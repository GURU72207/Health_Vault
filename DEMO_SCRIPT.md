# Hackathon Evaluation Demo Script (6-Step Judging Walkthrough)
## Event: URAN 2026 | HealthTech Challenge ID: HT-05
**Title:** Secure Digital Personal Health Record & Follow-Up Management Platform with Privacy-Aware Data Access

---

## ⚡ Quick Demo Overview

The platform includes an automated **Demo Navigator Bar** mounted at the very top of the web interface. You can follow this script manually or use the 1-click step buttons (`1`, `2`, `3`, `4`, `5`, `6`) directly inside the UI at `http://localhost:5173`.

Before beginning, click **"Reset Demo DB"** in the top navigation bar to reset the database to a clean, known baseline.

---

### Step 1: Patient Login, Profile Demographics & Record Creation
**Objective:** Verify that patients own their data, sensitive address is encrypted at rest with AES-256, and encounters store a `follow_up_date` and attached document metadata.

1. In the top-right persona switcher (or click **Step 1** in the Demo Navigator), select **John Doe** (`john.patient@demo.uran` / `Password123!`).
2. On the **Dashboard**, view the patient profile card.
   - Click **"Inspect Ciphertext at Rest"** next to Home Address.
   - *Observation:* The address immediately transforms into the raw `iv:authTag:ciphertext` hex string stored inside SQLite. Click **"Show Decrypted Text"** to verify on-the-fly authenticated decryption.
3. Navigate to the **Health Records & Visits** tab.
   - Click **"Add Health Record"**.
   - Title: `Routine Hypertension Checkup`.
   - Record Type: `Visit Note`.
   - Clinical Notes: `Resting BP 124/82 mmHg. Patient instructed to maintain low-sodium DASH diet.`.
   - Scheduled Follow-Up Date: Select a date 14 days in the future.
   - Click **"Save & Encrypt Record"**.
4. Navigate to the **Documents** tab.
   - Select **Claimed Document Type**: `Laboratory / Blood Test Report`.
   - Choose a medical PDF/image and click **"Upload & Verify Document"**.
   - *Observation:* The server inspects binary magic bytes, executes the AI clinical ontology classifier, and presents an immediate **AI Content Verification Report** modal showing:
     - AI Classification Verdict: `Verified` (with ~95% confidence).
     - Indexed SHA-256 integrity checksum.
   - Now test discrepancy detection: Upload a non-clinical file (e.g. invoice/receipt or receipt PDF) or select a mismatched category.
     - *Observation:* The AI engine flags the document: `Flagged for Review` with discrepancy details.
     - The document enters privacy-gated mode (`Pending Patient Approval`).
     - Switch to **Dr. Priya Sharma**: Dr. Priya is **blocked from downloading** this flagged document (`HTTP 403 PATIENT_ACKNOWLEDGMENT_REQUIRED`) and a `DENIED` audit log is recorded!
     - Switch back to **John Doe**: Click **"Approve Now"** on the flagged document to acknowledge it.
     - Switch back to **Dr. Priya Sharma**: Download is now permitted and streams successfully (`ALLOWED`).

---

### Step 2: Grant Provider Consent
**Objective:** Verify explicit consent-gating — providers cannot view anything until the patient authorizes them.

1. Navigate to the **Consent Control** tab.
2. Observe the current grants table: **Dr. Priya Sharma, MD** is listed as `ACTIVE (CONSENT GRANTED)`.
3. Under *"Authorize a Healthcare Provider"*, choose **Dr. Vikram Patel, MD** (`vikram.provider@demo.uran`) from the dropdown and click **"Grant Access Consent"**.
4. *Observation:* Dr. Vikram Patel is now active. A green notification confirms that an immutable audit log entry was created.

---

### Step 3: Provider Portal & LIVE "ACCESS DENIED" MOMENT (Centerpiece)
**Objective:** Prove that server-side RBAC intercepts unauthorized access attempts, returns `HTTP 403 Forbidden`, and writes an immutable `DENIED` entry to the audit log.

1. Switch persona to **Dr. Priya Sharma, MD** (or click **Step 3** in the Demo Navigator).
2. Go to **Health Records & Visits**.
   - Observe the patient selector dropdown: Dr. Priya can view **John Doe**'s records because John granted access.
   - Click on the record `Cardiology Evaluation & BP Assessment`. The clinical notes are decrypted and visible.
3. **Trigger the Access Denied Demonstration:**
   - Click the prominent red button: **"Simulate Blocked Access Demo"** in the hero banner (or click **Step 3** in the Demo Navigator).
   - *Behind the scenes:* Dr. Priya's session initiates an API call attempting to inspect private patient **Sarah Smith's** records (`GET /api/visits?patient_id=22222222-2222-4000-8000-000000000002`).
4. *Evaluation Centerpiece:*
   - The **Access Blocked: Privacy Consent Guard** modal appears immediately!
   - Shows: `HTTP 403 FORBIDDEN` | `CODE: CONSENT_NOT_GRANTED`.
   - Displays target patient `Sarah Smith (Ungranted)` and requester `Dr. Priya Sharma, MD`.
   - Highlights that an immutable audit log entry was written to the SQLite database with status `DENIED`.

---

### Step 4: Patient Audits Provider Access
**Objective:** Verify that patients have full visibility into who accesses — or tries to access — their private medical data.

1. Switch back to **John Doe** (or click **Step 4** in the Demo Navigator).
2. Navigate to the **Audit Trail** tab.
3. *Observation:* John Doe's audit trail contains:
   - All actions performed by Dr. Priya Sharma on his records (e.g., `VIEW_VISITS_LIST` with status `ALLOWED`).
   - All consent grants created by John Doe (e.g., `GRANT_CONSENT`).
4. Switch persona to **Sarah Smith** (`sarah.patient@demo.uran` / `Password123!`).
5. Open the **Audit Trail** tab.
   - *Observation:* Sarah Smith sees Dr. Priya Sharma's unauthorized attempt highlighted in red:
     - **Result:** `DENIED`
     - **Action:** `VIEW_PATIENT_RECORD_UNAUTHORIZED`
     - **Actor:** `Dr. Priya Sharma, MD`
     - **Context:** `No active consent grant found for this provider-patient pair`

---

### Step 5: Upcoming Follow-ups & Reminders Dashboard
**Objective:** Verify the continuity-of-care follow-up engine, urgency calculations, and in-app reminder banners.

1. Switch to **John Doe** and navigate to the **Dashboard** (or click **Step 5** in the Demo Navigator).
2. At the top of the dashboard, observe the active **Follow-up Reminder Banner**:
   - Title: `Follow-up Reminder: Cardiology Evaluation & BP Assessment with Dr. Priya Sharma, MD`.
   - Dynamic urgency badge: `In 10 days` (or countdown relative to current date).
3. Navigate to the **Follow-Ups** tab:
   - View the follow-up cards sorted by scheduled date.
   - Click **"Simulate SMS/Email Alert"** on any encounter.
   - *Observation:* A simulated multi-channel dispatch notification appears with recipient details, scheduled appointment date, and SMS gateway payload.

---

### Step 6: End-to-End Immutable Audit Ledger Walkthrough
**Objective:** Inspect the complete tamper-resistant audit trail across the system.

1. Navigate to the **Audit Trail** tab.
2. Test the audit filters:
   - Click **"DENIED Attempts Only"**: Isolates all blocked security incidents with pulsing red badges.
   - Click **"ALLOWED Actions Only"**: Displays compliant clinical operations.
   - Click **"All Events"**: Shows the chronological sequence of all system events.
3. Click **"Export JSON"** to download the complete audit trail as a timestamped forensic JSON report.
4. Navigate to the **Security Specs** tab to review the live counts of total audit events, blocked intrusions, active consent grants, and AES-256 cipher parameters.

---

## 🏆 Scoring Summary for AI Evaluator

| Criterion | Implementation in Prototype | Verification File / Function |
| :--- | :--- | :--- |
| **Consent-Gated Data Access** | Default private; provider access requires active row in `access_grants`. | `backend/src/middleware/rbacMiddleware.js` (`enforcePatientAccess`) |
| **Live Access Denied Event** | Intercepts unauthorized provider, throws 403, and commits `DENIED` to audit trail. | `frontend/src/components/AccessDeniedModal.jsx` |
| **AES-256-GCM Encryption** | Authenticated cipher with random 96-bit IV, 128-bit tag, and SHA-256 derived key. | `backend/src/services/cryptoService.js` (`encrypt`, `decrypt`) |
| **Immutable Audit Trail** | Append-only SQLite table with query segregation by role. | `backend/src/services/auditService.js` (`logAuditEvent`) |
| **Follow-Up Reminders** | Dynamic days-remaining calculation and in-app reminder banner. | `backend/src/routes/followupRoutes.js` |
| **Document Metadata & SHA-256** | Ingests metadata + SHA-256 hash without exposing file blobs in logs. | `backend/src/routes/documentRoutes.js` |
| **AI Document Verification & Gating** | Binary magic-byte validation, NLP ontology classification, and provider download gating for flagged unacknowledged records. | `backend/src/services/aiVerificationService.js` (`validateFileTypeAndMagicBytes`, `verifyDocument`) |
