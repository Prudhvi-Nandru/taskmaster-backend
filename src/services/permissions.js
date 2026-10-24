const prisma = require('../config/db');
const { httpError } = require('../utils/http');

async function requireTeamMember(userId, teamId) {
  const membership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
  if (!membership) throw httpError(403, 'You are not a member of this team');
  return membership;
}

async function requireTaskAccess(userId, taskId) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw httpError(404, 'Task not found');
  await requireTeamMember(userId, task.teamId);
  return task;
}

module.exports = { requireTeamMember, requireTaskAccess };
