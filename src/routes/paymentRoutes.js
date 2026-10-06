import express from 'express';
import {
  initiatePayment,
  handlePayheroCallback,
  getPaymentStatus,
  getAdminPayments,
  verifyPaymentManual
} from '../controllers/paymentController.js';
import { authenticate, authorizeRoles, optionalAuthenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Customer payment endpoints
router.post('/initiate', optionalAuthenticate, initiatePayment);
router.post('/stkpush', optionalAuthenticate, initiatePayment);
router.get('/status/:orderId', getPaymentStatus);

// Webhooks
router.post('/payhero/callback', handlePayheroCallback);
router.post('/callback', handlePayheroCallback);

// Admin endpoints
router.get('/admin/records', authenticate, authorizeRoles('admin'), getAdminPayments);
router.get('/admin/all', authenticate, authorizeRoles('admin'), getAdminPayments);
router.post('/admin/manual-verify', authenticate, authorizeRoles('admin'), verifyPaymentManual);

export default router;
