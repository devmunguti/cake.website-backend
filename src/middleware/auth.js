// Authoritative authentication middleware exported from authMiddleware.js
export { authenticate, optionalAuthenticate, authorizeRoles } from './authMiddleware.js';
export { generateAccessToken as generateToken, verifyAccessToken as verifyToken } from '../utils/generateToken.js';

