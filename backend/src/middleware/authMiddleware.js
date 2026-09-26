const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../database/db');
const { logAuditEvent } = require('../services/auditService');

/**
 * JWT Authentication Middleware.
 * Enforces token validity, expiration, and user existence on protected routes.
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;

  if (!token) {
    await logAuditEvent({
      actor_id: 'unauthenticated',
      actor_role: 'unauthenticated',
      action: 'UNAUTHENTICATED_REQUEST',
      target_type: 'endpoint',
      target_id: req.originalUrl,
      result: 'DENIED',
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.headers['user-agent'],
      details_redacted: 'Missing Bearer token'
    });

    return res.status(401).json({
      error: 'Authentication required. No bearer token provided.',
      code: 'AUTH_REQUIRED'
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    
    // Check if user still exists in DB
    const user = await db.queryOne(
      `SELECT id, name, email, role, created_at FROM users WHERE id = ?`,
      [decoded.id]
    );

    if (!user) {
      await logAuditEvent({
        actor_id: decoded.id || 'unknown',
        actor_role: decoded.role || 'unauthenticated',
        action: 'INVALID_USER_TOKEN',
        target_type: 'endpoint',
        target_id: req.originalUrl,
        result: 'DENIED',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details_redacted: 'Token references non-existent user'
      });

      return res.status(401).json({
        error: 'Invalid session. User no longer exists.',
        code: 'USER_NOT_FOUND'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    await logAuditEvent({
      actor_id: 'invalid_token',
      actor_role: 'unauthenticated',
      action: 'TOKEN_VERIFICATION_FAILED',
      target_type: 'endpoint',
      target_id: req.originalUrl,
      result: 'DENIED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details_redacted: err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid signature'
    });

    return res.status(401).json({
      error: err.name === 'TokenExpiredError' ? 'Session expired. Please log in again.' : 'Invalid token signature.',
      code: err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
    });
  }
}

module.exports = {
  authenticateToken
};
