# Security Architecture, Threat Model & Compliance Specification
## Challenge ID: HT-05 | URAN 2026 HealthTech Track

---

## 🔒 1. Cryptographic Design: Encryption-at-Rest

### 1.1 AES-256-GCM Authenticated Encryption
To protect sensitive patient health information against offline disk theft, database dump leakage, and unauthorized direct queries, sensitive fields are encrypted at rest using **AES-256 in Galois/Counter Mode (GCM)**:
- **Encrypted Fields**:
  - `patients.address_encrypted`: Home addresses and geographical demographics.
  - `visits.notes_encrypted`: Clinical observations, diagnostic findings, prescriptions, and physician instructions.
- **Key Derivation**:
  - Sourced exclusively from the environment variable `AES_256_SECRET_KEY`.
  - Passed through a cryptographic SHA-256 hash digest to guarantee an exact 256-bit (32-byte) key length.
  - Keys are never hardcoded, never committed to source control, and never output to console or logs.
- **Initialization Vector (IV)**:
  - A cryptographically secure random 96-bit (12-byte) IV is generated per record using `crypto.randomBytes(12)`.
  - IV reuse across records is mathematically impossible.
- **Authentication Tag (Tamper Detection)**:
  - A 128-bit (16-byte) GCM authentication tag is generated during encryption.
  - On decryption, `decipher.setAuthTag(authTag)` verifies ciphertext integrity. If an attacker modifies even a single byte of ciphertext in SQLite, the decipher operation aborts and flags a tamper event.
- **Serialization Format in Database**:
  ```text
  [12-byte IV in hex]:[16-byte Auth Tag in hex]:[AES-256 Ciphertext in hex]
  Example: 4a9f12bc88...:10c83a9f...:8e4210ab56...
  ```

---

## 🔑 2. Identity, Authentication & Password Security

### 2.1 Password Storage (Bcrypt)
- Passwords are never stored in plaintext.
- Hashed using **Bcrypt with 12 salt rounds** (`bcryptjs.hash(password, 12)`).
- Resistant to GPU-accelerated brute force and rainbow table precomputation.

### 2.2 Session Management (JWT)
- Authenticated users receive a digitally signed JSON Web Token (JWT).
- Signed using HMAC-SHA256 (`HS256`) with `JWT_SECRET`.
- Valid for 8 hours (`expiresIn: '8h'`).
- The token payload contains only minimal identity markers: `{ id, email, role, name }`. No passwords or health data are embedded in the token.

### 2.3 Rate Limiting & Brute Force Protection
- `express-rate-limit` safeguards `POST /api/auth/login` and `POST /api/auth/signup`.
- IP threshold: Maximum 100 requests per 15-minute window.

---

## 🛡️ 3. Server-Side Role-Based Access Control (RBAC) Matrix

Access control is strictly enforced on the server within `rbacMiddleware.js`. Frontend button hiding is used solely for UX; the API treats all requests with zero trust.

| Endpoint | HTTP Method | Patient Role | Provider (With Active Consent) | Provider (Ungranted / Revoked) | Admin Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/patients/:id` | `GET` | ✅ Own record only | ✅ Allowed | ❌ **403 FORBIDDEN** (Logged DENIED) | ✅ Audit Read |
| `/api/patients/:id` | `PUT` | ✅ Own record only | ❌ 403 Forbidden | ❌ 403 Forbidden | ✅ Allowed |
| `/api/visits` | `GET` | ✅ Own records | ✅ Allowed | ❌ **403 FORBIDDEN** (Logged DENIED) | ✅ Audit Read |
| `/api/visits` | `POST` | ✅ Own record | ✅ Allowed | ❌ **403 FORBIDDEN** (Logged DENIED) | ❌ Forbidden |
| `/api/documents` | `GET` | ✅ Own documents | ✅ Allowed | ❌ **403 FORBIDDEN** (Logged DENIED) | ✅ Audit Read |
| `/api/documents` | `POST` | ✅ Own record | ✅ Allowed | ❌ **403 FORBIDDEN** (Logged DENIED) | ❌ Forbidden |
| `/api/documents/:id/download` | `GET` | ✅ Own document | ✅ Allowed (if verified/acknowledged)<br>❌ **403 FORBIDDEN** if flagged & unacknowledged | ❌ **403 FORBIDDEN** (Logged DENIED) | ✅ Audit Read |
| `/api/documents/:id/acknowledge` | `POST` | ✅ Own flagged document | ❌ 403 Forbidden | ❌ 403 Forbidden | ❌ Forbidden |
| `/api/access/grant` | `POST` | ✅ Allowed | ❌ 403 Forbidden | ❌ 403 Forbidden | ❌ Forbidden |
| `/api/access/revoke` | `POST` | ✅ Allowed | ❌ 403 Forbidden | ❌ 403 Forbidden | ❌ Forbidden |
| `/api/followups/upcoming` | `GET` | ✅ Own follow-ups | ✅ Granted patients | ❌ Excluded from list | ✅ System Read |
| `/api/audit-log` | `GET` | ✅ All events on own PHR | ✅ Own actions only | ✅ Own actions only | ✅ Full Ledger |

---

## 📜 4. Immutable Audit Ledger Design

### 4.1 Append-Only Architecture
- Audit events are written to the `audit_logs` table via `auditService.logAuditEvent`.
- **No update or delete endpoints exist** in the API.
- All records receive an RFC 4122 UUID and ISO 8601 UTC timestamp.

### 4.2 Logging Blocked Attempts (The Winning Angle)
- When a provider attempts to query an ungranted patient, the system does not fail silently.
- It records a dedicated audit row with `result: 'DENIED'` and `action: 'VIEW_PATIENT_RECORD_UNAUTHORIZED'`.
- The patient can later inspect their audit log and see: *"Dr. Priya Sharma attempted unauthorized access on [Date/Time] — Status: BLOCKED"*.

### 4.3 Log Redaction & PII Stripping
- `redactLogger.js` and `cryptoService.redactPII` sanitize all logging parameters.
- Passwords, authorization tokens, plaintext clinical notes, and patient addresses are automatically replaced with `[REDACTED_FOR_PRIVACY]` prior to stdout logging.

---

## 🎯 5. Threat Model (STRIDE Analysis)

| Threat Category | Threat Description | Mitigation in SecurePHR |
| :--- | :--- | :--- |
| **Spoofing** | Adversary impersonates a patient or physician to extract records. | Bcrypt password verification + digitally signed JWT sessions with user existence verification on each call. |
| **Tampering** | Rogue actor alters diagnosis notes or modifies database records directly. | AES-256-GCM authentication tag verifies ciphertext integrity. Document uploads verify SHA-256 checksums. |
| **Repudiation** | Physician claims they never accessed or created a patient's prescription. | Append-only `audit_logs` table records actor ID, role, action, target record, timestamp, and IP address. |
| **Information Disclosure** | Database file leaked or unauthorized provider browses unshared records. | Consent-gating checks `access_grants` table on every call. Sensitive fields are encrypted with AES-256 at rest. |
| **Denial of Service** | Credential brute-forcing or excessive automated requests. | `express-rate-limit` throttles authentication attempts to 100 requests per 15 minutes. |
| **Elevation of Privilege** | Normal patient sends a crafted request with provider or admin role. | JWT tokens are verified against backend secret; role is checked against database user entity on protected routes. |

---

## 🤖 6. AI-Assisted Document Ingestion: Threat Model & Privacy Safeguards

### 6.1 Attack Vectors & Safeguard Controls

| Attack Vector | Threat Scenario | Mitigation Architecture |
| :--- | :--- | :--- |
| **Header Spoofing / Extension Disguise** | Malicious actor disguises an executable or script with a `.pdf` extension. | **Binary Magic-Byte Inspection**: `validateFileTypeAndMagicBytes` directly reads the first 16 bytes on disk (`%PDF-`, JPEG SOI, PNG header, ZIP/DOCX header). Discrepancies are immediately rejected (`400 INVALID_FILE_SIGNATURE`) and logged to audit trail. |
| **Model Inversion / PII Leakage in Logs** | Extracted clinical tokens from OCR/PDF extraction leak into system logs or stdout. | **Strict In-Memory Token Extraction**: Extracted tokens are analyzed strictly in ephemeral memory and discarded. Audit logs record only high-level classifier verdict (`verification_status`, `confidence`, and redacted reason codes); raw extracted text is never logged. |
| **Document Content Discrepancy** | User uploads an irrelevant or deceptive document (e.g., restaurant invoice claimed as a Lab Report). | **Clinical Ontology Classifier**: Matches document tokens against domain-specific clinical vocabulary (e.g. glucose, HbA1c, BP, creatinine). Suspicious non-clinical tokens trigger `flagged` status. |
| **Unauthorized Provider Access to Flagged PHR** | Provider downloads a flagged document containing questionable or unverified data without patient review. | **Consent & Patient Acknowledgment Gating**: Providers are blocked from downloading `flagged` documents (`403 PATIENT_ACKNOWLEDGMENT_REQUIRED`) until the patient explicitly reviews and acknowledges the document. |
| **AI Subsystem Failure / Outage** | AI classifier service fails, crashes, or times out during verification pass. | **Fail-Safe Default to 'Pending'**: If verification encounters an exception, status safely defaults to `pending` (never silently `verified`), ensuring unverified documents cannot bypass security controls. |

