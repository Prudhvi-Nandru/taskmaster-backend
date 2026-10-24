require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const prisma = require('./config/db');
const { initRealtime } = require('./services/realtime');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be configured and at least 32 characters long');
}
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map((v) => v.trim()) : false },
});
initRealtime(io);

const port = Number(process.env.PORT) || 4000;
server.listen(port, () => console.log(`TaskMaster API listening on port ${port}`));

async function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
