import express from 'express';
import {
  getCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/categoryController.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', getCategories);
router.get('/:slug', getCategoryBySlug);

// Admin routes
router.post('/', authenticate, authorizeRoles('admin'), createCategory);
router.put('/:id', authenticate, authorizeRoles('admin'), updateCategory);
router.delete('/:id', authenticate, authorizeRoles('admin'), deleteCategory);

export default router;
