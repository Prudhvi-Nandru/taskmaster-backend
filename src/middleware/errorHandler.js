function notFound(req, _res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

function errorHandler(error, _req, res, _next) {
  if (error.code === 'P2002') {
    return res.status(409).json({ error: 'Conflict', message: 'A record with this value already exists' });
  }
  if (error.code === 'P2025') {
    return res.status(404).json({ error: 'Not Found', message: 'Record not found' });
  }
  if (error.name === 'MulterError') {
    return res.status(400).json({ error: 'Upload error', message: error.message });
  }
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({
    error: status >= 500 ? 'Internal Server Error' : error.name || 'Request Error',
    message: status >= 500 ? 'An unexpected error occurred' : error.message,
    ...(error.details ? { details: error.details } : {}),
  });
}

module.exports = { notFound, errorHandler };
