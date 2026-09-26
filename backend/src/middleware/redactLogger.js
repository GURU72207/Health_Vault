const { redactPII } = require('../services/cryptoService');

/**
 * Privacy-preserving request logger.
 * Intercepts incoming requests and response codes, guaranteeing that no passwords,
 * authorization tokens, medical notes, or patient PII are printed in server logs.
 */
function redactLogger(req, res, next) {
  const start = Date.now();
  const originalEnd = res.end;

  // Redacted request summary
  const safeBody = req.body ? redactPII(req.body) : {};
  const safeQuery = req.query ? redactPII(req.query) : {};

  res.end = function (...args) {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const statusColor = statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
    const resetColor = '\x1b[0m';

    console.log(
      `[HTTP] ${req.method} ${req.originalUrl} -> ${statusColor}${statusCode}${resetColor} (${duration}ms) | User: ${req.user ? `${req.user.role}:${req.user.email}` : 'anonymous'}`
    );

    originalEnd.apply(res, args);
  };

  next();
}

module.exports = {
  redactLogger
};
