import User from '../models/User.js';
import Order from '../models/Order.js';
import { generateAccessToken } from '../utils/generateToken.js';
import { createAuditLog } from '../services/auditLogService.js';
import { notificationDispatcher } from '../services/notification/notificationDispatcher.js';
import { NOTIFICATION_EVENTS } from '../services/notification/notificationEvents.js';

// Password Strength Validator (min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char)
const validatePasswordStrength = (password) => {
  const minLength = 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (!password || password.length < minLength) {
    return 'Password must be at least 8 characters long.';
  }
  if (!hasUpper) {
    return 'Password must contain at least 1 uppercase letter.';
  }
  if (!hasLower) {
    return 'Password must contain at least 1 lowercase letter.';
  }
  if (!hasNumber) {
    return 'Password must contain at least 1 number.';
  }
  if (!hasSpecial) {
    return 'Password must contain at least 1 special character.';
  }
  return null;
};

// Cookie Options Helper (7 Days persistent session with Cross-Origin support)
const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});

/**
 * POST /api/auth/register
 */
export const register = async (req, res, next) => {
  try {
    const { firstName, lastName, name, email, password, phone, role = 'customer' } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    let fName = firstName;
    let lName = lastName;
    if (!fName && name) {
      const parts = name.trim().split(' ');
      fName = parts[0];
      lName = parts.slice(1).join(' ') || '';
    }

    const userRole = role === 'admin' ? 'admin' : 'customer';

    const newUser = await User.create({
      firstName: fName || 'Customer',
      lastName: lName || '',
      fullName: name || `${fName || ''} ${lName || ''}`.trim(),
      email: normalizedEmail,
      phone: phone || '',
      passwordHash: password,
      role: userRole,
      status: 'Active',
      isActive: true,
      lastLogin: new Date()
    });

    const token = generateAccessToken(newUser);
    res.cookie('accessToken', token, getCookieOptions());

    await createAuditLog({
      user: newUser._id,
      userName: newUser.fullName,
      role: newUser.role,
      action: 'User Registered',
      details: `New customer account registered: ${newUser.email}`,
      category: 'Authentication',
      status: 'Success',
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully!',
      user: {
        id: newUser._id,
        _id: newUser._id,
        email: newUser.email,
        fullName: newUser.fullName,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        phone: newUser.phone,
        role: newUser.role,
        status: newUser.status
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!user.isActive || user.status === 'Suspended') {
      return res.status(403).json({ success: false, message: 'Your account is suspended. Please contact bakery support.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateAccessToken(user);
    res.cookie('accessToken', token, getCookieOptions());

    await createAuditLog({
      user: user._id,
      userName: user.fullName,
      role: user.role,
      action: 'User Login',
      details: `User logged in: ${user.email} (${user.role})`,
      category: 'Authentication',
      status: 'Success',
      ipAddress: req.ip
    });

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully!',
      user: {
        id: user._id,
        _id: user._id,
        email: user.email,
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 */
export const logout = async (req, res) => {
  res.clearCookie('accessToken', getCookieOptions());
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
};

/**
 * GET /api/auth/me
 */
export const getCurrentUser = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, authenticated: false, message: 'Not authenticated.' });
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.isActive) {
      res.clearCookie('accessToken', getCookieOptions());
      return res.status(401).json({ success: false, authenticated: false, message: 'User not found or inactive.' });
    }

    return res.status(200).json({
      success: true,
      authenticated: true,
      user: {
        id: user._id,
        _id: user._id,
        email: user.email,
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        status: user.status,
        addresses: user.addresses || []
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/auth/profile
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, fullName, phone, addresses } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (firstName) user.firstName = firstName.trim();
    if (lastName) user.lastName = lastName.trim();
    if (fullName) user.fullName = fullName.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (Array.isArray(addresses)) user.addresses = addresses;

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: user._id,
        _id: user._id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        addresses: user.addresses
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/auth/change-password
 */
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required.' });
    }

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }

    const user = await User.findById(req.user.id).select('+passwordHash');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password.' });
    }

    user.passwordHash = newPassword;
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/customers
 */
export const getAdminCustomers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = { role: { $in: ['customer', 'user'] } };

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ fullName: regex }, { email: regex }, { phone: regex }];
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (currentPage - 1) * pageLimit;

    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageLimit).lean(),
      User.countDocuments(query)
    ]);

    // Enhance users with order counts
    const enhanced = await Promise.all(
      users.map(async (u) => {
        const orderCount = await Order.countDocuments({ customer: u._id });
        const totalSpentAgg = await Order.aggregate([
          { $match: { customer: u._id, paymentStatus: 'PAID' } },
          { $group: { _id: null, total: { $sum: '$pricing.grandTotal' } } }
        ]);
        return {
          ...u,
          orderCount,
          totalSpent: totalSpentAgg[0]?.total || 0
        };
      })
    );

    const totalPages = Math.ceil(total / pageLimit) || 1;

    return res.status(200).json({
      success: true,
      data: enhanced,
      pagination: {
        page: currentPage,
        limit: pageLimit,
        total,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1
      }
    });
  } catch (error) {
    next(error);
  }
};
