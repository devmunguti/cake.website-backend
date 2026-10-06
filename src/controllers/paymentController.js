import Payment from '../models/Payment.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { initiateMpesaPayment, checkPaymentStatus as checkPayheroApiStatus } from '../services/payheroService.js';
import { createAuditLog } from '../services/auditLogService.js';
import { notificationDispatcher } from '../services/notification/notificationDispatcher.js';
import { NOTIFICATION_EVENTS } from '../services/notification/notificationEvents.js';

/**
 * POST /api/payments/initiate
 * Customer: Initiates M-Pesa STK push via PayHero for an active cake order
 */
export const initiatePayment = async (req, res, next) => {
  try {
    const { orderId, phoneNumber } = req.body;

    if (!orderId || !phoneNumber) {
      return res.status(400).json({ success: false, message: 'Order ID and M-Pesa phone number are required.' });
    }

    let order = null;
    if (orderId.match(/^[0-9a-fA-F]{24}$/)) {
      order = await Order.findById(orderId);
    }
    if (!order) {
      order = await Order.findOne({
        $or: [{ orderNumber: orderId }, { orderRef: orderId }]
      });
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.paymentStatus === 'PAID') {
      return res.status(400).json({ success: false, message: 'This order is already fully paid.' });
    }

    const authoritativeAmount = order.pricing.grandTotal;
    if (authoritativeAmount <= 0) {
      // Free order / 100% coupon
      order.paymentStatus = 'PAID';
      order.orderStatus = 'PAYMENT_CONFIRMED';
      order.status = 'PAYMENT_CONFIRMED';
      await order.save();
      return res.status(200).json({
        success: true,
        message: 'Order confirmed without charge.',
        data: { paymentStatus: 'PAID' }
      });
    }

    const paymentRef = `CAKE-${order.orderNumber}-${Date.now().toString().slice(-4)}`;

    // Call PayHero gateway
    const payheroRes = await initiateMpesaPayment({
      amount: authoritativeAmount,
      phoneNumber,
      reference: paymentRef,
      description: `Payment for Cake Order ${order.orderNumber}`
    });

    // Check for existing pending payment record
    let payment = await Payment.findOne({ order: order._id, status: { $in: ['pending', 'processing'] } });
    if (!payment) {
      payment = new Payment({
        order: order._id,
        orderNumber: order.orderNumber,
        orderId: order.orderNumber,
        customer: order.customer || req.user?.id || null,
        customerName: order.customerDetails?.fullName || 'Customer',
        customerEmail: order.customerDetails?.email || '',
        customerPhone: phoneNumber,
        method: 'mpesa',
        status: 'processing',
        amount: authoritativeAmount,
        currency: 'KES',
        payheroReference: payheroRes.payheroReference,
        phoneNumber,
        gatewayMeta: payheroRes.rawResponse || {}
      });
    } else {
      payment.payheroReference = payheroRes.payheroReference;
      payment.phoneNumber = phoneNumber;
      payment.status = 'processing';
      payment.gatewayMeta = payheroRes.rawResponse || {};
    }

    await payment.save();

    await createAuditLog({
      user: req.user?.id || null,
      userName: order.customerDetails?.fullName || 'Customer',
      role: req.user?.role || 'customer',
      action: 'Payment Initiated',
      details: `Initiated M-Pesa STK Push of KES ${authoritativeAmount} for order ${order.orderNumber}`,
      category: 'Payment',
      status: 'Success',
      ipAddress: req.ip
    });

    return res.status(200).json({
      success: true,
      message: 'M-Pesa STK Push prompt sent to your phone. Please enter your M-Pesa PIN to complete payment.',
      data: {
        paymentId: payment._id,
        payheroReference: payment.payheroReference,
        orderNumber: order.orderNumber,
        amount: authoritativeAmount
      }
    });
  } catch (error) {
    console.error('❌ Payment Initiation Error:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Payment initiation failed. Please try again.'
    });
  }
};

/**
 * POST /api/payments/payhero/callback
 * Webhook: PayHero instant payment notification with idempotency verification
 */
export const handlePayheroCallback = async (req, res, next) => {
  try {
    const payload = req.body?.response || req.body;
    console.log('📥 PayHero Webhook Received:', JSON.stringify(payload));

    const externalRef = payload.external_reference || payload.ExternalReference || payload.reference;
    const checkoutRequestId = payload.CheckoutRequestID || payload.checkout_request_id || payload.payhero_reference;
    const isSuccess = payload.status === 'SUCCESS' || payload.Status === 'SUCCESS' || payload.success === true || payload.ResultCode === 0;
    const amountPaid = Number(payload.amount || payload.Amount || 0);
    const mpesaReceipt = payload.MpesaReceiptNumber || payload.mpesa_receipt_number || payload.transaction_id;

    // Locate matching payment record
    let payment = null;
    if (externalRef) {
      payment = await Payment.findOne({ payheroReference: externalRef });
    }
    if (!payment && checkoutRequestId) {
      payment = await Payment.findOne({ payheroReference: checkoutRequestId });
    }
    if (!payment && externalRef && externalRef.includes('CAKE-')) {
      const match = externalRef.match(/CAKE-(ORD-\d+)/i);
      if (match) {
        payment = await Payment.findOne({ orderNumber: match[1] }).sort({ createdAt: -1 });
      }
    }

    if (!payment) {
      console.warn('⚠️ No matching payment record found for PayHero callback:', externalRef || checkoutRequestId);
      return res.status(200).json({ success: true, message: 'Callback received but no matching payment found.' });
    }

    // Idempotency check: If already marked as paid, return 200 without duplicate execution
    if (payment.status.toLowerCase() === 'paid') {
      return res.status(200).json({ success: true, message: 'Payment already processed.' });
    }

    const order = await Order.findById(payment.order);

    if (isSuccess) {
      payment.status = 'paid';
      payment.paidAt = new Date();
      payment.transactionId = mpesaReceipt || `MPESA-${Date.now()}`;
      payment.gatewayMeta = payload;
      await payment.save();

      if (order) {
        order.paymentStatus = 'PAID';
        if (order.orderStatus === 'PENDING_PAYMENT') {
          order.orderStatus = 'PAYMENT_CONFIRMED';
          order.status = 'PAYMENT_CONFIRMED';
        }
        order.timeline.push({
          status: 'PAYMENT_CONFIRMED',
          timestamp: new Date(),
          note: `Payment of KES ${amountPaid || payment.amount} confirmed via M-Pesa (${payment.transactionId})`
        });
        await order.save();

        // Dispatch payment success notifications
        try {
          await notificationDispatcher.dispatch({
            event: NOTIFICATION_EVENTS.PAYMENT_SUCCESS,
            recipient: {
              email: order.customerDetails?.email,
              phone: order.customerDetails?.phone,
              userId: order.customer
            },
            data: {
              orderNumber: order.orderNumber,
              amount: payment.amount,
              transactionId: payment.transactionId,
              customerName: order.customerDetails?.fullName
            }
          });
        } catch (notifErr) {
          console.warn('⚠️ Notification error on payment callback:', notifErr.message);
        }
      }

      await createAuditLog({
        user: payment.customer,
        userName: payment.customerName || 'Customer',
        role: 'customer',
        action: 'Payment Success',
        details: `M-Pesa payment of KES ${payment.amount} completed for order ${payment.orderNumber} (Receipt: ${payment.transactionId})`,
        category: 'Payment',
        status: 'Success',
        ipAddress: req.ip
      });
    } else {
      payment.status = 'failed';
      payment.failedAt = new Date();
      payment.failureReason = payload.ResultDesc || payload.error || 'Payment declined or cancelled by user.';
      payment.gatewayMeta = payload;
      await payment.save();

      if (order && order.paymentStatus !== 'PAID') {
        order.paymentStatus = 'FAILED';
        order.timeline.push({
          status: 'PAYMENT_FAILED',
          timestamp: new Date(),
          note: `M-Pesa payment failed: ${payment.failureReason}`
        });
        await order.save();
      }

      await createAuditLog({
        user: payment.customer,
        userName: payment.customerName || 'Customer',
        role: 'customer',
        action: 'Payment Failed',
        details: `M-Pesa payment failed for order ${payment.orderNumber}: ${payment.failureReason}`,
        category: 'Payment',
        status: 'Failed',
        ipAddress: req.ip
      });
    }

    return res.status(200).json({ success: true, message: 'Callback processed successfully.' });
  } catch (error) {
    console.error('❌ Error processing PayHero callback:', error);
    return res.status(200).json({ success: false, message: 'Error processing callback' });
  }
};

/**
 * GET /api/payments/status/:orderId
 * Polling endpoint for frontend checkout modal
 */
export const getPaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    let order = null;
    if (orderId.match(/^[0-9a-fA-F]{24}$/)) {
      order = await Order.findById(orderId);
    }
    if (!order) {
      order = await Order.findOne({
        $or: [{ orderNumber: orderId }, { orderRef: orderId }]
      });
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const latestPayment = await Payment.findOne({ order: order._id }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        payment: latestPayment ? {
          status: latestPayment.status,
          amount: latestPayment.amount,
          transactionId: latestPayment.transactionId,
          paidAt: latestPayment.paidAt
        } : null
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/payments
 * Admin: Get paginated payment transactions ledger
 */
export const getAdminPayments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, method, search, startDate, endDate } = req.query;

    const query = {};

    if (status && status !== 'All') {
      query.status = new RegExp(status, 'i');
    }
    if (method && method !== 'All') {
      query.method = method.toLowerCase();
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { orderNumber: searchRegex },
        { customerName: searchRegex },
        { customerEmail: searchRegex },
        { customerPhone: searchRegex },
        { transactionId: searchRegex },
        { payheroReference: searchRegex }
      ];
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (currentPage - 1) * pageLimit;

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate('order', 'orderNumber orderStatus pricing scheduledDate')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),
      Payment.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / pageLimit) || 1;

    return res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        page: currentPage,
        limit: pageLimit,
        total,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/payments/manual-verify
 * Admin: Manually verify payment (e.g. cash on delivery or direct till payment)
 */
export const verifyPaymentManual = async (req, res, next) => {
  try {
    const { orderId, transactionId, method = 'mpesa', note } = req.body;

    let order = await Order.findById(orderId);
    if (!order) {
      order = await Order.findOne({ orderNumber: orderId });
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    let payment = await Payment.findOne({ order: order._id }).sort({ createdAt: -1 });
    if (!payment) {
      payment = new Payment({
        order: order._id,
        orderNumber: order.orderNumber,
        customer: order.customer,
        customerName: order.customerDetails?.fullName,
        customerEmail: order.customerDetails?.email,
        customerPhone: order.customerDetails?.phone,
        amount: order.pricing.grandTotal,
        method
      });
    }

    payment.status = 'paid';
    payment.paidAt = new Date();
    payment.transactionId = transactionId || `MANUAL-${Date.now()}`;
    await payment.save();

    order.paymentStatus = 'PAID';
    if (order.orderStatus === 'PENDING_PAYMENT') {
      order.orderStatus = 'PAYMENT_CONFIRMED';
      order.status = 'PAYMENT_CONFIRMED';
    }
    order.timeline.push({
      status: 'PAYMENT_CONFIRMED',
      timestamp: new Date(),
      note: note || `Payment verified manually by Admin (${payment.transactionId})`
    });
    await order.save();

    await createAuditLog({
      user: req.user?.id,
      userName: req.user?.fullName || 'Admin',
      role: 'admin',
      action: 'Payment Manually Verified',
      details: `Manually verified payment of KES ${order.pricing.grandTotal} for order ${order.orderNumber} (Ref: ${payment.transactionId})`,
      category: 'Payment',
      status: 'Success',
      ipAddress: req.ip
    });

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully.',
      data: { order, payment }
    });
  } catch (error) {
    next(error);
  }
};
