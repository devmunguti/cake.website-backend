import jwt from 'jsonwebtoken';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is missing in production!');
    }
    return 'dev_secret_cake_bakery_platform_key_2026';
  }
  return secret;
};

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      mustChangePassword: !!user.mustChangePassword
    },
    getJwtSecret(),
    {
      algorithm: 'HS256',
      expiresIn: JWT_EXPIRES_IN
    }
  );
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
};

