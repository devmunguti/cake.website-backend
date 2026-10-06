import Promotion from '../models/Promotion.js';
import { createAuditLog } from '../services/auditLogService.js';

/**
 * POST /api/promotions/validate
 * Public: Validate promo code and calculate discount for current cart subtotal
 */
export const validatePromotion = async (req, res, next) => {
  try {
    const { code, orderAmount = 0 } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Promo code is required.' });
    }

    const promo = await Promotion.findOne({
      code: code.trim().toUpperCase(),
      isActive: true
    });

    if (!promo) {
      return res.status(404).json({ success: false, message: 'Invalid or expired promotion code.' });
    }

    const amount = Number(orderAmount) || 0;
    if (!promo.isValid(amount)) {
      if (promo.minOrderAmount && amount < promo.minOrderAmount) {
        return res.status(400).json({
          success: false,
          message: `This coupon requires a minimum cake order of KES ${promo.minOrderAmount}.`
        });
      }
      return res.status(400).json({ success: false, message: 'This coupon is not valid for your order.' });
    }

    let calculatedDiscount = 0;
    if (promo.discountType === 'percentage') {
      calculatedDiscount = (amount * promo.discountValue) / 100;
      if (promo.maxDiscountAmount) {
        calculatedDiscount = Math.min(calculatedDiscount, promo.maxDiscountAmount);
      }
    } else {
      calculatedDiscount = Math.min(promo.discountValue, amount);
    }

    return res.status(200).json({
      success: true,
      message: `Coupon "${promo.code}" applied successfully!`,
      data: {
        code: promo.code,
        title: promo.title,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        calculatedDiscount: Math.round(calculatedDiscount)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/promotions
 * Public: Get active public promotions and banners
 */
export const getPromotions = async (req, res, next) => {
  try {
    const now = new Date();
    const query = { isActive: true, endDate: { $gte: now } };

    const promotions = await Promotion.find(query).sort({ discountValue: -1 }).lean();

    return res.status(200).json({
      success: true,
      count: promotions.length,
      data: promotions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/promotions
 * Admin: Get all promotions
 */
export const getAdminPromotions = async (req, res, next) => {
  try {
    const promotions = await Promotion.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json({
      success: true,
      data: promotions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/promotions
 * Admin: Create new promotion
 */
export const createPromotion = async (req, res, next) => {
  try {
    const {
      code,
      title,
      description,
      discountType = 'percentage',
      discountValue,
      minOrderAmount = 0,
      maxDiscountAmount,
      startDate,
      endDate,
      usageLimit = 100,
      isActive = true
    } = req.body;

    if (!code || !title || discountValue === undefined || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Code, title, discount value, and end date are required.'
      });
    }

    const normalizedCode = code.trim().toUpperCase();
    const existing = await Promotion.findOne({ code: normalizedCode });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A promotion with this code already exists.' });
    }

    const promo = await Promotion.create({
      code: normalizedCode,
      title: title.trim(),
      description: description || '',
      discountType,
      discountValue: Number(discountValue),
      minOrderAmount: Number(minOrderAmount) || 0,
      maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: new Date(endDate),
      usageLimit: Number(usageLimit) || 100,
      isActive: !!isActive
    });

    await createAuditLog({
      user: req.user?.id,
      userName: req.user?.fullName || 'Admin',
      role: 'admin',
      action: 'Promotion Created',
      details: `Created promo code ${promo.code} (${promo.discountValue}${promo.discountType === 'percentage' ? '%' : ' KES'} off)`,
      category: 'Promotion',
      status: 'Success',
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: 'Promotion created successfully',
      data: promo
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/promotions/:id
 */
export const deletePromotion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const promo = await Promotion.findById(id);
    if (!promo) {
      return res.status(404).json({ success: false, message: 'Promotion not found' });
    }

    await Promotion.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Promotion deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
