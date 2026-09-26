import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  UserCheck,
  Stethoscope,
  ShieldCheck,
  ChevronDown,
  LogOut,
  User,
  Lock,
  Layers
} from 'lucide-react';

export default function Navbar({ onOpenAuthModal, activeTab, setActiveTab }) {
  const { user, profile, personas, switchPersona, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isPatient = user?.role === 'patient';
  const isProvider = user?.role === 'provider';
  const isAdmin = user?.role === 'admin';

  return (
    <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Platform Info */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-white tracking-tight">SecurePHR</span>
                <span className="text-[11px] px-2 py-0.5 font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full">
                  HT-05
                </span>
              </div>
              <p className="text-xs text-slate-400">Consent-Gated & Audit-Logged Health Record</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          {user && (
            <nav className="hidden md:flex items-center space-x-1">
              {[
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'records', label: 'Health Records & Visits' },
                { id: 'documents', label: 'Documents' },
                ...(isPatient ? [{ id: 'consent', label: 'Consent Control' }] : []),
                { id: 'followups', label: 'Follow-Ups' },
                { id: 'audit', label: 'Audit Trail' },
                { id: 'security', label: 'Security Specs' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    activeTab === tab.id
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          )}

          {/* User Session & Quick Persona Switcher */}
          <div className="flex items-center space-x-3">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center space-x-2.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-left transition"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                    isPatient
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : isProvider
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                      : 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                  }`}>
                    {isPatient ? <User className="w-4 h-4" /> : isProvider ? <Stethoscope className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                  </div>
                  <div className="hidden sm:block">
                    <div className="text-xs font-semibold text-white leading-tight">{user.name}</div>
                    <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                      {user.role}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50 animate-fade-in text-sm">
                    <div className="px-3 py-2 border-b border-slate-800">
                      <p className="text-xs text-slate-400">Authenticated As</p>
                      <p className="font-semibold text-white truncate">{user.email}</p>
                      <div className="mt-1 flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[11px] text-emerald-400 font-mono">RBAC Session Active</span>
                      </div>
                    </div>

                    <div className="py-2">
                      <p className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Switch Demo Persona
                      </p>
                      {personas.map(p => (
                        <button
                          key={p.key}
                          onClick={async () => {
                            await switchPersona(p.key);
                            setDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition ${
                            user.email === p.email
                              ? 'bg-emerald-500/15 text-emerald-300 font-semibold'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <div>
                            <div>{p.name}</div>
                            <div className="text-[10px] text-slate-500 capitalize">{p.role} {p.specialty ? `(${p.specialty})` : ''}</div>
                          </div>
                          {user.email === p.email && <span className="text-emerald-400 text-xs">Active</span>}
                        </button>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-800">
                      <button
                        onClick={() => {
                          logout();
                          setDropdownOpen(false);
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition"
              >
                Sign In / Select Persona
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
