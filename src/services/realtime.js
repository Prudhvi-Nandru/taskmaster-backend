let io;

function initRealtime(socketServer) {
  io = socketServer;
  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    const jwt = require('jsonwebtoken');
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.sub;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });
  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
  });
}

function emitToUser(userId, event, payload) {
  if (io) io.to(`user:${userId}`).emit(event, payload);
}

module.exports = { initRealtime, emitToUser };
