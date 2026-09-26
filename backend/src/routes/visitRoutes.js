const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { encrypt, decrypt } = require('../services/cryptoService');
const { logAuditEvent } = require('../services/auditService');
const { authenticateToken } = require('../middleware/authMiddleware');
const { enforcePatientAccess } = require('../middleware/rbacMiddleware');

/**
 * GET /api/visits
 * List visits/records for a patient.
 * Query param: patient_id (required or defaults to patient themselves).
 * Filters supported: record_type, provider_id, start_date, end_date, search.
 *
 * CRITICAL HACKATHON MOMENT:
 * If a provider tries to request visits for an ungranted patient,
 * enforcePatientAccess middleware immediately intercepts, logs DENIED in audit_logs,
 * and returns 403 Forbidden.
 */
router.get('/', authenticateToken, enforcePatientAccess('query', 'patient_id'), async (req, res) => {
  const patientId = req.targetPatientId || req.query.patient_id;
  const { record_type, provider_id, start_date, end_date, search } = req.query;

  try {
    let sql = `
      SELECT v.*, u.name as provider_name, u.email as provider_email
      FROM visits v
      JOIN users u ON v.provider_id = u.id
      WHERE v.patient_id = ?
    `;
    const params = [patientId];

    if (record_type) {
      sql += ` AND v.record_type = ?`;
      params.push(record_type);
    }

    if (provider_id) {
      sql += ` AND v.provider_id = ?`;
      params.push(provider_id);
    }

    if (start_date) {
      sql += ` AND v.visit_date >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      sql += ` AND v.visit_date <= ?`;
      params.push(end_date);
    }

    sql += ` ORDER BY v.visit_date DESC`;

    const rawVisits = await db.query(sql, params);

    // Decrypt notes at domain layer and attach attached documents
    let visits = await Promise.all(
      rawVisits.map(async (v) => {
        const decryptedNotes = decrypt(v.notes_encrypted);
        const docs = await db.query(
          `SELECT id, filename, file_type, size, uploaded_by, uploaded_at FROM documents WHERE visit_id = ?`,
          [v.id]
        );

        return {
          ...v,
          notes: decryptedNotes,
          notes_encrypted: v.notes_encrypted, // retained to demonstrate AES-256 ciphertext at rest
          documents: docs
        };
      })
    );

    // Optional in-memory search filter on title or decrypted notes
    if (search && search.trim() !== '') {
      const term = search.toLowerCase();
      visits = visits.filter(
        v => v.title.toLowerCase().includes(term) || (v.notes && v.notes.toLowerCase().includes(term))
      );
    }

    await logAuditEvent({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'VIEW_VISITS_LIST',
      target_type: 'patient',
      target_id: patientId,
      result: 'ALLOWED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details_redacted: {
        records_retrieved: visits.length,
        filter_type: record_type || 'all'
      }
    });

    return res.json({ visits });
  } catch (err) {
    console.error('[GET_VISITS_ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve visits', code: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/visits
 * Create a new health visit record (Clinical Note, Prescription, or Lab Report).
 * Encrypts diagnosis and clinical notes with AES-256-GCM.
 */
router.post('/', authenticateToken, enforcePatientAccess('body', 'patient_id'), async (req, res) => {
  const {
    patient_id,
    record_type = 'Visit Note',
    title,
    notes,
    visit_date,
    follow_up_date
  } = req.body;

  if (!patient_id || !title || !notes) {
    return res.status(400).json({
      error: 'patient_id, title, and notes are required fields',
      code: 'MISSING_FIELDS'
    });
  }

  try {
    const visitId = uuidv4();
    const providerId = req.user.role === 'provider' ? req.user.id : (req.body.provider_id || req.user.id);
    const currentDate = new Date().toISOString().split('T')[0];
    const visitDateFinal = visit_date || currentDate;
    const createdAt = new Date().toISOString();

    // Encrypt sensitive notes & diagnosis with AES-256-GCM
    const encryptedNotes = encrypt(notes);

    await db.run(
      `INSERT INTO visits (
        id, patient_id, provider_id, visit_date, record_type, title, notes_encrypted, follow_up_date, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        visitId,
        patient_id,
        providerId,
        visitDateFinal,
        record_type,
        title.trim(),
        encryptedNotes,
        follow_up_date || null,
        'completed',
        createdAt
      ]
    );

    await logAuditEvent({
      actor_id: req.user.id,
      actor_role: req.user.role,
      action: 'CREATE_VISIT_RECORD',
      target_type: 'visit',
      target_id: visitId,
      result: 'ALLOWED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details_redacted: {
        record_type,
        patient_id,
        has_followup: !!follow_up_date
      }
    });

    return res.status(201).json({
      message: 'Health record created successfully with AES-256 encrypted storage',
      visit: {
        id: visitId,
        patient_id,
        provider_id: providerId,
        visit_date: visitDateFinal,
        record_type,
        title,
        notes,
        notes_encrypted: encryptedNotes,
        follow_up_date: follow_up_date || null,
        created_at: createdAt
      }
    });
  } catch (err) {
    console.error('[CREATE_VISIT_ERROR]', err);
    return res.status(500).json({ error: 'Failed to create visit record', code: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/visits/:id
 * Retrieve a single visit record by ID with consent check.
 */
router.get('/:id', authenticateToken, async (req, res) => {
  const visitId = req.params.id;

  try {
    const visit = await db.queryOne(
      `SELECT v.*, u.name as provider_name, u.email as provider_email
       FROM visits v
       JOIN users u ON v.provider_id = u.id
       WHERE v.id = ?`,
      [visitId]
    );

    if (!visit) {
      return res.status(404).json({ error: 'Visit record not found', code: 'NOT_FOUND' });
    }

    // Consent check for the patient owning this visit
    const user = req.user;
    if (user.role === 'patient' && user.id !== visit.patient_id) {
      await logAuditEvent({
        actor_id: user.id,
        actor_role: user.role,
        action: 'UNAUTHORIZED_VISIT_ACCESS',
        target_type: 'visit',
        target_id: visitId,
        result: 'DENIED',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details_redacted: 'Cross patient visit access attempt'
      });
      return res.status(403).json({ error: 'Access Denied', code: 'FORBIDDEN' });
    }

    if (user.role === 'provider') {
      const { hasActiveConsent } = require('../services/consentService');
      const granted = await hasActiveConsent(visit.patient_id, user.id);
      if (!granted) {
        await logAuditEvent({
          actor_id: user.id,
          actor_role: user.role,
          action: 'VIEW_VISIT_UNAUTHORIZED',
          target_type: 'visit',
          target_id: visitId,
          result: 'DENIED',
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          details_redacted: 'No active consent for patient visit'
        });
        return res.status(403).json({ error: 'Access Denied: Patient has not granted consent', code: 'CONSENT_NOT_GRANTED' });
      }
    }

    const decryptedNotes = decrypt(visit.notes_encrypted);
    const docs = await db.query(
      `SELECT id, filename, file_type, size, uploaded_by, uploaded_at FROM documents WHERE visit_id = ?`,
      [visit.id]
    );

    await logAuditEvent({
      actor_id: user.id,
      actor_role: user.role,
      action: 'VIEW_VISIT_DETAIL',
      target_type: 'visit',
      target_id: visitId,
      result: 'ALLOWED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details_redacted: { visit_id: visitId }
    });

    return res.json({
      visit: {
        ...visit,
        notes: decryptedNotes,
        notes_encrypted: visit.notes_encrypted,
        documents: docs
      }
    });
  } catch (err) {
    console.error('[GET_VISIT_DETAIL_ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve visit', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
