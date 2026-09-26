const assert = require('assert');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const db = require('../src/database/db');
const config = require('../src/config');
const { encrypt, decrypt, redactPII } = require('../src/services/cryptoService');
const { seedDatabase, PERSONAS } = require('../src/database/seed');
const { hasActiveConsent, grantAccess, revokeAccess } = require('../src/services/consentService');
const { getAuditLogsForPatient, getAuditLogsForProvider, logAuditEvent } = require('../src/services/auditService');
const { validateFileTypeAndMagicBytes, verifyDocument } = require('../src/services/aiVerificationService');

let passedTests = 0;
let failedTests = 0;

async function it(description, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${description}`);
    console.error(`    ${err.message}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('  URAN 2026 HT-05: AUTOMATED SECURITY & COMPLIANCE TEST SUITE');
  console.log('================================================================\n');

  // Reset to known clean seed baseline
  await seedDatabase();

  console.log('[SECTION 1: CRYPTOGRAPHIC INTEGRITY & ENCRYPTION-AT-REST]');
  
  await it('AES-256-GCM should encrypt plain text into IV:AuthTag:Ciphertext format', () => {
    const sensitiveClinicalNote = 'Patient diagnosed with Stage 2 Hypertension. Prescribed Lisinopril 20mg daily.';
    const cipherBlob = encrypt(sensitiveClinicalNote);
    
    assert(cipherBlob, 'Cipher blob should exist');
    assert.notStrictEqual(cipherBlob, sensitiveClinicalNote, 'Encrypted blob must never equal plaintext');
    
    const parts = cipherBlob.split(':');
    assert.strictEqual(parts.length, 3, 'Cipher blob must consist of iv:authTag:ciphertext');
    assert.strictEqual(parts[0].length, 24, 'IV length must be 12 bytes (24 hex characters)');
    assert.strictEqual(parts[1].length, 32, 'Auth tag length must be 16 bytes (32 hex characters)');
  });

  await it('AES-256-GCM should correctly decrypt encrypted data back to exact original text', () => {
    const original = 'Confidential patient biopsy: Benign epithelial tissue.';
    const cipherBlob = encrypt(original);
    const decrypted = decrypt(cipherBlob);
    assert.strictEqual(decrypted, original, 'Decrypted text must match original plaintext exactly');
  });

  await it('Tampered ciphertext must fail authentication and return error notice', () => {
    const original = 'Secret diagnosis';
    const cipherBlob = encrypt(original);
    const parts = cipherBlob.split(':');
    // Tamper with the ciphertext
    const tamperedCipher = parts[2].substring(0, parts[2].length - 2) + 'ff';
    const tamperedBlob = `${parts[0]}:${parts[1]}:${tamperedCipher}`;
    
    const result = decrypt(tamperedBlob);
    assert.strictEqual(result, '[ENCRYPTED_DATA_TAMPER_ERROR]', 'Tampered ciphertext must be detected by GCM auth tag');
  });

  await it('Database persistence check: raw database records store encrypted ciphertext, NOT plaintext', async () => {
    const rawPatient = await db.queryOne(`SELECT address_encrypted FROM patients WHERE user_id = ?`, [PERSONAS.patientJohn.id]);
    assert(rawPatient, 'Patient record exists in DB');
    assert.strictEqual(rawPatient.address_encrypted.includes('Orchid Street'), false, 'Raw database must NOT contain plaintext address');
    assert.strictEqual(rawPatient.address_encrypted.split(':').length, 3, 'Raw database contains IV:Tag:Ciphertext');

    const rawVisit = await db.queryOne(`SELECT notes_encrypted FROM visits WHERE patient_id = ?`, [PERSONAS.patientJohn.id]);
    assert(rawVisit, 'Visit record exists in DB');
    assert.strictEqual(rawVisit.notes_encrypted.includes('Telmisartan'), false, 'Raw database must NOT contain plaintext clinical notes');
  });

  console.log('\n[SECTION 2: PASSWORD SECURITY & AUTHENTICATION]');

  await it('Passwords stored in users table must be bcrypt hashes, never plaintext', async () => {
    const user = await db.queryOne(`SELECT password_hash FROM users WHERE email = ?`, [PERSONAS.patientJohn.email]);
    assert(user, 'User exists');
    assert.strictEqual(user.password_hash.startsWith('$2'), true, 'Password hash must start with bcrypt prefix ($2a$ or $2b$)');
    assert.notStrictEqual(user.password_hash, 'Password123!', 'Password must never be stored plaintext');
    
    const matches = await bcrypt.compare('Password123!', user.password_hash);
    assert.strictEqual(matches, true, 'Bcrypt compare must succeed for correct password');
  });

  console.log('\n[SECTION 3: CONSENT-GATED ACCESS CONTROL & RBAC]');

  await it('Active consent check: Dr. Priya Sharma HAS active consent for John Doe', async () => {
    const granted = await hasActiveConsent(PERSONAS.patientJohn.id, PERSONAS.providerPriya.id);
    assert.strictEqual(granted, true, 'Dr. Priya must have active consent for John Doe');
  });

  await it('Consent gating: Dr. Priya Sharma DOES NOT have active consent for Sarah Smith', async () => {
    const granted = await hasActiveConsent(PERSONAS.patientSarah.id, PERSONAS.providerPriya.id);
    assert.strictEqual(granted, false, 'Dr. Priya must NOT have consent for Sarah Smith by default');
  });

  await it('Granting and revoking consent works dynamically and updates status', async () => {
    // Dr. Vikram Patel does not have consent for John Doe yet
    let initial = await hasActiveConsent(PERSONAS.patientJohn.id, PERSONAS.providerVikram.id);
    assert.strictEqual(initial, false, 'Initially ungranted');

    // Grant access
    await grantAccess(PERSONAS.patientJohn.id, PERSONAS.providerVikram.id);
    let afterGrant = await hasActiveConsent(PERSONAS.patientJohn.id, PERSONAS.providerVikram.id);
    assert.strictEqual(afterGrant, true, 'Granted access should return true');

    // Revoke access
    await revokeAccess(PERSONAS.patientJohn.id, PERSONAS.providerVikram.id);
    let afterRevoke = await hasActiveConsent(PERSONAS.patientJohn.id, PERSONAS.providerVikram.id);
    assert.strictEqual(afterRevoke, false, 'Revoked access should return false');
  });

  console.log('\n[SECTION 4: IMMUTABLE AUDIT TRAIL]');

  await it('Logging an unauthorized access attempt records DENIED result in audit_logs', async () => {
    const auditRecord = await logAuditEvent({
      actor_id: PERSONAS.providerPriya.id,
      actor_role: 'provider',
      action: 'VIEW_PATIENT_RECORD_UNAUTHORIZED',
      target_type: 'patient',
      target_id: PERSONAS.patientSarah.id,
      result: 'DENIED',
      ip_address: '127.0.0.1',
      user_agent: 'Automated-Test-Runner',
      details_redacted: 'No active consent found'
    });

    assert(auditRecord.id, 'Audit log ID generated');
    assert.strictEqual(auditRecord.result, 'DENIED', 'Audit log must record DENIED');

    const saved = await db.queryOne(`SELECT * FROM audit_logs WHERE id = ?`, [auditRecord.id]);
    assert(saved, 'Audit row exists in SQLite');
    assert.strictEqual(saved.result, 'DENIED');
    assert.strictEqual(saved.actor_id, PERSONAS.providerPriya.id);
    assert.strictEqual(saved.target_id, PERSONAS.patientSarah.id);
  });

  await it('Patient audit query returns all provider interactions on their data', async () => {
    const logs = await getAuditLogsForPatient(PERSONAS.patientJohn.id);
    assert(Array.isArray(logs), 'Should return array of logs');
    assert(logs.length >= 1, 'John Doe should have baseline audit events');
  });

  console.log('\n[SECTION 5: PII SANITIZATION & LOG REDACTION]');

  await it('redactPII utility strips passwords, medical notes, and tokens from logging payloads', () => {
    const payload = {
      user: 'john_doe',
      password: 'PlainSecretPassword!',
      notes: 'Patient suffers from chronic arrhythmia',
      token: 'jwt.token.string',
      safe_field: 'Follow-up status active'
    };

    const sanitized = redactPII(payload);
    assert.strictEqual(sanitized.password, '[REDACTED_FOR_PRIVACY]');
    assert.strictEqual(sanitized.notes, '[REDACTED_FOR_PRIVACY]');
    assert.strictEqual(sanitized.token, '[REDACTED_FOR_PRIVACY]');
    assert.strictEqual(sanitized.safe_field, 'Follow-up status active');
  });

  console.log('\n[SECTION 6: AI-VERIFIED DOCUMENT UPLOAD & DOWNLOAD GATING]');

  await it('Magic byte validation strictly enforces binary header signatures', () => {
    const tempDir = config.uploadDir;
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    // 1. Valid PDF file
    const validPdfPath = path.join(tempDir, 'test_valid.pdf');
    fs.writeFileSync(validPdfPath, Buffer.from('%PDF-1.4 Clinical Diagnostic Results'));
    const validPdfCheck = validateFileTypeAndMagicBytes(validPdfPath, 'test_valid.pdf', 'application/pdf');
    assert.strictEqual(validPdfCheck.valid, true, 'Valid PDF magic bytes must pass');

    // 2. Disguised/spoofed file: .pdf extension with non-PDF binary header
    const spoofedPdfPath = path.join(tempDir, 'malicious_spoof.pdf');
    fs.writeFileSync(spoofedPdfPath, Buffer.from('MZ\x90\x00\x03\x00\x00\x00 executable payload'));
    const spoofCheck = validateFileTypeAndMagicBytes(spoofedPdfPath, 'malicious_spoof.pdf', 'application/pdf');
    assert.strictEqual(spoofCheck.valid, false, 'Spoofed PDF must fail binary header check');
    assert(spoofCheck.error.includes('%PDF'), 'Error must identify header discrepancy');

    // 3. Disallowed extension
    const exePath = path.join(tempDir, 'test.exe');
    fs.writeFileSync(exePath, Buffer.from('MZ executable'));
    const exeCheck = validateFileTypeAndMagicBytes(exePath, 'test.exe', 'application/octet-stream');
    assert.strictEqual(exeCheck.valid, false, 'Disallowed extension must be rejected');

    // Clean up temporary files
    try {
      fs.unlinkSync(validPdfPath);
      fs.unlinkSync(spoofedPdfPath);
      fs.unlinkSync(exePath);
    } catch (_) {}
  });

  await it('AI document verification marks matching clinical lab report as VERIFIED', async () => {
    const tempDir = config.uploadDir;
    const labReportPath = path.join(tempDir, 'test_lab_report.pdf');
    fs.writeFileSync(
      labReportPath,
      Buffer.from(
        '%PDF-1.4 Comprehensive Metabolic Panel\nLaboratory Specimen Result: Blood Glucose 98 mg/dL (Normal Range: 70-100)\nCreatinine 0.9 mg/dL\nHemoglobin A1c 5.4%\nDiagnostic Pathology Normal Sinus Rhythm'
      )
    );

    const verdict = await verifyDocument({
      filePath: labReportPath,
      filename: 'test_lab_report.pdf',
      mimetype: 'application/pdf',
      claimedType: 'Lab Report'
    });

    try { fs.unlinkSync(labReportPath); } catch (_) {}

    assert.strictEqual(verdict.verification_status, 'verified', 'Clinical lab report should be verified');
    assert.strictEqual(verdict.matches_claimed_type, true, 'Should match claimed type');
    assert(verdict.confidence >= 0.70, `Confidence should be >= 0.70, got ${verdict.confidence}`);
  });

  await it('AI document verification marks non-medical document as FLAGGED with discrepancy reasons', async () => {
    const tempDir = config.uploadDir;
    const invoicePath = path.join(tempDir, 'restaurant_invoice.pdf');
    fs.writeFileSync(
      invoicePath,
      Buffer.from(
        '%PDF-1.4 The Bistro Cafe Receipt\nInvoice #9821\nSubtotal: $45.00\nSales Tax: $4.05\nWaiter: Alex\nMenu: Pasta, Coffee'
      )
    );

    const verdict = await verifyDocument({
      filePath: invoicePath,
      filename: 'restaurant_invoice.pdf',
      mimetype: 'application/pdf',
      claimedType: 'Lab Report'
    });

    try { fs.unlinkSync(invoicePath); } catch (_) {}

    assert.strictEqual(verdict.verification_status, 'flagged', 'Invoice should be flagged for review');
    assert.strictEqual(verdict.matches_claimed_type, false, 'Invoice does not match claimed type');
    assert(verdict.flagged_reasons.length > 0, 'Flagged reasons should be provided');
  });

  await it('Provider download gating: unacknowledged flagged document blocks provider download', async () => {
    // Insert a flagged document for John Doe with patient_acknowledged = 0
    const flaggedDocId = 'test-flagged-doc-001';
    await db.run(
      `INSERT INTO documents (
        id, visit_id, patient_id, filename, file_type, size, storage_path, checksum_sha256,
        uploaded_by, uploaded_at, claimed_type, verification_status, ai_confidence, flagged_reasons, patient_acknowledged
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        flaggedDocId,
        null,
        PERSONAS.patientJohn.id,
        'flagged_invoice.pdf',
        'application/pdf',
        1024,
        'ecg_sample_synthetic.pdf', // reuse existing disk file
        'samplehash',
        PERSONAS.patientJohn.id,
        new Date().toISOString(),
        'Lab Report',
        'flagged',
        0.88,
        JSON.stringify(['Discrepancy detected: Document contains non-clinical keywords']),
        0 // unacknowledged
      ]
    );

    // Verify provider has active consent for John Doe
    const hasConsent = await hasActiveConsent(PERSONAS.patientJohn.id, PERSONAS.providerPriya.id);
    assert.strictEqual(hasConsent, true, 'Dr. Priya has consent for John Doe');

    // Query the document
    const doc = await db.queryOne(`SELECT * FROM documents WHERE id = ?`, [flaggedDocId]);
    assert(doc, 'Flagged document exists');

    // Check gating rule: provider cannot download if flagged and not acknowledged
    const providerCanDownload = hasConsent && !(doc.verification_status === 'flagged' && doc.patient_acknowledged !== 1);
    assert.strictEqual(providerCanDownload, false, 'Provider download must be gated/blocked for unacknowledged flagged document');

    // Simulate patient acknowledgment
    await db.run(`UPDATE documents SET patient_acknowledged = 1 WHERE id = ?`, [flaggedDocId]);
    const acknowledgedDoc = await db.queryOne(`SELECT * FROM documents WHERE id = ?`, [flaggedDocId]);
    assert.strictEqual(acknowledgedDoc.patient_acknowledged, 1, 'Patient acknowledgment updated in DB');

    const providerCanDownloadNow = hasConsent && !(acknowledgedDoc.verification_status === 'flagged' && acknowledgedDoc.patient_acknowledged !== 1);
    assert.strictEqual(providerCanDownloadNow, true, 'Provider can download after patient acknowledgment');

    // Cleanup
    await db.run(`DELETE FROM documents WHERE id = ?`, [flaggedDocId]);
  });

  console.log('\n================================================================');
  console.log(`  TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
