const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { grantAccess, revokeAccess, getGrantsForPatient, getActivePatientsForProvider } = require('../services/consentService');
const { logAuditEvent } = require('../services/auditService');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRoles } = require('../middleware/rbacMiddleware');

/**
 * POST /api/access/grant
 * Patient explicitly grants consent to a verified healthcare provider.
 */
router.post('/grant', authenticateToken, requireRoles('patient'), async (req, res) => {
  const { provider_id } = req.body;
  const patientId = req.user.id;

  if (!provider_id) {
    return res.status(400).json({ error: 'provider_id is required', code: 'MISSING_PROVIDER_ID' });
  }

  try {
    const provider = await db.queryOne(
      `SELECT id, name, email, role FROM users WHERE id = ? AND role = 'provider'`,
      [provider_id]
    );

    if (!provider) {
      return res.status(404).json({ error: 'Healthcare provider not found', code: 'PROVIDER_NOT_FOUND' });
    }

    const grant = await grantAccess(patientId, provider_id);

    await logAuditEvent({
      actor_id: patientId,
      actor_role: 'patient',
      action: 'GRANT_CONSENT',
      target_type: 'provider',
      target_id: provider_id,
      result: 'ALLOWED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details_redacted: {
        provider_name: provider.name,
        provider_email: provider.email,
        granted_at: grant.granted_at
      }
    });

    return res.status(200).json({
      message: `Consent granted to ${provider.name}`,
      grant,
      provider: {
        id: provider.id,
        name: provider.name,
        email: provider.email
      }
    });
  } catch (err) {
    console.error('[GRANT_ACCESS_ERROR]', err);
    return res.status(500).json({ error: 'Failed to grant access', code: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/access/revoke
 * Patient explicitly revokes consent from a healthcare provider.
 */
router.post('/revoke', authenticateToken, requireRoles('patient'), async (req, res) => {
  const { provider_id } = req.body;
  const patientId = req.user.id;

  if (!provider_id) {
    return res.status(400).json({ error: 'provider_id is required', code: 'MISSING_PROVIDER_ID' });
  }

  try {
    const provider = await db.queryOne(
      `SELECT id, name, email FROM users WHERE id = ?`,
      [provider_id]
    );

    const revoked = await revokeAccess(patientId, provider_id);

    await logAuditEvent({
      actor_id: patientId,
      actor_role: 'patient',
      action: 'REVOKE_CONSENT',
      target_type: 'provider',
      target_id: provider_id,
      result: 'ALLOWED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details_redacted: {
        provider_name: provider ? provider.name : provider_id,
        revoked_at: revoked.revoked_at
      }
    });

    return res.status(200).json({
      message: `Consent revoked for ${provider ? provider.name : 'provider'}`,
      revocation: revoked
    });
  } catch (err) {
    console.error('[REVOKE_ACCESS_ERROR]', err);
    return res.status(500).json({ error: 'Failed to revoke access', code: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/access/grants
 * List access grants.
 * - Patient: sees all their granted/revoked providers.
 * - Provider: sees patients who currently grant them access.
 */
router.get('/grants', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    if (user.role === 'patient') {
      const grants = await getGrantsForPatient(user.id);
      return res.json({ grants });
    } else if (user.role === 'provider') {
      const patients = await getActivePatientsForProvider(user.id);
      return res.json({ active_patients: patients });
    } else {
      // Admin sees all grants
      const allGrants = await db.query(`
        SELECT g.*, p.name as patient_name, doc.name as provider_name
        FROM access_grants g
        JOIN users p ON g.patient_id = p.id
        JOIN users doc ON g.provider_id = doc.id
        ORDER BY g.granted_at DESC
      `);
      return res.json({ grants: allGrants });
    }
  } catch (err) {
    console.error('[GET_GRANTS_ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve grants', code: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/access/providers
 * List available verified providers to allow patients to pick and grant access.
 */
router.get('/providers', authenticateToken, async (req, res) => {
  try {
    const providers = await db.query(
      `SELECT id, name, email, created_at FROM users WHERE role = 'provider' ORDER BY name ASC`
    );
    return res.json({ providers });
  } catch (err) {
    console.error('[GET_PROVIDERS_ERROR]', err);
    return res.status(500).json({ error: 'Failed to list providers', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
