import { pool } from '../config/db.js';
import { redis } from '../config/redis.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { invalidateTaskListCache, taskListCacheKey } from '../services/cache.service.js';

const transitions = {
  TODO: ['IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS: ['IN_REVIEW', 'BLOCKED'],
  IN_REVIEW: ['DONE', 'BLOCKED'],
  BLOCKED: ['IN_PROGRESS'],
  DONE: []
};

const assertSameOrgUser = async (org, userId) => {
  const [[u]] = await pool.query('SELECT id FROM users WHERE id=? AND organization_id=?', [userId, org]);
  if (!u) throw new AppError(400, 'INVALID_ASSIGNEE', 'Assignee must be a user in your organization');
};

export const createTask = asyncHandler(async (req, res) => {
  await assertSameOrgUser(req.user.org, req.body.assigneeId);
  
  const [result] = await pool.query(
    `INSERT INTO tasks 
    (organization_id, project_id, title, description, priority, assignee_id, created_by, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.org,
      req.body.projectId || null,
      req.body.title,
      req.body.description || null,
      req.body.priority,
      req.body.assigneeId,
      req.user.sub,
      req.body.dueDate || null
    ]
  );

  await invalidateTaskListCache(req.user.org, req.body.assigneeId);
  res.status(201).json({ 
    id: r.insertId, 
    message: 'Task created' 
  });
});

export const listTasks = asyncHandler(async (req, res) => {
  const page = req.query.page, limit = req.query.limit;
  const offset = (page - 1) * limit;
  let assignee = req.query.assignee;
  if (req.user.role === 'MEMBER') assignee = req.user.sub;
  const key = taskListCacheKey({ 
    orgId: req.user.org, 
    assignee, 
    page, 
    limit, 
    status: req.query.status, 
    priority: req.query.priority 
  });
  const cached = await redis.get(key);
  if (cached) return res.json({ cached: true, ...JSON.parse(cached) });

  const where = ['t.organization_id=?'];
  const vals = [req.user.org];
  if (req.query.status) { where.push('t.status=?'); vals.push(req.query.status); }
  if (req.query.priority) { where.push('t.priority=?'); vals.push(req.query.priority); }
  if (assignee) { where.push('t.assignee_id=?'); vals.push(assignee); }
  const whereSql = where.join(' AND ');
  const [[count]] = await pool.query(`SELECT COUNT(*) total FROM tasks t WHERE ${whereSql}`, vals);
  const [rows] = await pool.query(
    `SELECT t.*, 
     u.name assignee_name, 
     p.name project_name FROM tasks t 
     JOIN users u ON u.id=t.assignee_id 
     LEFT JOIN projects p ON p.id=t.project_id 
     WHERE ${whereSql} ORDER BY t.due_date ASC, t.id 
     DESC LIMIT ? OFFSET ?`,
    [...vals, limit, offset]
  );
  const payload = { cached: false, page, limit, total: count.total, data: rows };
  await redis.set(key, JSON.stringify(payload), 'EX', 120);
  res.json(payload);
});

export const getTask = asyncHandler(async (req, res) => {
  const [[task]] = await pool.query('SELECT * FROM tasks WHERE id=? AND organization_id=?', 
                   [req.params.id, req.user.org]);

  if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');
  if (req.user.role === 'MEMBER' && task.assignee_id !== Number(req.user.sub)) throw new AppError(403, 'FORBIDDEN', 'Members can only view assigned tasks');
  res.json(task);
});

export const updateTask = asyncHandler(async (req, res) => {
  const [[task]] = await pool.query('SELECT * FROM tasks WHERE id=? AND organization_id=?', 
                   [req.params.id, req.user.org]);

  if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');
  if (req.user.role === 'MEMBER') throw new AppError(403, 'FORBIDDEN', 'Members cannot edit task details');
  if (req.body.assigneeId) await assertSameOrgUser(req.user.org, req.body.assigneeId);
  const map = { 
        projectId:'project_id', 
        title:'title', 
        description:'description', 
        priority:'priority', 
        assigneeId:'assignee_id', 
        dueDate:'due_date' 
    };
  const fields = [], vals = [];
  for (const [k, c] of Object.entries(map)) if (k in req.body) { fields.push(`${c}=?`); vals.push(req.body[k]); }
  vals.push(req.params.id, req.user.org);
  await pool.query(`UPDATE tasks SET ${fields.join(', ')} WHERE id=? AND organization_id=?`, vals);
  await invalidateTaskListCache(req.user.org, task.assignee_id);
  if (req.body.assigneeId && req.body.assigneeId !== task.assignee_id) await invalidateTaskListCache(req.user.org, req.body.assigneeId);
  res.json({ message: 'Task updated' });
});

export const changeStatus = asyncHandler(async (req, res) => {
  const [[task]] = await pool.query('SELECT * FROM tasks WHERE id=? AND organization_id=?', [req.params.id, req.user.org]);
  if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');
  const canChange = req.user.role === 'MANAGER' || req.user.role === 'ADMIN' || task.assignee_id === Number(req.user.sub);
  if (!canChange) throw new AppError(403, 'FORBIDDEN', 'Only assignee or manager/admin can advance task status');
  const next = req.body.status;

  if (!transitions[task.status].includes(next)) throw new AppError(400, 'INVALID_STATUS_TRANSITION', `Cannot change status from ${task.status} to ${next}`);
  await pool.query('UPDATE tasks SET status=?, completed_at=? WHERE id=? AND organization_id=?', 
        [next, next === 'DONE' ? new Date() : null, req.params.id, req.user.org]);

  await invalidateTaskListCache(req.user.org, task.assignee_id);
  res.json({ message: 'Task status updated', from: task.status, to: next });
});

export const deleteTask = asyncHandler(async (req, res) => {
  const [[task]] = await pool.query('SELECT assignee_id FROM tasks WHERE id=? AND organization_id=?', 
                   [req.params.id, req.user.org]);
  if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');
  await pool.query('DELETE FROM tasks WHERE id=? AND organization_id=?', [req.params.id, req.user.org]);
  await invalidateTaskListCache(req.user.org, task.assignee_id);
  res.json({ message: 'Task deleted' });
});

export const analytics = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`
  SELECT u.id user_id, u.name, 
  COUNT(CASE WHEN t.due_date < NOW() AND t.status != 'DONE' THEN 1 END) overdue_count, 
  AVG(CASE WHEN t.completed_at IS NOT NULL THEN TIMESTAMPDIFF(HOUR, 
  t.created_at, 
  t.completed_at) END) avg_completion_hours FROM users u 
  LEFT JOIN tasks t ON t.assignee_id=u.id WHERE u.organization_id=? GROUP BY u.id,u.name`, 
  [req.user.org]);
  res.json(rows);
});
