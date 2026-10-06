import express from 'express';
import { getCakes, getCakeBySlug } from '../controllers/cakeController.js';

const router = express.Router();

// Forward legacy /api/services requests to cakes
router.get('/', getCakes);
router.get('/:slug', getCakeBySlug);

export default router;
