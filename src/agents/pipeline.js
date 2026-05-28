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
  const system = `You are a B2B sales strategist for a digital marketing agency called Dsocialtellers, based in Dubai.
You create outreach strategies based on business research. Output ONLY valid JSON.`;

  const user = `Create an outreach strategy for this lead:

Business: ${lead.name} (${lead.category}) in ${lead.location}
Weaknesses: ${research.marketing_weaknesses?.join(', ')}
Opportunities: ${research.growth_opportunities?.join(', ')}
Brand Quality: ${research.brand_quality}
Tone: ${research.tone}

Output JSON:
{
  "hook": "attention-grabbing opening angle",
  "pain_point_focus": "main pain point to address",
  "offer_positioning": "how to position our services"
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

  const system = `You are Ahmed, a guy who works at a small Dubai marketing agency called Dsocialtellers. You spotted a local business online and you're reaching out because you genuinely noticed something specific about them.

You are texting/emailing a real business owner. You are NOT writing a marketing pitch. You are NOT an AI.

VOICE: You write like a normal person in their late 20s who works in marketing. Casual but sharp. Like a WhatsApp message to someone you don't know yet but want to.

HARD RULES — breaking any of these means failure:
- NO em-dashes (—) anywhere. Use a comma or full stop instead.
- NO "leaving money on the table", "revenue channel", "digital landscape", "leverage", "unlock", "elevate", "boost", "supercharge", "cutting-edge", "we specialize in", "drive growth", "take it to the next level", "in today's world".
- NO listing multiple services. Pick ONE thing only.
- NO fake enthusiasm. No "Amazing!", "Great!", "Exciting!".
- NO more than 2 exclamation marks total across the entire message.
- Email body: MAX 70 words. Short paragraphs, max 2 sentences each.
- WhatsApp: MAX 3 sentences. Should feel like a real text.
- Subject line: lowercase, reads like a thought not a headline. Examples: "quick thought on your website", "noticed something about your menu", "random q about your instagram".
- The ONE observation must be hyper-specific to THIS business, not a generic weakness any business could have.
- End email with just: Thanks,\nDsocialtellers

EMAIL FORMAT: "Hi ${cleanName}," then body, then "Thanks,\nDsocialtellers"
${calendlyLink ? `CALENDLY: Do NOT write the URL in the email body. Just say something like "if you want, book a call below" — the button is added automatically.` : ''}

WHATSAPP FORMAT: "Hi ${cleanName}!" then 2-3 casual sentences.
${calendlyLink ? `End WhatsApp with the link on its own line: ${calendlyLink}` : `End with something like "worth a quick chat?" or "let me know if that's useful"`}

Output ONLY valid JSON, nothing else.`;

  const user = `You're reaching out to this business. You looked at their online presence and noticed something real.

Business: ${cleanName}
Type: ${lead.category}
Location: ${lead.location}
The one specific thing you noticed: ${research.marketing_weaknesses?.[0] || 'weak online presence'}
Your angle: ${strategy.hook}
What you can actually help with: ${strategy.offer_positioning}

Write ONE email and ONE WhatsApp. Hyper-specific to ${cleanName}. Not a template.

Output JSON:
{
  "email_subject": "casual lowercase subject, reads like a thought (max 8 words)",
  "email_body": "Hi ${cleanName}, then 2-3 short paragraphs max 70 words total, ends with Thanks,\\nDsocialtellers${calendlyLink ? ' — no raw URL, just invite to book below' : ''}",
  "whatsapp_message": "Hi ${cleanName}! then max 3 sentences${calendlyLink ? `, last line is just: ${calendlyLink}` : ''}"
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
