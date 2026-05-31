import { pool } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

export const createProject = asyncHandler(async (req, res) => {
  const [r] = await pool.query(
              `INSERT INTO projects 
              (organization_id, name, description, created_by) VALUES (?, ?, ?, ?)`, 
              [req.user.org, req.body.name, req.body.description || null, req.user.sub]);
  res.status(201).json({ id: r.insertId, ...req.body });
});

export const listProjects = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
                 `SELECT * FROM projects WHERE organization_id=? ORDER BY id DESC`, 
                 [req.user.org]);
  res.json(rows);
});

export const updateProject = asyncHandler(async (req, res) => {
  const [r] = await pool.query(
              `UPDATE projects SET name=?, description=? WHERE id=? AND organization_id=?`, 
              [req.body.name, req.body.description || null, req.params.id, req.user.org]);
  if (!r.affectedRows) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
  res.json({ message: 'Project updated' });
});

export const deleteProject = asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM projects WHERE id=? AND organization_id=?', [req.params.id, req.user.org]);
  res.json({ message: 'Project deleted' });
});
