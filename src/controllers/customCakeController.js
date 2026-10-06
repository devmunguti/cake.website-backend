import CustomCakeRequest, { generateNextCustomCakeRef } from '../models/CustomCakeRequest.js';
import Order, { generateNextOrderRef } from '../models/Order.js';
import Cake from '../models/Cake.js';
import { createAuditLog } from '../services/auditLogService.js';
import { notificationDispatcher } from '../services/notification/notificationDispatcher.js';
import { NOTIFICATION_EVENTS } from '../services/notification/notificationEvents.js';

/**
 * POST /api/custom-cake-requests
 * Customer / Guest: Submit a bespoke custom cake inquiry
 */
export const createCustomCakeRequest = async (req, res, next) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      eventType = 'Birthday',
      numberOfGuests = 20,
      preferredSize = '2.0 KG',
      preferredFlavour = 'Vanilla & Chocolate',
      preferredFillings,
      preferredColors,
      designRequirements,
      eventDate,
      budget = 0,
      referenceImages = [],
      specialInstructions,
      deliveryMethod = 'DELIVERY',
      deliveryAddress
    } = req.body;

    if (!customerName || !customerEmail || !customerPhone || !designRequirements || !eventDate) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, phone number, event date, and design requirements are required.'
      });
    }

    const requestRef = await generateNextCustomCakeRef();

    const request = await CustomCakeRequest.create({
      requestRef,
      customer: req.user?.id || null,
      customerName: customerName.trim(),
      customerEmail: customerEmail.toLowerCase().trim(),
      customerPhone: customerPhone.trim(),
      eventType: eventType.trim(),
      numberOfGuests: Number(numberOfGuests) || 20,
      preferredSize: preferredSize.trim(),
      preferredFlavour: preferredFlavour.trim(),
      preferredFillings: preferredFillings || '',
      preferredColors: preferredColors || '',
      designRequirements: designRequirements.trim(),
      eventDate: new Date(eventDate),
      budget: Number(budget) || 0,
      referenceImages: Array.isArray(referenceImages) ? referenceImages : [],
      specialInstructions: specialInstructions || '',
      deliveryMethod,
      deliveryAddress: deliveryAddress || '',
      status: 'PENDING'
    });

    await createAuditLog({
      user: req.user?.id || null,
      userName: customerName,
      role: req.user?.role || 'customer',
      action: 'Custom Cake Request Created',
      details: `Submitted custom cake inquiry ${request.requestRef} for ${request.eventType} (${request.preferredSize})`,
      category: 'Custom Cake',
      status: 'Success',
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: 'Your custom cake request has been submitted! Our baker will review your requirements and provide a tailored quote within 24 hours.',
      data: request
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/custom-cake-requests
 * Admin: Get all custom cake inquiries
 */
export const getCustomCakeRequests = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status && status !== 'All') {
      query.status = status.toUpperCase();
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { requestRef: searchRegex },
        { customerName: searchRegex },
        { customerEmail: searchRegex },
        { customerPhone: searchRegex },
        { eventType: searchRegex }
      ];
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (currentPage - 1) * pageLimit;

    const [requests, total] = await Promise.all([
      CustomCakeRequest.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),
      CustomCakeRequest.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / pageLimit) || 1;

    return res.status(200).json({
      success: true,
      data: requests,
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
 * GET /api/custom-cake-requests/:idOrRef
 */
export const getCustomCakeRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let doc = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      doc = await CustomCakeRequest.findById(id);
    }
    if (!doc) {
      doc = await CustomCakeRequest.findOne({ requestRef: id });
    }

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Custom cake request not found' });
    }

    return res.status(200).json({
      success: true,
      data: doc
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/custom-cake-requests/:id/quote
 * Admin: Provide quote for custom cake
 */
export const provideCustomCakeQuote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quoteAmount, quoteNotes, validityDays = 7, adminNotes } = req.body;

    if (!quoteAmount || Number(quoteAmount) <= 0) {
      return res.status(400).json({ success: false, message: 'A valid quote amount is required.' });
    }

    const request = await CustomCakeRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Custom cake request not found' });
    }

    const expiresAt = new Date(Date.now() + (Number(validityDays) || 7) * 24 * 60 * 60 * 1000);

    request.quoteAmount = Number(quoteAmount);
    request.quoteNotes = quoteNotes || '';
    request.quoteExpiresAt = expiresAt;
    request.status = 'QUOTE_SENT';
    if (adminNotes) request.adminNotes = adminNotes;

    await request.save();

    await createAuditLog({
      user: req.user?.id,
      userName: req.user?.fullName || 'Admin',
      role: req.user?.role || 'admin',
      action: 'Custom Cake Quote Sent',
      details: `Provided quote KES ${request.quoteAmount} for request ${request.requestRef}`,
      category: 'Custom Cake',
      status: 'Success',
      ipAddress: req.ip
    });

    return res.status(200).json({
      success: true,
      message: 'Quote sent successfully to customer',
      data: request
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/custom-cake-requests/:id/response
 * Customer responds: ACCEPTED or REJECTED
 */
export const respondToCustomCakeQuote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'ACCEPT' or 'REJECT'

    const request = await CustomCakeRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Custom cake request not found' });
    }

    if (request.status !== 'QUOTE_SENT') {
      return res.status(400).json({ success: false, message: `Cannot respond to quote in status ${request.status}` });
    }

    if (action === 'ACCEPT') {
      request.status = 'ACCEPTED';
      await request.save();
      return res.status(200).json({
        success: true,
        message: 'You have accepted the quotation. The bakery will prepare your custom order!',
        data: request
      });
    } else if (action === 'REJECT') {
      request.status = 'REJECTED';
      await request.save();
      return res.status(200).json({
        success: true,
        message: 'You have declined the quotation.',
        data: request
      });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action. Must be ACCEPT or REJECT.' });
    }
  } catch (error) {
    next(error);
  }
};
