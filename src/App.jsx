import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/dashboard/Dashboard';
import LeadsPage from './components/leads/LeadsPage';
import CRMPage from './components/crm/CRMPage';
import OutreachPage from './components/outreach/OutreachPage';
import AgentPage from './components/agents/AgentPage';
import WhatsAppInbox from './components/outreach/WhatsAppInbox';
import LoginPage, { supabase } from './components/auth/LoginPage';
import { loadLeads, loadMessages } from './lib/store';
import './styles/globals.css';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [selectedLead, setSelectedLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Check existing session on load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecked(true);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load data once authenticated
  useEffect(() => {
    if (session) {
      Promise.all([loadLeads(), loadMessages()]).finally(() => setLoading(false));
    }
  }, [session]);

  const navigate = (p, lead = null) => {
    setPage(p);
    if (lead) setSelectedLead(lead);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setPage('dashboard');
  };

  // Still checking auth
  if (!authChecked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-base)', color: 'var(--text-secondary)',
        fontFamily: 'var(--font-body)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '2px solid var(--border)',
            borderTopColor: 'var(--accent-primary)', borderRadius: '50%',
            margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
          Loading...
        </div>
      </div>
    );
  }

  // Not logged in — show login page
  if (!session) {
    return <LoginPage onLogin={setSession} />;
  }

  // Loading data
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-base)', color: 'var(--text-secondary)',
        fontFamily: 'var(--font-body)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '2px solid var(--border)',
            borderTopColor: 'var(--accent-primary)', borderRadius: '50%',
            margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
          Loading your data...
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar currentPage={page} onNavigate={navigate} onLogout={handleLogout}
        userEmail={session.user.email} />
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg-base)' }}>
        {page === 'dashboard' && <Dashboard onNavigate={navigate} />}
        {page === 'leads' && <LeadsPage onNavigate={navigate} selectedLead={selectedLead} />}
        {page === 'crm' && <CRMPage onNavigate={navigate} />}
        {page === 'outreach' && <OutreachPage selectedLead={selectedLead} onNavigate={navigate} />}
        {page === 'whatsapp' && <WhatsAppInbox />}
        {page === 'agents' && <AgentPage onNavigate={navigate} />}
      </main>
    </div>
  );
}
