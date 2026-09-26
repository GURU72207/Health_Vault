const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

/**
 * Checks if a provider has an ACTIVE consent grant for a specific patient.
 * A grant is active if and only if revoked_at IS NULL.
 */
async function hasActiveConsent(patientId, providerId) {
  const sql = `
    SELECT * FROM access_grants
    WHERE patient_id = ? AND provider_id = ? AND revoked_at IS NULL
    LIMIT 1
  `;
  const grant = await db.queryOne(sql, [patientId, providerId]);
  return !!grant;
}

/**
 * Patient explicitly grants consent to a provider.
 */
async function grantAccess(patientId, providerId) {
  // Check if an active grant already exists
  const existingActive = await db.queryOne(
    `SELECT * FROM access_grants WHERE patient_id = ? AND provider_id = ? AND revoked_at IS NULL`,
    [patientId, providerId]
  );

  if (existingActive) {
    return existingActive;
  }

  const id = uuidv4();
  const grantedAt = new Date().toISOString();

  await db.run(
    `INSERT INTO access_grants (id, patient_id, provider_id, granted_at, revoked_at) VALUES (?, ?, ?, ?, NULL)`,
    [id, patientId, providerId, grantedAt]
  );

  return { id, patient_id: patientId, provider_id: providerId, granted_at: grantedAt, revoked_at: null };
}

/**
 * Patient explicitly revokes consent from a provider.
 */
async function revokeAccess(patientId, providerId) {
  const revokedAt = new Date().toISOString();
  await db.run(
    `UPDATE access_grants SET revoked_at = ? WHERE patient_id = ? AND provider_id = ? AND revoked_at IS NULL`,
    [revokedAt, patientId, providerId]
  );

  return { patient_id: patientId, provider_id: providerId, revoked_at: revokedAt };
}

/**
 * Get all consent grants for a patient (active and revoked) with provider details.
 */
async function getGrantsForPatient(patientId) {
  const sql = `
    SELECT g.*, u.name as provider_name, u.email as provider_email
    FROM access_grants g
    JOIN users u ON g.provider_id = u.id
    WHERE g.patient_id = ?
    ORDER BY g.granted_at DESC
  `;
  return await db.query(sql, [patientId]);
}

/**
 * Get all patients who currently have an ACTIVE consent grant to this provider.
 * Providers can ONLY discover/view patients who granted them access.
 */
async function getActivePatientsForProvider(providerId) {
  const sql = `
    SELECT DISTINCT u.id, u.name, u.email, p.dob, p.phone, p.blood_group, g.granted_at
    FROM access_grants g
    JOIN users u ON g.patient_id = u.id
    JOIN patients p ON u.id = p.user_id
    WHERE g.provider_id = ? AND g.revoked_at IS NULL
    ORDER BY u.name ASC
  `;
  return await db.query(sql, [providerId]);
}

module.exports = {
  hasActiveConsent,
  grantAccess,
  revokeAccess,
  getGrantsForPatient,
  getActivePatientsForProvider
};
