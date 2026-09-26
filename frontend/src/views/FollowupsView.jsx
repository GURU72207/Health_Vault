import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import {
  Calendar,
  Clock,
  BellRing,
  Send,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  User,
  ArrowRight
} from 'lucide-react';

export default function FollowupsView() {
  const { user } = useAuth();
  const [followups, setFollowups] = useState([]);
  const [today, setToday] = useState('');
  const [loading, setLoading] = useState(true);
  const [simulatedNotice, setSimulatedNotice] = useState(null);

  const loadFollowups = async () => {
    try {
      setLoading(true);
      const res = await api.getUpcomingFollowups();
      setFollowups(res.followups || []);
      setToday(res.today || '');
    } catch (err) {
      console.error('Failed to load follow-ups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFollowups();
  }, [user]);

  const handleSimulateReminder = (item) => {
    setSimulatedNotice({
      recipient: user?.email,
      phone: '+1-555-0144',
      title: item.title,
      date: item.follow_up_date,
      days: item.days_remaining,
      channel: 'SMS & Email Gateway (Simulated)',
      timestamp: new Date().toLocaleTimeString(),
      text: `[REMINDER] URAN SecurePHR: Your follow-up encounter '${item.title}' is due on ${item.follow_up_date}. Please ensure medications are taken as scheduled.`
    });
  };

  const getUrgencyBadge = (urgency, statusLabel) => {
    switch (urgency) {
      case 'overdue':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/40 flex items-center space-x-1">
            <AlertCircle className="w-3.5 h-3.5 mr-1" />
            {statusLabel}
          </span>
        );
      case 'today':
      case 'tomorrow':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 mr-1" />
            {statusLabel}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center space-x-1">
            <Calendar className="w-3.5 h-3.5 mr-1" />
            {statusLabel}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-bold text-white">Upcoming Follow-Ups & Clinical Reminder Engine</h2>
          <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Automated Tracking
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Monitor scheduled consultations and verify automated notification dispatch for continuity of care.
        </p>
      </div>

      {/* Simulated Dispatch Modal / Banner */}
      {simulatedNotice && (
        <div className="bg-slate-900 border-2 border-emerald-500/50 p-4 rounded-xl shadow-xl space-y-2 animate-fade-in text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Simulated Multi-Channel Patient Notification Dispatched</span>
            </div>
            <button
              onClick={() => setSimulatedNotice(null)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] space-y-1 text-slate-300">
            <div><strong>Channel:</strong> {simulatedNotice.channel}</div>
            <div><strong>Recipient:</strong> {simulatedNotice.recipient} ({simulatedNotice.phone})</div>
            <div><strong>Payload Message:</strong> {simulatedNotice.text}</div>
            <div><strong>Timestamp:</strong> {simulatedNotice.timestamp}</div>
          </div>
        </div>
      )}

      {/* Follow-ups Timeline Cards */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Loading follow-ups schedule...</div>
        ) : followups.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
            <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No scheduled follow-ups</p>
            <p className="text-xs text-slate-500 mt-1">All encounters are currently up to date.</p>
          </div>
        ) : (
          followups.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 rounded-xl shadow-lg transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  {getUrgencyBadge(item.urgency, item.status_label)}
                  <span className="text-xs font-mono text-slate-400">
                    Scheduled: {item.follow_up_date}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white">{item.title}</h3>

                <div className="flex items-center space-x-3 text-xs text-slate-400">
                  <span className="flex items-center">
                    <User className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    {item.provider_name ? `Dr. ${item.provider_name}` : 'Provider'}
                  </span>
                  <span>•</span>
                  <span>Encounter Type: {item.record_type}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 self-end sm:self-center shrink-0">
                <button
                  onClick={() => handleSimulateReminder(item)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border border-slate-700 flex items-center space-x-1.5 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Simulate SMS/Email Alert</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
