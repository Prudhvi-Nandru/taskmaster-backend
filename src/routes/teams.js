const express = require('express');
const crypto = require('crypto');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { teamSchema, joinTeamSchema } = require('../schemas');
const asyncHandler = require('../utils/asyncHandler');
const { httpError } = require('../utils/http');

const router = express.Router();
router.use(authenticate);

router.post('/', validate(teamSchema), asyncHandler(async (req, res) => {
  const team = await prisma.team.create({
    data: {
      ...req.body,
      inviteCode: crypto.randomBytes(18).toString('hex'),
      members: { create: { userId: req.user.id, role: 'OWNER' } },
    },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });
  res.status(201).json({ team });
}));

router.get('/', asyncHandler(async (req, res) => {
  const memberships = await prisma.teamMember.findMany({
    where: { userId: req.user.id },
    include: { team: true },
    orderBy: { joinedAt: 'desc' },
  });
  res.json({ teams: memberships.map((m) => ({ ...m.team, role: m.role, joinedAt: m.joinedAt })) });
}));

router.post('/join', validate(joinTeamSchema), asyncHandler(async (req, res) => {
  const team = await prisma.team.findUnique({ where: { inviteCode: req.body.inviteCode } });
  if (!team) throw httpError(404, 'Invalid invite code');
  await prisma.teamMember.upsert({
    where: { userId_teamId: { userId: req.user.id, teamId: team.id } },
    update: {},
    create: { userId: req.user.id, teamId: team.id },
  });
  res.status(200).json({ message: 'Joined team', team: { id: team.id, name: team.name } });
}));

router.get('/:teamId/members', asyncHandler(async (req, res) => {
  await requireMember(req.user.id, req.params.teamId);
  const members = await prisma.teamMember.findMany({
    where: { teamId: req.params.teamId },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { joinedAt: 'asc' },
  });
  res.json({ members: members.map((m) => ({ role: m.role, joinedAt: m.joinedAt, user: m.user })) });
}));

async function requireMember(userId, teamId) {
  const membership = await prisma.teamMember.findUnique({ where: { userId_teamId: { userId, teamId } } });
  if (!membership) throw httpError(403, 'You are not a member of this team');
  return membership;
}
module.exports = router;
