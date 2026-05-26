// Central data store for the application
// In production, this would be backed by a real database

export const CRM_STATUSES = [
  'New', 'Contacted', 'Replied', 'Interested',
  'Not Interested', 'Follow-up', 'Closed Won', 'Closed Lost'
];

export const STATUS_COLORS = {
  'New': '#00d4ff',
  'Contacted': '#7c3aed',
  'Replied': '#f59e0b',
  'Interested': '#10b981',
  'Not Interested': '#ef4444',
  'Follow-up': '#f97316',
  'Closed Won': '#22c55e',
  'Closed Lost': '#6b7280'
};

export const BRAND_QUALITY = { low: '#ef4444', medium: '#f59e0b', high: '#10b981' };

let leads = [
  {
    id: 'l1', name: 'Burj Bites Restaurant', website: 'https://burjbites.ae',
    instagram: '@burjbites', phone: '+971501234567', category: 'Restaurant',
    location: 'Dubai Marina', source: 'Google Maps',
    status: 'Interested', channel: 'Email',
    brand_quality: 'medium', score: 72,
    business_summary: 'Mid-range dining with strong footfall but weak digital presence. Instagram is inconsistent with low engagement.',
    marketing_weaknesses: ['No Google My Business optimization', 'Inconsistent social posting', 'No email marketing'],
    growth_opportunities: ['Reels content strategy', 'Delivery platform integration', 'Loyalty program'],
    tone: 'friendly and professional',
    email_subject: 'Your Restaurant is Losing Customers Online — Here\'s Why',
    email_body: 'Hi Burj Bites team,\n\nI visited your menu online and noticed something that\'s likely costing you reservations every week.\n\nYour food looks amazing — but your Instagram engagement sits at 0.8%, and your Google listing has no posts in 3 months.\n\nAt Dstorytellers, we\'ve helped 12+ Dubai restaurants increase online reservations by 40% in 90 days using targeted content + Google optimization.\n\nWould you be open to a quick 15-min call this week?\n\nBest,\nAhmed',
    whatsapp_message: 'Hi! I noticed Burj Bites has great food but your online presence could be working harder for you 🍽️ We help Dubai restaurants get more bookings through smart content. Worth a quick chat?',
    notes: 'Owner responded positively. Follow up Tuesday.',
    last_action: '2025-05-22', tags: ['Restaurant', 'Dubai', 'High Priority'],
    createdAt: '2025-05-18'
  },
  {
    id: 'l2', name: 'GlowUp Beauty Lounge', website: 'https://glowup.ae',
    instagram: '@glowupbeauty', phone: '+971507654321', category: 'Beauty & Wellness',
    location: 'JLT', source: 'Instagram',
    status: 'Contacted', channel: 'WhatsApp',
    brand_quality: 'low', score: 45,
    business_summary: 'Small beauty salon with zero website traffic. Relies entirely on word of mouth. No CTA on Instagram bio.',
    marketing_weaknesses: ['No website SEO', 'No paid ads', 'Weak Instagram bio', 'No booking system visible'],
    growth_opportunities: ['Instagram ads targeting expats', 'Before/after content', 'Referral program'],
    tone: 'empathetic and motivating',
    email_subject: 'GlowUp is leaving money on the table — let\'s fix that',
    email_body: 'Hey GlowUp team,\n\nYour transformations on Instagram are stunning — seriously impressive work.\n\nBut here\'s what I noticed: your bio has no booking link, and your website isn\'t showing up for "beauty salon JLT" searches.\n\nThat\'s potential clients choosing your competitors every single day.\n\nWe specialize in helping beauty businesses in Dubai turn their Instagram into a booking machine. No fluff — just results.\n\nUp for a quick chat?\n\nWarmly,\nSara',
    whatsapp_message: 'Hey! Love the transformations on your page 💅 I noticed your booking link is missing from your bio — small fix, big impact. We help beauty salons in Dubai get more clients. Can I show you how?',
    notes: 'Sent WhatsApp. No reply yet.',
    last_action: '2025-05-24', tags: ['Beauty', 'JLT', 'Low Presence'],
    createdAt: '2025-05-20'
  },
  {
    id: 'l3', name: 'TechFix Pro', website: 'https://techfixpro.ae',
    instagram: null, phone: '+971509988776', category: 'Tech Repair',
    location: 'Deira', source: 'Google Maps',
    status: 'Follow-up', channel: 'Email',
    brand_quality: 'low', score: 38,
    business_summary: 'Phone repair shop with good reviews but zero social media. Website outdated — 2019 design.',
    marketing_weaknesses: ['No social media presence', 'Outdated website', 'No review strategy'],
    growth_opportunities: ['Google Ads for repair searches', 'WhatsApp business setup', 'Video content'],
    tone: 'direct and results-focused',
    email_subject: 'TechFix Pro: Your competitors are stealing your Google searches',
    email_body: 'Hi TechFix Pro,\n\nI searched "phone repair Deira" — your shop didn\'t appear in the top 10 results, but three of your competitors did.\n\nYou have 4.7 stars on Google — that\'s gold. But if people can\'t find you, those reviews aren\'t working for you.\n\nWe\'ve helped 8 repair shops in Dubai double their walk-ins using Google optimization + WhatsApp automations.\n\nWant to see how? Takes 15 minutes.\n\nBest,\nKarim',
    whatsapp_message: 'Hi TechFix Pro! You have great reviews but you\'re not ranking for "phone repair Deira" 📱 We help local shops show up first on Google. Interested in a quick demo?',
    notes: 'Second follow-up due. Owner busy season.',
    last_action: '2025-05-20', tags: ['Tech', 'Deira', 'Follow-up Due'],
    createdAt: '2025-05-15'
  },
  {
    id: 'l4', name: 'Zen Yoga Studio', website: 'https://zenyoga.ae',
    instagram: '@zenyogadubai', phone: '+971502233445', category: 'Fitness & Wellness',
    location: 'Downtown Dubai', source: 'Instagram',
    status: 'Closed Won', channel: 'Email',
    brand_quality: 'high', score: 88,
    business_summary: 'Well-established yoga studio with strong community. Good content but no paid strategy or email list.',
    marketing_weaknesses: ['No email newsletter', 'No paid acquisition', 'Underutilized website'],
    growth_opportunities: ['Email drip campaigns', 'Class booking automation', 'Meta ads for expats'],
    tone: 'calm and aspirational',
    email_subject: 'Growing your yoga community beyond Instagram',
    email_body: 'Hi Zen Yoga,\n\nYour community is clearly special — 8.2% engagement on Instagram is exceptional for a studio your size.\n\nBut here\'s the gap: once someone unfollows or the algorithm shifts, you lose that connection.\n\nAn email list of even 500 clients is worth more than 10,000 Instagram followers.\n\nWe\'d love to help you build that while keeping your authentic tone. Quick 20-min strategy call?\n\nPeacefully,\nLeila',
    whatsapp_message: 'Namaste! 🧘 Your Zen Yoga content is genuinely beautiful. We help studios like yours build email lists so you own your audience. Worth a chat?',
    notes: 'Signed 3-month retainer. Onboarding done.',
    last_action: '2025-05-10', tags: ['Fitness', 'Downtown', 'Client'],
    createdAt: '2025-05-05'
  },
  {
    id: 'l5', name: 'Desert Auto Garage', website: 'https://desertauto.ae',
    instagram: '@desertauto', phone: '+971506677889', category: 'Automotive',
    location: 'Al Quoz', source: 'Google Maps',
    status: 'New', channel: null,
    brand_quality: 'medium', score: 61,
    business_summary: 'Mid-size auto garage with 200+ monthly visits but poor digital marketing. Strong word of mouth.',
    marketing_weaknesses: ['No content marketing', 'Weak Google listing', 'No loyalty program digital'],
    growth_opportunities: ['Video testimonials', 'Service reminder automation', 'Google Ads'],
    tone: 'trustworthy and straightforward',
    email_subject: null, email_body: null, whatsapp_message: null,
    notes: 'Scraped. Awaiting outreach generation.',
    last_action: '2025-05-26', tags: ['Automotive', 'Al Quoz'],
    createdAt: '2025-05-26'
  },
  {
    id: 'l6', name: 'FreshMart Organic', website: 'https://freshmart.ae',
    instagram: '@freshmartdxb', phone: '+971503344556', category: 'Grocery & Food',
    location: 'Palm Jumeirah', source: 'LinkedIn',
    status: 'Replied', channel: 'Email',
    brand_quality: 'high', score: 79,
    business_summary: 'Premium organic grocery. Strong brand identity but minimal paid advertising. Good website UX.',
    marketing_weaknesses: ['No retargeting ads', 'Underused email list', 'No subscription model promoted'],
    growth_opportunities: ['Subscription box campaign', 'Retargeting ads', 'Recipe content series'],
    tone: 'premium and health-conscious',
    email_subject: 'FreshMart: Your email list is your most valuable untapped asset',
    email_body: 'Hi FreshMart team,\n\nYour brand positioning is exceptional — "organic, local, premium" is exactly what Palm Jumeirah residents respond to.\n\nBut scrolling through your site, I noticed one thing: your email list isn\'t being used. Not even a welcome sequence.\n\nA curated weekly newsletter with recipes + exclusive offers could easily drive 20%+ of your revenue on autopilot.\n\nWe\'d love to build that for you. 20 minutes?\n\nWarmly,\nNadia',
    whatsapp_message: 'Hi FreshMart! 🥑 Your brand is gorgeous. We help premium stores like yours turn their email list into recurring revenue. Short call this week?',
    notes: 'Replied asking for proposal. Sending deck tomorrow.',
    last_action: '2025-05-25', tags: ['Grocery', 'Palm', 'Proposal Stage'],
    createdAt: '2025-05-19'
  }
];

let messages = [
  { id: 'm1', leadId: 'l1', type: 'email', direction: 'outbound', subject: 'Your Restaurant is Losing Customers Online', content: 'Hi Burj Bites team...', timestamp: '2025-05-22T09:30:00', status: 'delivered' },
  { id: 'm2', leadId: 'l1', type: 'email', direction: 'inbound', subject: 'Re: Your Restaurant is Losing...', content: 'Thanks for reaching out! Yes, we\'d love to chat.', timestamp: '2025-05-22T14:15:00', status: 'received' },
  { id: 'm3', leadId: 'l2', type: 'whatsapp', direction: 'outbound', content: 'Hey! Love the transformations...', timestamp: '2025-05-24T10:00:00', status: 'delivered' },
  { id: 'm4', leadId: 'l6', type: 'email', direction: 'outbound', subject: 'FreshMart: Your email list...', content: 'Hi FreshMart team...', timestamp: '2025-05-25T08:00:00', status: 'delivered' },
  { id: 'm5', leadId: 'l6', type: 'email', direction: 'inbound', subject: 'Re: FreshMart', content: 'Sounds interesting! Can you send a proposal?', timestamp: '2025-05-25T16:30:00', status: 'received' },
];

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
  deleteLead: (id) => { leads = leads.filter(l => l.id !== id); },
  getMessages: (leadId) => messages.filter(m => m.leadId === leadId),
  addMessage: (msg) => { messages = [...messages, msg]; return msg; },
  getAllMessages: () => [...messages],

  // Agent job queue
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
    recentActivity: all.sort((a,b) => new Date(b.last_action) - new Date(a.last_action)).slice(0, 5)
  };
};
