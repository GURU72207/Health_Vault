import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { api } from './api/client';
import Navbar from './components/Navbar';
import DemoGuideBar from './components/DemoGuideBar';
import AccessDeniedModal from './components/AccessDeniedModal';
import LoginModal from './views/LoginModal';

import DashboardView from './views/DashboardView';
import RecordsView from './views/RecordsView';
import DocumentsView from './views/DocumentsView';
import ConsentView from './views/ConsentView';
import FollowupsView from './views/FollowupsView';
import AuditLogView from './views/AuditLogView';
import SecurityArchitectureView from './views/SecurityArchitectureView';

function MainLayout() {
  const { user, switchPersona, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [accessDeniedState, setAccessDeniedState] = useState({
    isOpen: false,
    errorData: null
  });

  // Centerpiece judging demo trigger: Dr. Priya Sharma attempts to query Sarah Smith's ungranted PHR!
  const triggerAccessDeniedDemo = async () => {
    try {
      // 1. Switch persona to Dr. Priya Sharma
      await switchPersona('providerPriya');

      // 2. Sarah Smith's ID (ungranted private patient)
      const sarahSmithId = '22222222-2222-4000-8000-000000000002';

      // 3. Make real HTTP request to visits endpoint
      await api.getVisits({ patient_id: sarahSmithId });
    } catch (err) {
      // Catch real 403 Forbidden response from server
      setAccessDeniedState({
        isOpen: true,
        errorData: {
          patient_name: 'Sarah Smith (Ungranted Private PHR)',
          patient_id: '22222222-2222-4000-8000-000000000002',
          provider_name: 'Dr. Priya Sharma, MD',
          status: err.status || 403,
          code: err.data?.code || 'CONSENT_NOT_GRANTED',
          message: err.message
        }
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-mono text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
          <span>Initializing SecurePHR Security Framework...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Top Demo Navigation Bar */}
      <DemoGuideBar
        currentTab={activeTab}
        setTab={setActiveTab}
        onTriggerAccessDenied={triggerAccessDeniedDemo}
      />

      {/* Main Top Navigation */}
      <Navbar
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            setActiveTab={setActiveTab}
            onTriggerAccessDenied={triggerAccessDeniedDemo}
          />
        )}
        {activeTab === 'records' && <RecordsView />}
        {activeTab === 'documents' && <DocumentsView />}
        {activeTab === 'consent' && <ConsentView />}
        {activeTab === 'followups' && <FollowupsView />}
        {activeTab === 'audit' && <AuditLogView />}
        {activeTab === 'security' && <SecurityArchitectureView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            URAN 2026 | HealthTech Challenge ID: <strong className="text-slate-400">HT-05</strong>
          </div>
          <div>
            Periyar Maniammai Institute of Science & Technology • Dept. of Computer Applications
          </div>
          <div className="text-[11px] font-mono text-emerald-400/80">
            AES-256-GCM • Bcrypt • Immutable Audit Ledger
          </div>
        </div>
      </footer>

      {/* Access Denied Centerpiece Modal */}
      <AccessDeniedModal
        isOpen={accessDeniedState.isOpen}
        onClose={() => setAccessDeniedState({ isOpen: false, errorData: null })}
        errorData={accessDeniedState.errorData}
        onViewAudit={() => {
          setActiveTab('audit');
        }}
      />

      {/* Authentication & Persona Modal */}
      <LoginModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
