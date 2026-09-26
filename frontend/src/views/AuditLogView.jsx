import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import {
  ShieldAlert,
  ShieldCheck,
  RotateCw,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Activity,
  Download,
  AlertTriangle
} from 'lucide-react';

export default function AuditLogView() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resultFilter, setResultFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadAuditLogs = async () => {
    try {
      setRefreshing(true);
      const params = {};
      if (resultFilter) params.result = resultFilter;
      const res = await api.getAuditLog(params);
      setLogs(res.logs || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [user, resultFilter]);

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `phr_audit_trail_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const deniedCount = logs.filter(l => l.result === 'DENIED').length;
  const allowedCount = logs.filter(l => l.result === 'ALLOWED').length;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-white">Immutable Security Audit Trail</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
              Append-Only Ledger
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Every read, write, consent grant, and blocked access attempt is permanently recorded.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadAuditLogs}
            disabled={refreshing}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Trail</span>
          </button>

          <button
            onClick={handleExportJson}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 flex items-center space-x-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Stat Bar and Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs">
        
        {/* Quick Filter Buttons */}
        <div className="flex items-center space-x-1.5 w-full sm:w-auto">
          <button
            onClick={() => setResultFilter('')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              resultFilter === ''
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            All Events ({logs.length})
          </button>
          <button
            onClick={() => setResultFilter('DENIED')}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center space-x-1 transition ${
              resultFilter === 'DENIED'
                ? 'bg-red-500/20 text-red-300 border border-red-500/40 font-semibold'
                : 'text-red-400/80 hover:bg-red-500/10'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 mr-1" />
            <span>DENIED Attempts ({deniedCount})</span>
          </button>
          <button
            onClick={() => setResultFilter('ALLOWED')}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center space-x-1 transition ${
              resultFilter === 'ALLOWED'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                : 'text-emerald-400/80 hover:bg-emerald-500/10'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            <span>ALLOWED Actions ({allowedCount})</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400 font-mono flex items-center">
          <span>Role Scope: </span>
          <span className="ml-1 text-slate-200 uppercase font-semibold">{user?.role} Isolation</span>
        </div>

      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Loading immutable audit trail...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No audit events match current criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-medium">
                <tr>
                  <th className="py-3 px-4">Result</th>
                  <th className="py-3 px-4">Timestamp (UTC)</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Type & ID</th>
                  <th className="py-3 px-4">Sanitized Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                {logs.map((log) => {
                  const isDenied = log.result === 'DENIED';
                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-slate-850/50 transition ${
                        isDenied ? 'bg-red-950/15' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-flex items-center space-x-1 ${
                          isDenied
                            ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        }`}>
                          {isDenied ? <XCircle className="w-3 h-3 mr-0.5" /> : <CheckCircle2 className="w-3 h-3 mr-0.5" />}
                          <span>{log.result}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {log.timestamp ? log.timestamp.replace('T', ' ').substring(0, 19) : 'N/A'}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-sans font-semibold text-slate-200">
                          {log.actor_name || log.actor_email || log.actor_id.substring(0, 8)}
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase">
                          Role: {log.actor_role}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          isDenied ? 'bg-red-900/50 text-red-200' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {log.action}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-300">
                        <span className="text-slate-500">[{log.target_type}]</span>{' '}
                        <span className="text-slate-300 font-mono">
                          {log.target_patient_name || log.target_name || log.target_id.substring(0, 8)}...
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-400 max-w-xs truncate font-sans text-xs" title={log.details_redacted}>
                        {log.details_redacted || 'Standard operation'}
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
