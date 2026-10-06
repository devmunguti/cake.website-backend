import express from 'express';
import {
  getReviews,
  createReview,
  replyToReview,
  togglePublishReview,
  deleteReview
} from '../controllers/reviewController.js';
import { authenticate, authorizeRoles, optionalAuthenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public
router.get('/', getReviews);
router.post('/', optionalAuthenticate, createReview);

// Admin
router.patch('/:id/reply', authenticate, authorizeRoles('admin'), replyToReview);
router.patch('/:id/toggle-publish', authenticate, authorizeRoles('admin'), togglePublishReview);
router.delete('/:id', authenticate, authorizeRoles('admin'), deleteReview);

export default router;
