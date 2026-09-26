const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const db = require('./database/db');
const { redactLogger } = require('./middleware/redactLogger');
const { logAuditEvent } = require('./services/auditService');

// Route modules
const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const visitRoutes = require('./routes/visitRoutes');
const documentRoutes = require('./routes/documentRoutes');
const accessRoutes = require('./routes/accessRoutes');
const followupRoutes = require('./routes/followupRoutes');
const auditRoutes = require('./routes/auditRoutes');
const demoRoutes = require('./routes/demoRoutes');

const app = express();

// Security and middleware setup
app.use(cors({
  origin: '*', // Allow frontend dev server
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Privacy-preserving HTTP request logger
app.use(redactLogger);

// Health and discovery endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'Secure PHR Platform (HT-05)',
    timestamp: new Date().toISOString()
  });
});

app.get('/api', (req, res) => {
  res.json({
    project: 'Secure Digital Personal Health Record & Follow-Up Management Platform',
    challenge_id: 'HT-05',
    track: 'HealthTech',
    event: 'URAN 2026',
    endpoints: {
      auth: ['POST /api/auth/signup', 'POST /api/auth/login', 'GET /api/auth/me'],
      patients: ['GET /api/patients', 'GET /api/patients/:id', 'PUT /api/patients/:id'],
      visits: ['GET /api/visits?patient_id=', 'POST /api/visits', 'GET /api/visits/:id'],
      documents: ['GET /api/documents?patient_id=', 'POST /api/documents', 'GET /api/documents/:id/download'],
      access_grants: ['POST /api/access/grant', 'POST /api/access/revoke', 'GET /api/access/grants'],
      followups: ['GET /api/followups/upcoming'],
      audit: ['GET /api/audit-log'],
      demo: ['GET /api/demo/personas', 'POST /api/demo/reset', 'GET /api/demo/status']
    }
  });
});

// API Routes mounting
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/followups', followupRoutes);
app.use('/api/audit-log', auditRoutes);
app.use('/api/demo', demoRoutes);

// Global Error Handler
app.use(async (err, req, res, next) => {
  console.error('[SERVER_ERROR]', err.message);

  if (err.name === 'MulterError') {
    return res.status(400).json({ error: `File upload error: ${err.message}`, code: 'UPLOAD_ERROR' });
  }

  try {
    await logAuditEvent({
      actor_id: req.user ? req.user.id : 'unauthenticated',
      actor_role: req.user ? req.user.role : 'unauthenticated',
      action: 'INTERNAL_SERVER_ERROR',
      target_type: 'endpoint',
      target_id: req.originalUrl,
      result: 'DENIED',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      details_redacted: err.message
    });
  } catch (auditErr) {
    console.error('[AUDIT_FAILURE]', auditErr);
  }

  return res.status(500).json({
    error: 'Internal server error occurred',
    code: 'INTERNAL_ERROR'
  });
});

// Auto-initialize DB on startup and launch server
async function startServer() {
  try {
    await db.getDb();
    const server = app.listen(config.port, () => {
      console.log(`================================================================`);
      console.log(`  SECURE PHR PLATFORM SERVER (URAN 2026 HT-05)`);
      console.log(`  Status  : ONLINE`);
      console.log(`  Port    : ${config.port}`);
      console.log(`  Endpoint: http://localhost:${config.port}/api`);
      console.log(`  Security: AES-256-GCM + Bcrypt + RBAC + Immutable Audit Log`);
      console.log(`================================================================`);
    });
    return server;
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
