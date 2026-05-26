import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/dashboard/Dashboard';
import LeadsPage from './components/leads/LeadsPage';
import CRMPage from './components/crm/CRMPage';
import OutreachPage from './components/outreach/OutreachPage';
import AgentPage from './components/agents/AgentPage';
import './styles/globals.css';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [selectedLead, setSelectedLead] = useState(null);

  const navigate = (p, lead = null) => {
    setPage(p);
    if (lead) setSelectedLead(lead);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar currentPage={page} onNavigate={navigate} />
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg-base)' }}>
        {page === 'dashboard' && <Dashboard onNavigate={navigate} />}
        {page === 'leads' && <LeadsPage onNavigate={navigate} selectedLead={selectedLead} />}
        {page === 'crm' && <CRMPage onNavigate={navigate} />}
        {page === 'outreach' && <OutreachPage selectedLead={selectedLead} onNavigate={navigate} />}
        {page === 'agents' && <AgentPage onNavigate={navigate} />}
      </main>
    </div>
  );
}
