import Order, { generateNextOrderRef } from '../models/Order.js';
import Cake from '../models/Cake.js';
import Promotion from '../models/Promotion.js';
import SystemSetting from '../models/SystemSetting.js';
import { createAuditLog } from '../services/auditLogService.js';
import { notificationDispatcher } from '../services/notification/notificationDispatcher.js';
import { NOTIFICATION_EVENTS } from '../services/notification/notificationEvents.js';

// Order Status Transition Rules Matrix
export const VALID_ORDER_TRANSITIONS = {
  PENDING_PAYMENT: ['PAYMENT_CONFIRMED', 'ORDER_CONFIRMED', 'CANCELLED'],
  PAYMENT_CONFIRMED: ['ORDER_CONFIRMED', 'PREPARING', 'CANCELLED'],
  ORDER_CONFIRMED: ['PREPARING', 'BAKING', 'CANCELLED'],
  PREPARING: ['BAKING', 'CANCELLED'],
  BAKING: ['DECORATING', 'CANCELLED'],
  DECORATING: ['READY', 'PICKUP_READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'COMPLETED'],
  DELIVERED: ['COMPLETED'],
  PICKUP_READY: ['PICKED_UP', 'COMPLETED'],
  PICKED_UP: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: []
};

/**
 * POST /api/orders
 * Public / Customer: Create new cake order with authoritative server-side price calculation
 */
export const createOrder = async (req, res, next) => {
  try {
    const {
      items,
      customerDetails,
      deliveryMethod = 'DELIVERY',
      deliveryAddress,
      scheduledDate,
      scheduledTimeSlot = '10:00 AM - 12:00 PM',
      promoCode,
      notes
    } = req.body;

    // 1. Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Your cart is empty. Please add cakes to place an order.' });
    }

    if (!customerDetails || !customerDetails.fullName || !customerDetails.phone || !customerDetails.email) {
      return res.status(400).json({ success: false, message: 'Customer name, phone number, and email are required.' });
    }

    if (!scheduledDate) {
      return res.status(400).json({ success: false, message: 'Please select a delivery or pickup date.' });
    }

    // Lead time validation against system settings
    const systemSettings = await SystemSetting.findOne().lean();
    const minLeadHours = systemSettings?.bakeryOperations?.minimumLeadTimeHours || 24;
    const orderDate = new Date(scheduledDate);
    const minAllowedDate = new Date(Date.now() + minLeadHours * 60 * 60 * 1000 - 5 * 60 * 1000); // 5 min grace

    if (orderDate < minAllowedDate) {
      return res.status(400).json({
        success: false,
        message: `Our artisanal cakes require at least ${minLeadHours} hours preparation lead time. Please choose a date after ${minAllowedDate.toLocaleDateString()}.`
      });
    }

    // 2. Server-side authoritative validation and price recalculation
    const processedItems = [];
    let calculatedSubtotal = 0;

    for (const item of items) {
      const targetCakeId = item.cakeId || item.cake;
      if (!targetCakeId || !String(targetCakeId).match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ success: false, message: 'Invalid cake selected.' });
      }

      const dbCake = await Cake.findById(targetCakeId);
      if (!dbCake || !dbCake.available) {
        return res.status(400).json({
          success: false,
          message: `Cake "${item.cakeName || 'Selected cake'}" is currently unavailable or out of season.`
        });
      }

      // Calculate unit price from base price + option adjustments
      let unitPrice = dbCake.basePrice;

      // Size adjustment
      let selectedSize = { name: '1.0 KG', weightKg: 1.0, priceAdjustment: 0 };
      if (item.size && item.size.name) {
        const foundSize = dbCake.sizes?.find(s => s.name === item.size.name);
        if (foundSize) {
          selectedSize = {
            name: foundSize.name,
            weightKg: foundSize.weightKg,
            priceAdjustment: foundSize.priceAdjustment || 0
          };
          unitPrice += selectedSize.priceAdjustment;
        }
      }

      // Flavour adjustment
      let selectedFlavour = { name: 'Classic Vanilla', priceAdjustment: 0 };
      if (item.flavour && item.flavour.name) {
        const foundFlavour = dbCake.flavours?.find(f => f.name === item.flavour.name);
        if (foundFlavour) {
          selectedFlavour = {
            name: foundFlavour.name,
            priceAdjustment: foundFlavour.priceAdjustment || 0
          };
          unitPrice += selectedFlavour.priceAdjustment;
        }
      }

      // Filling adjustment
      let selectedFilling = { name: 'Vanilla Buttercream', priceAdjustment: 0 };
      if (item.filling && item.filling.name) {
        const foundFilling = dbCake.fillings?.find(f => f.name === item.filling.name);
        if (foundFilling) {
          selectedFilling = {
            name: foundFilling.name,
            priceAdjustment: foundFilling.priceAdjustment || 0
          };
          unitPrice += selectedFilling.priceAdjustment;
        }
      }

      // Decoration adjustment
      let selectedDecoration = { name: 'Standard Piping', priceAdjustment: 0 };
      if (item.decoration && item.decoration.name) {
        const foundDecoration = dbCake.decorationOptions?.find(d => d.name === item.decoration.name);
        if (foundDecoration) {
          selectedDecoration = {
            name: foundDecoration.name,
            priceAdjustment: foundDecoration.priceAdjustment || 0
          };
          unitPrice += selectedDecoration.priceAdjustment;
        }
      }

      const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
      const itemTotalPrice = unitPrice * quantity;
      calculatedSubtotal += itemTotalPrice;

      processedItems.push({
        cake: dbCake._id,
        cakeNameSnapshot: dbCake.name,
        cakeImageSnapshot: dbCake.images?.[0] || '',
        quantity,
        size: selectedSize,
        flavour: selectedFlavour,
        filling: selectedFilling,
        decoration: selectedDecoration,
        customMessage: (item.customMessage || '').trim(),
        specialInstructions: (item.specialInstructions || '').trim(),
        unitPrice,
        totalPrice: itemTotalPrice
      });
    }

    // 3. Calculate Delivery Fee & Promo Discount
    let deliveryFee = 0;
    if (deliveryMethod === 'DELIVERY') {
      const defaultFee = systemSettings?.bakeryOperations?.defaultDeliveryFee ?? 350;
      const freeThreshold = systemSettings?.bakeryOperations?.freeDeliveryThreshold ?? 6000;
      deliveryFee = calculatedSubtotal >= freeThreshold ? 0 : defaultFee;
    }

    let discountAmount = 0;
    let appliedPromoCode = '';
    if (promoCode && promoCode.trim()) {
      const promo = await Promotion.findOne({ code: promoCode.trim().toUpperCase(), isActive: true });
      if (promo && promo.isValid(calculatedSubtotal)) {
        appliedPromoCode = promo.code;
        if (promo.discountType === 'percentage') {
          discountAmount = (calculatedSubtotal * promo.discountValue) / 100;
          if (promo.maxDiscountAmount) {
            discountAmount = Math.min(discountAmount, promo.maxDiscountAmount);
          }
        } else {
          discountAmount = Math.min(promo.discountValue, calculatedSubtotal);
        }
        // Increment usage count
        promo.usageCount += 1;
        await promo.save();
      }
    }

    const grandTotal = Math.max(0, calculatedSubtotal + deliveryFee - discountAmount);
    const orderNumber = await generateNextOrderRef();

    // 4. Create Order document
    const newOrder = await Order.create({
      orderNumber,
      orderRef: orderNumber,
      customer: req.user?.id || null,
      customerDetails: {
        fullName: customerDetails.fullName.trim(),
        phone: customerDetails.phone.trim(),
        email: customerDetails.email.toLowerCase().trim()
      },
      items: processedItems,
      deliveryMethod,
      deliveryAddress: deliveryMethod === 'DELIVERY' ? deliveryAddress || {} : {},
      scheduledDate: orderDate,
      scheduledTimeSlot: scheduledTimeSlot.trim(),
      pricing: {
        subtotal: calculatedSubtotal,
        deliveryFee,
        discount: discountAmount,
        promoCode: appliedPromoCode,
        grandTotal
      },
      paymentStatus: 'PENDING',
      orderStatus: 'PENDING_PAYMENT',
      status: 'PENDING_PAYMENT',
      notes: notes || '',
      timeline: [
        {
          status: 'PENDING_PAYMENT',
          timestamp: new Date(),
          note: 'Cake order placed. Awaiting M-Pesa payment.'
        }
      ]
    });

    // 5. Audit log
    await createAuditLog({
      user: req.user?.id || null,
      userName: customerDetails.fullName,
      role: req.user?.role || 'customer',
      action: 'Order Placed',
      details: `Placed order ${newOrder.orderNumber} for KES ${newOrder.pricing.grandTotal} (${processedItems.length} cakes)`,
      category: 'Order',
      status: 'Success',
      ipAddress: req.ip
    });

    // 6. Notify customer & Admin
    try {
      await notificationDispatcher.dispatch({
        event: NOTIFICATION_EVENTS.ORDER_CREATED,
        recipient: {
          email: customerDetails.email,
          phone: customerDetails.phone,
          userId: req.user?.id
        },
        data: {
          orderNumber: newOrder.orderNumber,
          customerName: customerDetails.fullName,
          grandTotal: newOrder.pricing.grandTotal,
          deliveryMethod: newOrder.deliveryMethod,
          scheduledDate: newOrder.scheduledDate
        }
      });
    } catch (notifErr) {
      console.warn('⚠️ Order creation notification warning:', notifErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Cake order created successfully.',
      data: newOrder
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/orders/my-orders
 * Customer: Get orders for authenticated user
 */
export const getCustomerOrders = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Please login to view your orders.' });
    }

    const orders = await Order.find({ customer: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/orders/:orderRefOrId
 * Public / Tracking: Get order by orderNumber or ID
 */
export const getOrderByRef = async (req, res, next) => {
  try {
    const { orderRef } = req.params;

    let order = null;
    if (orderRef.match(/^[0-9a-fA-F]{24}$/)) {
      order = await Order.findById(orderRef).populate('items.cake', 'name slug images basePrice');
    }
    if (!order) {
      order = await Order.findOne({
        $or: [{ orderNumber: orderRef }, { orderRef: orderRef }]
      }).populate('items.cake', 'name slug images basePrice');
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Cake order not found' });
    }

    return res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/orders
 * Admin: Paginated order management with search and filters
 */
export const getAdminOrders = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      orderStatus,
      paymentStatus,
      deliveryMethod,
      search,
      startDate,
      endDate
    } = req.query;

    const query = {};

    if (orderStatus && orderStatus !== 'All') {
      query.$or = [{ orderStatus }, { status: orderStatus }];
    }
    if (paymentStatus && paymentStatus !== 'All') {
      query.paymentStatus = paymentStatus.toUpperCase();
    }
    if (deliveryMethod && deliveryMethod !== 'All') {
      query.deliveryMethod = deliveryMethod.toUpperCase();
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
        { orderRef: searchRegex },
        { 'customerDetails.fullName': searchRegex },
        { 'customerDetails.phone': searchRegex },
        { 'customerDetails.email': searchRegex }
      ];
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (currentPage - 1) * pageLimit;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('customer', 'fullName email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),
      Order.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / pageLimit) || 1;

    return res.status(200).json({
      success: true,
      data: orders,
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
 * PATCH /api/admin/orders/:id/status
 * Admin: Update bakery order status with state machine enforcement
 */
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Target order status is required.' });
    }

    const targetStatus = status.toUpperCase();
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const currentStatus = (order.orderStatus || order.status || 'PENDING_PAYMENT').toUpperCase();

    // Validate transition
    const allowedTransitions = VALID_ORDER_TRANSITIONS[currentStatus] || [];
    if (!allowedTransitions.includes(targetStatus) && targetStatus !== currentStatus) {
      return res.status(400).json({
        success: false,
        message: `Invalid order state transition from ${currentStatus} to ${targetStatus}. Allowed next states: [${allowedTransitions.join(', ')}]`
      });
    }

    order.orderStatus = targetStatus;
    order.status = targetStatus;

    if (targetStatus === 'PAYMENT_CONFIRMED' || targetStatus === 'COMPLETED' || targetStatus === 'DELIVERED') {
      if (order.paymentStatus === 'PENDING' && targetStatus !== 'CANCELLED') {
        order.paymentStatus = 'PAID';
      }
    }

    order.timeline.push({
      status: targetStatus,
      timestamp: new Date(),
      note: note || `Order status updated to ${targetStatus}`
    });

    await order.save();

    await createAuditLog({
      user: req.user?.id,
      userName: req.user?.fullName || 'Admin',
      role: req.user?.role || 'admin',
      action: 'Order Status Changed',
      details: `Changed status of order ${order.orderNumber} from ${currentStatus} to ${targetStatus}`,
      category: 'Order',
      status: 'Success',
      ipAddress: req.ip
    });

    // Send customer notification for milestone states
    try {
      await notificationDispatcher.dispatch({
        event: NOTIFICATION_EVENTS.ORDER_STATUS_UPDATED,
        recipient: {
          email: order.customerDetails?.email,
          phone: order.customerDetails?.phone,
          userId: order.customer
        },
        data: {
          orderNumber: order.orderNumber,
          customerName: order.customerDetails?.fullName,
          newStatus: targetStatus,
          note: note || ''
        }
      });
    } catch (notifErr) {
      console.warn('⚠️ Order status notification warning:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Order status successfully updated to ${targetStatus}`,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/orders/dashboard-stats
 * Admin: Real-time bakery overview KPIs and analytics
 */
export const getAdminDashboardStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      todayOrdersCount,
      pendingOrdersCount,
      bakingCount,
      readyCount,
      completedOrdersCount,
      todayRevenueAgg,
      monthlyRevenueAgg,
      totalCustomersCount,
      popularCakesAgg
    ] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: today } }),
      Order.countDocuments({ orderStatus: { $in: ['PENDING_PAYMENT', 'ORDER_CONFIRMED', 'PAYMENT_CONFIRMED'] } }),
      Order.countDocuments({ orderStatus: { $in: ['PREPARING', 'BAKING', 'DECORATING'] } }),
      Order.countDocuments({ orderStatus: { $in: ['READY', 'PICKUP_READY', 'OUT_FOR_DELIVERY'] } }),
      Order.countDocuments({ orderStatus: { $in: ['DELIVERED', 'PICKED_UP', 'COMPLETED'] } }),
      Order.aggregate([
        { $match: { paymentStatus: 'PAID', createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$pricing.grandTotal' } } }
      ]),
      Order.aggregate([
        { $match: { paymentStatus: 'PAID', createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$pricing.grandTotal' } } }
      ]),
      Order.distinct('customerDetails.email').then(arr => arr.length),
      Order.aggregate([
        { $unwind: '$items' },
        { $group: { _id: '$items.cakeNameSnapshot', count: { $sum: '$items.quantity' }, revenue: { $sum: '$items.totalPrice' } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ])
    ]);

    const todayRevenue = todayRevenueAgg[0]?.total || 0;
    const monthlyRevenue = monthlyRevenueAgg[0]?.total || 0;

    return res.status(200).json({
      success: true,
      data: {
        todayOrdersCount,
        pendingOrdersCount,
        bakingCount,
        readyCount,
        completedOrdersCount,
        todayRevenue,
        monthlyRevenue,
        totalCustomersCount,
        popularCakes: popularCakesAgg
      }
    });
  } catch (error) {
    next(error);
  }
};
