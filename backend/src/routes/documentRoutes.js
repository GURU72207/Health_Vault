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
const { validateFileTypeAndMagicBytes, verifyDocument } = require('../services/aiVerificationService');

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

// Allowed safe mime types for medical health records: PDF, JPG, PNG, DOCX
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.docx'];

const upload = multer({
  storage: storage,
  limits: {
    fileSize: (config.maxFileSizeMb || 10) * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype.toLowerCase();

    if (ALLOWED_EXTENSIONS.includes(ext) && ALLOWED_MIME_TYPES.includes(mime)) {
      cb(null, true);
    } else {
      cb(new Error(`File type rejected. Only PDF, JPG, PNG, and DOCX formats are permitted.`));
    }
  }
});

// Safe wrapper middleware to handle Multer validation and size errors cleanly
function handleUpload(req, res, next) {
  upload.single('document')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: `File size exceeds the configured maximum limit of ${config.maxFileSizeMb || 10}MB`,
          code: 'FILE_TOO_LARGE'
        });
      }
      return res.status(400).json({ error: err.message, code: 'UPLOAD_ERROR' });
    } else if (err) {
      return res.status(400).json({ error: err.message, code: 'INVALID_FILE_TYPE' });
    }
    next();
  });
}

/**
 * POST /api/documents
 * Multipart upload for health documents (lab reports, prescriptions, radiology scans).
 * Stores metadata in DB, physical blob in storage folder. Never logs raw file contents or PII.
 * Enforces server-side AI verification pass before marking document status.
 */
router.post('/', authenticateToken, handleUpload, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded', code: 'FILE_MISSING' });
  }

  const { patient_id, visit_id, claimed_type } = req.body;
  const user = req.user;
  const claimedType = claimed_type || 'Lab Report';

  const targetPatientId = patient_id || (user.role === 'patient' ? user.id : null);
  if (!targetPatientId) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'patient_id is required', code: 'PATIENT_ID_REQUIRED' });
  }

  // RBAC & Consent check
  if (user.role === 'patient' && user.id !== targetPatientId) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
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
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
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

  // Validate binary magic bytes strictly on disk
  const magicValidation = validateFileTypeAndMagicBytes(req.file.path, req.file.originalname, req.file.mimetype);
  if (!magicValidation.valid) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    await logAuditEvent({
      actor_id: user.id,
      actor_role: user.role,
      action: 'DOCUMENT_UPLOAD_FAILED',
      target_type: 'document',
      target_id: 'rejected_binary',
      result: 'DENIED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details_redacted: { reason: magicValidation.error, filename: req.file.originalname }
    });
    return res.status(400).json({ error: magicValidation.error, code: 'INVALID_FILE_SIGNATURE' });
  }

  try {
    // Run Server-side AI Verification Pass
    const aiVerdict = await verifyDocument({
      filePath: req.file.path,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      claimedType
    });

    const verificationStatus = aiVerdict.verification_status || 'pending';
    const aiConfidence = aiVerdict.confidence || 0.0;
    const flaggedReasons = JSON.stringify(aiVerdict.flagged_reasons || []);
    // If flagged, patient acknowledgment is required before provider download (default to 0)
    const patientAcknowledged = verificationStatus === 'verified' ? 1 : 0;

    // Compute SHA-256 checksum for cryptographic proof of file integrity
    const fileBuffer = fs.readFileSync(req.file.path);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const documentId = uuidv4();
    const uploadedAt = new Date().toISOString();

    await db.run(
      `INSERT INTO documents (
        id, visit_id, patient_id, filename, file_type, size, storage_path, checksum_sha256,
        uploaded_by, uploaded_at, claimed_type, verification_status, ai_confidence, flagged_reasons, patient_acknowledged
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        documentId,
        visit_id || null,
        targetPatientId,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.file.filename,
        checksum,
        user.id,
        uploadedAt,
        claimedType,
        verificationStatus,
        aiConfidence,
        flaggedReasons,
        patientAcknowledged
      ]
    );

    // Audit log upload event - NEVER logs raw content or PII, only verdict metadata
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
        patient_id: targetPatientId,
        claimed_type: claimedType,
        verification_status: verificationStatus,
        ai_confidence: aiConfidence,
        flagged_reasons: aiVerdict.flagged_reasons
      }
    });

    return res.status(201).json({
      message: 'Document uploaded and verified successfully',
      document: {
        id: documentId,
        visit_id: visit_id || null,
        patient_id: targetPatientId,
        filename: req.file.originalname,
        file_type: req.file.mimetype,
        size: req.file.size,
        checksum_sha256: checksum,
        uploaded_by: user.id,
        uploaded_at: uploadedAt,
        claimed_type: claimedType,
        verification_status: verificationStatus,
        ai_confidence: aiConfidence,
        flagged_reasons: aiVerdict.flagged_reasons || [],
        patient_acknowledged: patientAcknowledged
      },
      ai_verdict: {
        matches_claimed_type: aiVerdict.matches_claimed_type,
        confidence: aiConfidence,
        status: verificationStatus,
        flagged_reasons: aiVerdict.flagged_reasons || []
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
 * List all documents for a patient with consent validation and AI verification details.
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
    const rawDocuments = await db.query(
      `SELECT d.id, d.visit_id, d.patient_id, d.filename, d.file_type, d.size,
              d.checksum_sha256, d.uploaded_by, d.uploaded_at, d.claimed_type,
              d.verification_status, d.ai_confidence, d.flagged_reasons, d.patient_acknowledged,
              u.name as uploader_name
       FROM documents d
       JOIN users u ON d.uploaded_by = u.id
       WHERE d.patient_id = ?
       ORDER BY d.uploaded_at DESC`,
      [patientId]
    );

    const documents = rawDocuments.map(doc => {
      let parsedReasons = [];
      try {
        parsedReasons = typeof doc.flagged_reasons === 'string' ? JSON.parse(doc.flagged_reasons) : (doc.flagged_reasons || []);
      } catch (_) {
        parsedReasons = [];
      }
      return {
        ...doc,
        flagged_reasons: parsedReasons
      };
    });

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
 * Strictly verifies consent & AI verification status prior to streaming file bytes.
 * Provider CANNOT download flagged documents unless patient has acknowledged.
 */
router.get('/:id/download', authenticateToken, async (req, res) => {
  const documentId = req.params.id;
  const user = req.user;

  try {
    const doc = await db.queryOne(`SELECT * FROM documents WHERE id = ?`, [documentId]);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found', code: 'NOT_FOUND' });
    }

    // Patient consent check
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
      // 1. Consent check
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

      // 2. Flagged document acknowledgment gating
      if (doc.verification_status === 'flagged' && doc.patient_acknowledged !== 1) {
        await logAuditEvent({
          actor_id: user.id,
          actor_role: user.role,
          action: 'DOWNLOAD_DOCUMENT_UNAUTHORIZED',
          target_type: 'document',
          target_id: documentId,
          result: 'DENIED',
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          details_redacted: 'Provider download blocked: flagged document requires patient acknowledgment'
        });
        return res.status(403).json({
          error: 'Document flagged by AI verification and requires patient acknowledgment before provider access.',
          code: 'PATIENT_ACKNOWLEDGMENT_REQUIRED',
          verification_status: doc.verification_status
        });
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
      details_redacted: { filename: doc.filename, size: doc.size, verification_status: doc.verification_status }
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

/**
 * POST /api/documents/:id/acknowledge
 * Patient acknowledgment endpoint for flagged documents.
 * Allows patient to review reasons and approve document for clinical visibility.
 */
router.post('/:id/acknowledge', authenticateToken, async (req, res) => {
  const documentId = req.params.id;
  const user = req.user;

  try {
    const doc = await db.queryOne(`SELECT * FROM documents WHERE id = ?`, [documentId]);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found', code: 'NOT_FOUND' });
    }

    // Only the patient whose record this is can acknowledge
    if (user.role !== 'patient' || user.id !== doc.patient_id) {
      await logAuditEvent({
        actor_id: user.id,
        actor_role: user.role,
        action: 'ACKNOWLEDGE_DOCUMENT_UNAUTHORIZED',
        target_type: 'document',
        target_id: documentId,
        result: 'DENIED',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details_redacted: 'Non-patient or unauthorized user attempted to acknowledge document'
      });
      return res.status(403).json({ error: 'Only the patient can acknowledge this document', code: 'FORBIDDEN' });
    }

    await db.run(`UPDATE documents SET patient_acknowledged = 1 WHERE id = ?`, [documentId]);

    await logAuditEvent({
      actor_id: user.id,
      actor_role: user.role,
      action: 'ACKNOWLEDGE_DOCUMENT',
      target_type: 'document',
      target_id: documentId,
      result: 'ALLOWED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details_redacted: { document_id: documentId, filename: doc.filename, status: doc.verification_status }
    });

    return res.json({
      message: 'Document successfully acknowledged by patient. Available for provider review.',
      document_id: documentId,
      patient_acknowledged: 1
    });
  } catch (err) {
    console.error('[ACKNOWLEDGE_DOCUMENT_ERROR]', err);
    return res.status(500).json({ error: 'Failed to acknowledge document', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
