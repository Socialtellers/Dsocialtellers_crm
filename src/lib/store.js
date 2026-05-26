// Central data store
// All data comes from AI agents — no hardcoded leads

export const CRM_STATUSES = [
  'New', 'Contacted', 'Replied', 'Interested',
  'Not Interested', 'Follow-up', 'Closed Won', 'Closed Lost'
];

export const STATUS_COLORS = {
  'New': '#6366f1',
  'Contacted': '#8b5cf6',
  'Replied': '#f59e0b',
  'Interested': '#22c55e',
  'Not Interested': '#ef4444',
  'Follow-up': '#f97316',
  'Closed Won': '#16a34a',
  'Closed Lost': '#6b7280'
};

export const BRAND_QUALITY = { low: '#ef4444', medium: '#f59e0b', high: '#22c55e' };

let leads = [];
let messages = [];
let agentJobs = [];
let jobIdCounter = 1;

export const db = {
  getLeads: () => [...leads],
  getLead: (id) => leads.find(l => l.id === id),
  updateLead: (id, updates) => {
    leads = leads.map(l => l.id === id ? { ...l, ...updates } : l);
    return leads.find(l => l.id === id);
  },
  addLead: (lead) => {
    leads = [...leads, lead];
    return lead;
  },
  addLeads: (newLeads) => {
    leads = [...leads, ...newLeads];
    return newLeads;
  },
  deleteLead: (id) => { leads = leads.filter(l => l.id !== id); },
  getMessages: (leadId) => messages.filter(m => m.leadId === leadId),
  addMessage: (msg) => { messages = [...messages, msg]; return msg; },
  getAllMessages: () => [...messages],

  createJob: (type, input) => {
    const job = {
      id: `job_${jobIdCounter++}`,
      type, input, status: 'pending',
      progress: 0, logs: [],
      createdAt: new Date().toISOString()
    };
    agentJobs = [...agentJobs, job];
    return job;
  },
  getJob: (id) => agentJobs.find(j => j.id === id),
  updateJob: (id, updates) => {
    agentJobs = agentJobs.map(j => j.id === id ? { ...j, ...updates } : j);
    return agentJobs.find(j => j.id === id);
  },
  getJobs: () => [...agentJobs].reverse(),
};

export const getStats = () => {
  const all = db.getLeads();
  if (all.length === 0) return {
    total: 0, byStatus: {}, closedWon: 0, interested: 0,
    avgScore: 0, byQuality: { high: 0, medium: 0, low: 0 },
    bySource: {}, recentActivity: []
  };
  return {
    total: all.length,
    byStatus: CRM_STATUSES.reduce((acc, s) => ({ ...acc, [s]: all.filter(l => l.status === s).length }), {}),
    closedWon: all.filter(l => l.status === 'Closed Won').length,
    interested: all.filter(l => l.status === 'Interested').length,
    avgScore: Math.round(all.reduce((s, l) => s + (l.score || 0), 0) / all.length),
    byQuality: {
      high: all.filter(l => l.brand_quality === 'high').length,
      medium: all.filter(l => l.brand_quality === 'medium').length,
      low: all.filter(l => l.brand_quality === 'low').length,
    },
    bySource: all.reduce((acc, l) => ({ ...acc, [l.source]: (acc[l.source] || 0) + 1 }), {}),
    recentActivity: [...all].sort((a, b) => new Date(b.last_action) - new Date(a.last_action)).slice(0, 5)
  };
};
