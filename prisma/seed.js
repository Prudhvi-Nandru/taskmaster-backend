require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/db');

async function main() {
  const email = 'demo@example.com';
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: 'Demo User', email, passwordHash: await bcrypt.hash('ChangeMe123!', 12) },
  });
  const team = await prisma.team.upsert({
    where: { inviteCode: 'demo-team-invite-code' },
    update: {},
    create: { name: 'Demo Team', description: 'Starter team for local development', inviteCode: 'demo-team-invite-code' },
  });
  await prisma.teamMember.upsert({
    where: { userId_teamId: { userId: user.id, teamId: team.id } },
    update: {},
    create: { userId: user.id, teamId: team.id, role: 'OWNER' },
  });
  console.log('Seed complete. Demo login: demo@example.com / ChangeMe123!');
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
