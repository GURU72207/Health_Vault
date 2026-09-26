import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import {
  ShieldCheck,
  Lock,
  Database,
  Key,
  Server,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Code
} from 'lucide-react';

export default function SecurityArchitectureView() {
  const [demoStatus, setDemoStatus] = useState(null);

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await api.getDemoStatus();
        setDemoStatus(res);
      } catch (err) {
        console.error('Failed to load status:', err);
      }
    }
    loadStatus();
  }, []);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-bold text-white">Security Architecture & Cryptographic Specifications</h2>
          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            HT-05 Verified
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Technical specifications of zero-trust RBAC, AES-256 encryption-at-rest, and the immutable audit ledger.
        </p>
      </div>

      {/* Live Operational Status */}
      {demoStatus && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center">
              <Server className="w-4 h-4 mr-2 text-emerald-400" />
              Live Security Engine State
            </h3>
            <span className="px-2 py-0.5 text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30">
              STATUS: {demoStatus.status}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs font-mono">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-500 block">Total Audit Entries:</span>
              <span className="text-lg font-bold text-white mt-1 block">
                {demoStatus.counts?.total_audit_events}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-500 block">Denied Access Logged:</span>
              <span className="text-lg font-bold text-red-400 mt-1 block">
                {demoStatus.counts?.denied_attempts_logged}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-500 block">Active Consent Grants:</span>
              <span className="text-lg font-bold text-sky-400 mt-1 block">
                {demoStatus.counts?.active_consent_grants}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-500 block">Encrypted Records:</span>
              <span className="text-lg font-bold text-emerald-400 mt-1 block">
                {demoStatus.counts?.visits}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Cryptography Specification Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Encryption at Rest */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3">
          <div className="flex items-center space-x-2 text-emerald-400">
            <Lock className="w-5 h-5" />
            <h3 className="font-semibold text-sm text-white">AES-256-GCM Encryption-at-Rest</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Sensitive clinical fields (diagnoses, consultation notes, medication dosages, and home addresses) are encrypted at rest using AES-256 in Galois/Counter Mode (GCM).
          </p>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] space-y-1 text-slate-400">
            <div><strong className="text-slate-300">Cipher:</strong> aes-256-gcm (Authenticated)</div>
            <div><strong className="text-slate-300">IV Length:</strong> 96 bits (12 bytes, cryptographically random per record)</div>
            <div><strong className="text-slate-300">Auth Tag:</strong> 128 bits (16 bytes, prevents ciphertext tampering)</div>
            <div><strong className="text-slate-300">Key Sourcing:</strong> AES_256_SECRET_KEY env var (SHA-256 derived 32-byte key)</div>
            <div><strong className="text-slate-300">Storage Format:</strong> iv_hex:authTag_hex:ciphertext_hex</div>
          </div>
        </div>

        {/* Identity & Password Hashing */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3">
          <div className="flex items-center space-x-2 text-sky-400">
            <Key className="w-5 h-5" />
            <h3 className="font-semibold text-sm text-white">Password & Token Security</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Authentication is safeguarded against credential theft, rainbow tables, and session replay attacks.
          </p>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] space-y-1 text-slate-400">
            <div><strong className="text-slate-300">Password Hashing:</strong> Bcrypt with 12 salt rounds</div>
            <div><strong className="text-slate-300">Token Format:</strong> Signed JWT (JSON Web Token) with HMAC-SHA256</div>
            <div><strong className="text-slate-300">Session Expiry:</strong> 8 hours with explicit server validation</div>
            <div><strong className="text-slate-300">Rate Limiting:</strong> Express-rate-limit on auth endpoints (100 req / 15 min)</div>
            <div><strong className="text-slate-300">Log Sanitization:</strong> Active middleware strips passwords and PII</div>
          </div>
        </div>

      </div>

      {/* RBAC Matrix Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-white">Role-Based Access Control (RBAC) Matrix</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Strictly enforced server-side by <code className="text-emerald-400 font-mono">rbacMiddleware.js</code> on every request.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-medium">
              <tr>
                <th className="py-3 px-4">Resource / Operation</th>
                <th className="py-3 px-4">Patient Role</th>
                <th className="py-3 px-4">Provider (With Consent)</th>
                <th className="py-3 px-4">Provider (Ungranted)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
              <tr>
                <td className="py-3 px-4 font-sans font-medium text-slate-200">View Patient Profile</td>
                <td className="py-3 px-4 text-emerald-400">ALLOWED (Own only)</td>
                <td className="py-3 px-4 text-emerald-400">ALLOWED</td>
                <td className="py-3 px-4 text-red-400 font-bold">403 DENIED + LOGGED</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-sans font-medium text-slate-200">View Clinical Encounters / Rx</td>
                <td className="py-3 px-4 text-emerald-400">ALLOWED (Own only)</td>
                <td className="py-3 px-4 text-emerald-400">ALLOWED</td>
                <td className="py-3 px-4 text-red-400 font-bold">403 DENIED + LOGGED</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-sans font-medium text-slate-200">Create Clinical Encounter</td>
                <td className="py-3 px-4 text-emerald-400">ALLOWED (Own record)</td>
                <td className="py-3 px-4 text-emerald-400">ALLOWED</td>
                <td className="py-3 px-4 text-red-400 font-bold">403 DENIED + LOGGED</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-sans font-medium text-slate-200">Upload / Download Documents</td>
                <td className="py-3 px-4 text-emerald-400">ALLOWED (Own record)</td>
                <td className="py-3 px-4 text-emerald-400">ALLOWED</td>
                <td className="py-3 px-4 text-red-400 font-bold">403 DENIED + LOGGED</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-sans font-medium text-slate-200">Grant / Revoke Consent</td>
                <td className="py-3 px-4 text-emerald-400">ALLOWED (Patient Sovereign)</td>
                <td className="py-3 px-4 text-slate-500">FORBIDDEN</td>
                <td className="py-3 px-4 text-slate-500">FORBIDDEN</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-sans font-medium text-slate-200">View Audit Trail</td>
                <td className="py-3 px-4 text-emerald-400">ALLOWED (All events on own data)</td>
                <td className="py-3 px-4 text-sky-400">ALLOWED (Own actions only)</td>
                <td className="py-3 px-4 text-sky-400">ALLOWED (Own actions only)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
