const express = require('express');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { taskSchema, taskUpdateSchema, commentSchema } = require('../schemas');
const asyncHandler = require('../utils/asyncHandler');
const { httpError } = require('../utils/http');
const { requireTeamMember, requireTaskAccess } = require('../services/permissions');
const { emitToUser } = require('../services/realtime');

const router = express.Router();
router.use(authenticate);

const includeTask = {
  creator: { select: { id: true, name: true, email: true } },
  assignee: { select: { id: true, name: true, email: true } },
  team: { select: { id: true, name: true } },
  _count: { select: { comments: true, attachments: true } },
};

router.post('/', validate(taskSchema), asyncHandler(async (req, res) => {
  const data = req.body;
  await requireTeamMember(req.user.id, data.teamId);
  if (data.assigneeId) await requireTeamMember(data.assigneeId, data.teamId);
  const task = await prisma.task.create({ data: { ...data, creatorId: req.user.id }, include: includeTask });
  if (task.assigneeId && task.assigneeId !== req.user.id) {
    await notify(task.assigneeId, 'TASK_ASSIGNED', `You were assigned task: ${task.title}`);
  }
  res.status(201).json({ task });
}));

router.get('/', asyncHandler(async (req, res) => {
  const { teamId, status, assigneeId, q, sort = 'createdAt', order = 'desc', dueBefore, dueAfter, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
  const allowedSort = ['createdAt', 'updatedAt', 'dueDate', 'title', 'priority', 'status'];
  if (!allowedSort.includes(sort)) throw httpError(400, `sort must be one of: ${allowedSort.join(', ')}`);
  if (!['asc', 'desc'].includes(order)) throw httpError(400, 'order must be asc or desc');

  const memberships = await prisma.teamMember.findMany({ where: { userId: req.user.id }, select: { teamId: true } });
  const teamIds = memberships.map((m) => m.teamId);
  if (teamId && !teamIds.includes(teamId)) throw httpError(403, 'You are not a member of this team');
  const where = {
    teamId: teamId ? { equals: teamId } : { in: teamIds },
    ...(status ? { status: String(status).toUpperCase() } : {}),
    ...(assigneeId ? { assigneeId: String(assigneeId) } : {}),
    ...(q ? { OR: [{ title: { contains: String(q), mode: 'insensitive' } }, { description: { contains: String(q), mode: 'insensitive' } }] } : {}),
    ...(dueBefore || dueAfter ? { dueDate: { ...(dueBefore ? { lte: new Date(String(dueBefore)) } : {}), ...(dueAfter ? { gte: new Date(String(dueAfter)) } : {}) } } : {}),
  };
  if (status && !['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(String(status).toUpperCase())) {
    throw httpError(400, 'Invalid status');
  }
  const [total, tasks] = await prisma.$transaction([
    prisma.task.count({ where }),
    prisma.task.findMany({ where, include: includeTask, orderBy: { [sort]: order }, skip: (pageNum - 1) * pageSize, take: pageSize }),
  ]);
  res.json({ tasks, pagination: { page: pageNum, limit: pageSize, total, pages: Math.ceil(total / pageSize) } });
}));

router.get('/assigned-to-me', asyncHandler(async (req, res) => {
  const memberships = await prisma.teamMember.findMany({ where: { userId: req.user.id }, select: { teamId: true } });
  const tasks = await prisma.task.findMany({
    where: { assigneeId: req.user.id, teamId: { in: memberships.map((m) => m.teamId) } },
    include: includeTask,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
  });
  res.json({ tasks });
}));

router.get('/:taskId', asyncHandler(async (req, res) => {
  await requireTaskAccess(req.user.id, req.params.taskId);
  const task = await prisma.task.findUnique({
    where: { id: req.params.taskId },
    include: { ...includeTask, comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } }, attachments: true },
  });
  res.json({ task });
}));

router.patch('/:taskId', validate(taskUpdateSchema), asyncHandler(async (req, res) => {
  const existing = await requireTaskAccess(req.user.id, req.params.taskId);
  if (req.body.assigneeId) await requireTeamMember(req.body.assigneeId, existing.teamId);
  const task = await prisma.task.update({ where: { id: existing.id }, data: req.body, include: includeTask });
  const recipients = new Set([task.assigneeId, task.creatorId].filter((id) => id && id !== req.user.id));
  for (const recipient of recipients) await notify(recipient, 'TASK_UPDATED', `Task updated: ${task.title}`);
  res.json({ task });
}));

router.patch('/:taskId/complete', asyncHandler(async (req, res) => {
  await requireTaskAccess(req.user.id, req.params.taskId);
  const task = await prisma.task.update({ where: { id: req.params.taskId }, data: { status: 'COMPLETED' }, include: includeTask });
  const recipients = new Set([task.assigneeId, task.creatorId].filter((id) => id && id !== req.user.id));
  for (const recipient of recipients) await notify(recipient, 'TASK_UPDATED', `Task completed: ${task.title}`);
  res.json({ task });
}));

router.delete('/:taskId', asyncHandler(async (req, res) => {
  const task = await requireTaskAccess(req.user.id, req.params.taskId);
  if (task.creatorId !== req.user.id) throw httpError(403, 'Only the task creator can delete this task');
  await prisma.task.delete({ where: { id: task.id } });
  res.status(204).send();
}));

router.get('/:taskId/comments', asyncHandler(async (req, res) => {
  await requireTaskAccess(req.user.id, req.params.taskId);
  const comments = await prisma.comment.findMany({
    where: { taskId: req.params.taskId },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ comments });
}));

router.post('/:taskId/comments', validate(commentSchema), asyncHandler(async (req, res) => {
  const task = await requireTaskAccess(req.user.id, req.params.taskId);
  const comment = await prisma.comment.create({
    data: { taskId: task.id, authorId: req.user.id, body: req.body.body },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });
  const recipients = new Set([task.assigneeId, task.creatorId].filter((id) => id && id !== req.user.id));
  for (const recipient of recipients) await notify(recipient, 'COMMENT_ADDED', `New comment on task: ${task.title}`);
  res.status(201).json({ comment });
}));

async function notify(userId, type, message) {
  const notification = await prisma.notification.create({ data: { userId, type, message } });
  emitToUser(userId, 'notification', notification);
}

module.exports = router;
