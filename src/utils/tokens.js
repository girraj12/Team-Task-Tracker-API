import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const signAccessToken = (user) => jwt.sign(
  { sub: user.id, org: user.organization_id, role: user.role },
  process.env.JWT_ACCESS_SECRET,
  { expiresIn: process.env.ACCESS_TOKEN_TTL }
);

export const signRefreshToken = (user) => jwt.sign(
  { sub: user.id, jti: uuid() },
  process.env.JWT_REFRESH_SECRET,
  { expiresIn: `${process.env.REFRESH_TOKEN_DAYS}d` }
);

export const verifyAccessToken = (token) => jwt.verify(token, process.env.JWT_ACCESS_SECRET);
export const verifyRefreshToken = (token) => jwt.verify(token, process.env.JWT_REFRESH_SECRET);
