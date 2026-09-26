const crypto = require('crypto');
const config = require('../config');

// Derive exact 256-bit (32-byte) encryption key from the environment secret
const DERIVED_KEY = crypto.createHash('sha256').update(config.aesKey).digest();
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM

/**
 * Encrypt sensitive plain text using AES-256-GCM.
 * Output format: iv:authTag:ciphertext (all in hex)
 *
 * @param {string} plaintext - Sensitive text (clinical notes, home address, etc.)
 * @returns {string} Encrypted blob
 */
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) {
    return null;
  }
  const textStr = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, DERIVED_KEY, iv);
  
  let encrypted = cipher.update(textStr, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt ciphertext previously encrypted with encrypt().
 * Validates integrity via AES-GCM authentication tag.
 *
 * @param {string} encryptedBlob - iv:authTag:ciphertext
 * @returns {string} Original plain text
 */
function decrypt(encryptedBlob) {
  if (!encryptedBlob || typeof encryptedBlob !== 'string') {
    return null;
  }

  const parts = encryptedBlob.split(':');
  if (parts.length !== 3) {
    // If not properly formatted or legacy plaintext, return as is safely
    return encryptedBlob;
  }

  try {
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const ciphertext = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, DERIVED_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('[SECURITY_ALERT] AES-GCM Decryption failed or ciphertext was tampered with.');
    return '[ENCRYPTED_DATA_TAMPER_ERROR]';
  }
}

/**
 * Deep redaction utility to sanitize logs and prevent PII, tokens, or encryption keys from leaking.
 */
function redactPII(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const SENSITIVE_KEYS = [
    'password', 'password_hash', 'token', 'authorization', 'secret',
    'notes_encrypted', 'address_encrypted', 'notes', 'address', 'key',
    'phone', 'ssn', 'dob', 'credit_card'
  ];

  if (Array.isArray(obj)) {
    return obj.map(redactPII);
  }

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some(k => lowerKey.includes(k))) {
      clean[key] = '[REDACTED_FOR_PRIVACY]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = redactPII(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

module.exports = {
  encrypt,
  decrypt,
  redactPII
};
