// AI Agent Service - calls our local backend proxy (server/index.js)
// Backend talks to Claude API and Apify — avoids CORS issues
const BACKEND = import.meta.env.VITE_BACKEND_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:3001');

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

  const DSOCIALTELLERS_SERVICES = `
Dsocialtellers offers ONLY these 5 services — never suggest anything else:
1. Digital Marketing — social media management, paid ads, content strategy, growing their online presence
2. Creator Collaborations — connecting them with local influencers and UGC creators to reach new audiences
3. Video Production — reels, brand films, product videos, short-form content for social media
4. Photography — product shoots, lifestyle photography, brand imagery for their website and social
5. Personal Branding — building the founder or executive's personal profile, content, and positioning online`;

  const system = `You are Ahmed, someone who works at Dsocialtellers, a small marketing agency in Dubai. You noticed something specific about a local business and you are reaching out personally.

You are NOT pitching. You are NOT an AI. You noticed a real problem and you are offering the ONE service that directly solves it.

MESSAGE STRUCTURE — follow this exactly:
Paragraph 1: What you noticed about their business (specific, real, based on actual research)
Paragraph 2: Why this is hurting them (the consequence of the problem)
Paragraph 3: Which ONE Dsocialtellers service fixes it and how (be specific about what we do)

VOICE: Casual, direct, human. Like a WhatsApp from someone in marketing who genuinely spotted something.

EXAMPLE — Photography service for a restaurant with bad photos:
"Hi Saffron Kitchen,

I checked out your Instagram and the food looks great in person I'm sure, but the photos are quite dark and don't really show the dishes off properly.

That's usually what stops people from saving the post or coming in. Good food photography makes people hungry just by scrolling.

We do brand photography for restaurants in Dubai. Happy to show you what a difference it makes — book a call below if you're interested.

Thanks,
Dsocialtellers"

EXAMPLE — Digital Marketing for a gym with no social media presence:
"Hi FitZone,

Noticed your gym has been open for a while but your Instagram hasn't been updated in 4 months and you've only got 200 followers.

In Dubai, most people find gyms through social media before they ever Google you. That gap is costing you walk-ins.

We manage social media for fitness businesses here, posting consistently and running local ads to bring in new members. Worth a quick call if you want to see how it works.

Thanks,
Dsocialtellers"

HARD RULES:
- NO em-dashes (—). Use comma or full stop instead.
- NO "we've worked with X before", "businesses like yours", "clients like you".
- NO "leaving money on the table", "leverage", "unlock", "elevate", "boost", "cutting-edge", "drive growth", "digital landscape", "in today's world", "game-changing".
- NEVER suggest SEO, website redesign, e-commerce, app development, or anything NOT in Dsocialtellers' 5 services.
- ONLY promote the ONE service that matches their specific problem.
- Email: 70-90 words, 3 short paragraphs.
- WhatsApp: 2-3 sentences only.
- Subject line: lowercase, specific to their business.
- End email with: Thanks,\nSocial Tellers

EMAIL FORMAT: "Hi ${cleanName}," then 3 paragraphs, then "Thanks,\nSocial Tellers"
${calendlyLink ? `CALENDLY: Do NOT write the URL. Just say "book a call below" — button is added automatically.` : ''}

WHATSAPP FORMAT: "Hi ${cleanName}!" then 2-3 sentences.
${calendlyLink ? `Last line of WhatsApp is ONLY the booking link: ${calendlyLink}` : `End with something like "worth a quick chat?"`}

Output ONLY valid JSON.`;

  const user = `Write outreach for this business based on what was actually found about them.

Business: ${cleanName}
Type: ${lead.category}
Location: ${lead.location}

WHAT WAS FOUND (use this as the basis — do not make things up):
Main problem observed: ${research.marketing_weaknesses?.[0] || 'weak online presence'}
Other issues: ${research.marketing_weaknesses?.slice(1).join(', ') || 'none'}
Opportunities spotted: ${research.growth_opportunities?.join(', ') || 'none'}
Brand quality: ${research.brand_quality || 'unknown'}

STRATEGY:
Angle: ${strategy.hook}
Service to offer: ${strategy.offer_positioning}

${DSOCIALTELLERS_SERVICES}

Write the message addressing their SPECIFIC problem first, then offer the ONE matching service as the solution.
Make it feel like you actually looked at their business, not a template.

Output JSON:
{
  "email_subject": "Proper Title Case Subject about their actual problem (max 8 words, capitalize main words, e.g. No WhatsApp Button on Your Website)",
  "email_body": "Hi ${cleanName}, then 3 paragraphs 70-90 words, ends with Thanks,\\nSocial Tellers${calendlyLink ? '. No raw URL.' : ''}",
  "whatsapp_message": "Hi ${cleanName}! then 2-3 sentences about their specific problem and our solution${calendlyLink ? `, then on its own line: ${calendlyLink}` : ''}"
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
  onProgress?.({ step: 'Research complete ✓', pct: 40, statusUpdate: 'Researched' });

  // Wait for Researched status to be saved before continuing
  await new Promise(r => setTimeout(r, 1500));

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
export async function scrapeLeads(query, location, source = 'Google Maps', limit = 5, nameSearch = false) {
  const response = await fetch(`${BACKEND}/api/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, location, source, limit, nameSearch })
  });
  if (!response.ok) throw new Error(`Scrape error: ${response.status} — is the server running? Run: npm run server`);
  return response.json();
}
