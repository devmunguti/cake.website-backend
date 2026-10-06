import Review from '../models/Review.js';
import Order from '../models/Order.js';
import Cake from '../models/Cake.js';
import { createAuditLog } from '../services/auditLogService.js';

/**
 * GET /api/reviews
 * Public: Get published bakery and cake reviews
 */
export const getReviews = async (req, res, next) => {
  try {
    const { cakeId, rating, featured, page = 1, limit = 20 } = req.query;
    const query = { isPublished: true };

    if (cakeId) {
      query.cake = cakeId;
    }
    if (rating) {
      query.rating = Number(rating);
    }
    if (featured === 'true') {
      query.isFeatured = true;
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (currentPage - 1) * pageLimit;

    const [reviews, total, aggregateStats] = await Promise.all([
      Review.find(query)
        .populate('cake', 'name slug images')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),
      Review.countDocuments(query),
      Review.aggregate([
        { $match: { isPublished: true } },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
            fiveStars: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
            fourStars: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
            threeStars: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
            twoStars: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
            oneStar: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } }
          }
        }
      ])
    ]);

    const stats = aggregateStats[0] || {
      averageRating: 5.0,
      totalReviews: 0,
      fiveStars: 0,
      fourStars: 0,
      threeStars: 0,
      twoStars: 0,
      oneStar: 0
    };

    const totalPages = Math.ceil(total / pageLimit) || 1;

    return res.status(200).json({
      success: true,
      data: reviews,
      stats,
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
 * POST /api/reviews
 * Customer: Submit review for a completed order
 */
export const createReview = async (req, res, next) => {
  try {
    const { orderRef, rating, comment, images = [], occasion } = req.body;

    if (!orderRef || !rating) {
      return res.status(400).json({ success: false, message: 'Order reference and star rating (1-5) are required.' });
    }

    const starRating = Number(rating);
    if (isNaN(starRating) || starRating < 1 || starRating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be a number between 1 and 5.' });
    }

    let order = await Order.findOne({
      $or: [{ orderNumber: orderRef }, { orderRef: orderRef }, { _id: orderRef.match(/^[0-9a-fA-F]{24}$/) ? orderRef : null }]
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order reference not found. Please enter a valid order number.' });
    }

    // Check for duplicate review
    const existing = await Review.findOne({ order: order._id });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You have already submitted a review for this order. Thank you!' });
    }

    const firstItem = order.items?.[0];

    const review = await Review.create({
      order: order._id,
      orderNumber: order.orderNumber,
      cake: firstItem?.cake || null,
      cakeName: firstItem?.cakeNameSnapshot || 'Artisanal Cake',
      customer: order.customer || req.user?.id || null,
      customerName: order.customerDetails?.fullName || 'Customer',
      rating: starRating,
      comment: (comment || '').trim(),
      images: Array.isArray(images) ? images : [],
      occasion: occasion || 'Celebration',
      isPublished: true
    });

    // Update Cake average rating if cake is referenced
    if (firstItem?.cake) {
      const cakeReviews = await Review.find({ cake: firstItem.cake, isPublished: true });
      const avg = cakeReviews.reduce((sum, r) => sum + r.rating, 0) / cakeReviews.length;
      await Cake.findByIdAndUpdate(firstItem.cake, {
        rating: Math.round(avg * 10) / 10,
        reviewsCount: cakeReviews.length
      });
    }

    await createAuditLog({
      user: req.user?.id || null,
      userName: order.customerDetails?.fullName || 'Customer',
      role: 'customer',
      action: 'Review Submitted',
      details: `Submitted ${starRating}-star review for order ${order.orderNumber}`,
      category: 'Other',
      status: 'Success',
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: 'Thank you for your review! Your feedback helps us bake even better cakes.',
      data: review
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/reviews/:id/reply
 * Admin: Reply to customer review
 */
export const replyToReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { replyText } = req.body;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    review.adminReply = {
      text: replyText || '',
      repliedAt: new Date()
    };
    await review.save();

    return res.status(200).json({
      success: true,
      message: 'Reply posted successfully.',
      data: review
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/reviews/:id/toggle-publish
 */
export const togglePublishReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    review.isPublished = !review.isPublished;
    await review.save();

    return res.status(200).json({
      success: true,
      message: `Review is now ${review.isPublished ? 'published' : 'hidden'}`,
      isPublished: review.isPublished
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/reviews/:id
 */
export const deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    await Review.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Review deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};
