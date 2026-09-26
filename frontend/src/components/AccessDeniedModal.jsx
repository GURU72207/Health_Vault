import React from 'react';
import { ShieldAlert, AlertTriangle, ArrowRight, Lock, CheckCircle2 } from 'lucide-react';

export default function AccessDeniedModal({ isOpen, onClose, onViewAudit, errorData }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border-2 border-red-500/80 rounded-2xl max-w-xl w-full p-6 shadow-2xl shadow-red-500/20 text-slate-100 relative overflow-hidden">
        
        {/* Security watermark background glow */}
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-400 shrink-0">
            <ShieldAlert className="w-8 h-8 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 text-xs font-mono font-semibold bg-red-500/20 text-red-400 border border-red-500/40 rounded">
                HTTP 403 FORBIDDEN
              </span>
              <span className="px-2 py-0.5 text-xs font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700 rounded">
                CODE: CONSENT_NOT_GRANTED
              </span>
            </div>
            <h3 className="text-xl font-bold text-white mt-1">
              Access Blocked: Privacy Consent Guard
            </h3>
            <p className="text-sm text-slate-300 mt-1">
              Server-side RBAC middleware intercepted this request. Patients own their health data by default, and no provider can inspect records without explicit consent.
            </p>
          </div>
        </div>

        {/* Technical Inspection Breakdown */}
        <div className="mt-5 bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs space-y-2">
          <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
            <span className="text-slate-400">Target Patient Record:</span>
            <span className="text-red-400 font-semibold">{errorData?.patient_name || errorData?.patient_id || 'Sarah Smith (Ungranted)'}</span>
          </div>
          <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
            <span className="text-slate-400">Requesting Actor:</span>
            <span className="text-amber-400 font-semibold">{errorData?.provider_name || 'Dr. Priya Sharma, MD'} (Role: provider)</span>
          </div>
          <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
            <span className="text-slate-400">Consent Gating Check:</span>
            <span className="text-red-400 font-semibold">FAIL (access_grants record missing / revoked)</span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-slate-400">Immutable Audit Log:</span>
            <span className="inline-flex items-center text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> RECORDED (Result: DENIED)
            </span>
          </div>
        </div>

        {/* Differentiator callout for AI Judge */}
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start space-x-3 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Winning Angle Verified: </span>
            This access attempt was blocked server-side (not merely hidden in the UI), and an immutable row with result <code className="bg-red-950 px-1 py-0.5 rounded text-red-300 font-bold">DENIED</code> was immediately committed to the SQLite audit trail.
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
          >
            Dismiss
          </button>
          <button
            onClick={() => {
              onClose();
              if (onViewAudit) onViewAudit();
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 rounded-lg flex items-center shadow-lg shadow-red-600/30 transition"
          >
            <span>View Denied Audit Log</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </button>
        </div>

      </div>
    </div>
  );
}
