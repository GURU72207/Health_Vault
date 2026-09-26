const express = require('express');
const router = express.Router();
const { getAuditLogsForPatient, getAuditLogsForProvider, getAllAuditLogs, logAuditEvent } = require('../services/auditService');
const { authenticateToken } = require('../middleware/authMiddleware');

/**
 * GET /api/audit-log
 * Immutable Audit Trail retrieval.
 * - Patient: Sees all events affecting their health record (both their own and provider interactions).
 * - Provider: Sees only their own actions and access attempts (including blocked/denied attempts).
 * - Admin: Full system audit trail.
 */
router.get('/', authenticateToken, async (req, res) => {
  const user = req.user;
  const { result, action, limit, offset } = req.query;

  const filter = {
    result: result ? result.toUpperCase() : null,
    action: action || null,
    limit: limit ? parseInt(limit, 10) : 100,
    offset: offset ? parseInt(offset, 10) : 0
  };

  try {
    let logs = [];

    if (user.role === 'patient') {
      logs = await getAuditLogsForPatient(user.id, filter);
    } else if (user.role === 'provider') {
      logs = await getAuditLogsForProvider(user.id, filter);
    } else if (user.role === 'admin') {
      logs = await getAllAuditLogs(filter);
    }

    // Log the viewing of the audit log itself! (Audit completeness)
    await logAuditEvent({
      actor_id: user.id,
      actor_role: user.role,
      action: 'VIEW_AUDIT_LOG',
      target_type: 'audit_log',
      target_id: user.id,
      result: 'ALLOWED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details_redacted: { logs_retrieved: logs.length, filter_result: filter.result || 'all' }
    });

    return res.json({
      role: user.role,
      total_retrieved: logs.length,
      logs
    });
  } catch (err) {
    console.error('[GET_AUDIT_LOG_ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve audit log', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
