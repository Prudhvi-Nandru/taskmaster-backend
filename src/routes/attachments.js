const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { requireTaskAccess } = require('../services/permissions');
const { httpError } = require('../utils/http');

const router = express.Router();
const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const maxBytes = (Number(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).slice(0, 12)}`),
});
const upload = multer({
  storage, limits: { fileSize: maxBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname || file.originalname.length > 255) {
      const error = new Error('Invalid file name');
      error.status = 400;
      return cb(error);
    }
    cb(null, true);
  },
});

router.use(authenticate);
router.post('/:taskId/attachments', asyncHandler(async (req, _res, next) => {
  await requireTaskAccess(req.user.id, req.params.taskId);
  next();
}), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw httpError(400, 'Attach a file using multipart field "file"');
  const attachment = await prisma.attachment.create({
    data: {
      taskId: req.params.taskId, uploaderId: req.user.id,
      originalName: path.basename(req.file.originalname), storedName: req.file.filename,
      mimeType: req.file.mimetype, size: req.file.size,
    },
  });
  res.status(201).json({ attachment, downloadPath: `/api/attachments/${attachment.id}/download` });
}));

router.get('/:attachmentId/download', asyncHandler(async (req, res) => {
  const attachment = await prisma.attachment.findUnique({ where: { id: req.params.attachmentId }, include: { task: true } });
  if (!attachment) throw httpError(404, 'Attachment not found');
  await requireTaskAccess(req.user.id, attachment.taskId);
  const fullPath = path.join(uploadDir, path.basename(attachment.storedName));
  if (!fs.existsSync(fullPath)) throw httpError(404, 'File is no longer available');
  res.download(fullPath, attachment.originalName);
}));

router.delete('/:attachmentId', asyncHandler(async (req, res) => {
  const attachment = await prisma.attachment.findUnique({ where: { id: req.params.attachmentId } });
  if (!attachment) throw httpError(404, 'Attachment not found');
  await requireTaskAccess(req.user.id, attachment.taskId);
  if (attachment.uploaderId !== req.user.id) throw httpError(403, 'Only the uploader can delete this attachment');
  const fullPath = path.join(uploadDir, path.basename(attachment.storedName));
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  await prisma.attachment.delete({ where: { id: attachment.id } });
  res.status(204).send();
}));
module.exports = router;
