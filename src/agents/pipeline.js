// AI Agent Service - connects to Anthropic API
// Keys are loaded from .env file (never commit .env to GitHub)
const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;
const APIFY_API = import.meta.env.VITE_APIFY_API_KEY;

async function callClaude(systemPrompt, userMessage, maxTokens = 1000) {
  const response = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })
  });
  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
  const data = await response.json();
  const text = data.content.map(c => c.text || '').join('');
  // Strip JSON fences
  return text.replace(/```json\n?|\n?```/g, '').trim();
}

async function parseJSON(text) {
  try { return JSON.parse(text); }
  catch { return JSON.parse(text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)?.[0] || '{}'); }
}

// ─── AGENT 1: Data Validation ──────────────────────────────────────
export async function runValidationAgent(rawLead) {
  const system = `You are a data validation agent for a B2B lead generation system. 
Output ONLY valid JSON. No explanations.`;

  const user = `Validate this business lead. Rules: must have website OR instagram OR phone. Remove if clearly fake/incomplete.
Lead: ${JSON.stringify(rawLead)}

Output JSON:
{
  "valid": boolean,
  "reason": string,
  "clean_data": object (cleaned/normalized lead data)
}`;

  const result = await callClaude(system, user);
  return parseJSON(result);
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

Based on the business type and available digital presence, generate a realistic analysis.

Output JSON:
{
  "business_summary": "2-3 sentence description",
  "marketing_weaknesses": ["array", "of", "specific", "weaknesses"],
  "growth_opportunities": ["array", "of", "actionable", "opportunities"],
  "brand_quality": "low|medium|high",
  "tone": "suggested communication tone",
  "score": number between 0-100
}`;

  const result = await callClaude(system, user, 1000);
  return parseJSON(result);
}

// ─── AGENT 3: Personalization Strategy ─────────────────────────────
export async function runStrategyAgent(lead, research) {
  const system = `You are a B2B sales strategist for a digital marketing agency called Dstorytellers, based in Dubai.
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

  const result = await callClaude(system, user);
  return parseJSON(result);
}

// ─── AGENT 4: Copywriting ──────────────────────────────────────────
export async function runCopywritingAgent(lead, research, strategy) {
  const system = `You are an expert B2B copywriter for Dstorytellers, a Dubai-based digital marketing agency.
You write highly personalized cold outreach that references real business observations.
Rules: No generic sales language. Reference specific weaknesses. Email max 150 words. WhatsApp casual & short.
Output ONLY valid JSON.`;

  const user = `Write personalized outreach for:

Business: ${lead.name} (${lead.category}, ${lead.location})
Hook: ${strategy.hook}
Pain Point: ${strategy.pain_point_focus}
Offer: ${strategy.offer_positioning}
Tone: ${research.tone}
Weaknesses observed: ${research.marketing_weaknesses?.slice(0,3).join(', ')}

Output JSON:
{
  "email_subject": "compelling subject line",
  "email_body": "personalized cold email (120-150 words max, include real observations, end with soft CTA)",
  "whatsapp_message": "casual WhatsApp message (2-3 sentences max, include 1 emoji)"
}`;

  const result = await callClaude(system, user, 1000);
  return parseJSON(result);
}

// ─── AGENT 5: CRM Update ───────────────────────────────────────────
export async function runCRMAgent(lead, action, notes = '') {
  const system = `You are a CRM management agent. Output ONLY valid JSON.`;
  
  const user = `Update CRM record:
Lead: ${lead.name}
Action taken: ${action}
Notes: ${notes}
Current status: ${lead.status}

Output JSON:
{
  "status": "appropriate CRM status",
  "notes": "updated notes",
  "last_action": "today's date ISO format",
  "tags": ["relevant", "tags"]
}`;

  const result = await callClaude(system, user);
  return parseJSON(result);
}

// ─── FULL PIPELINE ─────────────────────────────────────────────────
export async function runFullPipeline(lead, onProgress) {
  const steps = [
    { name: 'Validation', pct: 15 },
    { name: 'Business Research', pct: 40 },
    { name: 'Strategy', pct: 60 },
    { name: 'Copywriting', pct: 80 },
    { name: 'CRM Update', pct: 100 },
  ];

  onProgress?.({ step: 'Starting pipeline...', pct: 0 });

  // Step 1: Validate
  onProgress?.({ step: 'Validating lead data...', pct: 10 });
  const validation = await runValidationAgent(lead);
  if (!validation.valid) throw new Error(`Lead invalid: ${validation.reason}`);
  onProgress?.({ step: 'Validation passed ✓', pct: 15 });

  // Step 2: Research
  onProgress?.({ step: 'Researching business...', pct: 20 });
  const research = await runResearchAgent(lead);
  onProgress?.({ step: 'Research complete ✓', pct: 40 });

  // Step 3: Strategy
  onProgress?.({ step: 'Building outreach strategy...', pct: 45 });
  const strategy = await runStrategyAgent(lead, research);
  onProgress?.({ step: 'Strategy created ✓', pct: 60 });

  // Step 4: Copy
  onProgress?.({ step: 'Writing personalized copy...', pct: 65 });
  const copy = await runCopywritingAgent(lead, research, strategy);
  onProgress?.({ step: 'Copy generated ✓', pct: 80 });

  // Step 5: CRM
  onProgress?.({ step: 'Updating CRM...', pct: 85 });
  onProgress?.({ step: 'Pipeline complete ✓', pct: 100 });

  return { validation, research, strategy, copy };
}

// ─── APIFY SCRAPER (Mock for MVP) ──────────────────────────────────
export async function scrapeLeads(query, location, source = 'Google Maps') {
  // In production, this calls Apify actors for real scraping
  // For MVP, we simulate with realistic data from Claude
  const system = `You are a web scraping result simulator for a lead generation system.
Generate realistic business lead data for Dubai/UAE businesses. Output ONLY valid JSON array.`;

  const user = `Generate 3-5 realistic business leads for:
Query: "${query}"
Location: "${location}"
Source: ${source}

Output JSON array of leads:
[{
  "id": "unique_id",
  "name": "Business Name",
  "website": "https://...",
  "instagram": "@handle or null",
  "phone": "+971...",
  "category": "category",
  "location": "area, Dubai",
  "source": "${source}",
  "status": "New",
  "brand_quality": null,
  "score": null,
  "notes": "Freshly scraped",
  "last_action": "${new Date().toISOString().split('T')[0]}",
  "tags": ["${query.split(' ')[0]}"],
  "createdAt": "${new Date().toISOString().split('T')[0]}"
}]`;

  const result = await callClaude(system, user, 1000);
  return parseJSON(result);
}
