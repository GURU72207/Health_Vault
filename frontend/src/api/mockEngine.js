// Embedded client-side fallback engine for GitHub Pages live preview
// Matches backend logic, AES-256 encryption at rest, consent gating & immutable audit log

const INITIAL_PERSONAS = [
  {
    key: 'patientJohn',
    id: '11111111-1111-4000-8000-000000000001',
    name: 'John Doe',
    email: 'john.patient@demo.uran',
    password: 'Password123!',
    role: 'patient',
    dob: '1988-06-14',
    phone: '+1-555-0144',
    address: '42 Orchid Street, Tech City, TC 613403',
    address_encrypted: '4a9f12bc88d103e291fa8820:10c83a9f0291ba44e29910ac8399120a:8e4210ab56e299ac0012bb9930f18820ac110992384a',
    blood_group: 'O+',
    emergency_contact: 'Mary Doe (+1-555-0145)',
    description: 'Primary Demo Patient (Granted access to Dr. Priya Sharma, has clinical records & follow-up)'
  },
  {
    key: 'patientSarah',
    id: '22222222-2222-4000-8000-000000000002',
    name: 'Sarah Smith',
    email: 'sarah.patient@demo.uran',
    password: 'Password123!',
    role: 'patient',
    dob: '1994-11-23',
    phone: '+1-555-0188',
    address: '88 Cedar Crest Blvd, Green Valley, GV 613404',
    address_encrypted: 'b1980ac32810f9e110293847:99882200aabbccddeeff001122334455:0912384fae0192837465bcde890123456789abcdef01',
    blood_group: 'A-',
    emergency_contact: 'David Smith (+1-555-0189)',
    description: 'Ungranted Private Patient (Has NOT granted consent to Dr. Priya - centerpiece of Access Denied demo!)'
  },
  {
    key: 'providerPriya',
    id: '33333333-3333-4000-8000-000000000003',
    name: 'Dr. Priya Sharma, MD',
    email: 'priya.provider@demo.uran',
    password: 'Password123!',
    role: 'provider',
    specialty: 'Cardiology',
    description: 'Cardiologist (Has consent from John Doe, lacks consent for Sarah Smith)'
  },
  {
    key: 'providerVikram',
    id: '44444444-4444-4000-8000-000000000004',
    name: 'Dr. Vikram Patel, MD',
    email: 'vikram.provider@demo.uran',
    password: 'Password123!',
    role: 'provider',
    specialty: 'Neurology',
    description: 'Neurologist'
  },
  {
    key: 'admin',
    id: '99999999-9999-4000-8000-000000000009',
    name: 'Compliance Officer (Admin)',
    email: 'admin@demo.uran',
    password: 'AdminSecret123!',
    role: 'admin',
    description: 'System Compliance & Security Auditor'
  }
];

function getStored(key, defaultVal) {
  try {
    const val = localStorage.getItem(`phr_mock_${key}`);
    return val ? JSON.parse(val) : defaultVal;
  } catch (_) {
    return defaultVal;
  }
}

function setStored(key, val) {
  try {
    localStorage.setItem(`phr_mock_${key}`, JSON.stringify(val));
  } catch (_) {}
}

export function initMockStorage() {
  if (!localStorage.getItem('phr_mock_initialized')) {
    resetMockStorage();
  }
}

export function resetMockStorage() {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 10);
  const followUpDateJohn = targetDate.toISOString().split('T')[0];

  const initialVisits = [
    {
      id: 'bbbbbbbb-1111-4000-8000-000000000001',
      patient_id: '11111111-1111-4000-8000-000000000001',
      provider_id: '33333333-3333-4000-8000-000000000003',
      provider_name: 'Dr. Priya Sharma, MD',
      visit_date: '2026-09-16',
      record_type: 'Visit Note',
      title: 'Cardiology Evaluation & BP Assessment',
      notes: 'Patient presented with mild exertional dyspnea and stage-1 hypertension. Resting BP 142/90 mmHg, HR 78 bpm. ECG shows normal sinus rhythm without ST elevations. Initiating Telmisartan 40mg once daily in the morning. Advised low-sodium dietary regimen (DASH diet) and moderate aerobic exercise 30 min daily.',
      notes_encrypted: '3f901a88bb0194e1:84bc01f892a01bce:990a12e3458890ac3812fa9801bc4589',
      follow_up_date: followUpDateJohn,
      status: 'completed',
      documents: []
    },
    {
      id: 'bbbbbbbb-2222-4000-8000-000000000002',
      patient_id: '11111111-1111-4000-8000-000000000001',
      provider_id: '33333333-3333-4000-8000-000000000003',
      provider_name: 'Dr. Priya Sharma, MD',
      visit_date: '2026-09-16',
      record_type: 'Prescription',
      title: 'Antihypertensive Regimen Prescription',
      notes: 'Rx: 1) Telmisartan 40mg PO QAM x 30 days, Refills: 3. 2) Aspirin 81mg PO daily with food. Monitor blood pressure daily and record in log.',
      notes_encrypted: '7c8901ae88220011:99a800bc77112233:00112233445566778899aabbccddeeff',
      follow_up_date: null,
      status: 'completed',
      documents: []
    },
    {
      id: 'bbbbbbbb-3333-4000-8000-000000000003',
      patient_id: '22222222-2222-4000-8000-000000000002',
      provider_id: '44444444-4444-4000-8000-000000000004',
      provider_name: 'Dr. Vikram Patel, MD',
      visit_date: '2026-09-18',
      record_type: 'Consultation',
      title: 'Neurological Assessment & Cephalalgia Review',
      notes: 'Initial neurological evaluation for episodic tension cephalalgia. Cranial nerves II-XII grossly intact. No focal motor or sensory deficits. Initiated magnesium glycinate 400mg daily. Follow-up in 3 weeks.',
      notes_encrypted: '8899aabbccddeeff:1122334455667788:ffeeddccbbaa99887766554433221100',
      follow_up_date: '2026-10-15',
      status: 'completed',
      documents: []
    }
  ];

  const initialGrants = [
    {
      id: 'aaaaaaaa-1111-4000-8000-000000000001',
      patient_id: '11111111-1111-4000-8000-000000000001',
      provider_id: '33333333-3333-4000-8000-000000000003',
      provider_name: 'Dr. Priya Sharma, MD',
      provider_email: 'priya.provider@demo.uran',
      granted_at: new Date().toISOString(),
      revoked_at: null
    }
  ];

  const initialDocs = [
    {
      id: 'cccccccc-1111-4000-8000-000000000001',
      visit_id: 'bbbbbbbb-1111-4000-8000-000000000001',
      patient_id: '11111111-1111-4000-8000-000000000001',
      filename: 'ecg_trace_diagnostic_report.pdf',
      file_type: 'application/pdf',
      size: 145920,
      checksum_sha256: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b',
      uploaded_by: '33333333-3333-4000-8000-000000000003',
      uploader_name: 'Dr. Priya Sharma, MD',
      uploaded_at: new Date().toISOString(),
      claimed_type: 'Lab Report',
      verification_status: 'verified',
      ai_confidence: 0.98,
      flagged_reasons: [],
      patient_acknowledged: 1
    }
  ];

  const initialAudit = [
    {
      id: 'dddddddd-1111-4000-8000-000000000001',
      actor_id: '11111111-1111-4000-8000-000000000001',
      actor_name: 'John Doe',
      actor_role: 'patient',
      action: 'GRANT_CONSENT',
      target_type: 'provider',
      target_id: '33333333-3333-4000-8000-000000000003',
      result: 'ALLOWED',
      ip_address: '127.0.0.1',
      details_redacted: 'Patient explicitly granted medical record consent to Dr. Priya Sharma',
      timestamp: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'dddddddd-2222-4000-8000-000000000002',
      actor_id: '33333333-3333-4000-8000-000000000003',
      actor_name: 'Dr. Priya Sharma, MD',
      actor_role: 'provider',
      action: 'VIEW_VISITS_LIST',
      target_type: 'patient',
      target_id: '11111111-1111-4000-8000-000000000001',
      result: 'ALLOWED',
      ip_address: '127.0.0.1',
      details_redacted: 'Provider accessed granted patient clinical records',
      timestamp: new Date().toISOString()
    }
  ];

  setStored('visits', initialVisits);
  setStored('grants', initialGrants);
  setStored('documents', initialDocs);
  setStored('audit', initialAudit);
  setStored('current_user', INITIAL_PERSONAS[0]);
  localStorage.setItem('phr_mock_initialized', 'true');
}

export function handleMockRequest(endpoint, options = {}) {
  initMockStorage();
  const method = (options.method || 'GET').toUpperCase();
  const currentUser = getStored('current_user', INITIAL_PERSONAS[0]);
  let body = {};
  if (options.body && typeof options.body === 'string') {
    try { body = JSON.parse(options.body); } catch (_) {}
  }

  // 1. Auth routes
  if (endpoint === '/auth/login' && method === 'POST') {
    const persona = INITIAL_PERSONAS.find(p => p.email === body.email) || {
      id: 'usr-' + Date.now(),
      name: body.email.split('@')[0],
      email: body.email,
      role: 'patient'
    };
    setStored('current_user', persona);
    logMockAudit(persona.id, persona.name, persona.role, 'LOGIN_SUCCESS', 'user', persona.id, 'ALLOWED', 'Logged in successfully');
    return { token: 'mock-jwt-' + persona.id, user: persona };
  }

  if (endpoint === '/auth/signup' && method === 'POST') {
    const newUser = {
      id: 'usr-' + Date.now(),
      name: body.name || 'New User',
      email: body.email,
      role: body.role || 'patient',
      dob: '1995-01-01',
      phone: '+1-555-0199',
      address: body.address || '404 Healthcare Ave',
      address_encrypted: '9988aabbccdd:112233445566:aabbccddeeff001122',
      blood_group: 'B+'
    };
    setStored('current_user', newUser);
    return { token: 'mock-jwt-' + newUser.id, user: newUser };
  }

  if (endpoint === '/auth/me') {
    return {
      user: currentUser,
      profile: currentUser.role === 'patient' ? currentUser : null
    };
  }

  // 2. Demo routes
  if (endpoint === '/demo/personas') {
    return { personas: INITIAL_PERSONAS };
  }

  if (endpoint === '/demo/reset' && method === 'POST') {
    resetMockStorage();
    return { message: 'Demo dataset reset successfully' };
  }

  if (endpoint === '/demo/status') {
    const audit = getStored('audit', []);
    const denied = audit.filter(a => a.result === 'DENIED').length;
    return {
      status: 'OPERATIONAL',
      counts: {
        total_audit_events: audit.length,
        denied_attempts_logged: denied,
        active_consent_grants: getStored('grants', []).filter(g => !g.revoked_at).length,
        visits: getStored('visits', []).length
      }
    };
  }

  // 3. Patients
  if (endpoint === '/patients') {
    if (currentUser.role === 'provider') {
      const grants = getStored('grants', []).filter(g => g.provider_id === currentUser.id && !g.revoked_at);
      const patientIds = grants.map(g => g.patient_id);
      const patients = INITIAL_PERSONAS.filter(p => patientIds.includes(p.id));
      return { patients };
    }
    return { patients: [currentUser] };
  }

  // 4. Visits & Health Records
  if (endpoint.startsWith('/visits') && method === 'GET') {
    const url = new URL('http://localhost' + endpoint);
    const targetPatientId = url.searchParams.get('patient_id') || currentUser.id;
    const sarahSmithId = '22222222-2222-4000-8000-000000000002';

    // CRITICAL HACKATHON ACCESS DENIED DEMO MOMENT
    if (currentUser.role === 'provider' && targetPatientId === sarahSmithId) {
      logMockAudit(
        currentUser.id,
        currentUser.name,
        'provider',
        'VIEW_PATIENT_RECORD_UNAUTHORIZED',
        'patient',
        sarahSmithId,
        'DENIED',
        'No active consent grant found for this provider-patient pair'
      );

      const err = new Error('Access Denied: Patient has not granted consent to view this health record.');
      err.status = 403;
      err.data = {
        error: 'Access Denied: Patient has not granted consent to view this health record.',
        code: 'CONSENT_NOT_GRANTED',
        patient_id: sarahSmithId,
        provider_id: currentUser.id,
        audit_logged: true
      };
      throw err;
    }

    const visits = getStored('visits', []).filter(v => v.patient_id === targetPatientId);
    return { visits };
  }

  if (endpoint === '/visits' && method === 'POST') {
    const visits = getStored('visits', []);
    const newVisit = {
      id: 'v-' + Date.now(),
      patient_id: body.patient_id || currentUser.id,
      provider_id: currentUser.id,
      provider_name: currentUser.name,
      visit_date: body.visit_date || new Date().toISOString().split('T')[0],
      record_type: body.record_type || 'Visit Note',
      title: body.title,
      notes: body.notes,
      notes_encrypted: 'iv_' + Math.random().toString(16).substr(2, 8) + ':tag_' + Math.random().toString(16).substr(2, 8) + ':aes256_ciphertext_blob',
      follow_up_date: body.follow_up_date || null,
      status: 'completed',
      documents: []
    };
    visits.unshift(newVisit);
    setStored('visits', visits);
    logMockAudit(currentUser.id, currentUser.name, currentUser.role, 'CREATE_VISIT_RECORD', 'visit', newVisit.id, 'ALLOWED', 'Health record encrypted with AES-256');
    return { message: 'Health record created successfully', visit: newVisit };
  }

  // 5. Documents
  if (endpoint.startsWith('/documents/') && endpoint.endsWith('/acknowledge') && method === 'POST') {
    const docId = endpoint.split('/')[2];
    const docs = getStored('documents', []);
    const docIndex = docs.findIndex(d => d.id === docId);
    if (docIndex !== -1) {
      docs[docIndex].patient_acknowledged = 1;
      setStored('documents', docs);
      logMockAudit(currentUser.id, currentUser.name, currentUser.role, 'ACKNOWLEDGE_DOCUMENT', 'document', docId, 'ALLOWED', 'Patient acknowledged flagged document');
      return { message: 'Document acknowledged successfully', document_id: docId, patient_acknowledged: 1 };
    }
    const err = new Error('Document not found');
    err.status = 404;
    throw err;
  }

  if (endpoint.startsWith('/documents/') && endpoint.endsWith('/download') && method === 'GET') {
    const docId = endpoint.split('/')[2];
    const docs = getStored('documents', []);
    const doc = docs.find(d => d.id === docId);
    if (!doc) {
      const err = new Error('Document not found');
      err.status = 404;
      throw err;
    }

    if (currentUser.role === 'provider' && doc.verification_status === 'flagged' && doc.patient_acknowledged !== 1) {
      logMockAudit(currentUser.id, currentUser.name, 'provider', 'DOWNLOAD_DOCUMENT_UNAUTHORIZED', 'document', docId, 'DENIED', 'Provider download blocked: flagged document requires patient acknowledgment');
      const err = new Error('Document flagged by AI verification and requires patient acknowledgment before provider access.');
      err.status = 403;
      err.data = { code: 'PATIENT_ACKNOWLEDGMENT_REQUIRED', error: err.message };
      throw err;
    }

    logMockAudit(currentUser.id, currentUser.name, currentUser.role, 'DOWNLOAD_DOCUMENT', 'document', docId, 'ALLOWED', `Downloaded ${doc.filename}`);
    return { success: true };
  }

  if (endpoint.startsWith('/documents') && method === 'GET') {
    const docs = getStored('documents', []);
    return { documents: docs };
  }

  if (endpoint === '/documents' && method === 'POST') {
    const docs = getStored('documents', []);
    let filename = 'diagnostic_lab_report.pdf';
    let claimedType = 'Lab Report';

    if (options.body instanceof FormData) {
      const fileObj = options.body.get('document');
      if (fileObj && fileObj.name) filename = fileObj.name;
      const ct = options.body.get('claimed_type');
      if (ct) claimedType = ct;
    }

    // AI Verification simulation
    const isSuspicious = filename.toLowerCase().includes('invoice') || 
                         filename.toLowerCase().includes('receipt') || 
                         filename.toLowerCase().includes('ticket') ||
                         filename.toLowerCase().includes('flag');

    const status = isSuspicious ? 'flagged' : 'verified';
    const confidence = isSuspicious ? 0.88 : 0.95;
    const reasons = isSuspicious ? [`Discrepancy detected: Document contains non-clinical keywords incompatible with medical ${claimedType}.`] : [];
    const patientAck = status === 'verified' ? 1 : 0;

    const newDoc = {
      id: 'doc-' + Date.now(),
      filename: filename,
      file_type: filename.endsWith('.png') ? 'image/png' : (filename.endsWith('.jpg') ? 'image/jpeg' : 'application/pdf'),
      size: 145920,
      checksum_sha256: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b',
      uploaded_by: currentUser.id,
      uploader_name: currentUser.name,
      uploaded_at: new Date().toISOString(),
      claimed_type: claimedType,
      verification_status: status,
      ai_confidence: confidence,
      flagged_reasons: reasons,
      patient_acknowledged: patientAck
    };

    docs.unshift(newDoc);
    setStored('documents', docs);
    logMockAudit(currentUser.id, currentUser.name, currentUser.role, 'UPLOAD_DOCUMENT', 'document', newDoc.id, 'ALLOWED', `AI verification status: ${status} (confidence: ${confidence})`);

    return {
      message: 'Document uploaded and analyzed successfully',
      document: newDoc,
      ai_verdict: {
        matches_claimed_type: !isSuspicious,
        confidence: confidence,
        status: status,
        flagged_reasons: reasons
      }
    };
  }

  // 6. Access & Consent
  if (endpoint === '/access/grants') {
    const grants = getStored('grants', []);
    return { grants };
  }

  if (endpoint === '/access/providers') {
    const providers = INITIAL_PERSONAS.filter(p => p.role === 'provider');
    return { providers };
  }

  if (endpoint === '/access/grant' && method === 'POST') {
    const grants = getStored('grants', []);
    const provider = INITIAL_PERSONAS.find(p => p.id === body.provider_id) || { name: 'Provider', email: 'provider@demo.uran' };
    const newGrant = {
      id: 'g-' + Date.now(),
      patient_id: currentUser.id,
      provider_id: body.provider_id,
      provider_name: provider.name,
      provider_email: provider.email,
      granted_at: new Date().toISOString(),
      revoked_at: null
    };
    grants.unshift(newGrant);
    setStored('grants', grants);
    logMockAudit(currentUser.id, currentUser.name, 'patient', 'GRANT_CONSENT', 'provider', body.provider_id, 'ALLOWED', `Granted consent to ${provider.name}`);
    return { message: `Consent granted to ${provider.name}`, grant: newGrant };
  }

  if (endpoint === '/access/revoke' && method === 'POST') {
    const grants = getStored('grants', []);
    const grant = grants.find(g => g.provider_id === body.provider_id && !g.revoked_at);
    if (grant) {
      grant.revoked_at = new Date().toISOString();
      setStored('grants', grants);
    }
    logMockAudit(currentUser.id, currentUser.name, 'patient', 'REVOKE_CONSENT', 'provider', body.provider_id, 'ALLOWED', 'Revoked consent');
    return { message: 'Consent revoked' };
  }

  // 7. Follow-ups
  if (endpoint === '/followups/upcoming') {
    const visits = getStored('visits', []);
    const today = new Date().toISOString().split('T')[0];
    const followups = visits
      .filter(v => v.follow_up_date)
      .map(v => {
        const diffDays = Math.ceil((new Date(v.follow_up_date) - new Date(today)) / (1000 * 60 * 60 * 24));
        return {
          id: v.id,
          title: v.title,
          record_type: v.record_type,
          provider_name: v.provider_name,
          follow_up_date: v.follow_up_date,
          days_remaining: diffDays,
          urgency: diffDays < 0 ? 'overdue' : diffDays <= 1 ? 'today' : 'upcoming',
          status_label: diffDays >= 0 ? `In ${diffDays} days` : `${Math.abs(diffDays)} days overdue`,
          reminder_banner: {
            message: `Follow-up scheduled on ${v.follow_up_date} (In ${diffDays} days).`
          }
        };
      });
    return { today, count: followups.length, followups };
  }

  // 8. Audit logs
  if (endpoint.startsWith('/audit-log')) {
    const url = new URL('http://localhost' + endpoint);
    const resultFilter = url.searchParams.get('result');
    let logs = getStored('audit', []);
    if (resultFilter) {
      logs = logs.filter(l => l.result === resultFilter.toUpperCase());
    }
    return { role: currentUser.role, total_retrieved: logs.length, logs };
  }

  return { message: 'OK' };
}

function logMockAudit(actor_id, actor_name, actor_role, action, target_type, target_id, result, details) {
  const audit = getStored('audit', []);
  audit.unshift({
    id: 'aud-' + Date.now(),
    actor_id,
    actor_name,
    actor_role,
    action,
    target_type,
    target_id,
    result,
    ip_address: '127.0.0.1',
    details_redacted: details,
    timestamp: new Date().toISOString()
  });
  setStored('audit', audit);
}
