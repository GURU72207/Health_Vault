const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { decrypt } = require('../services/cryptoService');
const { logAuditEvent } = require('../services/auditService');
const { authenticateToken } = require('../middleware/authMiddleware');

/**
 * GET /api/followups/upcoming
 * Retrieve scheduled follow-ups with simulated reminders.
 * - Patient: Sees own upcoming clinical follow-ups.
 * - Provider: Sees upcoming follow-ups for patients who have granted active consent.
 */
router.get('/upcoming', authenticateToken, async (req, res) => {
  const user = req.user;
  const today = new Date().toISOString().split('T')[0];

  try {
    let sql = '';
    let params = [];

    if (user.role === 'patient') {
      sql = `
        SELECT v.id, v.patient_id, v.provider_id, v.title, v.record_type, v.visit_date,
               v.follow_up_date, v.notes_encrypted,
               u.name as provider_name, u.email as provider_email
        FROM visits v
        JOIN users u ON v.provider_id = u.id
        WHERE v.patient_id = ? AND v.follow_up_date IS NOT NULL AND v.follow_up_date != ''
        ORDER BY v.follow_up_date ASC
      `;
      params = [user.id];
    } else if (user.role === 'provider') {
      sql = `
        SELECT v.id, v.patient_id, v.provider_id, v.title, v.record_type, v.visit_date,
               v.follow_up_date, v.notes_encrypted,
               p.name as patient_name, p.email as patient_email
        FROM visits v
        JOIN users p ON v.patient_id = p.id
        JOIN access_grants g ON v.patient_id = g.patient_id
        WHERE g.provider_id = ? AND g.revoked_at IS NULL
          AND v.follow_up_date IS NOT NULL AND v.follow_up_date != ''
        ORDER BY v.follow_up_date ASC
      `;
      params = [user.id];
    } else {
      // Admin
      sql = `
        SELECT v.id, v.patient_id, v.provider_id, v.title, v.record_type, v.visit_date,
               v.follow_up_date, v.notes_encrypted,
               p.name as patient_name, u.name as provider_name
        FROM visits v
        JOIN users p ON v.patient_id = p.id
        JOIN users u ON v.provider_id = u.id
        WHERE v.follow_up_date IS NOT NULL AND v.follow_up_date != ''
        ORDER BY v.follow_up_date ASC
      `;
      params = [];
    }

    const rows = await db.query(sql, params);

    const followups = rows.map(r => {
      const todayDate = new Date(today);
      const targetDate = new Date(r.follow_up_date);
      const diffTime = targetDate - todayDate;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let urgency = 'upcoming';
      let statusLabel = `In ${diffDays} days`;

      if (diffDays < 0) {
        urgency = 'overdue';
        statusLabel = `${Math.abs(diffDays)} days overdue`;
      } else if (diffDays === 0) {
        urgency = 'today';
        statusLabel = 'Today';
      } else if (diffDays === 1) {
        urgency = 'tomorrow';
        statusLabel = 'Tomorrow';
      }

      return {
        id: r.id,
        visit_id: r.id,
        patient_id: r.patient_id,
        patient_name: r.patient_name || null,
        provider_id: r.provider_id,
        provider_name: r.provider_name || null,
        title: r.title,
        record_type: r.record_type,
        visit_date: r.visit_date,
        follow_up_date: r.follow_up_date,
        days_remaining: diffDays,
        urgency,
        status_label: statusLabel,
        reminder_banner: {
          active: true,
          urgency,
          title: `Follow-up Reminder: ${r.title}`,
          message: diffDays >= 0
            ? `Follow-up scheduled on ${r.follow_up_date} (${statusLabel}).`
            : `Follow-up was scheduled for ${r.follow_up_date} (${statusLabel}). Please reschedule promptly.`
        }
      };
    });

    await logAuditEvent({
      actor_id: user.id,
      actor_role: user.role,
      action: 'VIEW_UPCOMING_FOLLOWUPS',
      target_type: 'followup_collection',
      target_id: 'upcoming',
      result: 'ALLOWED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details_redacted: { followups_count: followups.length }
    });

    return res.json({
      today,
      count: followups.length,
      followups
    });
  } catch (err) {
    console.error('[GET_FOLLOWUPS_ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve follow-ups', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
