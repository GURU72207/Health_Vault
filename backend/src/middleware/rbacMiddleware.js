const { hasActiveConsent } = require('../services/consentService');
const { logAuditEvent } = require('../services/auditService');

/**
 * Role-Based Access Control (RBAC) middleware.
 * Verifies that the authenticated user possesses one of the authorized roles.
 */
function requireRoles(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated user context', code: 'AUTH_REQUIRED' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      await logAuditEvent({
        actor_id: req.user.id,
        actor_role: req.user.role,
        action: 'INSUFFICIENT_ROLE_ACCESS',
        target_type: 'endpoint',
        target_id: req.originalUrl,
        result: 'DENIED',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details_redacted: {
          user_role: req.user.role,
          required_roles: allowedRoles,
          method: req.method,
          path: req.originalUrl
        }
      });

      return res.status(403).json({
        error: `Access Denied: Role '${req.user.role}' is not authorized to access this resource.`,
        code: 'FORBIDDEN_ROLE',
        allowed_roles: allowedRoles
      });
    }

    next();
  };
}

/**
 * Consent-Gated RBAC middleware: Enforce patient data isolation and consent grant checks.
 *
 * Rules:
 * 1. Admin: Full clinical audit access.
 * 2. Patient: Can ONLY access their own data (req.user.id === targetPatientId).
 * 3. Provider: Can ONLY access patient data if the patient has an ACTIVE consent grant (revoked_at IS NULL).
 *    If no grant exists: IMMEDIATELY logs DENIED to immutable audit_logs and returns 403 Forbidden.
 */
function enforcePatientAccess(source = 'param', fieldName = 'id') {
  return async (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    // Determine target patient ID from specified request source
    let targetPatientId = null;
    if (source === 'param') {
      targetPatientId = req.params[fieldName];
    } else if (source === 'query') {
      targetPatientId = req.query[fieldName];
    } else if (source === 'body') {
      targetPatientId = req.body[fieldName];
    }

    // Default to own user id if patient requesting own list without explicit param
    if (!targetPatientId && user.role === 'patient') {
      targetPatientId = user.id;
      if (source === 'param') req.params[fieldName] = user.id;
      if (source === 'query') req.query[fieldName] = user.id;
      if (source === 'body') req.body[fieldName] = user.id;
    }

    if (!targetPatientId) {
      return res.status(400).json({
        error: `Missing required patient identifier in ${source} ('${fieldName}')`,
        code: 'PATIENT_ID_REQUIRED'
      });
    }

    // Admin bypass for system oversight
    if (user.role === 'admin') {
      req.targetPatientId = targetPatientId;
      return next();
    }

    // Patient rule: strictly own data only
    if (user.role === 'patient') {
      if (user.id !== targetPatientId) {
        await logAuditEvent({
          actor_id: user.id,
          actor_role: 'patient',
          action: 'CROSS_PATIENT_ACCESS_ATTEMPT',
          target_type: 'patient',
          target_id: targetPatientId,
          result: 'DENIED',
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          details_redacted: 'Patient attempted to access another patient record'
        });

        return res.status(403).json({
          error: 'Access Denied: Patients are strictly forbidden from viewing other patients’ records.',
          code: 'PATIENT_ISOLATION_VIOLATION',
          target_patient_id: targetPatientId
        });
      }

      req.targetPatientId = targetPatientId;
      return next();
    }

    // Provider rule: Consent-Gated access check
    if (user.role === 'provider') {
      const isConsentGranted = await hasActiveConsent(targetPatientId, user.id);

      if (!isConsentGranted) {
        // CENTERPIECE OF JUDGING DEMO: Log denied attempt to immutable audit trail
        await logAuditEvent({
          actor_id: user.id,
          actor_role: 'provider',
          action: 'VIEW_PATIENT_RECORD_UNAUTHORIZED',
          target_type: 'patient',
          target_id: targetPatientId,
          result: 'DENIED',
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          details_redacted: {
            reason: 'No active consent grant found in access_grants table',
            provider_id: user.id,
            target_patient_id: targetPatientId,
            endpoint: req.originalUrl
          }
        });

        return res.status(403).json({
          error: 'Access Denied: Patient has not granted consent to view this health record.',
          code: 'CONSENT_NOT_GRANTED',
          patient_id: targetPatientId,
          provider_id: user.id,
          audit_logged: true,
          resolution: 'Patient must explicitly grant access to your provider ID in their Consent Settings.'
        });
      }

      req.targetPatientId = targetPatientId;
      return next();
    }

    return res.status(403).json({ error: 'Unauthorized role', code: 'UNAUTHORIZED_ROLE' });
  };
}

module.exports = {
  requireRoles,
  enforcePatientAccess
};
