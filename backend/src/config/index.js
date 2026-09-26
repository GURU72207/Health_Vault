const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 5001,
  jwtSecret: process.env.JWT_SECRET || 'uran2026_default_phr_jwt_secret_dev_only',
  jwtExpiresIn: '8h',
  aesKey: process.env.AES_256_SECRET_KEY || 'b9f4a7c8e2d10356a8bc43fe12098d5e7a6b4c3d2e1f0a9b8c7d6e5f4a3b2c1d',
  dbPath: path.resolve(__dirname, '../../data/phr_data.sqlite'),
  uploadDir: path.resolve(__dirname, '../../data/uploads'),
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10,
  aiApiKey: process.env.AI_VERIFICATION_API_KEY || process.env.GEMINI_API_KEY || null,
  env: process.env.NODE_ENV || 'development'
};

module.exports = config;
