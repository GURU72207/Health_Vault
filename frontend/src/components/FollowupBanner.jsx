import React from 'react';
import { Calendar, BellRing, Clock, ArrowRight, X } from 'lucide-react';

export default function FollowupBanner({ followup, onDismiss, onViewAll }) {
  if (!followup) return null;

  const isOverdue = followup.urgency === 'overdue';
  const isUrgent = followup.urgency === 'today' || followup.urgency === 'tomorrow';

  const borderColor = isOverdue
    ? 'border-red-500/40 bg-red-950/30'
    : isUrgent
    ? 'border-amber-500/40 bg-amber-950/30'
    : 'border-emerald-500/40 bg-emerald-950/30';

  const badgeColor = isOverdue
    ? 'bg-red-500/20 text-red-400 border-red-500/40'
    : isUrgent
    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';

  return (
    <div className={`p-4 rounded-xl border ${borderColor} relative backdrop-blur-sm transition-all shadow-lg`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className={`p-2.5 rounded-lg border ${badgeColor} shrink-0`}>
            <BellRing className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-md border ${badgeColor}`}>
                {followup.status_label}
              </span>
              <span className="text-xs font-mono text-slate-400 flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1" />
                Target Date: {followup.follow_up_date}
              </span>
            </div>
            <h4 className="text-sm font-semibold text-white mt-1">
              {followup.title} {followup.provider_name ? `with ${followup.provider_name}` : ''}
            </h4>
            <p className="text-xs text-slate-300">
              {followup.reminder_banner?.message || 'Routine follow-up scheduled. Please adhere to prescribed regimen.'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
          <button
            onClick={onViewAll}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center border border-slate-700 transition"
          >
            <span>Follow-Ups View</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
