# Requirements Traceability Matrix & Feature Mapping
## Event: URAN 2026 | HealthTech Challenge ID: HT-05
**Title:** Secure Digital Personal Health Record & Follow-Up Management Platform with Privacy-Aware Data Access

This document establishes an explicit, sentence-by-sentence mapping between the hackathon problem brief and the exact source code files and functions implementing each requirement.

---

## 📋 Comprehensive Requirements Traceability Matrix

| Section / Requirement Statement | Exact Implementing File(s) | Function / Component Name | Implementation Summary & Evidence |
| :--- | :--- | :--- | :--- |
| **Problem Statement: Organize health documents/visits** | `backend/src/routes/visitRoutes.js`<br/>`frontend/src/views/RecordsView.jsx` | `GET /api/visits`<br/>`RecordsView` | Organizes clinical visit notes, prescriptions, and lab reports with structured schemas and metadata. |
| **Problem Statement: All demo data must be synthetic** | `backend/src/database/seed.js` | `seedDatabase`, `PERSONAS` | 100% synthetic personas (John Doe, Sarah Smith, Dr. Priya Sharma, Dr. Vikram Patel). No real PHI used. |
| **Winning Angle: Patients own their data by default; nothing is visible to a provider until explicit grant** | `backend/src/middleware/rbacMiddleware.js`<br/>`backend/src/services/consentService.js` | `enforcePatientAccess`, `hasActiveConsent` | Queries `access_grants` table for `revoked_at IS NULL`. Providers receive `403 Forbidden` if ungranted. |
| **Winning Angle: Every read/write — allowed or denied — is written to an immutable audit log** | `backend/src/services/auditService.js`<br/>`backend/src/database/db.js` | `logAuditEvent`, `initSchema` | `INSERT INTO audit_logs` on all operations. SQLite table has no UPDATE or DELETE queries. |
| **Winning Angle: Live 'Access Denied' demo moment (provider tries to view ungranted record)** | `frontend/src/App.jsx`<br/>`frontend/src/components/AccessDeniedModal.jsx` | `triggerAccessDeniedDemo`, `AccessDeniedModal` | Dr. Priya requests Sarah Smith's PHR -> triggers HTTP 403 (`CONSENT_NOT_GRANTED`) -> opens modal -> commits `DENIED` audit row. |
| **Roles & Permissions: Patient — full CRUD on own profile/records/documents** | `backend/src/routes/patientRoutes.js`<br/>`backend/src/routes/visitRoutes.js`<br/>`backend/src/routes/documentRoutes.js` | `PUT /api/patients/:id`, `POST /api/visits`, `POST /api/documents` | Patient creates, updates, and reads their own records. `enforcePatientAccess` verifies `user.id === targetPatientId`. |
| **Roles & Permissions: Patient can grant/revoke provider access** | `backend/src/routes/accessRoutes.js`<br/>`frontend/src/views/ConsentView.jsx` | `POST /api/access/grant`, `POST /api/access/revoke` | Inserts or sets `revoked_at = CURRENT_TIMESTAMP` in `access_grants`. Logs `GRANT_CONSENT` / `REVOKE_CONSENT`. |
| **Roles & Permissions: Patient can view their own audit log** | `backend/src/routes/auditRoutes.js`<br/>`backend/src/services/auditService.js` | `GET /api/audit-log`, `getAuditLogsForPatient` | Returns audit entries where `target_id = patient_id` OR `actor_id = patient_id`. Patient sees all provider interactions. |
| **Roles & Permissions: Provider can only view patients who granted access** | `backend/src/routes/patientRoutes.js`<br/>`backend/src/services/consentService.js` | `GET /api/patients`, `getActivePatientsForProvider` | Returns `SELECT DISTINCT ... FROM access_grants WHERE provider_id = ? AND revoked_at IS NULL`. Ungranted patients are hidden. |
| **Roles & Permissions: Provider can add visit notes/documents to granted patients** | `backend/src/routes/visitRoutes.js`<br/>`backend/src/routes/documentRoutes.js` | `POST /api/visits`, `POST /api/documents` | Allowed if `hasActiveConsent(patient_id, provider_id) === true`. Encrypts notes with AES-256. |
| **Roles & Permissions: Provider access attempts logged (successful or blocked)** | `backend/src/middleware/rbacMiddleware.js`<br/>`backend/src/services/auditService.js` | `enforcePatientAccess`, `logAuditEvent` | Successful queries log `result: 'ALLOWED'`. Blocked attempts log `result: 'DENIED'` with target patient ID and reason. |
| **Auth: Email/password signup + login** | `backend/src/routes/authRoutes.js` | `POST /api/auth/signup`, `POST /api/auth/login` | Validates input formats, roles, checks duplicates, returns JWT token. |
| **Auth: Hashed passwords** | `backend/src/routes/authRoutes.js`<br/>`backend/tests/security.test.js` | `bcrypt.hash(password, 12)`, `bcrypt.compare` | Uses Bcrypt with 12 salt rounds. Plaintext passwords never stored. Verified in automated test suite. |
| **Auth: Session / JWT expiry** | `backend/src/config/index.js`<br/>`backend/src/middleware/authMiddleware.js` | `jwtExpiresIn: '8h'`, `authenticateToken` | Signed JWT expires in 8 hours. Rejects expired tokens with `TOKEN_EXPIRED` (401). |
| **Patient profile CRUD** | `backend/src/routes/patientRoutes.js`<br/>`frontend/src/views/DashboardView.jsx` | `GET /api/patients/:id`, `PUT /api/patients/:id` | Read and update demographics. Encrypts address with AES-256 before saving to SQLite. |
| **Visit/record creation with follow_up_date field** | `backend/src/routes/visitRoutes.js`<br/>`frontend/src/views/RecordsView.jsx` | `POST /api/visits` | Stores `record_type`, `title`, `notes_encrypted`, and `follow_up_date`. |
| **Document upload with metadata (filename, type, size, uploaded_by, uploaded_at)** | `backend/src/routes/documentRoutes.js`<br/>`frontend/src/views/DocumentsView.jsx` | `POST /api/documents`, `multer` storage | Multer saves file with UUID name; DB stores `filename`, `file_type`, `size`, `checksum_sha256`, `uploaded_by`, `uploaded_at`. |
| **Never log file contents or secrets** | `backend/src/middleware/redactLogger.js`<br/>`backend/src/services/cryptoService.js` | `redactLogger`, `redactPII` | Sanitization utility intercepts stdout/stderr; redacts passwords, JWTs, encrypted blobs, and raw binary streams. |
| **RBAC enforced server-side on every request** | `backend/src/middleware/rbacMiddleware.js` | `requireRoles`, `enforcePatientAccess` | Applied as Express middleware directly on route definitions before handler execution. |
| **Upcoming follow-ups dashboard + simple reminder (in-app banner)** | `backend/src/routes/followupRoutes.js`<br/>`frontend/src/components/FollowupBanner.jsx`<br/>`frontend/src/views/FollowupsView.jsx` | `GET /api/followups/upcoming`, `FollowupBanner`, `FollowupsView` | Calculates days remaining (`days_remaining`), urgency status (`today`, `tomorrow`, `upcoming`, `overdue`), renders banner alert. |
| **Search/filter records by date, type, or provider** | `backend/src/routes/visitRoutes.js`<br/>`frontend/src/views/RecordsView.jsx` | `GET /api/visits?record_type=&start_date=&end_date=&search=` | SQL and domain filters for `record_type`, `start_date`, `end_date`, `provider_id`, and text search. |
| **Encryption-at-rest: Encrypt sensitive fields with AES-256; key from env var** | `backend/src/services/cryptoService.js`<br/>`backend/src/config/index.js`<br/>`backend/.env` | `encrypt`, `decrypt`, `DERIVED_KEY` | AES-256-GCM authenticated cipher with 96-bit random IV, 128-bit Auth Tag. Key derived from `AES_256_SECRET_KEY` env var. |
| **No hardcoded secrets or logged keys** | `backend/src/config/index.js`<br/>`backend/src/services/cryptoService.js` | `config.aesKey`, `redactPII` | Key loaded dynamically via `dotenv`. Scanned and stripped from all log outputs. |
| **Basic input validation / rate limiting** | `backend/src/routes/authRoutes.js`<br/>`backend/src/routes/documentRoutes.js` | `express-rate-limit`, `upload.limits` | 100 requests / 15 min on auth routes. Max 10MB document size limit with safe MIME-type whitelist. |

---

## 🧪 Automated Test Verification Reference

Run `npm test` inside `backend/` to execute the automated verification suite (`tests/security.test.js`):

| Test Suite Assertion | Verified Requirement | Status |
| :--- | :--- | :--- |
| `AES-256-GCM should encrypt plain text into IV:AuthTag:Ciphertext format` | Encryption-at-rest formatting | ✅ PASSED |
| `AES-256-GCM should correctly decrypt encrypted data back to exact original text` | Decryption fidelity | ✅ PASSED |
| `Tampered ciphertext must fail authentication and return error notice` | GCM Auth Tag integrity & anti-tamper | ✅ PASSED |
| `Database persistence check: raw database records store encrypted ciphertext, NOT plaintext` | Zero plaintext leakage on disk | ✅ PASSED |
| `Passwords stored in users table must be bcrypt hashes, never plaintext` | Bcrypt password security | ✅ PASSED |
| `Active consent check: Dr. Priya Sharma HAS active consent for John Doe` | Baseline consent validation | ✅ PASSED |
| `Consent gating: Dr. Priya Sharma DOES NOT have active consent for Sarah Smith` | Consent-gating isolation | ✅ PASSED |
| `Granting and revoking consent works dynamically and updates status` | Dynamic grant/revocation | ✅ PASSED |
| `Logging an unauthorized access attempt records DENIED result in audit_logs` | Audit trail of blocked attempts | ✅ PASSED |
| `Patient audit query returns all provider interactions on their data` | Patient audit transparency | ✅ PASSED |
| `redactPII utility strips passwords, medical notes, and tokens from logging payloads` | Privacy preservation in logs | ✅ PASSED |

**Final Verification Result:** `11 PASSED, 0 FAILED` (100% compliance rate).
