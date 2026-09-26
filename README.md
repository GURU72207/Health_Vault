# Secure Digital Personal Health Record (PHR) & Follow-Up Management Platform
## URAN 2026 — Department of Computer Applications, Periyar Maniammai Institute of Science & Technology
**Track:** HealthTech | **Challenge ID:** HT-05  
**Core Architectural Philosophy:** *Consent-Gated PHR with an Immutable Audit Ledger*

---

## 🏆 Executive Summary & Winning Differentiator

In traditional healthcare systems, personal health information is fragmented across disconnected portals, paper prescriptions, lab reports, and follow-up cards. Most existing Electronic Medical Record (EMR) systems default to institutional ownership where hospital personnel have blanket access.

**SecurePHR fundamentally reverses this model**:
1. **Patient Sovereign Data Ownership by Default**: No healthcare provider can view or query a patient's health records until the patient explicitly issues an active, digital consent grant.
2. **Deterministic Cryptographic Enforcement at Rest**: All sensitive clinical diagnoses, consultation notes, prescription regimens, and patient addresses are encrypted at rest with **AES-256-GCM** using keys sourced exclusively from environment variables.
3. **Immutable, Append-Only Audit Trail**: Every single read, write, consent grant, consent revocation, and **blocked access attempt** is committed to an immutable audit ledger with cryptographic checksums and sanitization.
4. **Live "Access Denied" Centerpiece**: When an unauthorized provider attempts to inspect an unshared health record, the platform enforces server-side RBAC interception, blocks the request with `HTTP 403 Forbidden` (`CONSENT_NOT_GRANTED`), and instantly logs a red `DENIED` entry in the audit trail.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** (v18, v20, v22, or v24)
- **npm** (included with Node.js)

### 1. Installation & Environment Setup
Clone or navigate to the project directory:
```bash
cd secure-phr-platform
```

Install backend dependencies:
```bash
cd backend
npm install
```

Install frontend dependencies:
```bash
cd ../frontend
npm install
```

### 2. Database Initialization & Synthetic Seeding
Run the automated seed script to generate pre-populated synthetic test personas, encounters, diagnostic files, and baseline consent grants:
```bash
cd ../backend
npm run seed
```

### 3. Run Automated Security Verification Suite
Verify cryptographic integrity, AES-256-GCM encryption at rest, password hashing, and server-side RBAC:
```bash
npm test
```
*Expected Output: `11 PASSED, 0 FAILED`.*

### 4. Start the Application

**Terminal 1 — Backend API Server (Port 5001):**
```bash
cd backend
npm start
```
*Backend runs at: `http://localhost:5001/api`*

**Terminal 2 — Frontend Application (Port 5173):**
```bash
cd frontend
npm run dev
```
*Access web interface at: `http://localhost:5173`*

---

## 👥 Demo Personas (1-Click Switcher Available in UI)

| Persona Key | Name | Role | Email | Password | Clinical Context |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `patientJohn` | **John Doe** | Patient | `john.patient@demo.uran` | `Password123!` | Has cardiology encounters, ECG diagnostic PDF, and scheduled follow-up. **Granted consent to Dr. Priya Sharma.** |
| `patientSarah` | **Sarah Smith** | Patient | `sarah.patient@demo.uran` | `Password123!` | Private patient with neurology consultation. **Has NOT granted access to Dr. Priya Sharma.** |
| `providerPriya` | **Dr. Priya Sharma, MD** | Provider | `priya.provider@demo.uran` | `Password123!` | Cardiologist. Can access John Doe; **blocked from accessing Sarah Smith.** |
| `providerVikram` | **Dr. Vikram Patel, MD** | Provider | `vikram.provider@demo.uran` | `Password123!` | Neurologist. Authorized provider. |
| `admin` | **Compliance Auditor** | Admin | `admin@demo.uran` | `AdminSecret123!` | System-wide immutable audit trail inspector. |

---

## 📁 Repository Directory Structure

```text
secure-phr-platform/
├── backend/
│   ├── data/
│   │   ├── phr_data.sqlite          # SQLite file database (persisted Wasm engine)
│   │   └── uploads/                 # Object storage directory for medical files
│   ├── src/
│   │   ├── config/                  # Environment loader & AES key configuration
│   │   ├── database/
│   │   │   ├── db.js                # Database connection, schemas, and transactions
│   │   │   └── seed.js              # Synthetic dataset seeder
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js    # JWT verification and user extraction
│   │   │   ├── rbacMiddleware.js    # Server-side RBAC and consent-gating guard
│   │   │   └── redactLogger.js      # PII and token redaction logging middleware
│   │   ├── routes/
│   │   │   ├── accessRoutes.js      # Consent granting and revocation endpoints
│   │   │   ├── auditRoutes.js       # Immutable audit log query endpoints
│   │   │   ├── authRoutes.js        # Bcrypt auth, signup, and login
│   │   │   ├── demoRoutes.js        # 1-click test personas and instant DB reset
│   │   │   ├── documentRoutes.js    # Metadata upload and verified streaming
│   │   │   ├── followupRoutes.js    # Follow-up urgency calculation & reminders
│   │   │   ├── patientRoutes.js     # Patient profile CRUD with AES-256
│   │   │   └── visitRoutes.js       # Health encounters, search, and filters
│   │   ├── services/
│   │   │   ├── auditService.js      # Append-only audit logger
│   │   │   ├── consentService.js    # Active consent table verification
│   │   │   └── cryptoService.js     # AES-256-GCM cipher & PII redactor
│   │   └── server.js                # Express main server entry point
│   ├── tests/
│   │   └── security.test.js         # Automated security & compliance test suite
│   ├── .env                         # Environment variables (AES key, JWT secret)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/                     # Typed API client wrapper
│   │   ├── components/
│   │   │   ├── AccessDeniedModal.jsx# Centerpiece 403 Forbidden demo modal
│   │   │   ├── DemoGuideBar.jsx     # Top interactive 6-step demo tour
│   │   │   ├── FollowupBanner.jsx   # In-app clinical follow-up alert banner
│   │   │   └── Navbar.jsx           # Top navigation with live persona switcher
│   │   ├── context/
│   │   │   └── AuthContext.jsx      # Session state and 1-click persona switching
│   │   ├── views/
│   │   │   ├── AuditLogView.jsx     # Immutable audit trail with DENIED filters
│   │   │   ├── ConsentView.jsx      # Grant and revoke provider access
│   │   │   ├── DashboardView.jsx    # Metrics and encryption-at-rest inspector
│   │   │   ├── DocumentsView.jsx    # File upload, checksum, and download
│   │   │   ├── FollowupsView.jsx    # Urgency countdowns and simulated alerts
│   │   │   ├── LoginModal.jsx       # Authentication modal
│   │   │   ├── RecordsView.jsx      # Health records, search, filter, and modal
│   │   │   └── SecurityArchitectureView.jsx # Live cryptographic specs & RBAC matrix
│   │   ├── App.jsx                  # Main application orchestrator
│   │   ├── index.css                # Tailwind CSS styling
│   │   └── main.jsx
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
├── ARCHITECTURE.md                  # Comprehensive architecture diagram & data flows
├── SECURITY.md                      # Threat model, cryptographic proofs & RBAC matrix
├── API.md                           # Endpoints with exact request/response schemas
├── DEMO_SCRIPT.md                   # 6-step judging walkthrough
├── REQUIREMENTS_MAPPING.md          # 1:1 line-by-line compliance mapping
└── package.json                     # Root orchestrator
```

---

## 📑 Complete Documentation Suite

For AI evaluation and in-depth judging verification, refer to the accompanying artifacts:
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — Architectural diagram and subsystem interactions.
- [`SECURITY.md`](./SECURITY.md) — Cryptographic design, key derivation, and threat modeling.
- [`API.md`](./API.md) — Complete API documentation with cURL examples.
- [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) — The 6-step evaluation walkthrough.
- [`REQUIREMENTS_MAPPING.md`](./REQUIREMENTS_MAPPING.md) — Verifiable 1:1 compliance matrix.
