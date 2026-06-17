// AI Agent Service - calls our local backend proxy (server/index.js)
const BACKEND = import.meta.env.VITE_BACKEND_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:3001');

const MODELS = {
  cheap: 'claude-haiku-4-5-20251001',
  smart: 'claude-sonnet-4-5'
};

// ─── Agent Observability Log ────────────────────────────────────────
// Every agent run is tracked — success, failure, duration, rejection reason
const agentLog = [];

export function getAgentLog() { return [...agentLog]; }
export function clearAgentLog() { agentLog.length = 0; }

function logAgentRun(agentName, leadId, status, durationMs, meta = {}) {
  agentLog.push({
    id: `log_${Date.now()}`,
    agent: agentName,
    leadId,
    status,           // 'success' | 'failed' | 'rejected' | 'recovered'
    durationMs,
    timestamp: new Date().toISOString(),
    ...meta
  });
}

// ─── Assertion Layer ────────────────────────────────────────────────
// Each agent output is validated before passing to the next agent
// If it fails the assertion, we attempt a recovery prompt before giving up

function assertResearch(data) {
  if (!data || typeof data !== 'object') throw new Error('Research returned non-object');
  if (!data.business_summary || data.business_summary.length < 20) throw new Error('business_summary too short or missing');
  if (!Array.isArray(data.marketing_weaknesses) || data.marketing_weaknesses.length === 0) throw new Error('marketing_weaknesses empty');
  if (!['high', 'medium', 'low'].includes(data.brand_quality)) throw new Error(`brand_quality invalid: ${data.brand_quality}`);
  return true;
}

function assertStrategy(data) {
  if (!data || typeof data !== 'object') throw new Error('Strategy returned non-object');
  if (!data.hook || data.hook.length < 10) throw new Error('hook too short or missing');
  if (!data.pain_point_focus || data.pain_point_focus.length < 10) throw new Error('pain_point_focus missing');
  if (!data.offer_positioning || data.offer_positioning.length < 10) throw new Error('offer_positioning missing');
  return true;
}

function assertCopy(data) {
  if (!data || typeof data !== 'object') throw new Error('Copy returned non-object');
  if (!data.email_subject || data.email_subject.length < 5) throw new Error('email_subject missing');
  if (!data.email_body || data.email_body.length < 50) throw new Error('email_body too short');
  if (!data.whatsapp_message || data.whatsapp_message.length < 20) throw new Error('whatsapp_message too short');
  // Check for AI hallmarks that sneak through
  const bannedPhrases = ['em-dash', 'leverage', 'synergy', 'unlock potential', 'game-changing', 'digital landscape'];
  for (const phrase of bannedPhrases) {
    if (data.email_body.toLowerCase().includes(phrase)) throw new Error(`Banned phrase found: "${phrase}"`);
  }
  return true;
}

// ─── Claude caller ──────────────────────────────────────────────────
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
export async function runValidationAgent(rawLead) {
  const start = Date.now();
  const hasContact = !!(rawLead.website || rawLead.instagram || rawLead.phone);
  const hasName = !!(rawLead.name && rawLead.name.trim().length > 1);
  const valid = hasContact && hasName;

  logAgentRun('validation', rawLead.id, valid ? 'success' : 'rejected', Date.now() - start, {
    reason: valid ? 'Has name and contact' : 'Missing name or contact'
  });

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
  const start = Date.now();
  try {
    const response = await fetch(`${BACKEND}/api/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Research failed: ${err.error || response.status}`);
    }
    const data = await response.json();

    // ── Assertion ──
    try {
      assertResearch(data);
      logAgentRun('research', lead.id, 'success', Date.now() - start, { source: data.data_source });
      return data;
    } catch (assertErr) {
      // ── Recovery: retry with stricter prompt ──
      logAgentRun('research', lead.id, 'rejected', Date.now() - start, { assertionFail: assertErr.message });
      console.warn(`Research assertion failed for ${lead.name}: ${assertErr.message} — retrying`);

      const retryRes = await fetch(`${BACKEND}/api/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lead, _retry: true })
      });
      const retryData = await retryRes.json();
      assertResearch(retryData); // if this fails too, throw and pipeline stops

      logAgentRun('research', lead.id, 'recovered', Date.now() - start, { recoveredAfter: assertErr.message });
      return retryData;
    }
  } catch (err) {
    logAgentRun('research', lead.id, 'failed', Date.now() - start, { error: err.message });
    throw err;
  }
}

// ─── AGENT 3: Personalization Strategy ─────────────────────────────
export async function runStrategyAgent(lead, research) {
  const start = Date.now();

  const SERVICES = `Services offered:
- Digital Marketing (social media management, ads, content strategy)
- Creator Collaborations (influencer partnerships, UGC campaigns)
- Video Production (reels, brand films, product videos)
- Photography (product, lifestyle, brand photography)
- Personal Branding (positioning, content, profile building for founders/executives)`;

  const system = `You are a B2B sales strategist for a marketing agency.
Match the business's weakness to ONE specific service that solves it.
Output ONLY valid JSON.`;

  const user = `Create an outreach strategy for this lead:

Business: ${lead.name} (${lead.category}) in ${lead.location}
Weaknesses: ${research.marketing_weaknesses?.join(', ')}
Opportunities: ${research.growth_opportunities?.join(', ')}
Brand Quality: ${research.brand_quality}
Tone: ${research.tone}

${SERVICES}

Pick ONLY ONE service. Output JSON:
{
  "hook": "specific opening angle based on actual research",
  "pain_point_focus": "the ONE main problem",
  "offer_positioning": "which ONE service and exactly why it fits"
}`;

  try {
    const result = await callClaude(system, user, 500, MODELS.cheap);
    const data = await parseJSON(result);
    assertStrategy(data);
    logAgentRun('strategy', lead.id, 'success', Date.now() - start);
    return data;
  } catch (err) {
    // Recovery — retry with more explicit instructions
    logAgentRun('strategy', lead.id, 'rejected', Date.now() - start, { error: err.message });
    const retryResult = await callClaude(system, user + '\n\nIMPORTANT: You MUST return valid JSON with hook, pain_point_focus, and offer_positioning fields. No markdown.', 600, MODELS.cheap);
    const retryData = await parseJSON(retryResult);
    assertStrategy(retryData);
    logAgentRun('strategy', lead.id, 'recovered', Date.now() - start);
    return retryData;
  }
}

// ─── AGENT 4: Copywriting ──────────────────────────────────────────
export async function runCopywritingAgent(lead, research, strategy, calendlyLink = '') {
  const start = Date.now();

  const UAE_AREAS = ['Bur Dubai','Al Mankhool','Al Quoz','Al Barsha','Business Bay','Downtown Dubai','Dubai Marina','JLT','Jumeirah Lakes Towers','Deira','Karama','Satwa','Jumeirah','Palm Jumeirah','Dubai Hills','Mirdif','Silicon Oasis','Tecom','Media City','Internet City','Sheikh Zayed Road','Al Nahda','International City','Motor City','Sports City','Arabian Ranches','Discovery Gardens','Dubai','Abu Dhabi','Sharjah','Ajman','UAE','United Arab Emirates'];
  let cleanName = (lead.name || '').split(/\s*[|\-–—:•]\s*/)[0].trim();
  for (const area of [...UAE_AREAS].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`\\s+${area.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    if (re.test(cleanName)) { cleanName = cleanName.replace(re, '').trim(); break; }
  }
  if (!cleanName || cleanName.length < 2) cleanName = lead.name;

  const system = `You are a real person at a marketing agency reaching out to a local business you noticed online.

MESSAGE STRUCTURE:
Para 1: Specific thing you noticed (real, based on research data)
Para 2: Why this is hurting them
Para 3: The ONE service that fixes it

HARD RULES:
- NO em-dashes. Use comma or full stop.
- NO "leaving money on the table", "leverage", "unlock", "elevate", "boost", "cutting-edge", "game-changing", "digital landscape"
- ONE service only. Never list multiple.
- Email: 70-90 words, 3 paragraphs
- WhatsApp: 2-3 sentences max
- Subject: Title Case, specific to this business
- Sign off: Thanks,\\nSocial Tellers
${calendlyLink ? `- Do NOT write the calendly URL in email body. Just say "book a call below"` : ''}

Output ONLY valid JSON.`;

  const user = `Business: ${cleanName} (${lead.category}, ${lead.location})
Main problem: ${research.marketing_weaknesses?.[0] || 'weak online presence'}
Other issues: ${research.marketing_weaknesses?.slice(1).join(', ') || 'none'}
Opportunities: ${research.growth_opportunities?.join(', ') || 'none'}
Angle: ${strategy.hook}
Service to offer: ${strategy.offer_positioning}

Which Dsocialtellers service to offer: ${strategy.offer_positioning}

STRICT: Only mention this ONE service.

Output JSON:
{
  "email_subject": "Title Case Subject (max 8 words)",
  "email_body": "Hi ${cleanName}, 3 paragraphs 70-90 words, ends with Thanks,\\nSocial Tellers${calendlyLink ? '. No raw URL.' : ''}",
  "whatsapp_message": "Hi ${cleanName}! 2-3 sentences${calendlyLink ? `, then on its own line: ${calendlyLink}` : ''}"
}`;

  try {
    const result = await callClaude(system, user, 600, MODELS.smart);
    const data = await parseJSON(result);
    assertCopy(data);
    logAgentRun('copywriting', lead.id, 'success', Date.now() - start);
    return data;
  } catch (err) {
    // Recovery — retry with stronger constraints
    logAgentRun('copywriting', lead.id, 'rejected', Date.now() - start, { error: err.message });
    const retryResult = await callClaude(system + '\n\nPREVIOUS ATTEMPT FAILED QUALITY CHECK. Write a new version. Be more specific and human.', user, 700, MODELS.smart);
    const retryData = await parseJSON(retryResult);
    assertCopy(retryData);
    logAgentRun('copywriting', lead.id, 'recovered', Date.now() - start);
    return retryData;
  }
}

// ─── AGENT 5: CRM Update (NO AI) ───────────────────────────────────
export async function runCRMAgent(lead, action, notes = '') {
  const statusMap = {
    'contacted': 'Contacted', 'replied': 'Replied', 'interested': 'Interested',
    'not interested': 'Not Interested', 'follow up': 'Follow-up',
    'closed won': 'Closed Won', 'closed lost': 'Closed Lost'
  };
  const status = statusMap[action?.toLowerCase()] || lead.status || 'New';
  return { status, notes: notes || lead.notes || '', last_action: new Date().toISOString().split('T')[0], tags: lead.tags || [] };
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
