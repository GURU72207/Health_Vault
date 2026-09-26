const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { encrypt, decrypt } = require('../services/cryptoService');
const { logAuditEvent } = require('../services/auditService');
const { getActivePatientsForProvider } = require('../services/consentService');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRoles, enforcePatientAccess } = require('../middleware/rbacMiddleware');

/**
 * GET /api/patients
 * List patients visible to the authenticated user.
 * - Patient: Sees only themselves.
 * - Provider: Sees ONLY patients who have granted active consent!
 * - Admin: Sees all patients.
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    let patients = [];

    if (user.role === 'patient') {
      const patient = await db.queryOne(
        `SELECT u.id, u.name, u.email, p.dob, p.phone, p.blood_group, p.emergency_contact, p.address_encrypted
         FROM users u
         JOIN patients p ON u.id = p.user_id
         WHERE u.id = ?`,
        [user.id]
      );
      if (patient) {
        patients = [{
          ...patient,
          address: decrypt(patient.address_encrypted),
          address_encrypted: patient.address_encrypted
        }];
      }
    } else if (user.role === 'provider') {
      // Privacy-Aware: Providers CANNOT see unshared patients!
      patients = await getActivePatientsForProvider(user.id);
    } else if (user.role === 'admin') {
      const allPatients = await db.query(
        `SELECT u.id, u.name, u.email, p.dob, p.phone, p.blood_group, p.emergency_contact, p.address_encrypted
         FROM users u
         JOIN patients p ON u.id = p.user_id
         ORDER BY u.name ASC`
      );
      patients = allPatients.map(p => ({
        ...p,
        address: decrypt(p.address_encrypted),
        address_encrypted: p.address_encrypted
      }));
    }

    await logAuditEvent({
      actor_id: user.id,
      actor_role: user.role,
      action: 'LIST_ACCESSIBLE_PATIENTS',
      target_type: 'patient_collection',
      target_id: 'all_visible',
      result: 'ALLOWED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details_redacted: { visible_count: patients.length }
    });

    return res.json({ patients });
  } catch (err) {
    console.error('[GET_PATIENTS_ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve patients list', code: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/patients/:id
 * Retrieve a specific patient profile.
 * Server-side RBAC enforces:
 * - Patient: can only view own profile.
 * - Provider: can only view if active consent exists (else 403 + DENIED audit log).
 */
router.get('/:id', authenticateToken, enforcePatientAccess('param', 'id'), async (req, res) => {
  const patientId = req.params.id;

  try {
    const patient = await db.queryOne(
      `SELECT u.id, u.name, u.email, u.role, u.created_at,
              p.dob, p.phone, p.address_encrypted, p.blood_group, p.emergency_contact
       FROM users u
       JOIN patients p ON u.id = p.user_id
       WHERE u.id = ?`,
      [patientId]
    );

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found', code: 'PATIENT_NOT_FOUND' });
    }

    const decryptedAddress = decrypt(patient.address_encrypted);

    await logAuditEvent({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'VIEW_PATIENT_PROFILE',
      target_type: 'patient',
      target_id: patientId,
      result: 'ALLOWED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details_redacted: { patient_id: patientId }
    });

    return res.json({
      patient: {
        ...patient,
        address: decryptedAddress,
        address_encrypted: patient.address_encrypted // proof of AES-256 encryption at rest
      }
    });
  } catch (err) {
    console.error('[GET_PATIENT_PROFILE_ERROR]', err);
    return res.status(500).json({ error: 'Failed to fetch patient profile', code: 'SERVER_ERROR' });
  }
});

/**
 * PUT /api/patients/:id
 * Patient updates their own demographics.
 * Encrypts address with AES-256 before saving to disk.
 */
router.put('/:id', authenticateToken, requireRoles('patient', 'admin'), enforcePatientAccess('param', 'id'), async (req, res) => {
  const patientId = req.params.id;
  const { dob, phone, address, blood_group, emergency_contact, name } = req.body;

  try {
    if (name) {
      await db.run(`UPDATE users SET name = ? WHERE id = ?`, [name.trim(), patientId]);
    }

    const existingPatient = await db.queryOne(`SELECT * FROM patients WHERE user_id = ?`, [patientId]);
    if (!existingPatient) {
      return res.status(404).json({ error: 'Patient profile not found', code: 'NOT_FOUND' });
    }

    const newEncryptedAddress = address !== undefined ? encrypt(address) : existingPatient.address_encrypted;

    await db.run(
      `UPDATE patients SET
        dob = COALESCE(?, dob),
        phone = COALESCE(?, phone),
        address_encrypted = ?,
        blood_group = COALESCE(?, blood_group),
        emergency_contact = COALESCE(?, emergency_contact)
       WHERE user_id = ?`,
      [
        dob || null,
        phone || null,
        newEncryptedAddress,
        blood_group || null,
        emergency_contact || null,
        patientId
      ]
    );

    await logAuditEvent({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'UPDATE_PATIENT_PROFILE',
      target_type: 'patient',
      target_id: patientId,
      result: 'ALLOWED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details_redacted: 'Profile demographics updated; sensitive address re-encrypted'
    });

    return res.json({
      message: 'Profile updated successfully',
      patient_id: patientId
    });
  } catch (err) {
    console.error('[UPDATE_PATIENT_PROFILE_ERROR]', err);
    return res.status(500).json({ error: 'Failed to update patient profile', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
