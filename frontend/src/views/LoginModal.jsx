import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  User,
  Stethoscope,
  Lock,
  Mail,
  Key,
  ArrowRight,
  UserPlus,
  LogIn
} from 'lucide-react';

export default function LoginModal({ isOpen, onClose }) {
  const { login, signup, personas, switchPersona } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('patient');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      if (isSignup) {
        await signup({ name, email, password, role, address });
      } else {
        await login(email, password);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative">
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          ✕
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center mx-auto mb-2 shadow-lg shadow-emerald-500/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold text-white">
            {isSignup ? 'Create PHR Account' : 'Authenticate Session'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            URAN 2026 HT-05 Secure Health Record Platform
          </p>
        </div>

        {/* Quick Demo Persona Selection */}
        <div className="mb-5 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            One-Click Judging Personas
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={async () => {
                await switchPersona('patientJohn');
                onClose();
              }}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-left transition flex items-center space-x-2"
            >
              <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div className="truncate">
                <div className="font-semibold text-slate-200">John Doe</div>
                <div className="text-[10px] text-slate-500">Patient (Granted)</div>
              </div>
            </button>

            <button
              type="button"
              onClick={async () => {
                await switchPersona('patientSarah');
                onClose();
              }}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-left transition flex items-center space-x-2"
            >
              <User className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <div className="truncate">
                <div className="font-semibold text-slate-200">Sarah Smith</div>
                <div className="text-[10px] text-slate-500">Patient (Ungranted)</div>
              </div>
            </button>

            <button
              type="button"
              onClick={async () => {
                await switchPersona('providerPriya');
                onClose();
              }}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-left transition flex items-center space-x-2"
            >
              <Stethoscope className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <div className="truncate">
                <div className="font-semibold text-slate-200">Dr. Priya Sharma</div>
                <div className="text-[10px] text-slate-500">Cardiologist</div>
              </div>
            </button>

            <button
              type="button"
              onClick={async () => {
                await switchPersona('admin');
                onClose();
              }}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-left transition flex items-center space-x-2"
            >
              <Lock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <div className="truncate">
                <div className="font-semibold text-slate-200">Auditor Admin</div>
                <div className="text-[10px] text-slate-500">Compliance</div>
              </div>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-red-500/20 border border-red-500/40 rounded-lg text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Custom Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {isSignup && (
            <div>
              <label className="block text-slate-400 mb-1">Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          <div>
            <label className="block text-slate-400 mb-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {isSignup && (
            <>
              <div>
                <label className="block text-slate-400 mb-1">Account Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none"
                >
                  <option value="patient">Patient (Owns records & grants consent)</option>
                  <option value="provider">Healthcare Provider (Clinical physician)</option>
                </select>
              </div>

              {role === 'patient' && (
                <div>
                  <label className="block text-slate-400 mb-1">Home Address (AES-256 Encrypted)</label>
                  <input
                    type="text"
                    placeholder="e.g. 123 Healthcare Ave, Suite 400"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition disabled:opacity-50 mt-4 flex items-center justify-center space-x-1.5"
          >
            {isSignup ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            <span>{loading ? 'Authenticating...' : isSignup ? 'Create Account' : 'Sign In'}</span>
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setIsSignup(!isSignup)}
            className="text-xs text-slate-400 hover:text-emerald-400 transition"
          >
            {isSignup ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
          </button>
        </div>

      </div>
    </div>
  );
}
