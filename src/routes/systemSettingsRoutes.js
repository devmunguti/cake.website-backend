import express from 'express';
import {
  getPublicSettings,
  getAllSettings,
  updateSystemSettings
} from '../controllers/systemSettingsController.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public
router.get('/public', getPublicSettings);

// Admin
router.get('/', authenticate, authorizeRoles('admin'), getAllSettings);
router.put('/', authenticate, authorizeRoles('admin'), updateSystemSettings);

export default router;
