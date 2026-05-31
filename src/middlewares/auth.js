import { verifyAccessToken } from '../utils/tokens.js';
import { AppError } from '../utils/AppError.js';

export const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AppError(401, 'UNAUTHORIZED', 'Missing bearer token');
  try {
    req.user = verifyAccessToken(header.split(' ')[1]);
    next();
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
};

export const allowRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) throw new AppError(403, 'FORBIDDEN', 'You do not have permission');
  next();
};
