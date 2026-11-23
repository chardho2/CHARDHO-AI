/**
 * CHARDHO-AI :: work management
 * Tasks, attendance and support tickets with server-side authorisation on every write.
 */
import express from 'express';
import { db } from '../db.js';
import {
  asyncRoute, requireAuth, requirePermission, audit, notFound, badRequest, forbidden,
  requireFields, stringField, oneOf, userSatisfies, HttpError,
} from '../security.js';

export const workRouter = express.Router();

const TASK_STATUS = ['todo', 'in_progress', 'review', 'done', 'blocked'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const TICKET_STATUS = ['open', 'pending', 'resolved', 'closed'];

/* -------------------------------- tasks ------------------------------- */
workRouter.get(
  '/tasks',
  requireAuth,
  requirePermission('tasks.read'),
  asyncRoute(async (req, res) => {
    const scopeAll = userSatisfies(req.user, ['tasks.read.all']);
    const rows = db.prepare(
      `SELECT t.*, a.name AS assignee, c.name AS creator FROM tasks t
       LEFT JOIN users a ON a.id = t.assigned_to LEFT JOIN users c ON c.id = t.created_by
       WHERE (? = 1 OR t.assigned_to = ?) ORDER BY t.updated_at DESC`,
    ).all(scopeAll ? 1 : 0, req.user.id);
    res.json({ tasks: rows, scope: scopeAll ? 'all' : 'self' });
  }),
);

workRouter.post(
  '/tasks',
  requireAuth,
  requirePermission('tasks.assign', 'tasks.write'),
  asyncRoute(async (req, res) => {
    requireFields(req.body, ['title']);
    const title = stringField(req.body.title, 'title', { min: 3, max: 160 });
    const description = req.body.description ? stringField(req.body.description, 'description', { max: 4000 }) : null;
    const status = req.body.status ? oneOf(req.body.status, TASK_STATUS, 'status') : 'todo';
    const priority = req.body.priority ? oneOf(req.body.priority, PRIORITIES, 'priority') : 'medium';

    // Assigning to somebody else requires tasks.assign. Otherwise you may only self-assign.
    let assignedTo = req.body.assigned_to ? Number(req.body.assigned_to) : req.user.id;
    if (assignedTo !== req.user.id && !userSatisfies(req.user, ['tasks.assign'])) {
      throw forbidden('You can only assign tasks to yourself');
    }
    if (!db.prepare('SELECT id FROM users WHERE id = ?').get(assignedTo)) throw badRequest('Assignee does not exist');

    const result = db.prepare(
      `INSERT INTO tasks (title, description, assigned_to, created_by, status, priority, due_date)
       VALUES (?,?,?,?,?,?,?)`,
    ).run(title, description, assignedTo, req.user.id, status, priority, req.body.due_date || null);

    db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?,?,?)').run(
      assignedTo, 'New task assigned', title,
    );
    audit(req, 'tasks.create', { entity: 'tasks', entityId: result.lastInsertRowid, meta: { assignedTo } });
    res.status(201).json({ ok: true, id: Number(result.lastInsertRowid) });
  }),
);

workRouter.patch(
  '/tasks/:id',
  requireAuth,
  requirePermission('tasks.read'),
  asyncRoute(async (req, res) => {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) throw notFound('Task not found');

    const canManageAll = userSatisfies(req.user, ['tasks.assign']);
    const isOwner = task.assigned_to === req.user.id;
    if (!canManageAll && !isOwner) throw forbidden('This task is not assigned to you');

    const updates = [];
    const params = [];
    if (req.body.status !== undefined) {
      updates.push('status = ?');
      params.push(oneOf(req.body.status, TASK_STATUS, 'status'));
    }
    if (req.body.progress !== undefined) {
      updates.push('progress = ?');
      params.push(Math.min(Math.max(Number(req.body.progress) || 0, 0), 100));
    }
    if (req.body.priority !== undefined) {
      if (!canManageAll) throw forbidden('Only a manager can change priority');
      updates.push('priority = ?');
      params.push(oneOf(req.body.priority, PRIORITIES, 'priority'));
    }
    if (req.body.assigned_to !== undefined) {
      if (!canManageAll) throw forbidden('Only a manager can reassign tasks');
      updates.push('assigned_to = ?');
      params.push(Number(req.body.assigned_to));
    }
    if (!updates.length) throw badRequest('No supported fields to update');

    db.prepare(`UPDATE tasks SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...params, task.id);
    audit(req, 'tasks.update', { entity: 'tasks', entityId: task.id, meta: { fields: Object.keys(req.body) } });
    res.json({ ok: true });
  }),
);

/* ------------------------------ attendance ---------------------------- */
workRouter.get(
  '/attendance',
  requireAuth,
  requirePermission('attendance.read'),
  asyncRoute(async (req, res) => {
    const scopeAll = userSatisfies(req.user, ['attendance.read.all']);
    const rows = db.prepare(
      `SELECT a.*, u.name AS staff FROM attendance a JOIN users u ON u.id=a.user_id
       WHERE (? = 1 OR a.user_id = ?) ORDER BY a.work_date DESC LIMIT 120`,
    ).all(scopeAll ? 1 : 0, req.user.id);
    res.json({ attendance: rows, scope: scopeAll ? 'all' : 'self' });
  }),
);

workRouter.post(
  '/attendance/:action',
  requireAuth,
  requirePermission('attendance.write'),
  asyncRoute(async (req, res) => {
    const action = oneOf(req.params.action, ['check-in', 'check-out'], 'action');
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString().slice(11, 16);
    const existing = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND work_date = ?').get(req.user.id, today);
    const late = now > '09:30';

    if (action === 'check-in') {
      if (existing?.check_in) throw badRequest('You have already checked in today');
      if (existing) {
        db.prepare('UPDATE attendance SET check_in = ?, status = ? WHERE id = ?').run(now, late ? 'late' : 'present', existing.id);
      } else {
        db.prepare('INSERT INTO attendance (user_id, work_date, check_in, status) VALUES (?,?,?,?)')
          .run(req.user.id, today, now, late ? 'late' : 'present');
      }
    } else {
      if (!existing?.check_in) throw badRequest('Check in before checking out');
      if (existing.check_out) throw badRequest('You have already checked out today');
      db.prepare('UPDATE attendance SET check_out = ? WHERE id = ?').run(now, existing.id);
    }
    const record = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND work_date = ?').get(req.user.id, today);
    audit(req, `attendance.${action}`, { entity: 'attendance', entityId: record.id });
    res.json({ ok: true, attendance: record });
  }),
);

workRouter.patch(
  '/attendance/:id',
  requireAuth,
  requirePermission('attendance.read.all'),
  asyncRoute(async (req, res) => {
    const row = db.prepare('SELECT * FROM attendance WHERE id = ?').get(req.params.id);
    if (!row) throw notFound('Attendance record not found');
    const status = oneOf(req.body.status, ['present', 'late', 'absent', 'leave', 'half_day'], 'status');
    db.prepare('UPDATE attendance SET status = ?, note = ? WHERE id = ?').run(status, req.body.note || null, row.id);
    audit(req, 'attendance.correct', { entity: 'attendance', entityId: row.id, meta: { status } });
    res.json({ ok: true });
  }),
);

/* ------------------------------- tickets ------------------------------ */
workRouter.get(
  '/tickets',
  requireAuth,
  requirePermission('tickets.read'),
  asyncRoute(async (req, res) => {
    const scopeAll = userSatisfies(req.user, ['tickets.read.all']);
    const rows = db.prepare(
      `SELECT s.*, u.name AS requester, a.name AS assignee FROM support_tickets s
       LEFT JOIN users u ON u.id = s.user_id LEFT JOIN users a ON a.id = s.assigned_to
       WHERE (? = 1 OR s.user_id = ?)
       ORDER BY CASE s.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, s.created_at DESC`,
    ).all(scopeAll ? 1 : 0, req.user.id);
    res.json({ tickets: rows, scope: scopeAll ? 'all' : 'self' });
  }),
);

workRouter.post(
  '/tickets',
  requireAuth,
  requirePermission('tickets.write', 'portal.app.access'),
  asyncRoute(async (req, res) => {
    requireFields(req.body, ['subject']);
    const subject = stringField(req.body.subject, 'subject', { min: 4, max: 160 });
    const description = req.body.description ? stringField(req.body.description, 'description', { max: 4000 }) : null;
    const priority = req.body.priority ? oneOf(req.body.priority, PRIORITIES, 'priority') : 'medium';
    const result = db.prepare(
      'INSERT INTO support_tickets (subject, description, user_id, priority) VALUES (?,?,?,?)',
    ).run(subject, description, req.user.id, priority);
    audit(req, 'tickets.create', { entity: 'support_tickets', entityId: result.lastInsertRowid });
    res.status(201).json({ ok: true, id: Number(result.lastInsertRowid) });
  }),
);

workRouter.patch(
  '/tickets/:id',
  requireAuth,
  requirePermission('tickets.read'),
  asyncRoute(async (req, res) => {
    const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(req.params.id);
    if (!ticket) throw notFound('Ticket not found');
    const canManage = userSatisfies(req.user, ['tickets.assign']);
    if (!canManage && ticket.user_id !== req.user.id) throw forbidden('This ticket belongs to another user');

    const updates = [];
    const params = [];
    if (req.body.status !== undefined) {
      const status = oneOf(req.body.status, TICKET_STATUS, 'status');
      if (!canManage && !['closed'].includes(status)) throw forbidden('Only support staff can set that status');
      updates.push('status = ?');
      params.push(status);
      if (status === 'resolved') updates.push(`resolved_at = datetime('now')`);
    }
    if (req.body.priority !== undefined) {
      if (!canManage) throw forbidden('Only support staff can change priority');
      updates.push('priority = ?');
      params.push(oneOf(req.body.priority, PRIORITIES, 'priority'));
    }
    if (req.body.assigned_to !== undefined) {
      if (!canManage) throw forbidden('Only support staff can assign tickets');
      updates.push('assigned_to = ?');
      params.push(Number(req.body.assigned_to));
    }
    if (!updates.length) throw badRequest('No supported fields to update');

    db.prepare(`UPDATE support_tickets SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...params, ticket.id);
    if (ticket.user_id) {
      db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?,?,?)').run(
        ticket.user_id, 'Support ticket updated', `Ticket #${ticket.id}: ${req.body.status || 'updated'}`,
      );
    }
    audit(req, 'tickets.update', { entity: 'support_tickets', entityId: ticket.id, meta: { fields: Object.keys(req.body) } });
    res.json({ ok: true });
  }),
);

/* ------------------------------- reports ------------------------------ */
workRouter.get(
  '/staff-overview',
  requireAuth,
  requirePermission('staff.manage'),
  asyncRoute(async (_req, res) => {
    const staff = db.prepare(
      `SELECT u.id, u.name, u.email, sp.employee_code, sp.department, sp.designation,
              (SELECT COUNT(*) FROM tasks t WHERE t.assigned_to = u.id AND t.status != 'done') AS open_tasks,
              (SELECT COUNT(*) FROM tasks t WHERE t.assigned_to = u.id AND t.status = 'done') AS done_tasks,
              (SELECT status FROM attendance a WHERE a.user_id = u.id ORDER BY work_date DESC LIMIT 1) AS last_attendance
       FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id
       JOIN roles r ON r.id = u.role_id WHERE r.key = 'staff'`,
    ).all();
    res.json({ staff });
  }),
);
