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

// ─── AGENT 2: Business Research ────────────────────────────────────
export async function runResearchAgent(lead) {
  const system = `You are a business intelligence analyst specializing in digital marketing audits for SMEs in Dubai and the UAE.
You analyze businesses and identify marketing weaknesses and growth opportunities.
Output ONLY valid JSON. Be specific and actionable.`;

  const user = `Analyze this business for marketing weaknesses and opportunities:

Business: ${lead.name}
Category: ${lead.category}
Location: ${lead.location}
Website: ${lead.website || 'None'}
Instagram: ${lead.instagram || 'None'}
Phone: ${lead.phone || 'None'}
Source: ${lead.source}

Output JSON:
{
  "business_summary": "2-3 sentence description",
  "marketing_weaknesses": ["array", "of", "specific", "weaknesses"],
  "growth_opportunities": ["array", "of", "actionable", "opportunities"],
  "brand_quality": "low|medium|high",
  "tone": "suggested communication tone",
  "score": number between 0-100
}`;

  const result = await callClaude(system, user, 1000, MODELS.smart);
  return parseJSON(result);
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
export async function runCopywritingAgent(lead, research, strategy) {
  const system = `You are a real person named Ahmed who works at Dsocialtellers, a small Dubai marketing agency. You are NOT an AI and you must never sound like one. You're messaging a local business owner you genuinely want to help.

Write the way a real human casually types a message — like you noticed something about their business and decided to reach out. Think: a friendly, sharp marketer texting, not a corporate sales bot.

STRICT RULES TO SOUND HUMAN:
- Write like you talk. Short sentences. Natural rhythm. Contractions (you're, I'd, that's, didn't).
- NO corporate buzzwords: never use "leverage", "synergy", "elevate", "unlock", "boost", "supercharge", "in today's digital landscape", "we specialize in", "cutting-edge", "solutions", "drive growth", "take it to the next level".
- NO fake hype or exclamation spam. Calm and real.
- NO em-dashes (—). Use commas or just start a new sentence.
- Don't over-explain. A real person keeps it tight.
- One specific, real observation about THEIR business — like you actually looked at it.
- Sound a little imperfect and casual, not polished and templated.
- The CTA should be low-pressure, like a human asking, not a sales close. e.g. "worth a quick chat?" or "want me to show you what I mean?"
- Never start the email with "I hope this email finds you well" or "I came across your business".
- For WhatsApp: super casual, like texting a friend. Lowercase is fine. 1-2 short lines.

Output ONLY valid JSON.`;

  const user = `Write outreach to this business owner. You (Ahmed) noticed their business and want to reach out.

Business: ${lead.name} (${lead.category}, ${lead.location})
What you noticed (the angle): ${strategy.hook}
Their main problem: ${strategy.pain_point_focus}
How you can help: ${strategy.offer_positioning}
One real weakness you spotted: ${research.marketing_weaknesses?.[0] || 'weak online presence'}

Write it like a real human reaching out, NOT a marketing template.

Output JSON:
{
  "email_subject": "short, curious, lowercase-friendly subject like a human would write (no clickbait, no ALL CAPS)",
  "email_body": "a genuine human email, 60-110 words, sounds like a real person typed it, one specific observation, casual low-pressure ending. Sign off as 'Ahmed'",
  "whatsapp_message": "a casual human WhatsApp text, 1-2 short lines, like texting. natural, friendly, max 1 emoji and only if it fits"
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
export async function runFullPipeline(lead, onProgress) {
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
  const copy = await runCopywritingAgent(lead, research, strategy);
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
