const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { registerSchema, loginSchema, profileSchema } = require('../schemas');
const asyncHandler = require('../utils/asyncHandler');
const { httpError } = require('../utils/http');

const router = express.Router();
const publicUser = ({ id, name, email, avatarUrl, createdAt }) => ({ id, name, email, avatarUrl, createdAt });

function signToken(user) {
  return jwt.sign({ sub: user.id, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });
}

router.post('/register', validate(registerSchema), asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { name, email, passwordHash } });
  res.status(201).json({ user: publicUser(user), token: signToken(user), tokenType: 'Bearer' });
}));

router.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
    throw httpError(401, 'Invalid email or password');
  }
  res.json({ user: publicUser(user), token: signToken(user), tokenType: 'Bearer' });
}));

// Incrementing the user's token version revokes all existing sessions, including this token.
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  await prisma.user.update({ where: { id: req.user.id }, data: { tokenVersion: { increment: 1 } } });
  res.status(204).send();
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({ user: publicUser(user) });
}));

router.patch('/me', authenticate, validate(profileSchema), asyncHandler(async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.user.id }, data: req.body });
  res.json({ user: publicUser(user) });
}));

module.exports = router;
