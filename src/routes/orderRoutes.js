import express from 'express';
import {
  createOrder,
  getCustomerOrders,
  getOrderByRef,
  getAdminOrders,
  updateOrderStatus,
  getAdminDashboardStats
} from '../controllers/orderController.js';
import { authenticate, authorizeRoles, optionalAuthenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Customer / Public routes
router.post('/', optionalAuthenticate, createOrder);
router.get('/my-orders', authenticate, getCustomerOrders);
router.get('/track/:orderRef', getOrderByRef);
router.get('/:orderRef', optionalAuthenticate, getOrderByRef);

// Admin routes
router.get('/admin/dashboard-stats', authenticate, authorizeRoles('admin'), getAdminDashboardStats);
router.get('/admin/all', authenticate, authorizeRoles('admin'), getAdminOrders);
router.patch('/admin/:id/status', authenticate, authorizeRoles('admin'), updateOrderStatus);

export default router;
