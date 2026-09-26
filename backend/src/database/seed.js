const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const { encrypt } = require('../services/cryptoService');
const config = require('../config');

// Deterministic synthetic UUIDs for predictable testing and judging evaluation
const PERSONAS = {
  patientJohn: {
    id: '11111111-1111-4000-8000-000000000001',
    name: 'John Doe',
    email: 'john.patient@demo.uran',
    password: 'Password123!',
    role: 'patient',
    dob: '1988-06-14',
    phone: '+1-555-0144',
    address: '42 Orchid Street, Tech City, TC 613403',
    blood_group: 'O+',
    emergency_contact: 'Mary Doe (+1-555-0145)'
  },
  patientSarah: {
    id: '22222222-2222-4000-8000-000000000002',
    name: 'Sarah Smith',
    email: 'sarah.patient@demo.uran',
    password: 'Password123!',
    role: 'patient',
    dob: '1994-11-23',
    phone: '+1-555-0188',
    address: '88 Cedar Crest Blvd, Green Valley, GV 613404',
    blood_group: 'A-',
    emergency_contact: 'David Smith (+1-555-0189)'
  },
  providerPriya: {
    id: '33333333-3333-4000-8000-000000000003',
    name: 'Dr. Priya Sharma, MD',
    email: 'priya.provider@demo.uran',
    password: 'Password123!',
    role: 'provider',
    specialty: 'Cardiology'
  },
  providerVikram: {
    id: '44444444-4444-4000-8000-000000000004',
    name: 'Dr. Vikram Patel, MD',
    email: 'vikram.provider@demo.uran',
    password: 'Password123!',
    role: 'provider',
    specialty: 'Neurology'
  },
  admin: {
    id: '99999999-9999-4000-8000-000000000009',
    name: 'Compliance Officer (Admin)',
    email: 'admin@demo.uran',
    password: 'AdminSecret123!',
    role: 'admin'
  }
};

async function seedDatabase() {
  console.log('[SEED] Initializing synthetic seed dataset for URAN 2026 HT-05...');

  // Reset database schema cleanly
  await db.resetDb();

  const saltRounds = 10;
  const commonHash = await bcrypt.hash('Password123!', saltRounds);
  const adminHash = await bcrypt.hash('AdminSecret123!', saltRounds);
  const now = new Date().toISOString();

  // 1. Insert Users
  console.log('[SEED] Seeding synthetic Users...');
  for (const persona of Object.values(PERSONAS)) {
    const hash = persona.role === 'admin' ? adminHash : commonHash;
    await db.run(
      `INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [persona.id, persona.name, persona.email, hash, persona.role, now]
    );
  }

  // 2. Insert Patients (with AES-256 encrypted addresses)
  console.log('[SEED] Seeding Patients with AES-256 encrypted demographics...');
  for (const patientKey of ['patientJohn', 'patientSarah']) {
    const p = PERSONAS[patientKey];
    const encryptedAddr = encrypt(p.address);
    await db.run(
      `INSERT INTO patients (user_id, dob, phone, address_encrypted, blood_group, emergency_contact) VALUES (?, ?, ?, ?, ?, ?)`,
      [p.id, p.dob, p.phone, encryptedAddr, p.blood_group, p.emergency_contact]
    );
  }

  // 3. Establish initial Consent Grants
  // John Doe grants access to Dr. Priya Sharma
  // Sarah Smith grants NO access to Dr. Priya Sharma (key for Access Denied demo!)
  console.log('[SEED] Establishing baseline consent grant: John Doe -> Dr. Priya Sharma...');
  const grantId1 = 'aaaaaaaa-1111-4000-8000-000000000001';
  await db.run(
    `INSERT INTO access_grants (id, patient_id, provider_id, granted_at, revoked_at) VALUES (?, ?, ?, ?, NULL)`,
    [grantId1, PERSONAS.patientJohn.id, PERSONAS.providerPriya.id, now]
  );

  // 4. Seed Clinical Visits & Records (notes AES-256 encrypted)
  console.log('[SEED] Seeding clinical visits with AES-256 encrypted notes & upcoming follow-ups...');
  
  // John Doe Visit 1: Cardiology consultation with follow-up
  const visitJohn1 = 'bbbbbbbb-1111-4000-8000-000000000001';
  const notesJohn1 = 'Patient presented with mild exertional dyspnea and stage-1 hypertension. Resting BP 142/90 mmHg, HR 78 bpm. ECG shows normal sinus rhythm without ST elevations. Initiating Telmisartan 40mg once daily in the morning. Advised low-sodium dietary regimen (DASH diet) and moderate aerobic exercise 30 min daily.';
  
  // Follow-up scheduled 10 days from today
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 10);
  const followUpDateJohn = targetDate.toISOString().split('T')[0];

  await db.run(
    `INSERT INTO visits (id, patient_id, provider_id, visit_date, record_type, title, notes_encrypted, follow_up_date, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)`,
    [
      visitJohn1,
      PERSONAS.patientJohn.id,
      PERSONAS.providerPriya.id,
      '2026-09-16',
      'Visit Note',
      'Cardiology Evaluation & BP Assessment',
      encrypt(notesJohn1),
      followUpDateJohn,
      now
    ]
  );

  // John Doe Visit 2: Prescription record
  const visitJohn2 = 'bbbbbbbb-2222-4000-8000-000000000002';
  const notesJohn2 = 'Rx: 1) Telmisartan 40mg PO QAM x 30 days, Refills: 3. 2) Aspirin 81mg PO daily with food. Monitor blood pressure daily and record in log.';
  await db.run(
    `INSERT INTO visits (id, patient_id, provider_id, visit_date, record_type, title, notes_encrypted, follow_up_date, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)`,
    [
      visitJohn2,
      PERSONAS.patientJohn.id,
      PERSONAS.providerPriya.id,
      '2026-09-16',
      'Prescription',
      'Antihypertensive Regimen Prescription',
      encrypt(notesJohn2),
      null,
      now
    ]
  );

  // Sarah Smith Visit 1: Private consultation with Dr. Vikram Patel
  const visitSarah1 = 'bbbbbbbb-3333-4000-8000-000000000003';
  const notesSarah1 = 'Initial neurological evaluation for episodic tension cephalalgia. Cranial nerves II-XII grossly intact. No focal motor or sensory deficits. Initiated magnesium glycinate 400mg daily. Follow-up in 3 weeks.';
  
  const targetDateSarah = new Date();
  targetDateSarah.setDate(targetDateSarah.getDate() + 21);
  const followUpDateSarah = targetDateSarah.toISOString().split('T')[0];

  await db.run(
    `INSERT INTO visits (id, patient_id, provider_id, visit_date, record_type, title, notes_encrypted, follow_up_date, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)`,
    [
      visitSarah1,
      PERSONAS.patientSarah.id,
      PERSONAS.providerVikram.id,
      '2026-09-18',
      'Consultation',
      'Neurological Assessment & Cephalalgia Review',
      encrypt(notesSarah1),
      followUpDateSarah,
      now
    ]
  );

  // 5. Seed Synthetic Document Metadata and Physical File
  console.log('[SEED] Creating synthetic sample medical document on disk...');
  const sampleDocName = 'ecg_trace_diagnostic_report.pdf';
  const sampleDocDiskName = 'ecg_sample_synthetic.pdf';
  const sampleDocPath = path.join(config.uploadDir, sampleDocDiskName);
  
  const syntheticPdfContent = `%PDF-1.4
% Synthetic ECG Clinical Test Report - URAN 2026 HT-05
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj
4 0 obj << /Length 120 >> stream
BT
/F1 14 Tf
72 700 Td
(URAN 2026 HT-05: Synthetic ECG Diagnostic Report for John Doe) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000115 00000 n 
0000000210 00000 n 
trailer << /Size 5 /Root 1 0 R >>
startxref
380
%%EOF`;

  fs.writeFileSync(sampleDocPath, syntheticPdfContent);
  const docChecksum = crypto.createHash('sha256').update(syntheticPdfContent).digest('hex');

  const docId = 'cccccccc-1111-4000-8000-000000000001';
  await db.run(
    `INSERT INTO documents (
      id, visit_id, patient_id, filename, file_type, size, storage_path, checksum_sha256,
      uploaded_by, uploaded_at, claimed_type, verification_status, ai_confidence, flagged_reasons, patient_acknowledged
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      docId,
      visitJohn1,
      PERSONAS.patientJohn.id,
      sampleDocName,
      'application/pdf',
      Buffer.byteLength(syntheticPdfContent),
      sampleDocDiskName,
      docChecksum,
      PERSONAS.providerPriya.id,
      now,
      'Lab Report',
      'verified',
      0.98,
      '[]',
      1
    ]
  );

  // 6. Seed Baseline Audit Logs
  console.log('[SEED] Seeding baseline immutable audit log entries...');
  await db.run(
    `INSERT INTO audit_logs (id, actor_id, actor_role, action, target_type, target_id, result, ip_address, user_agent, details_redacted, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'dddddddd-1111-4000-8000-000000000001',
      PERSONAS.patientJohn.id,
      'patient',
      'GRANT_CONSENT',
      'provider',
      PERSONAS.providerPriya.id,
      'ALLOWED',
      '127.0.0.1',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Patient explicitly granted medical record consent to Dr. Priya Sharma',
      now
    ]
  );

  await db.run(
    `INSERT INTO audit_logs (id, actor_id, actor_role, action, target_type, target_id, result, ip_address, user_agent, details_redacted, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'dddddddd-2222-4000-8000-000000000002',
      PERSONAS.providerPriya.id,
      'provider',
      'VIEW_VISITS_LIST',
      'patient',
      PERSONAS.patientJohn.id,
      'ALLOWED',
      '127.0.0.1',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Provider accessed granted patient clinical records',
      now
    ]
  );

  console.log('[SEED] Seed completed successfully!');
  return { success: true, personas: PERSONAS };
}

// Allow direct CLI execution: node src/database/seed.js
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('[SEED] Complete. Ready for judging evaluation.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[SEED] Error during seeding:', err);
      process.exit(1);
    });
}

module.exports = {
  seedDatabase,
  PERSONAS
};
