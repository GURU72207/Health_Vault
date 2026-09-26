# API Specification & Endpoint Documentation
## Challenge ID: HT-05 | URAN 2026 HealthTech Track

Base URL: `http://localhost:5001/api`  
Authentication: HTTP Bearer Token (`Authorization: Bearer <jwt_token>`)

---

## 1. Authentication Endpoints

### 1.1 User Registration
`POST /api/auth/signup`

Creates a new patient or provider account. Automatically encrypts patient home address with AES-256-GCM.

**Request Body:**
```json
{
  "name": "Alice Walker",
  "email": "alice@example.com",
  "password": "Password123!",
  "role": "patient",
  "dob": "1992-05-18",
  "phone": "+1-555-0199",
  "address": "124 Magnolia Blvd, Suite 2A",
  "blood_group": "A+"
}
```

**Response (`201 Created`):**
```json
{
  "message": "Account successfully registered",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "e9b21a42-7c39-4d22-9bb4-6cb08c7a2301",
    "name": "Alice Walker",
    "email": "alice@example.com",
    "role": "patient"
  }
}
```

---

### 1.2 User Authentication
`POST /api/auth/login`

Verifies bcrypt password hash and returns signed JWT.

**Request Body:**
```json
{
  "email": "john.patient@demo.uran",
  "password": "Password123!"
}
```

**Response (`200 OK`):**
```json
{
  "message": "Authentication successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "11111111-1111-4000-8000-000000000001",
    "name": "John Doe",
    "email": "john.patient@demo.uran",
    "role": "patient"
  }
}
```

---

## 2. Patient Profile Endpoints

### 2.1 Retrieve Patient Profile
`GET /api/patients/:id`

Retrieves patient demographics. Server verifies consent before returning. Address is decrypted on the fly.

**Response (`200 OK`):**
```json
{
  "patient": {
    "id": "11111111-1111-4000-8000-000000000001",
    "name": "John Doe",
    "email": "john.patient@demo.uran",
    "role": "patient",
    "dob": "1988-06-14",
    "phone": "+1-555-0144",
    "blood_group": "O+",
    "emergency_contact": "Mary Doe (+1-555-0145)",
    "address": "42 Orchid Street, Tech City, TC 613403",
    "address_encrypted": "9a2f7c01b4...:5c18e4...:b3901f4c..."
  }
}
```

---

## 3. Health Records & Encounters (Visits)

### 3.1 List Patient Health Records
`GET /api/visits?patient_id=:patient_id&record_type=Prescription`

**Authorized Response (`200 OK`):**
```json
{
  "visits": [
    {
      "id": "bbbbbbbb-1111-4000-8000-000000000001",
      "patient_id": "11111111-1111-4000-8000-000000000001",
      "provider_id": "33333333-3333-4000-8000-000000000003",
      "provider_name": "Dr. Priya Sharma, MD",
      "visit_date": "2026-09-16",
      "record_type": "Visit Note",
      "title": "Cardiology Evaluation & BP Assessment",
      "notes": "Patient presented with mild exertional dyspnea...",
      "notes_encrypted": "1c7a8b9f...:84bc01f...:990a12e...",
      "follow_up_date": "2026-10-06",
      "documents": []
    }
  ]
}
```

**Unauthorized Response (Centerpiece "Access Denied" Event — `403 Forbidden`):**
```json
{
  "error": "Access Denied: Patient has not granted consent to view this health record.",
  "code": "CONSENT_NOT_GRANTED",
  "patient_id": "22222222-2222-4000-8000-000000000002",
  "provider_id": "33333333-3333-4000-8000-000000000003",
  "audit_logged": true,
  "resolution": "Patient must explicitly grant access to your provider ID in their Consent Settings."
}
```

---

### 3.2 Create Health Record
`POST /api/visits`

Encrypted with AES-256-GCM. Requires patient ownership or active provider consent grant.

**Request Body:**
```json
{
  "patient_id": "11111111-1111-4000-8000-000000000001",
  "record_type": "Visit Note",
  "title": "Post-Medication Follow-Up",
  "notes": "Blood pressure stabilized at 128/82 mmHg. Patient tolerating Telmisartan without orthostatic symptoms.",
  "visit_date": "2026-09-26",
  "follow_up_date": "2026-11-15"
}
```

**Response (`201 Created`):**
```json
{
  "message": "Health record created successfully with AES-256 encrypted storage",
  "visit": {
    "id": "a1b2c3d4-0000-4000-8000-000000000099",
    "patient_id": "11111111-1111-4000-8000-000000000001",
    "title": "Post-Medication Follow-Up",
    "notes_encrypted": "3b29c0...:1a9f02...:841ef9...",
    "follow_up_date": "2026-11-15"
  }
}
```

---

## 4. Medical Document Upload & Ingestion

### 4.1 Multipart File Upload
`POST /api/documents`

`Content-Type: multipart/form-data`  
Payload: `document: <binary file>`, `patient_id: <uuid>`, `visit_id: <uuid>` (optional).

**Response (`201 Created`):**
```json
{
  "message": "Document uploaded and indexed successfully",
  "document": {
    "id": "f8a1290b-1111-4000-8000-000000000001",
    "filename": "echocardiogram_report.pdf",
    "file_type": "application/pdf",
    "size": 145920,
    "checksum_sha256": "8f4a10bc39e102834b7fae2981...",
    "uploaded_by": "11111111-1111-4000-8000-000000000001",
    "uploaded_at": "2026-09-26T04:15:00.000Z"
  }
}
```

---

## 5. Consent & Access Grant Management

### 5.1 Grant Provider Consent
`POST /api/access/grant` (Patient Role Only)

**Request Body:**
```json
{
  "provider_id": "33333333-3333-4000-8000-000000000003"
}
```

**Response (`200 OK`):**
```json
{
  "message": "Consent granted to Dr. Priya Sharma, MD",
  "grant": {
    "id": "aaaaaaaa-1111-4000-8000-000000000001",
    "patient_id": "11111111-1111-4000-8000-000000000001",
    "provider_id": "33333333-3333-4000-8000-000000000003",
    "granted_at": "2026-09-26T04:20:00.000Z",
    "revoked_at": null
  }
}
```

### 5.2 Revoke Provider Consent
`POST /api/access/revoke` (Patient Role Only)

**Request Body:**
```json
{
  "provider_id": "33333333-3333-4000-8000-000000000003"
}
```

**Response (`200 OK`):**
```json
{
  "message": "Consent revoked for Dr. Priya Sharma, MD",
  "revocation": {
    "patient_id": "11111111-1111-4000-8000-000000000001",
    "provider_id": "33333333-3333-4000-8000-000000000003",
    "revoked_at": "2026-09-26T04:22:00.000Z"
  }
}
```

---

## 6. Upcoming Follow-ups & Reminders

### 6.1 List Upcoming Follow-ups
`GET /api/followups/upcoming`

Calculates days remaining and urgency status dynamically.

**Response (`200 OK`):**
```json
{
  "today": "2026-09-26",
  "count": 1,
  "followups": [
    {
      "id": "bbbbbbbb-1111-4000-8000-000000000001",
      "title": "Cardiology Evaluation & BP Assessment",
      "provider_name": "Dr. Priya Sharma, MD",
      "follow_up_date": "2026-10-06",
      "days_remaining": 10,
      "urgency": "upcoming",
      "status_label": "In 10 days",
      "reminder_banner": {
        "active": true,
        "urgency": "upcoming",
        "title": "Follow-up Reminder: Cardiology Evaluation & BP Assessment",
        "message": "Follow-up scheduled on 2026-10-06 (In 10 days)."
      }
    }
  ]
}
```

---

## 7. Immutable Audit Trail

### 7.1 Query Audit Logs
`GET /api/audit-log?result=DENIED`

**Response (`200 OK`):**
```json
{
  "role": "patient",
  "total_retrieved": 1,
  "logs": [
    {
      "id": "dddddddd-9999-4000-8000-000000000099",
      "actor_id": "33333333-3333-4000-8000-000000000003",
      "actor_role": "provider",
      "actor_name": "Dr. Priya Sharma, MD",
      "action": "VIEW_PATIENT_RECORD_UNAUTHORIZED",
      "target_type": "patient",
      "target_id": "22222222-2222-4000-8000-000000000002",
      "result": "DENIED",
      "ip_address": "127.0.0.1",
      "details_redacted": "No active consent grant found for this provider-patient pair",
      "timestamp": "2026-09-26T04:25:00.000Z"
    }
  ]
}
```
