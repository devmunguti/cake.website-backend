import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import morgan from 'morgan';
import dns from 'dns';
import mongoose from 'mongoose';

try {
  dns.setDefaultResultOrder?.('ipv4first');
} catch (e) { }

dotenv.config();

import { connectDB } from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import cakeRoutes from './routes/cakeRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import customCakeRoutes from './routes/customCakeRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import promotionRoutes from './routes/promotionRoutes.js';
import systemSettingsRoutes from './routes/systemSettingsRoutes.js';
import auditLogRoutes from './routes/auditLogRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { getPublicSettings } from './controllers/systemSettingsController.js';

import { maintenanceMiddleware } from './middleware/maintenanceMiddleware.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for reverse proxies / load balancers
app.set('trust proxy', 1);

// CORS configuration with credentials support
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://localhost:5173'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));

// Middlewares
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Root & Health Check Endpoints
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'cake-bakery-backend',
    name: 'Sweet Delights Bakery API',
    version: '1.0.0'
  });
});

app.get('/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: isDbConnected ? 'connected' : 'disconnected'
  });
});

app.get('/api/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    status: 'ok',
    message: 'Cake Bakery Platform Backend API is running smoothly',
    timestamp: new Date().toISOString(),
    database: isDbConnected ? 'connected' : 'disconnected'
  });
});

// Public System Settings Endpoint
app.get('/api/public/settings', getPublicSettings);

// API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/cakes', cakeRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/custom-cake-requests', customCakeRoutes);
app.use('/api/orders', maintenanceMiddleware, orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/admin/settings', systemSettingsRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/services', serviceRoutes); // Backward compatibility bridge

// 404 & Global Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

import { startNotificationScheduler } from './services/notification/notificationScheduler.js';
import { validateEmailConfiguration } from './services/email/emailProvider.js';

// Start server
async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🎂 Cake Bakery Platform Server listening on port ${PORT}`);
    validateEmailConfiguration(true);
    try {
      startNotificationScheduler();
    } catch (e) {
      console.warn('Notification scheduler init warning:', e.message);
    }
  });
}

startServer();

export { app, startServer };
export default app;
