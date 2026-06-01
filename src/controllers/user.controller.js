import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const hash = await bcrypt.hash(password, 12);
  const [result] = await pool.query('INSERT INTO users (organization_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)', [req.user.org, name, email, hash, role]);
  res.status(201).json({ id: result.insertId, name, email, role });
});

export const listUsers = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT id, name, email, role, created_at FROM users WHERE organization_id=? ORDER BY id DESC', [req.user.org]);
  res.json(rows);
});

export const getUser = asyncHandler(async (req, res) => {
  const [[user]] = await pool.query(
    `SELECT
      id,
      organization_id,
      name,
      email,
      role,
      created_at,
      updated_at
     FROM users
     WHERE id=? AND organization_id=?`,
    [req.params.id, req.user.org]
  );

  if (!user) {
    throw new AppError(
      404,
      "USER_NOT_FOUND",
      "User not found"
    );
  }

  res.json(user);
});

export const updateUser = asyncHandler(async (req, res) => {
    console.log("data");
  const { id } = req.params;
  const [[target]] = await pool.query('SELECT id FROM users WHERE id=? AND organization_id=?', [id, req.user.org]);
  if (!target) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

  const fields = [], values = [];
  for (const [key, col] of [['name','name'], ['role','role']]) 
  if (req.body[key]) { 
    fields.push(`${col}=?`); 
    values.push(req.body[key]); 
  }
  values.push(id, req.user.org);

  await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id=? AND organization_id=?`, values);
  res.json({ message: 'User updated' });
});

export const deleteUser = asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM users WHERE id=? AND organization_id=?', [req.params.id, req.user.org]);
  res.json({ message: 'User deleted' });
});
