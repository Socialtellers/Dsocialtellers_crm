// AI Agent Service - calls our local backend proxy (server/index.js)
// Backend talks to Claude API and Apify — avoids CORS issues
const BACKEND = 'http://localhost:3001';

// Model tiers — use cheap Haiku for simple agents, Sonnet for quality-critical ones
const MODELS = {
  cheap: 'claude-haiku-4-5-20251001',   // ~10x cheaper, for simple/structured tasks
  smart: 'claude-sonnet-4-5'            // for research + copywriting
};

async function callClaude(systemPrompt, userMessage, maxTokens = 1000, model = MODELS.smart) {
  const response = await fetch(`${BACKEND}/api/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })
  });
  if (!response.ok) throw new Error(`Backend error: ${response.status} — is the server running? Run: npm run server`);
  const data = await response.json();
  const text = data.content.map(c => c.text || '').join('');
  return text.replace(/```json\n?|\n?```/g, '').trim();
}

async function parseJSON(text) {
  try { return JSON.parse(text); }
  catch { return JSON.parse(text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)?.[0] || '{}'); }
}

// ─── AGENT 1: Data Validation (NO AI — free + instant) ─────────────
// Validation is a simple rule check, so we do it in code. No token cost.
export async function runValidationAgent(rawLead) {
  const hasContact = !!(rawLead.website || rawLead.instagram || rawLead.phone);
  const hasName = !!(rawLead.name && rawLead.name.trim().length > 1);
  const valid = hasContact && hasName;
  return {
    valid,
    reason: valid ? 'Has name and at least one contact method' : 'Missing name or all contact methods',
    clean_data: {
      ...rawLead,
      name: rawLead.name?.trim(),
      website: rawLead.website?.trim() || null,
      instagram: rawLead.instagram?.trim() || null,
      phone: rawLead.phone?.trim() || null,
    }
  };
}

// ─── AGENT 2: Business Research (REAL — fetches their website) ─────
export async function runResearchAgent(lead) {
  // Calls the backend which fetches the actual website and analyzes real content
  const response = await fetch(`${BACKEND}/api/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lead)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Research failed: ${err.error || response.status}`);
  }
  return response.json();
}

// ─── AGENT 3: Personalization Strategy ─────────────────────────────
export async function runStrategyAgent(lead, research) {
  const SERVICES = `Dsocialtellers services:
- Digital Marketing (social media management, ads, content strategy)
- Creator Collaborations (influencer partnerships, UGC campaigns)
- Video Production (reels, brand films, product videos)
- Photography (product, lifestyle, brand photography)
- Personal Branding (positioning, content, profile building for founders/executives)`;

  const system = `You are a B2B sales strategist for Dsocialtellers, a Dubai marketing agency.
You match the business's weakness to ONE specific Dsocialtellers service that solves it.
Output ONLY valid JSON.`;

  const user = `Create an outreach strategy for this lead:

Business: ${lead.name} (${lead.category}) in ${lead.location}
Weaknesses: ${research.marketing_weaknesses?.join(', ')}
Opportunities: ${research.growth_opportunities?.join(', ')}
Brand Quality: ${research.brand_quality}
Tone: ${research.tone}

${SERVICES}

Pick ONLY ONE service from the list above that best solves their main weakness.
Do NOT suggest services outside this list.

Output JSON:
{
  "hook": "specific opening angle based on what you actually found about their business",
  "pain_point_focus": "the ONE main problem that a Dsocialtellers service can solve",
  "offer_positioning": "which ONE Dsocialtellers service to offer and exactly why it fits this business"
}`;

  const result = await callClaude(system, user, 500, MODELS.cheap);
  return parseJSON(result);
}

// ─── AGENT 4: Copywriting ──────────────────────────────────────────
export async function runCopywritingAgent(lead, research, strategy, calendlyLink = '') {
  // Clean the business name for greetings — strip taglines + trailing UAE area names
  const UAE_AREAS = ['Bur Dubai','Al Mankhool','Al Quoz','Al Barsha','Business Bay','Downtown Dubai','Dubai Marina','JLT','Jumeirah Lakes Towers','Deira','Karama','Satwa','Jumeirah','Palm Jumeirah','Dubai Hills','Mirdif','Silicon Oasis','Tecom','Media City','Internet City','Sheikh Zayed Road','Al Nahda','International City','Motor City','Sports City','Arabian Ranches','Discovery Gardens','Dubai','Abu Dhabi','Sharjah','Ajman','UAE','United Arab Emirates'];
  let cleanName = (lead.name || '').split(/\s*[|\-–—:•]\s*/)[0].trim();
  for (const area of [...UAE_AREAS].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`\\s+${area.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    if (re.test(cleanName)) { cleanName = cleanName.replace(re, '').trim(); break; }
  }
  if (!cleanName || cleanName.length < 2) cleanName = lead.name;

  const system = `You are Ahmed, someone who works at Dsocialtellers, a small marketing agency in Dubai. You noticed something specific about a local business and you're reaching out personally.

You are NOT pitching. You are NOT an AI. You noticed one real thing and you're mentioning it.

VOICE: Sounds like a message from a real person. Casual, direct, no fluff. Like something you'd actually send on WhatsApp or email to a stranger you want to help.

PERFECT EXAMPLE EMAIL (match this style exactly):
"Hi Binous Gym,

I came across your site and noticed you're calling yourself Dubai's biggest bodybuilding gym, but there's a typo that says 'Dudai' and another that says 'BIGEST'. Makes it harder to take the champion claim seriously.

We help businesses fix their copy and make sure their site actually reflects the quality of what they do. Happy to walk through what that could look like for you.

If you want, book a call below.

Thanks,
Dsocialtellers"

PERFECT EXAMPLE WHATSAPP (match this style exactly):
"Hi Binous Gym! Checked out your website and saw you're positioning as the biggest bodybuilding facility in Dubai, but there are spelling mistakes like 'Dudai' and 'BIGEST' that hurt the credibility. We help fix that so the site matches what you're actually offering. https://calendly.com/..."

HARD RULES:
- NO em-dashes (—). Use comma or full stop.
- NO "we've worked with X before", "gyms like yours", "businesses like yours", "clients like you". Speak directly to THIS business.
- NO "leaving money on the table", "revenue channel", "leverage", "unlock", "elevate", "boost", "supercharge", "cutting-edge", "drive growth", "take it to the next level", "in today's world", "digital landscape".
- NO listing multiple services. ONE thing only.
- NO fake hype. No "Amazing!", "Great!", "Exciting!".
- Email body: 60-80 words MAX. 3 short paragraphs.
- WhatsApp: 2-3 sentences MAX.
- Subject line: lowercase, casual. Like "noticed something on your site" or "quick thought on your menu".
- End email with exactly: Thanks,\nDsocialtellers
- One specific observation about THIS business. Not something generic that applies to anyone.

EMAIL FORMAT: "Hi ${cleanName}," then 3 short paragraphs, then "Thanks,\nDsocialtellers"
${calendlyLink ? `CALENDLY: Do NOT write the URL in the email. Just say "if you want, book a call below" — button added automatically.` : ''}

WHATSAPP FORMAT: "Hi ${cleanName}!" then 2-3 sentences.
${calendlyLink ? `Last line of WhatsApp is ONLY the link: ${calendlyLink}` : `End casually, e.g. "worth a quick chat?"`}

Output ONLY valid JSON.`;

  const user = `Reach out to this business. One real observation. Keep it human.

Business: ${cleanName}
Type: ${lead.category}  
Location: ${lead.location}
What you specifically noticed: ${research.marketing_weaknesses?.[0] || 'weak online presence'}
Angle to use: ${strategy.hook}
Which Dsocialtellers service to offer: ${strategy.offer_positioning}

STRICT: Only mention this ONE service. Never suggest anything outside our services: Digital Marketing, Creator Collaborations, Video Production, Photography, Personal Branding.

Write like the examples above. Specific to ${cleanName}. Not a template.

Output JSON:
{
  "email_subject": "casual lowercase subject (max 7 words, like a thought)",
  "email_body": "Hi ${cleanName}, then 3 short paragraphs 60-80 words total, ends with Thanks,\\nDsocialtellers${calendlyLink ? '. No raw URL — invite to book below.' : ''}",
  "whatsapp_message": "Hi ${cleanName}! then 2-3 sentences${calendlyLink ? `, then on its own line: ${calendlyLink}` : ''}"
}`;

  const result = await callClaude(system, user, 600, MODELS.smart);
  return parseJSON(result);
}

// ─── AGENT 5: CRM Update ───────────────────────────────────────────
// ─── AGENT 5: CRM Update (NO AI — free + instant) ──────────────────
// Setting a status + timestamp needs no intelligence. Pure code, zero cost.
export async function runCRMAgent(lead, action, notes = '') {
  const statusMap = {
    'contacted': 'Contacted',
    'replied': 'Replied',
    'interested': 'Interested',
    'not interested': 'Not Interested',
    'follow up': 'Follow-up',
    'closed won': 'Closed Won',
    'closed lost': 'Closed Lost'
  };
  const status = statusMap[action?.toLowerCase()] || lead.status || 'New';
  return {
    status,
    notes: notes || lead.notes || '',
    last_action: new Date().toISOString().split('T')[0],
    tags: lead.tags || []
  };
}

// ─── FULL PIPELINE ─────────────────────────────────────────────────
export async function runFullPipeline(lead, onProgress, calendlyLink = '') {
  onProgress?.({ step: 'Starting pipeline...', pct: 0 });

  onProgress?.({ step: 'Validating lead data...', pct: 10 });
  const validation = await runValidationAgent(lead);
  if (!validation.valid) throw new Error(`Lead invalid: ${validation.reason}`);
  onProgress?.({ step: 'Validation passed ✓', pct: 15 });

  onProgress?.({ step: 'Researching business...', pct: 20 });
  const research = await runResearchAgent(lead);
  onProgress?.({ step: 'Research complete ✓', pct: 40 });

  onProgress?.({ step: 'Building outreach strategy...', pct: 45 });
  const strategy = await runStrategyAgent(lead, research);
  onProgress?.({ step: 'Strategy created ✓', pct: 60 });

  onProgress?.({ step: 'Writing personalized copy...', pct: 65 });
  const copy = await runCopywritingAgent(lead, research, strategy, calendlyLink);
  onProgress?.({ step: 'Copy generated ✓', pct: 80 });

  onProgress?.({ step: 'Updating CRM...', pct: 85 });
  onProgress?.({ step: 'Pipeline complete ✓', pct: 100 });

  return { validation, research, strategy, copy };
}

// ─── APIFY SCRAPER ─────────────────────────────────────────────────
export async function scrapeLeads(query, location, source = 'Google Maps', limit = 5) {
  const response = await fetch(`${BACKEND}/api/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, location, source, limit })
  });
  if (!response.ok) throw new Error(`Scrape error: ${response.status} — is the server running? Run: npm run server`);
  return response.json();
}
