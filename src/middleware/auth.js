const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { httpError } = require('../utils/http');

async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw httpError(401, 'Authentication required');
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw httpError(401, 'Invalid or expired token');
    }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || payload.tokenVersion !== user.tokenVersion) throw httpError(401, 'Invalid or revoked token');
    req.user = { id: user.id, name: user.name, email: user.email };
    req.token = token;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { authenticate };
