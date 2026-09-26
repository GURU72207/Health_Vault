const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const config = require('../config');

let dbInstance = null;
let SQL = null;

// Ensure storage directories exist
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

function persistToDisk() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(config.dbPath, buffer);
  } catch (err) {
    console.error('[DB_ERROR] Failed to persist database to disk:', err.message);
  }
}

async function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  if (!SQL) {
    SQL = await initSqlJs();
  }

  if (fs.existsSync(config.dbPath)) {
    const fileBuffer = fs.readFileSync(config.dbPath);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
    initSchema(dbInstance);
    persistToDisk();
  }

  return dbInstance;
}

function initSchema(db) {
  const schemaSql = `
    -- Users table (core identity and roles)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('patient', 'provider', 'admin')),
      created_at TEXT NOT NULL
    );

    -- Patients table (1:1 with user, privacy-sensitive health demographics)
    CREATE TABLE IF NOT EXISTS patients (
      user_id TEXT PRIMARY KEY,
      dob TEXT,
      phone TEXT,
      address_encrypted TEXT NOT NULL,
      blood_group TEXT,
      emergency_contact TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Visits & Health Records (clinical notes, prescriptions, lab reports)
    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      visit_date TEXT NOT NULL,
      record_type TEXT NOT NULL CHECK(record_type IN ('Visit Note', 'Prescription', 'Lab Report', 'Consultation')),
      title TEXT NOT NULL,
      notes_encrypted TEXT NOT NULL,
      follow_up_date TEXT,
      status TEXT DEFAULT 'completed',
      created_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (provider_id) REFERENCES users(id)
    );

    -- Documents table (metadata only, physical file stored in object/disk storage)
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      visit_id TEXT,
      patient_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      file_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      storage_path TEXT NOT NULL,
      checksum_sha256 TEXT,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE SET NULL,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    -- Access Grants (Consent-gating mechanism)
    -- Active grant when revoked_at IS NULL
    CREATE TABLE IF NOT EXISTS access_grants (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      granted_at TEXT NOT NULL,
      revoked_at TEXT DEFAULT NULL,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (provider_id) REFERENCES users(id)
    );

    -- Audit Logs (Append-only immutable record of all access events)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      result TEXT NOT NULL CHECK(result IN ('ALLOWED', 'DENIED')),
      ip_address TEXT,
      user_agent TEXT,
      details_redacted TEXT,
      timestamp TEXT NOT NULL
    );

    -- Performance and lookup indexes
    CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
    CREATE INDEX IF NOT EXISTS idx_visits_followup ON visits(follow_up_date);
    CREATE INDEX IF NOT EXISTS idx_grants_lookup ON access_grants(patient_id, provider_id, revoked_at);
    CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_id);
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
    CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(timestamp DESC);
  `;

  db.run(schemaSql);
}

// Helper query function that returns array of objects with named columns
async function query(sql, params = []) {
  const db = await getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper function to return single row or null
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Helper function to run INSERT/UPDATE/DELETE and persist to disk
async function run(sql, params = []) {
  const db = await getDb();
  db.run(sql, params);
  persistToDisk();
  return { success: true };
}

// Method to re-initialize or reset DB for testing & live judging reset
async function resetDb() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  dbInstance = new SQL.Database();
  initSchema(dbInstance);
  persistToDisk();
  return dbInstance;
}

module.exports = {
  getDb,
  query,
  queryOne,
  run,
  persistToDisk,
  resetDb
};
