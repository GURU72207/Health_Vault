import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import {
  Sparkles,
  User,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  FileText,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  Info
} from 'lucide-react';

export default function DemoGuideBar({ currentTab, setTab, onTriggerAccessDenied }) {
  const { user, switchPersona } = useAuth();
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleReset = async () => {
    try {
      setResetting(true);
      await api.resetDemoData();
      await switchPersona('patientJohn');
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
    } catch (err) {
      console.error('Reset failed:', err);
    } finally {
      setResetting(false);
    }
  };

  const STEPS = [
    {
      num: 1,
      title: 'Patient Profile & Visit',
      persona: 'patientJohn',
      tab: 'records',
      desc: 'John Doe: view profile, visits, and upload document'
    },
    {
      num: 2,
      title: 'Grant Provider Access',
      persona: 'patientJohn',
      tab: 'consent',
      desc: 'Verify explicit consent grant to Dr. Priya Sharma'
    },
    {
      num: 3,
      title: 'Access Denied Live Demo',
      persona: 'providerPriya',
      isAction: true,
      action: () => onTriggerAccessDenied(),
      desc: 'Dr. Priya attempts to view Sarah Smith\'s unshared PHR -> 403 Forbidden!'
    },
    {
      num: 4,
      title: 'Patient Audit Review',
      persona: 'patientJohn',
      tab: 'audit',
      desc: 'John inspects immutable audit trail for provider events'
    },
    {
      num: 5,
      title: 'Upcoming Follow-ups',
      persona: 'patientJohn',
      tab: 'followups',
      desc: 'Check reminder countdowns and in-app banners'
    },
    {
      num: 6,
      title: 'Full Audit Trail',
      persona: 'patientJohn',
      tab: 'audit',
      desc: 'Inspect all ALLOWED and DENIED tamper-resistant logs'
    }
  ];

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border-b border-slate-800 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Title & Badge */}
        <div className="flex items-center space-x-2 shrink-0">
          <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
            <Sparkles className="w-4 h-4" />
          </span>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">URAN 2026 HT-05</span>
              <span className="text-xs px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded border border-slate-700">Demo Navigator</span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Step-by-step evaluator walkthrough</p>
          </div>
        </div>

        {/* 6 Step Buttons */}
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto py-1 scrollbar-none">
          {STEPS.map((step) => {
            const isAccessDenied = step.num === 3;
            return (
              <button
                key={step.num}
                onClick={async () => {
                  if (step.persona) {
                    await switchPersona(step.persona);
                  }
                  if (step.tab) {
                    setTab(step.tab);
                  }
                  if (step.action) {
                    step.action();
                  }
                }}
                title={step.desc}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 shrink-0 transition ${
                  isAccessDenied
                    ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 shadow-sm shadow-red-500/10'
                    : currentTab === step.tab && (!step.persona || user?.email?.includes(step.persona === 'patientJohn' ? 'john' : 'priya'))
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                }`}
              >
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                  isAccessDenied ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-200'
                }`}>
                  {step.num}
                </span>
                <span className="whitespace-nowrap">{step.title}</span>
              </button>
            );
          })}
        </div>

        {/* Database Reset Button */}
        <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
          <button
            onClick={handleReset}
            disabled={resetting}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center space-x-1.5 transition disabled:opacity-50"
            title="Reset synthetic database to baseline"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
            <span>{resetSuccess ? 'Reset Complete!' : 'Reset Demo DB'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
