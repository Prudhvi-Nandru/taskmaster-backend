const express = require('express');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { httpError } = require('../utils/http');

const router = express.Router();
router.use(authenticate);
router.get('/', asyncHandler(async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 100,
  });
  res.json({ notifications });
}));
router.patch('/:id/read', asyncHandler(async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (!result.count) throw httpError(404, 'Unread notification not found');
  res.status(204).send();
}));
router.patch('/read-all', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, readAt: null }, data: { readAt: new Date() } });
  res.status(204).send();
}));
module.exports = router;
