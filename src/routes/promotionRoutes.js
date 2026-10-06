import express from 'express';
import {
  validatePromotion,
  getPromotions,
  getAdminPromotions,
  createPromotion,
  deletePromotion
} from '../controllers/promotionController.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public
router.post('/validate', validatePromotion);
router.get('/active', getPromotions);
router.get('/', getPromotions);

// Admin
router.get('/admin/all', authenticate, authorizeRoles('admin'), getAdminPromotions);
router.post('/admin', authenticate, authorizeRoles('admin'), createPromotion);
router.delete('/admin/:id', authenticate, authorizeRoles('admin'), deletePromotion);

export default router;
