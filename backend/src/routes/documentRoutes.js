const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const db = require('../database/db');
const { logAuditEvent } = require('../services/auditService');
const { hasActiveConsent } = require('../services/consentService');
const { authenticateToken } = require('../middleware/authMiddleware');

// Configure Multer storage: files stored on disk with UUID names, metadata in DB
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(config.uploadDir)) {
      fs.mkdirSync(config.uploadDir, { recursive: true });
    }
    cb(null, config.uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const safeName = `${uuidv4()}${ext}`;
    cb(null, safeName);
  }
});

// Allowed safe mime types for medical health records
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword'
];

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB limit
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type '${file.mimetype}' is not permitted. Only PDF, Images, and text documents allowed.`));
    }
  }
});

/**
 * POST /api/documents
 * Multipart upload for health documents (lab reports, prescriptions, radiology scans).
 * Stores metadata in DB, physical blob in storage folder. Never logs file contents.
 */
router.post('/', authenticateToken, upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded', code: 'FILE_MISSING' });
  }

  const { patient_id, visit_id } = req.body;
  const user = req.user;

  const targetPatientId = patient_id || (user.role === 'patient' ? user.id : null);
  if (!targetPatientId) {
    // Clean up uploaded file if patient id not provided
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'patient_id is required', code: 'PATIENT_ID_REQUIRED' });
  }

  // RBAC & Consent check
  if (user.role === 'patient' && user.id !== targetPatientId) {
    fs.unlinkSync(req.file.path);
    await logAuditEvent({
      actor_id: user.id,
      actor_role: user.role,
      action: 'UNAUTHORIZED_DOCUMENT_UPLOAD',
      target_type: 'patient',
      target_id: targetPatientId,
      result: 'DENIED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details_redacted: 'Patient attempted upload for different patient'
    });
    return res.status(403).json({ error: 'Forbidden: Cannot upload to another patient', code: 'FORBIDDEN' });
  }

  if (user.role === 'provider') {
    const isGranted = await hasActiveConsent(targetPatientId, user.id);
    if (!isGranted) {
      fs.unlinkSync(req.file.path);
      await logAuditEvent({
        actor_id: user.id,
        actor_role: user.role,
        action: 'UNAUTHORIZED_DOCUMENT_UPLOAD',
        target_type: 'patient',
        target_id: targetPatientId,
        result: 'DENIED',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details_redacted: 'Provider lacks active consent to upload document'
      });
      return res.status(403).json({
        error: 'Access Denied: Patient has not granted consent to upload documents',
        code: 'CONSENT_NOT_GRANTED'
      });
    }
  }

  try {
    // Compute SHA-256 checksum for cryptographic proof of file integrity
    const fileBuffer = fs.readFileSync(req.file.path);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const documentId = uuidv4();
    const uploadedAt = new Date().toISOString();

    await db.run(
      `INSERT INTO documents (
        id, visit_id, patient_id, filename, file_type, size, storage_path, checksum_sha256, uploaded_by, uploaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        documentId,
        visit_id || null,
        targetPatientId,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.file.filename, // only relative stored name, not full server path
        checksum,
        user.id,
        uploadedAt
      ]
    );

    await logAuditEvent({
      actor_id: user.id,
      actor_role: user.role,
      action: 'UPLOAD_DOCUMENT',
      target_type: 'document',
      target_id: documentId,
      result: 'ALLOWED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details_redacted: {
        filename: req.file.originalname,
        file_type: req.file.mimetype,
        size_bytes: req.file.size,
        checksum_sha256: checksum,
        patient_id: targetPatientId
      }
    });

    return res.status(201).json({
      message: 'Document uploaded and indexed successfully',
      document: {
        id: documentId,
        visit_id: visit_id || null,
        patient_id: targetPatientId,
        filename: req.file.originalname,
        file_type: req.file.mimetype,
        size: req.file.size,
        checksum_sha256: checksum,
        uploaded_by: user.id,
        uploaded_at: uploadedAt
      }
    });
  } catch (err) {
    console.error('[DOCUMENT_UPLOAD_ERROR]', err);
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ error: 'Failed to process document upload', code: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/documents
 * List all documents for a patient with consent validation.
 */
router.get('/', authenticateToken, async (req, res) => {
  const patientId = req.query.patient_id || (req.user.role === 'patient' ? req.user.id : null);
  const user = req.user;

  if (!patientId) {
    return res.status(400).json({ error: 'patient_id query parameter is required', code: 'MISSING_PARAM' });
  }

  // RBAC & Consent check
  if (user.role === 'patient' && user.id !== patientId) {
    return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
  }

  if (user.role === 'provider') {
    const isGranted = await hasActiveConsent(patientId, user.id);
    if (!isGranted) {
      await logAuditEvent({
        actor_id: user.id,
        actor_role: user.role,
        action: 'LIST_DOCUMENTS_UNAUTHORIZED',
        target_type: 'patient',
        target_id: patientId,
        result: 'DENIED',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details_redacted: 'No active consent to view patient documents'
      });
      return res.status(403).json({ error: 'Access Denied: Consent not granted', code: 'CONSENT_NOT_GRANTED' });
    }
  }

  try {
    const documents = await db.query(
      `SELECT d.id, d.visit_id, d.patient_id, d.filename, d.file_type, d.size,
              d.checksum_sha256, d.uploaded_by, d.uploaded_at, u.name as uploader_name
       FROM documents d
       JOIN users u ON d.uploaded_by = u.id
       WHERE d.patient_id = ?
       ORDER BY d.uploaded_at DESC`,
      [patientId]
    );

    await logAuditEvent({
      actor_id: user.id,
      actor_role: user.role,
      action: 'LIST_DOCUMENTS',
      target_type: 'patient',
      target_id: patientId,
      result: 'ALLOWED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details_redacted: { document_count: documents.length }
    });

    return res.json({ documents });
  } catch (err) {
    console.error('[GET_DOCUMENTS_ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve documents', code: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/documents/:id/download
 * Download the physical document file.
 * Strictly verifies consent prior to streaming file bytes.
 */
router.get('/:id/download', authenticateToken, async (req, res) => {
  const documentId = req.params.id;
  const user = req.user;

  try {
    const doc = await db.queryOne(`SELECT * FROM documents WHERE id = ?`, [documentId]);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found', code: 'NOT_FOUND' });
    }

    // Consent check
    if (user.role === 'patient' && user.id !== doc.patient_id) {
      await logAuditEvent({
        actor_id: user.id,
        actor_role: user.role,
        action: 'DOWNLOAD_DOCUMENT_UNAUTHORIZED',
        target_type: 'document',
        target_id: documentId,
        result: 'DENIED',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details_redacted: 'Patient attempted download of another patient file'
      });
      return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    }

    if (user.role === 'provider') {
      const isGranted = await hasActiveConsent(doc.patient_id, user.id);
      if (!isGranted) {
        await logAuditEvent({
          actor_id: user.id,
          actor_role: user.role,
          action: 'DOWNLOAD_DOCUMENT_UNAUTHORIZED',
          target_type: 'document',
          target_id: documentId,
          result: 'DENIED',
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          details_redacted: 'Provider attempted download without active consent'
        });
        return res.status(403).json({ error: 'Access Denied: Consent not granted', code: 'CONSENT_NOT_GRANTED' });
      }
    }

    const filePath = path.join(config.uploadDir, doc.storage_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File content missing on storage system', code: 'FILE_NOT_FOUND' });
    }

    await logAuditEvent({
      actor_id: user.id,
      actor_role: user.role,
      action: 'DOWNLOAD_DOCUMENT',
      target_type: 'document',
      target_id: documentId,
      result: 'ALLOWED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details_redacted: { filename: doc.filename, size: doc.size }
    });

    res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
    res.setHeader('Content-Type', doc.file_type);
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  } catch (err) {
    console.error('[DOWNLOAD_DOCUMENT_ERROR]', err);
    return res.status(500).json({ error: 'Failed to download document', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
