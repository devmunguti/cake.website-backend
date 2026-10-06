import express from 'express';
import {
  register,
  login,
  logout,
  getCurrentUser,
  updateProfile,
  changePassword,
  getAdminCustomers
} from '../controllers/authController.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Authenticated user
router.get('/me', authenticate, getCurrentUser);
router.put('/profile', authenticate, updateProfile);
router.put('/change-password', authenticate, changePassword);

// Admin
router.get('/customers', authenticate, authorizeRoles('admin'), getAdminCustomers);

export default router;
