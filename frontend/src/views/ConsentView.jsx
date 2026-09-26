import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import {
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  Plus,
  Stethoscope,
  Lock,
  Clock,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

export default function ConsentView() {
  const { user } = useAuth();
  const [grants, setGrants] = useState([]);
  const [availableProviders, setAvailableProviders] = useState([]);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const loadConsentData = async () => {
    try {
      setLoading(true);
      const grantsRes = await api.getGrants();
      setGrants(grantsRes.grants || []);

      const providersRes = await api.getProviders();
      setAvailableProviders(providersRes.providers || []);
      if (providersRes.providers && providersRes.providers.length > 0) {
        setSelectedProviderId(providersRes.providers[0].id);
      }
    } catch (err) {
      console.error('Failed to load consent data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConsentData();
  }, [user]);

  const handleGrant = async (e) => {
    e.preventDefault();
    if (!selectedProviderId) return;

    try {
      setActionError('');
      const res = await api.grantAccess(selectedProviderId);
      setActionSuccess(res.message || 'Access successfully granted.');
      setTimeout(() => setActionSuccess(''), 4000);
      await loadConsentData();
    } catch (err) {
      setActionError(err.message || 'Failed to grant access');
    }
  };

  const handleRevoke = async (providerId) => {
    try {
      setActionError('');
      const res = await api.revokeAccess(providerId);
      setActionSuccess(res.message || 'Access revoked.');
      setTimeout(() => setActionSuccess(''), 4000);
      await loadConsentData();
    } catch (err) {
      setActionError(err.message || 'Failed to revoke access');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-bold text-white">Consent-Gating & Provider Access Control</h2>
          <span className="text-xs px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
            Zero-Trust Consent
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          You own your health record. Explicitly control which physicians and clinical providers can view your visits, diagnostic tests, and follow-ups.
        </p>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess} (Recorded to Immutable Audit Trail)</span>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Grant New Provider Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center">
          <UserCheck className="w-4 h-4 mr-2 text-sky-400" />
          Authorize a Healthcare Provider
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Select a verified provider. Once authorized, the provider can inspect your clinical encounters and add follow-up notes.
        </p>

        <form onSubmit={handleGrant} className="flex flex-col sm:flex-row items-center gap-3">
          <select
            value={selectedProviderId}
            onChange={(e) => setSelectedProviderId(e.target.value)}
            className="w-full sm:flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
          >
            {availableProviders.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.email})
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={!selectedProviderId}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/20 transition flex items-center justify-center space-x-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Grant Access Consent</span>
          </button>
        </form>
      </div>

      {/* Current Grants Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Current & Historical Consent Grants</h3>
          <span className="text-xs text-slate-400 font-mono">{grants.length} records</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Loading consent records...</div>
        ) : grants.length === 0 ? (
          <div className="p-8 text-center">
            <Lock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No active or historical grants</p>
            <p className="text-xs text-slate-500 mt-1">Your records are completely private to you.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-medium">
                <tr>
                  <th className="py-3 px-4">Healthcare Provider</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Granted At</th>
                  <th className="py-3 px-4">Revocation Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {grants.map((g) => {
                  const isActive = !g.revoked_at;
                  return (
                    <tr key={g.id} className="hover:bg-slate-850/50 transition">
                      <td className="py-3 px-4 font-medium text-white flex items-center space-x-2">
                        <Stethoscope className="w-4 h-4 text-sky-400 shrink-0" />
                        <div>
                          <div>{g.provider_name}</div>
                          <div className="text-[10px] text-slate-400">{g.provider_email}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {isActive ? 'ACTIVE (CONSENT GRANTED)' : 'REVOKED (ACCESS BLOCKED)'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300 text-[11px]">
                        {g.granted_at ? g.granted_at.split('T')[0] : 'N/A'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        {g.revoked_at ? g.revoked_at.split('T')[0] : 'Active'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isActive ? (
                          <button
                            onClick={() => handleRevoke(g.provider_id)}
                            className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold inline-flex items-center space-x-1 transition"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>Revoke Access</span>
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              await api.grantAccess(g.provider_id);
                              await loadConsentData();
                            }}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold inline-flex items-center space-x-1 transition"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Re-grant Access</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
