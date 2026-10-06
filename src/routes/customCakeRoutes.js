import express from 'express';
import {
  createCustomCakeRequest,
  getCustomCakeRequests,
  getCustomCakeRequestById,
  provideCustomCakeQuote,
  respondToCustomCakeQuote
} from '../controllers/customCakeController.js';
import { authenticate, authorizeRoles, optionalAuthenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public / Customer submission
router.post('/', optionalAuthenticate, createCustomCakeRequest);
router.get('/:id', optionalAuthenticate, getCustomCakeRequestById);
router.patch('/:id/response', optionalAuthenticate, respondToCustomCakeQuote);

// Admin management
router.get('/', authenticate, authorizeRoles('admin'), getCustomCakeRequests);
router.patch('/:id/quote', authenticate, authorizeRoles('admin'), provideCustomCakeQuote);

export default router;
