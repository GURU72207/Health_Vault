import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import FollowupBanner from '../components/FollowupBanner';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Calendar,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  Activity,
  PlusCircle,
  Clock,
  ArrowRight,
  Database
} from 'lucide-react';

export default function DashboardView({ setActiveTab, onTriggerAccessDenied }) {
  const { user, profile, refreshProfile } = useAuth();
  const [stats, setStats] = useState({
    visitsCount: 0,
    docsCount: 0,
    grantsCount: 0,
    upcomingCount: 0
  });
  const [upcomingFollowup, setUpcomingFollowup] = useState(null);
  const [showEncryptedAddress, setShowEncryptedAddress] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      if (!user) return;
      try {
        setLoading(true);
        // Load upcoming follow-ups
        const followupsRes = await api.getUpcomingFollowups();
        if (followupsRes.followups && followupsRes.followups.length > 0) {
          setUpcomingFollowup(followupsRes.followups[0]);
        } else {
          setUpcomingFollowup(null);
        }

        // Load visits
        const visitsRes = await api.getVisits();
        // Load documents
        const docsRes = await api.getDocuments();

        let grants = [];
        try {
          const grantsRes = await api.getGrants();
          grants = grantsRes.grants || grantsRes.active_patients || [];
        } catch (_) {}

        setStats({
          visitsCount: visitsRes.visits?.length || 0,
          docsCount: docsRes.documents?.length || 0,
          grantsCount: grants.length,
          upcomingCount: followupsRes.count || 0
        });
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, [user]);

  const isPatient = user?.role === 'patient';
  const isProvider = user?.role === 'provider';

  return (
    <div className="space-y-6">
      
      {/* Top Banner Alert for Upcoming Clinical Follow-Up */}
      {upcomingFollowup && (
        <FollowupBanner
          followup={upcomingFollowup}
          onViewAll={() => setActiveTab('followups')}
        />
      )}

      {/* Hero Welcome & Role Indicator */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${
                isPatient
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
              }`}>
                {isPatient ? 'Consent-Gated Patient Portal' : 'Clinical Provider Portal'}
              </span>
              <span className="text-xs text-slate-400 font-mono">ID: {user?.id?.substring(0, 8)}...</span>
            </div>
            <h2 className="text-2xl font-bold text-white mt-1">
              Welcome back, {user?.name}
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              {isPatient
                ? 'You maintain sovereign ownership of your health record. Healthcare providers cannot access your medical encounters or lab documents until you explicitly grant active consent.'
                : 'You are operating within the clinical provider interface. Data access is strictly restricted to patients who have active, non-revoked consent grants on record.'}
            </p>
          </div>

          {/* Winning Angle Highlight Action */}
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <button
              onClick={onTriggerAccessDenied}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-semibold flex items-center justify-center space-x-2 shadow-lg shadow-red-600/30 transition group"
            >
              <ShieldAlert className="w-4 h-4 text-red-200 group-hover:scale-110 transition" />
              <span>Simulate Blocked Access Demo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Clinical Records</span>
            <FileText className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{stats.visitsCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Encounters & Rx</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Uploaded Documents</span>
            <Activity className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{stats.docsCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Lab tests & reports</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              {isPatient ? 'Active Providers' : 'Granted Patients'}
            </span>
            <UserCheck className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{stats.grantsCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Consent-gated pairs</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Upcoming Follow-Ups</span>
            <Calendar className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{stats.upcomingCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Active reminders</div>
        </div>
      </div>

      {/* Patient Profile Demographics with AES-256 Inspection */}
      {isPatient && profile && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Patient Profile & AES-256 Encrypted Demographics</h3>
            </div>
            <button
              onClick={() => setShowEncryptedAddress(!showEncryptedAddress)}
              className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center space-x-1.5 border border-slate-700 transition"
            >
              {showEncryptedAddress ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showEncryptedAddress ? 'Show Decrypted Text' : 'Inspect Ciphertext at Rest'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 text-xs">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
              <span className="text-slate-500 block">Date of Birth:</span>
              <span className="font-semibold text-slate-200 mt-0.5 block">{profile.dob || 'Not specified'}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
              <span className="text-slate-500 block">Blood Group:</span>
              <span className="font-semibold text-emerald-400 mt-0.5 block">{profile.blood_group || 'O+'}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
              <span className="text-slate-500 block">Contact Phone:</span>
              <span className="font-semibold text-slate-200 mt-0.5 block">{profile.phone || '+1-555-0100'}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
              <span className="text-slate-500 block">Emergency Contact:</span>
              <span className="font-semibold text-slate-200 mt-0.5 block">{profile.emergency_contact || 'None listed'}</span>
            </div>
          </div>

          {/* Address Encryption at Rest Inspector */}
          <div className="mt-3 bg-slate-950 p-3 rounded-lg border border-slate-800/80 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>Home Address ({showEncryptedAddress ? 'AES-256-GCM Raw Ciphertext in SQLite' : 'Decrypted View'}):</span>
              <span className="text-[10px] text-emerald-400">Algorithm: AES-256-GCM</span>
            </div>
            <div className={`p-2 rounded bg-slate-900 border border-slate-800 break-all ${
              showEncryptedAddress ? 'text-amber-300 font-mono text-[11px]' : 'text-slate-200'
            }`}>
              {showEncryptedAddress ? profile.address_encrypted : profile.address}
            </div>
          </div>
        </div>
      )}

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => setActiveTab('records')}
          className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 p-4 rounded-xl cursor-pointer transition group"
        >
          <div className="flex items-center justify-between">
            <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition">
              <FileText className="w-5 h-5" />
            </span>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition" />
          </div>
          <h4 className="font-semibold text-white mt-3">Health Records & Encounters</h4>
          <p className="text-xs text-slate-400 mt-1">
            Search clinical visit notes, prescriptions, and lab tests with AES-256 encryption.
          </p>
        </div>

        {isPatient && (
          <div
            onClick={() => setActiveTab('consent')}
            className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-sky-500/40 p-4 rounded-xl cursor-pointer transition group"
          >
            <div className="flex items-center justify-between">
              <span className="p-2 rounded-lg bg-sky-500/10 text-sky-400 group-hover:bg-sky-500/20 transition">
                <UserCheck className="w-5 h-5" />
              </span>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition" />
            </div>
            <h4 className="font-semibold text-white mt-3">Consent & Access Control</h4>
            <p className="text-xs text-slate-400 mt-1">
              Grant or revoke provider access in real-time. Unapproved providers cannot view any records.
            </p>
          </div>
        )}

        <div
          onClick={() => setActiveTab('audit')}
          className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-purple-500/40 p-4 rounded-xl cursor-pointer transition group"
        >
          <div className="flex items-center justify-between">
            <span className="p-2 rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition" />
          </div>
          <h4 className="font-semibold text-white mt-3">Immutable Audit Trail</h4>
          <p className="text-xs text-slate-400 mt-1">
            Every read, write, consent change, and blocked access attempt is logged permanently.
          </p>
        </div>
      </div>

    </div>
  );
}
