import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/tokens.js';

const refreshExpiry = () => new Date(Date.now() + Number(process.env.REFRESH_TOKEN_DAYS || 7) * 86400000);

const saveRefreshToken = async (user, refreshToken) => {
  await pool.query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', 
        [user.id, hashToken(refreshToken), refreshExpiry()]);
};

const tokenResponse = async (user) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await saveRefreshToken(user, refreshToken);
  return { accessToken, refreshToken };
};

export const register = asyncHandler(async (req, res) => {
  const { organizationName, name, email, password } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[exists]] = await conn.query('SELECT id FROM users WHERE email=?', [email]);
    if (exists) throw new AppError(409, 'EMAIL_EXISTS', 'Email already registered');
    const [orgResult] = await conn.query('INSERT INTO organizations (name) VALUES (?)', [organizationName]);
    const passwordHash = await bcrypt.hash(password, 12);
    const [userResult] = await conn.query(
      'INSERT INTO users (organization_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [orgResult.insertId, name, email, passwordHash, 'ADMIN']
    );
    await conn.commit();
    const user = { id: userResult.insertId, organization_id: orgResult.insertId, email, role: 'ADMIN' };
    const tokens = await tokenResponse(user);
    res.status(201).json(
        { 
        message: 'Organization and admin registered', 
        user: { 
        id: user.id, 
        name, email, 
        role: 'ADMIN', 
        organizationId: user.organization_id 
       }, ...tokens 
    });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const [[user]] = await pool.query('SELECT * FROM users WHERE email=?', [email]);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) 
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

  const tokens = await tokenResponse(user);
  res.json(
    { message: 'Login successful', 
      user: { 
      id: user.id, 
      name: user.name, 
      email: user.email, 
      role: user.role, 
      organizationId: user.organization_id 
    }, ...tokens 
    });
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  let payload;
  try { payload = verifyRefreshToken(refreshToken); } catch { throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token'); }
  const oldHash = hashToken(refreshToken);
  const [[stored]] = await pool.query('SELECT * FROM refresh_tokens WHERE user_id=? AND token_hash=?', [payload.sub, oldHash]);
  if (!stored || stored.revoked_at || new Date(stored.expires_at) < new Date()) throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token expired or revoked');
  const [[user]] = await pool.query('SELECT id, organization_id, email, role FROM users WHERE id=?', [payload.sub]);
  if (!user) throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'User no longer exists');
  const accessToken = signAccessToken(user);
  const newRefreshToken = signRefreshToken(user);
  const newHash = hashToken(newRefreshToken);
  await pool.query('UPDATE refresh_tokens SET revoked_at=NOW(), replaced_by_token_hash=? WHERE id=?', [newHash, stored.id]);
  await pool.query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [user.id, newHash, refreshExpiry()]);
  res.json({ accessToken, refreshToken: newRefreshToken });
});

export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  await pool.query('UPDATE refresh_tokens SET revoked_at=NOW() WHERE token_hash=?', [hashToken(refreshToken)]);
  res.json({ message: 'Logged out' });
});
