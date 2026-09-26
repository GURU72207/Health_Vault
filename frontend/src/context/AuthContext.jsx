import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('phr_token') || null);
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch demo personas once on mount
  useEffect(() => {
    async function loadPersonas() {
      try {
        const res = await api.getPersonas();
        setPersonas(res.personas || []);
      } catch (err) {
        console.error('Failed to load demo personas:', err);
      }
    }
    loadPersonas();
  }, []);

  // Check existing session
  useEffect(() => {
    async function checkSession() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.getMe();
        setUser(res.user);
        setProfile(res.profile);
      } catch (err) {
        console.warn('Session invalid or expired. Logging out.');
        localStorage.removeItem('phr_token');
        setToken(null);
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, [token]);

  const login = async (email, password) => {
    const res = await api.login({ email, password });
    localStorage.setItem('phr_token', res.token);
    setToken(res.token);
    setUser(res.user);
    // Refresh profile details
    try {
      const meRes = await api.getMe();
      setProfile(meRes.profile);
    } catch (_) {}
    return res.user;
  };

  const signup = async (userData) => {
    const res = await api.signup(userData);
    localStorage.setItem('phr_token', res.token);
    setToken(res.token);
    setUser(res.user);
    try {
      const meRes = await api.getMe();
      setProfile(meRes.profile);
    } catch (_) {}
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem('phr_token');
    setToken(null);
    setUser(null);
    setProfile(null);
  };

  const switchPersona = async (personaKey) => {
    const persona = personas.find(p => p.key === personaKey);
    if (!persona) return;
    return await login(persona.email, persona.password);
  };

  const refreshProfile = async () => {
    if (!token) return;
    try {
      const meRes = await api.getMe();
      setUser(meRes.user);
      setProfile(meRes.profile);
    } catch (err) {
      console.error('Failed to refresh profile:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        token,
        personas,
        loading,
        login,
        signup,
        logout,
        switchPersona,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
