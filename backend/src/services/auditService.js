const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

/**
 * Log an immutable security audit event.
 * Every read, write, consent grant, revoke, and denied attempt is recorded here.
 */
async function logAuditEvent({
  actor_id = 'unauthenticated',
  actor_role = 'unauthenticated',
  action,
  target_type,
  target_id = 'system',
  result = 'ALLOWED', // 'ALLOWED' | 'DENIED'
  ip_address = null,
  user_agent = null,
  details_redacted = null
}) {
  const id = uuidv4();
  const timestamp = new Date().toISOString();

  const sql = `
    INSERT INTO audit_logs (
      id, actor_id, actor_role, action, target_type, target_id, result, ip_address, user_agent, details_redacted, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const detailsStr = typeof details_redacted === 'object' && details_redacted !== null
    ? JSON.stringify(details_redacted)
    : (details_redacted ? String(details_redacted) : null);

  await db.run(sql, [
    id,
    actor_id,
    actor_role,
    action,
    target_type,
    target_id,
    result,
    ip_address,
    user_agent ? user_agent.substring(0, 150) : null,
    detailsStr,
    timestamp
  ]);

  return { id, timestamp, result };
}

/**
 * Retrieve audit log events for a patient.
 * Patients can see everything that happened to their records:
 * 1. Their own actions (login, edits, consent grants)
 * 2. Provider actions (both ALLOWED and DENIED attempts)
 */
async function getAuditLogsForPatient(patientId, filter = {}) {
  let sql = `
    SELECT a.*, u.name as actor_name, u.email as actor_email
    FROM audit_logs a
    LEFT JOIN users u ON a.actor_id = u.id
    WHERE a.target_id = ? OR a.actor_id = ?
  `;
  const params = [patientId, patientId];

  if (filter.result) {
    sql += ` AND a.result = ?`;
    params.push(filter.result.toUpperCase());
  }

  if (filter.action) {
    sql += ` AND a.action = ?`;
    params.push(filter.action);
  }

  sql += ` ORDER BY a.timestamp DESC LIMIT ? OFFSET ?`;
  params.push(filter.limit || 100, filter.offset || 0);

  return await db.query(sql, params);
}

/**
 * Retrieve audit log events for a provider.
 * Providers can only see their own actions and access attempts.
 */
async function getAuditLogsForProvider(providerId, filter = {}) {
  let sql = `
    SELECT a.*, p.name as target_patient_name
    FROM audit_logs a
    LEFT JOIN users p ON a.target_id = p.id
    WHERE a.actor_id = ?
  `;
  const params = [providerId];

  if (filter.result) {
    sql += ` AND a.result = ?`;
    params.push(filter.result.toUpperCase());
  }

  if (filter.action) {
    sql += ` AND a.action = ?`;
    params.push(filter.action);
  }

  sql += ` ORDER BY a.timestamp DESC LIMIT ? OFFSET ?`;
  params.push(filter.limit || 100, filter.offset || 0);

  return await db.query(sql, params);
}

/**
 * Retrieve all audit log entries (for Admin or System audit view).
 */
async function getAllAuditLogs(filter = {}) {
  let sql = `
    SELECT a.*, 
           u.name as actor_name, 
           u.email as actor_email,
           p.name as target_name
    FROM audit_logs a
    LEFT JOIN users u ON a.actor_id = u.id
    LEFT JOIN users p ON a.target_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (filter.result) {
    sql += ` AND a.result = ?`;
    params.push(filter.result.toUpperCase());
  }

  if (filter.action) {
    sql += ` AND a.action = ?`;
    params.push(filter.action);
  }

  sql += ` ORDER BY a.timestamp DESC LIMIT ? OFFSET ?`;
  params.push(filter.limit || 100, filter.offset || 0);

  return await db.query(sql, params);
}

module.exports = {
  logAuditEvent,
  getAuditLogsForPatient,
  getAuditLogsForProvider,
  getAllAuditLogs
};
