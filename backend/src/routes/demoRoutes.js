const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { seedDatabase, PERSONAS } = require('../database/seed');
const { logAuditEvent } = require('../services/auditService');

/**
 * GET /api/demo/personas
 * Provides synthetic test persona credentials for easy one-click testing in judging demos.
 */
router.get('/personas', (req, res) => {
  const publicPersonas = Object.entries(PERSONAS).map(([key, p]) => ({
    key,
    id: p.id,
    name: p.name,
    email: p.email,
    password: p.password,
    role: p.role,
    specialty: p.specialty || null,
    description: key === 'patientJohn'
      ? 'Primary Demo Patient (Granted access to Dr. Priya Sharma, has clinical records & follow-up)'
      : key === 'patientSarah'
      ? 'Ungranted Private Patient (Has NOT granted consent to Dr. Priya - centerpiece of Access Denied demo!)'
      : key === 'providerPriya'
      ? 'Cardiologist (Has consent from John Doe, lacks consent for Sarah Smith)'
      : key === 'providerVikram'
      ? 'Neurologist'
      : 'System Compliance & Security Auditor'
  }));

  return res.json({ personas: publicPersonas });
});

/**
 * POST /api/demo/reset
 * Resets and reseeds the synthetic database in 1 second.
 */
router.post('/reset', async (req, res) => {
  try {
    await seedDatabase();
    await logAuditEvent({
      actor_id: 'system_demo',
      actor_role: 'admin',
      action: 'RESET_DEMO_DATABASE',
      target_type: 'system',
      target_id: 'database',
      result: 'ALLOWED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details_redacted: 'Synthetic demo database reset to initial baseline'
    });

    return res.json({
      message: 'Demo dataset reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[DEMO_RESET_ERROR]', err);
    return res.status(500).json({ error: 'Failed to reset demo dataset', code: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/demo/status
 * Returns system statistics and encryption validation status.
 */
router.get('/status', async (req, res) => {
  try {
    const userCount = await db.queryOne(`SELECT COUNT(*) as count FROM users`);
    const visitCount = await db.queryOne(`SELECT COUNT(*) as count FROM visits`);
    const docCount = await db.queryOne(`SELECT COUNT(*) as count FROM documents`);
    const grantCount = await db.queryOne(`SELECT COUNT(*) as count FROM access_grants WHERE revoked_at IS NULL`);
    const auditCount = await db.queryOne(`SELECT COUNT(*) as count FROM audit_logs`);
    const deniedCount = await db.queryOne(`SELECT COUNT(*) as count FROM audit_logs WHERE result = 'DENIED'`);

    return res.json({
      challenge_id: 'HT-05',
      event: 'URAN 2026',
      status: 'OPERATIONAL',
      security_features: {
        password_hashing: 'Bcrypt (12 rounds)',
        encryption_at_rest: 'AES-256-GCM authenticated cipher (key from env var)',
        rbac_enforcement: 'Server-side middleware with mandatory consent verification',
        audit_trail: 'Append-only immutable audit_logs capturing allowed and denied events',
        pii_protection: 'Active log sanitization and redaction middleware'
      },
      counts: {
        users: userCount.count,
        visits: visitCount.count,
        documents: docCount.count,
        active_consent_grants: grantCount.count,
        total_audit_events: auditCount.count,
        denied_attempts_logged: deniedCount.count
      }
    });
  } catch (err) {
    console.error('[DEMO_STATUS_ERROR]', err);
    return res.status(500).json({ error: 'Failed to fetch demo status', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
