import express from 'express';
import {
  getCakes,
  getFeaturedCakes,
  getCakeBySlug,
  createCake,
  updateCake,
  deleteCake,
  toggleAvailability,
  toggleFeatured
} from '../controllers/cakeController.js';
import { authenticate, authorizeRoles, optionalAuthenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', optionalAuthenticate, getCakes);
router.get('/featured', getFeaturedCakes);
router.get('/:slug', getCakeBySlug);

// Admin protected routes
router.post('/', authenticate, authorizeRoles('admin'), createCake);
router.put('/:id', authenticate, authorizeRoles('admin'), updateCake);
router.delete('/:id', authenticate, authorizeRoles('admin'), deleteCake);
router.patch('/:id/toggle-availability', authenticate, authorizeRoles('admin'), toggleAvailability);
router.patch('/:id/toggle-featured', authenticate, authorizeRoles('admin'), toggleFeatured);

export default router;
