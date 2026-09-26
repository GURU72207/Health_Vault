const assert = require('assert');
const bcrypt = require('bcryptjs');
const db = require('../src/database/db');
const { encrypt, decrypt, redactPII } = require('../src/services/cryptoService');
const { seedDatabase, PERSONAS } = require('../src/database/seed');
const { hasActiveConsent, grantAccess, revokeAccess } = require('../src/services/consentService');
const { getAuditLogsForPatient, getAuditLogsForProvider, logAuditEvent } = require('../src/services/auditService');

let passedTests = 0;
let failedTests = 0;

function it(description, fn) {
  try {
    fn();
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
  
  it('AES-256-GCM should encrypt plain text into IV:AuthTag:Ciphertext format', () => {
    const sensitiveClinicalNote = 'Patient diagnosed with Stage 2 Hypertension. Prescribed Lisinopril 20mg daily.';
    const cipherBlob = encrypt(sensitiveClinicalNote);
    
    assert(cipherBlob, 'Cipher blob should exist');
    assert.notStrictEqual(cipherBlob, sensitiveClinicalNote, 'Encrypted blob must never equal plaintext');
    
    const parts = cipherBlob.split(':');
    assert.strictEqual(parts.length, 3, 'Cipher blob must consist of iv:authTag:ciphertext');
    assert.strictEqual(parts[0].length, 24, 'IV length must be 12 bytes (24 hex characters)');
    assert.strictEqual(parts[1].length, 32, 'Auth tag length must be 16 bytes (32 hex characters)');
  });

  it('AES-256-GCM should correctly decrypt encrypted data back to exact original text', () => {
    const original = 'Confidential patient biopsy: Benign epithelial tissue.';
    const cipherBlob = encrypt(original);
    const decrypted = decrypt(cipherBlob);
    assert.strictEqual(decrypted, original, 'Decrypted text must match original plaintext exactly');
  });

  it('Tampered ciphertext must fail authentication and return error notice', () => {
    const original = 'Secret diagnosis';
    const cipherBlob = encrypt(original);
    const parts = cipherBlob.split(':');
    // Tamper with the ciphertext
    const tamperedCipher = parts[2].substring(0, parts[2].length - 2) + 'ff';
    const tamperedBlob = `${parts[0]}:${parts[1]}:${tamperedCipher}`;
    
    const result = decrypt(tamperedBlob);
    assert.strictEqual(result, '[ENCRYPTED_DATA_TAMPER_ERROR]', 'Tampered ciphertext must be detected by GCM auth tag');
  });

  it('Database persistence check: raw database records store encrypted ciphertext, NOT plaintext', async () => {
    const rawPatient = await db.queryOne(`SELECT address_encrypted FROM patients WHERE user_id = ?`, [PERSONAS.patientJohn.id]);
    assert(rawPatient, 'Patient record exists in DB');
    assert.strictEqual(rawPatient.address_encrypted.includes('Orchid Street'), false, 'Raw database must NOT contain plaintext address');
    assert.strictEqual(rawPatient.address_encrypted.split(':').length, 3, 'Raw database contains IV:Tag:Ciphertext');

    const rawVisit = await db.queryOne(`SELECT notes_encrypted FROM visits WHERE patient_id = ?`, [PERSONAS.patientJohn.id]);
    assert(rawVisit, 'Visit record exists in DB');
    assert.strictEqual(rawVisit.notes_encrypted.includes('Telmisartan'), false, 'Raw database must NOT contain plaintext clinical notes');
  });

  console.log('\n[SECTION 2: PASSWORD SECURITY & AUTHENTICATION]');

  it('Passwords stored in users table must be bcrypt hashes, never plaintext', async () => {
    const user = await db.queryOne(`SELECT password_hash FROM users WHERE email = ?`, [PERSONAS.patientJohn.email]);
    assert(user, 'User exists');
    assert.strictEqual(user.password_hash.startsWith('$2'), true, 'Password hash must start with bcrypt prefix ($2a$ or $2b$)');
    assert.notStrictEqual(user.password_hash, 'Password123!', 'Password must never be stored plaintext');
    
    const matches = await bcrypt.compare('Password123!', user.password_hash);
    assert.strictEqual(matches, true, 'Bcrypt compare must succeed for correct password');
  });

  console.log('\n[SECTION 3: CONSENT-GATED ACCESS CONTROL & RBAC]');

  it('Active consent check: Dr. Priya Sharma HAS active consent for John Doe', async () => {
    const granted = await hasActiveConsent(PERSONAS.patientJohn.id, PERSONAS.providerPriya.id);
    assert.strictEqual(granted, true, 'Dr. Priya must have active consent for John Doe');
  });

  it('Consent gating: Dr. Priya Sharma DOES NOT have active consent for Sarah Smith', async () => {
    const granted = await hasActiveConsent(PERSONAS.patientSarah.id, PERSONAS.providerPriya.id);
    assert.strictEqual(granted, false, 'Dr. Priya must NOT have consent for Sarah Smith by default');
  });

  it('Granting and revoking consent works dynamically and updates status', async () => {
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

  it('Logging an unauthorized access attempt records DENIED result in audit_logs', async () => {
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

  it('Patient audit query returns all provider interactions on their data', async () => {
    const logs = await getAuditLogsForPatient(PERSONAS.patientJohn.id);
    assert(Array.isArray(logs), 'Should return array of logs');
    assert(logs.length >= 1, 'John Doe should have baseline audit events');
  });

  console.log('\n[SECTION 5: PII SANITIZATION & LOG REDACTION]');

  it('redactPII utility strips passwords, medical notes, and tokens from logging payloads', () => {
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
