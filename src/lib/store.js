// Central data store — backed by Supabase via the backend API
// Falls back gracefully if backend/Supabase is unavailable

const BACKEND = 'http://localhost:3001';

export const CRM_STATUSES = [
  'New', 'Contacted', 'Replied', 'Interested',
  'Not Interested', 'Follow-up', 'Closed Won', 'Closed Lost'
];

export const STATUS_COLORS = {
  'New': '#e8651e',
  'Contacted': '#c0410f',
  'Replied': '#d97706',
  'Interested': '#16a34a',
  'Not Interested': '#dc2626',
  'Follow-up': '#ea580c',
  'Closed Won': '#15803d',
  'Closed Lost': '#9ca3af'
};

export const BRAND_QUALITY = { low: '#dc2626', medium: '#d97706', high: '#16a34a' };

// Local cache (synced with Supabase)
let leads = [];
let messages = [];

// ─── Sync functions (call backend / Supabase) ─────────────────────
export async function loadLeads() {
  try {
    const res = await fetch(`${BACKEND}/api/leads`);
    if (res.ok) { leads = await res.json(); }
  } catch (e) { console.warn('Could not load leads from DB:', e.message); }
  return leads;
}

export async function loadMessages() {
  try {
    const res = await fetch(`${BACKEND}/api/messages`);
    if (res.ok) { messages = await res.json(); }
  } catch (e) { console.warn('Could not load messages:', e.message); }
  return messages;
}

export const db = {
  getLeads: () => [...leads],
  getLead: (id) => leads.find(l => l.id === id),

  addLeads: async (newLeads) => {
    leads = [...newLeads, ...leads];
    try {
      await fetch(`${BACKEND}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLeads)
      });
    } catch (e) { console.warn('Save to DB failed:', e.message); }
    return newLeads;
  },

  addLead: async (lead) => {
    leads = [lead, ...leads];
    try {
      await fetch(`${BACKEND}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead)
      });
    } catch (e) { console.warn('Save failed:', e.message); }
    return lead;
  },

  updateLead: async (id, updates) => {
    leads = leads.map(l => l.id === id ? { ...l, ...updates } : l);
    try {
      await fetch(`${BACKEND}/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) { console.warn('Update failed:', e.message); }
    return leads.find(l => l.id === id);
  },

  getMessages: (leadId) => messages.filter(m => m.leadId === leadId),
  getAllMessages: () => [...messages],

  addMessage: async (msg) => {
    messages = [...messages, msg];
    try {
      await fetch(`${BACKEND}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg)
      });
    } catch (e) { console.warn('Message save failed:', e.message); }
    return msg;
  },
};

export const getStats = () => {
  const all = [...leads];
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
