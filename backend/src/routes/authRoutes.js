const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const db = require('../database/db');
const { encrypt, decrypt } = require('../services/cryptoService');
const { logAuditEvent } = require('../services/auditService');
const { authenticateToken } = require('../middleware/authMiddleware');

// Rate limiting on sensitive auth endpoints to mitigate brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many login attempts. Please try again after 15 minutes.', code: 'RATE_LIMIT_EXCEEDED' }
});

/**
 * POST /api/auth/signup
 * Register a new Patient or Provider account.
 */
router.post('/signup', authLimiter, async (req, res) => {
  const { name, email, password, role, dob, phone, address, blood_group, specialty } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required', code: 'INVALID_INPUT' });
  }

  if (!['patient', 'provider'].includes(role)) {
    return res.status(400).json({ error: "Role must be either 'patient' or 'provider'", code: 'INVALID_ROLE' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long', code: 'WEAK_PASSWORD' });
  }

  try {
    const existing = await db.queryOne(`SELECT id FROM users WHERE email = ?`, [email.toLowerCase().trim()]);
    if (existing) {
      await logAuditEvent({
        actor_id: 'unauthenticated',
        actor_role: role,
        action: 'SIGNUP_DUPLICATE_EMAIL',
        target_type: 'user',
        target_id: email,
        result: 'DENIED',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details_redacted: 'Email already registered'
      });

      return res.status(409).json({ error: 'An account with this email already exists', code: 'EMAIL_EXISTS' });
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);
    const createdAt = new Date().toISOString();

    // Insert user
    await db.run(
      `INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, name.trim(), email.toLowerCase().trim(), passwordHash, role, createdAt]
    );

    // If patient, initialize profile with AES-256 encrypted address
    if (role === 'patient') {
      const encryptedAddress = encrypt(address || 'No address provided');
      await db.run(
        `INSERT INTO patients (user_id, dob, phone, address_encrypted, blood_group, emergency_contact) VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, dob || '1990-01-01', phone || '+1-555-0100', encryptedAddress, blood_group || 'Unknown', null]
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: userId, email: email.toLowerCase().trim(), role, name: name.trim() },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    await logAuditEvent({
      actor_id: userId,
      actor_role: role,
      action: 'SIGNUP_SUCCESS',
      target_type: 'user',
      target_id: userId,
      result: 'ALLOWED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details_redacted: { role, email: email.toLowerCase().trim() }
    });

    return res.status(201).json({
      message: 'Account successfully registered',
      token,
      user: {
        id: userId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role
      }
    });
  } catch (err) {
    console.error('[AUTH_SIGNUP_ERROR]', err);
    return res.status(500).json({ error: 'Failed to complete registration', code: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/auth/login
 * Authenticate with email and password.
 */
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required', code: 'INVALID_INPUT' });
  }

  try {
    const user = await db.queryOne(`SELECT * FROM users WHERE email = ?`, [email.toLowerCase().trim()]);

    if (!user) {
      await logAuditEvent({
        actor_id: 'unauthenticated',
        actor_role: 'unauthenticated',
        action: 'LOGIN_FAILURE',
        target_type: 'user',
        target_id: email.toLowerCase().trim(),
        result: 'DENIED',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details_redacted: 'Email not found in database'
      });

      return res.status(401).json({ error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      await logAuditEvent({
        actor_id: user.id,
        actor_role: user.role,
        action: 'LOGIN_FAILURE',
        target_type: 'user',
        target_id: user.id,
        result: 'DENIED',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        details_redacted: 'Password mismatch'
      });

      return res.status(401).json({ error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    await logAuditEvent({
      actor_id: user.id,
      actor_role: user.role,
      action: 'LOGIN_SUCCESS',
      target_type: 'user',
      target_id: user.id,
      result: 'ALLOWED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details_redacted: 'Successful authentication'
    });

    return res.json({
      message: 'Authentication successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('[AUTH_LOGIN_ERROR]', err);
    return res.status(500).json({ error: 'Internal login error', code: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/auth/me
 * Return current authenticated session and profile details.
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    let profile = null;
    if (req.user.role === 'patient') {
      const patientRow = await db.queryOne(`SELECT * FROM patients WHERE user_id = ?`, [req.user.id]);
      if (patientRow) {
        profile = {
          ...patientRow,
          address: decrypt(patientRow.address_encrypted),
          address_encrypted: patientRow.address_encrypted // retain encrypted blob to prove AES-256 at rest!
        };
      }
    }

    return res.json({
      user: req.user,
      profile
    });
  } catch (err) {
    console.error('[AUTH_ME_ERROR]', err);
    return res.status(500).json({ error: 'Failed to fetch session profile', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
