import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
const PORT = 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

const API_KEY = process.env.CLAUDE_API_KEY || process.env.VITE_CLAUDE_API_KEY;
const APIFY_KEY = process.env.APIFY_API_KEY || process.env.VITE_APIFY_API_KEY;
const TODAY = () => new Date().toISOString().split('T')[0];

// Common UAE areas/cities to strip from the end of business names
const UAE_AREAS = [
  'Bur Dubai', 'Al Mankhool', 'Al Quoz', 'Al Barsha', 'Business Bay', 'Downtown Dubai',
  'Dubai Marina', 'JLT', 'Jumeirah Lakes Towers', 'Deira', 'Karama', 'Satwa', 'Jumeirah',
  'Palm Jumeirah', 'Dubai Hills', 'Mirdif', 'Silicon Oasis', 'Tecom', 'Media City',
  'Internet City', 'Sheikh Zayed Road', 'Al Nahda', 'International City', 'Motor City',
  'Sports City', 'Arabian Ranches', 'Discovery Gardens', 'Dubai', 'Abu Dhabi', 'Sharjah',
  'Ajman', 'UAE', 'United Arab Emirates'
];

// Clean business names: strip taglines after separators, then strip trailing area names
// "GymNation Bur Dubai | Best Gym In Bur Dubai" → "GymNation"
const cleanName = (raw) => {
  if (!raw) return raw;
  // 1. Cut off taglines after | - – — : •
  let n = raw.split(/\s*[|\-–—:•]\s*/)[0].trim();
  // 2. Strip a trailing UAE area name (longest match first)
  const sorted = [...UAE_AREAS].sort((a, b) => b.length - a.length);
  for (const area of sorted) {
    const re = new RegExp(`\\s+${area.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    if (re.test(n)) { n = n.replace(re, '').trim(); break; }
  }
  if (n.length < 2) n = raw.trim();
  return n;
};

// ─── Supabase client ───────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('✓ Supabase connected');
} else {
  console.log('⚠ Supabase not configured — using in-memory only');
}

// Map DB row (snake_case) → frontend lead (camelCase where needed)
const rowToLead = (r) => ({
  ...r,
  createdAt: r.created_at,
  marketing_weaknesses: r.marketing_weaknesses || [],
  growth_opportunities: r.growth_opportunities || [],
  tags: r.tags || []
});

// Only these columns exist in the DB — strip anything else to avoid insert errors
const LEAD_COLUMNS = [
  'id', 'name', 'website', 'instagram', 'phone', 'email', 'category', 'location',
  'source', 'status', 'channel', 'brand_quality', 'score', 'business_summary',
  'marketing_weaknesses', 'growth_opportunities', 'tone', 'email_subject',
  'email_body', 'whatsapp_message', 'notes', 'last_action', 'tags', 'created_at'
];

const leadToRow = (l) => {
  const row = { ...l, created_at: l.createdAt || l.created_at || new Date().toISOString() };
  delete row.createdAt;
  // Keep only known columns
  const clean = {};
  for (const key of LEAD_COLUMNS) {
    if (row[key] !== undefined) clean[key] = row[key];
  }
  return clean;
};

// ─── Claude caller ─────────────────────────────────────────────────
async function callClaude(system, userMsg, maxTokens = 1000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userMsg }]
    })
  });
  const data = await res.json();
  if (!res.ok || !data.content?.[0]) throw new Error(JSON.stringify(data));
  return data.content[0].text.replace(/```json\n?|\n?```/g, '').trim();
}

// ─── Apify caller (async — avoids 300s sync timeout) ──────────────
async function runApifyActor(actorId, input, limit = 5) {
  console.log(`→ Running Apify actor: ${actorId} (limit ${limit})`);

  // 1. Start the run (async)
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }
  );
  if (!startRes.ok) {
    const err = await startRes.text();
    throw new Error(`Apify start error ${startRes.status}: ${err}`);
  }
  const { data: run } = await startRes.json();
  const runId = run.id;
  console.log(`  Run started: ${runId}`);

  // 2. Poll until SUCCEEDED or FAILED (max 10 min)
  const POLL_INTERVAL = 4000;
  const MAX_WAIT = 600000;
  const deadline = Date.now() + MAX_WAIT;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_KEY}`
    );
    const { data: statusData } = await statusRes.json();
    console.log(`  Status: ${statusData.status}`);
    if (statusData.status === 'SUCCEEDED') break;
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(statusData.status)) {
      throw new Error(`Apify run ${statusData.status}`);
    }
  }

  // 3. Fetch dataset items
  const dataRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_KEY}&limit=${limit}`
  );
  if (!dataRes.ok) throw new Error(`Apify dataset fetch error ${dataRes.status}`);
  return dataRes.json();
}

// ─── Platform scrapers ─────────────────────────────────────────────

async function scrapeGoogleMaps(query, location, limit = 5, minRating = null, maxRating = null, nameSearch = false) {
  // Google Maps returns highest-rated places first.
  // To find 3.0-3.9 star businesses we need to scrape a large batch and filter.
  const fetchLimit = nameSearch ? limit : 200;
  console.log(`  Fetching ${fetchLimit} places from Apify${nameSearch ? ' (name search)' : ' to find ' + limit + ' with 3.0-3.9 stars'}`);

  const results = await runApifyActor('compass~crawler-google-places', {
    searchStringsArray: [`${query} in ${location}, UAE`],
    maxCrawledPlacesPerSearch: fetchLimit,
    language: 'en',
    countryCode: 'ae',
    city: location,
  }, fetchLimit);

  // Debug: log first result to see actual field names
  if (results.length > 0) {
    const sample = results[0];
    console.log(`  Sample result keys: ${Object.keys(sample).join(', ')}`);
    console.log(`  Sample rating fields: totalScore=${sample.totalScore}, rating=${sample.rating}, stars=${sample.stars}, averageRating=${sample.averageRating}`);
  }

  let mapped = results.map((p, i) => {
    // Try all possible rating field names from Apify
    const rating = p.totalScore || p.rating || p.stars || p.averageRating || p.reviewsRating || null;
    return {
      id: `gmap_${Date.now()}_${i}`,
      name: cleanName(p.title),
      website: p.website || null,
      instagram: null,
      phone: p.phone || p.phoneUnformatted || null,
      category: p.categoryName || query,
      location: p.neighborhood || p.city || location,
      source: 'Google Maps',
      status: 'New',
      brand_quality: null,
      score: null,
      rating: rating,
      notes: `Rating: ${rating || 'N/A'} ⭐ | Reviews: ${p.reviewsCount || p.reviewCount || 0} | ${p.address || ''}`.trim(),
      last_action: TODAY(),
      tags: [query, 'Google Maps'],
      createdAt: TODAY()
    };
  });

  console.log(`  Ratings found: ${mapped.map(l => l.rating).join(', ')}`);

  // Skip rating filter for name searches — user is looking for a specific business
  if (!nameSearch) {
    mapped = mapped.filter(l => {
      const r = parseFloat(l.rating || 0);
      return r >= 3.0 && r <= 3.9;
    });
  }
  console.log(`  After rating filter (3.0–3.9★): ${mapped.length} leads found`);
  if (mapped.length === 0) {
    throw new Error(`No businesses found with rating between 3.0 and 3.9 stars for "${query}" in ${location}. Try a different category or increase the count.`);
  }

  // Return only the requested limit
  return mapped.slice(0, limit);
}

async function scrapeInstagram(query, location, limit = 5) {
  // Use Instagram search scraper to find business accounts by keyword
  // Search by username keyword, get profile details
  const results = await runApifyActor('apify~instagram-scraper', {
    search: `${query} ${location}`,
    searchType: 'user',
    searchLimit: limit,
    resultsType: 'details',
    resultsLimit: limit,
  }, limit);
  console.log(`  Instagram raw profiles: ${results.length}`);

  if (!results.length) throw new Error('Instagram returned no results. Try Google Maps instead.');

  const leads = [];
  for (const profile of results) {
    if (!profile.username) continue;
    leads.push({
      id: `ig_${Date.now()}_${leads.length}`,
      name: cleanName(profile.fullName || profile.username),
      website: profile.externalUrl || null,
      instagram: `@${profile.username}`,
      phone: profile.businessPhoneNumber || null,
      email: profile.businessEmail || null,
      category: query,
      location: profile.city || location,
      source: 'Instagram',
      status: 'New',
      brand_quality: null,
      score: null,
      notes: `Followers: ${profile.followersCount || 'N/A'} | Posts: ${profile.postsCount || 'N/A'}`,
      last_action: TODAY(),
      tags: [query, 'Instagram'],
      createdAt: TODAY()
    });
    if (leads.length >= limit) break;
  }

  if (!leads.length) throw new Error('No Instagram business profiles found. Try Google Maps instead.');
  return leads;
}

async function scrapeLinkedIn(query, location, limit = 5) {
  const results = await runApifyActor('curious_coder~linkedin-company-search-scraper', {
    searchUrl: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(query + ' ' + location)}&origin=SWITCH_SEARCH_VERTICAL`,
    maxResults: limit,
  }, limit);

  return results.map((c, i) => ({
    id: `li_${Date.now()}_${i}`,
    name: cleanName(c.name || c.companyName),
    website: c.website || null,
    instagram: null,
    phone: null,
    category: c.industry || query,
    location: c.location || location,
    source: 'LinkedIn',
    status: 'New',
    brand_quality: null,
    score: null,
    notes: `Employees: ${c.employeeCount || 'N/A'} | Industry: ${c.industry || 'N/A'}`,
    last_action: TODAY(),
    tags: [query, 'LinkedIn'],
    createdAt: TODAY()
  }));
}

// ─── Scrape endpoint ───────────────────────────────────────────────
// No fake data. If Apify is missing or fails, we return a real error.
app.post('/api/scrape', async (req, res) => {
  const { query, location, source, limit = 5, minRating, maxRating, nameSearch = false } = req.body;
  console.log(`\n→ Scraping "${query}" in "${location}" via ${source}`);

  try {
    if (!APIFY_KEY) {
      return res.status(400).json({
        error: 'APIFY_API_KEY is not configured. Add it to your .env file to scrape real leads.'
      });
    }

    let leads = [];

    if (source === 'Google Maps') {
      leads = await scrapeGoogleMaps(query, location, limit, minRating, maxRating, nameSearch);
      console.log(`✓ Google Maps: ${leads.length} leads`);
    } else if (source === 'Instagram') {
      leads = await scrapeInstagram(query, location, limit);
      console.log(`✓ Instagram: ${leads.length} leads`);
    } else if (source === 'LinkedIn') {
      leads = await scrapeLinkedIn(query, location, limit);
      console.log(`✓ LinkedIn: ${leads.length} leads`);
    } else {
      return res.status(400).json({
        error: `Source "${source}" is not supported. Use Google Maps, Instagram, or LinkedIn.`
      });
    }

    if (leads.length === 0) {
      return res.status(404).json({
        error: `No leads found for "${query}" in "${location}" on ${source}. Try a different search.`
      });
    }

    console.log(`✓ Total leads returned: ${leads.length}`);

    // Save to Supabase
    if (supabase && leads.length > 0) {
      const rows = leads.map(l => ({
        id: l.id,
        name: l.name,
        website: l.website || null,
        instagram: l.instagram || null,
        phone: l.phone || null,
        email: l.email || null,
        category: l.category || null,
        location: l.location || null,
        source: l.source || source,
        status: l.status || 'New',
        brand_quality: null,
        score: null,
        notes: l.notes || null,
        last_action: l.last_action || TODAY(),
        tags: l.tags || [],
        created_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('leads')
        .upsert(rows, { onConflict: 'id' });

      if (insertError) {
        console.warn('⚠ Supabase save warning:', insertError.message);
      } else {
        console.log(`✓ Saved ${leads.length} leads to Supabase`);
      }
    }

    res.json(leads);

  } catch (error) {
    console.error('✗ Scrape error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── Claude proxy ──────────────────────────────────────────────────
app.post('/api/claude', async (req, res) => {
  try {
    if (!API_KEY) return res.status(500).json({ error: 'CLAUDE_API_KEY missing in .env' });
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════
// REAL WEBSITE RESEARCH — fetches the actual site and analyzes it
// ════════════════════════════════════════════════════════════════

// Fetch a website and extract readable text (strip HTML tags/scripts)
async function fetchWebsiteText(url) {
  try {
    let target = url.startsWith('http') ? url : `https://${url}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const resp = await fetch(target, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DsocialtellersBot/1.0)' },
      redirect: 'follow'
    });
    clearTimeout(timeout);

    if (!resp.ok) return { ok: false, reason: `HTTP ${resp.status}`, text: '' };

    const html = await resp.text();

    // Detect key signals before stripping
    const signals = {
      hasBooking: /book|appointment|reserve|schedule|calendly|booking/i.test(html),
      hasInstagram: /instagram\.com/i.test(html),
      hasFacebook: /facebook\.com/i.test(html),
      hasWhatsApp: /wa\.me|whatsapp/i.test(html),
      hasContactForm: /<form/i.test(html),
      hasPhone: /tel:|\+971|05\d/i.test(html),
      hasShop: /shop|cart|checkout|add to cart|buy now/i.test(html),
      pageLength: html.length
    };

    // Strip scripts, styles, tags → plain text
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Keep first ~2500 chars (enough for analysis, controls token cost)
    text = text.slice(0, 2500);

    return { ok: true, text, signals };
  } catch (e) {
    return { ok: false, reason: e.name === 'AbortError' ? 'timeout' : e.message, text: '' };
  }
}

// Real research endpoint — fetches website, then Claude analyzes actual content
app.post('/api/research', async (req, res) => {
  const lead = req.body;
  console.log(`\n🔬 Researching ${lead.name}...`);

  try {
    if (!API_KEY) return res.status(500).json({ error: 'CLAUDE_API_KEY missing in .env' });

    // 1. Fetch the real website
    let siteData = { ok: false, text: '', signals: {} };
    if (lead.website) {
      console.log(`  Fetching site: ${lead.website}`);
      siteData = await fetchWebsiteText(lead.website);
      console.log(`  Site fetch: ${siteData.ok ? 'OK (' + siteData.text.length + ' chars)' : 'FAILED (' + siteData.reason + ')'}`);
    }

    // 2. Build a research prompt grounded in REAL data
    const siteContext = siteData.ok
      ? `ACTUAL WEBSITE CONTENT (first 2500 chars):
"""
${siteData.text}
"""

DETECTED SIGNALS FROM THEIR SITE:
- Online booking present: ${siteData.signals.hasBooking ? 'YES' : 'NO'}
- Instagram linked: ${siteData.signals.hasInstagram ? 'YES' : 'NO'}
- Facebook linked: ${siteData.signals.hasFacebook ? 'YES' : 'NO'}
- WhatsApp present: ${siteData.signals.hasWhatsApp ? 'YES' : 'NO'}
- Contact form present: ${siteData.signals.hasContactForm ? 'YES' : 'NO'}
- Phone number on site: ${siteData.signals.hasPhone ? 'YES' : 'NO'}
- Online shop/cart: ${siteData.signals.hasShop ? 'YES' : 'NO'}`
      : lead.website
        ? `IMPORTANT: Their website (${lead.website}) could NOT be reached (${siteData.reason}). This itself is a finding — a slow or down website is a real marketing problem. Base your analysis on this fact plus the business type.`
        : `IMPORTANT: This business has NO website at all. That is a major, VERIFIED weakness for a ${lead.category} in ${lead.location}.`;

    const system = `You are a business intelligence analyst doing a digital marketing audit for a Dubai agency.
You MUST base every weakness and opportunity on the ACTUAL DATA provided below, not assumptions.

CRITICAL RULES — breaking these is a serious error:
- If Instagram field is NOT 'NONE', do NOT say they lack Instagram. They have it.
- If phone is NOT 'NONE', do NOT say they lack a phone number.
- If website is NOT 'NONE', do NOT say they have no website.
- If a detected signal says YES, do NOT list it as a weakness.
- ONLY list something as a weakness if the data actually confirms it is missing or poor.
- Do not fabricate findings. Only state what the real data supports.
Output ONLY valid JSON.`;

    const user = `Analyze this business using the REAL data below. Do not contradict any field below.

Business: ${lead.name}
Category: ${lead.category}
Location: ${lead.location}
Website: ${lead.website || 'NONE — this is a weakness'}
Instagram: ${lead.instagram ? lead.instagram + ' — THEY HAVE INSTAGRAM, do NOT list as weakness' : 'NONE — this is a weakness'}
Phone: ${lead.phone ? lead.phone + ' — THEY HAVE A PHONE NUMBER' : 'NONE — this is a weakness'}

${siteContext}

Based on the ACTUAL data above (not guesses), output JSON:
{
  "business_summary": "2-3 sentences based on what you actually saw",
  "marketing_weaknesses": ["only weaknesses the real data supports"],
  "growth_opportunities": ["actionable opportunities based on what's missing"],
  "brand_quality": "low|medium|high",
  "tone": "suggested communication tone",
  "score": number 0-100,
  "data_source": "${siteData.ok ? 'real website content' : lead.website ? 'website unreachable' : 'no website'}"
}`;

    // 3. Call Claude with the real content
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1200,
        system,
        messages: [{ role: 'user', content: user }]
      })
    });

    const data = await claudeRes.json();
    if (!claudeRes.ok || !data.content?.[0]) throw new Error(JSON.stringify(data));

    const text = data.content[0].text.replace(/```json\n?|\n?```/g, '').trim();
    const research = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || text);
    console.log(`✓ Research done`);

    // Update lead status to Researched in Supabase immediately
    if (supabase && req.body.id) {
      await supabase.from('leads').update({
        status: 'Researched',
        last_action: TODAY()
      }).eq('id', req.body.id);
    }

    res.json(research);

  } catch (error) {
    console.error('✗ Research error:', error.message);
    res.status(500).json({ error: error.message });
  }
});


// ─── Apify diagnostic test ─────────────────────────────────────────
app.get('/api/test-apify', async (req, res) => {
  if (!APIFY_KEY) return res.json({ error: 'No Apify key' });
  try {
    // Test if the Apify token is valid
    const userRes = await fetch(`https://api.apify.com/v2/users/me?token=${APIFY_KEY}`);
    const userData = await userRes.json();
    res.json({
      token_valid: userRes.ok,
      account: userData.data?.username || 'unknown',
      plan: userData.data?.plan || 'unknown',
      monthly_usage: userData.data?.monthlyUsage || 'unknown'
    });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════
// DATABASE ENDPOINTS (Supabase)
// ════════════════════════════════════════════════════════════════

// GET all leads
app.get('/api/leads', async (req, res) => {
  if (!supabase) return res.json([]);
  try {
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data.map(rowToLead));
  } catch (e) {
    console.error('Get leads error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST add leads (single or array)
app.post('/api/leads', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const leads = Array.isArray(req.body) ? req.body : [req.body];
    const rows = leads.map(leadToRow);
    const { data, error } = await supabase.from('leads').upsert(rows).select();
    if (error) {
      console.error('✗ Supabase rejected insert:', JSON.stringify(error));
      throw error;
    }
    console.log(`✓ Saved ${data.length} leads to Supabase`);
    res.json(data.map(rowToLead));
  } catch (e) {
    console.error('Add leads error:', e.message, e.details || '', e.hint || '');
    res.status(500).json({ error: e.message, details: e.details, hint: e.hint });
  }
});

// PATCH update a lead
app.patch('/api/leads/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const updates = { ...req.body };
    const INVALID_FIELDS = ['createdAt', 'id', 'data_source', 'leadId'];
    INVALID_FIELDS.forEach(f => delete updates[f]);
    const { data, error } = await supabase.from('leads').update(updates).eq('id', req.params.id).select();
    if (error) throw error;

    const lead = data[0] ? rowToLead(data[0]) : null;

    // Auto-send WhatsApp template when pipeline generates copy (whatsapp_message just set)
    if (lead && updates.whatsapp_message && lead.phone && WA_PHONE_ID && WA_TOKEN) {
      try {
        // Check if we already sent a template to this lead
        const { data: prevMsgs } = await supabase.from('messages')
          .select('id').eq('lead_id', lead.id)
          .eq('type', 'whatsapp').eq('direction', 'outbound')
          .limit(1);

        if (!prevMsgs || prevMsgs.length === 0) {
          console.log(`→ Auto-sending WhatsApp template to ${lead.name} (${lead.phone})`);
          const result = await sendWhatsAppTemplate(lead.phone);
          console.log(`✓ Template auto-sent: ${result.messages?.[0]?.id}`);

          // Log the auto-sent template
          await supabase.from('messages').insert({
            id: `wa_auto_${Date.now()}`,
            lead_id: lead.id,
            type: 'whatsapp',
            direction: 'outbound',
            content: 'Hi, just wanted to reach out about your business. Do you have a moment to chat?',
            status: 'sent',
            timestamp: new Date().toISOString()
          });
        }
      } catch (waErr) {
        console.warn(`⚠ Auto WhatsApp failed for ${lead.name}: ${waErr.message}`);
      }
    }

    res.json(lead);
  } catch (e) {
    console.error('Update lead error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE a lead
app.delete('/api/leads/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { error } = await supabase.from('leads').delete().eq('id', req.params.id);
    if (error) throw error;
    console.log(`✓ Deleted lead ${req.params.id}`);
    res.json({ deleted: true });
  } catch (e) {
    console.error('Delete lead error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET messages for a lead
app.get('/api/messages/:leadId', async (req, res) => {
  if (!supabase) return res.json([]);
  try {
    const { data, error } = await supabase.from('messages').select('*').eq('lead_id', req.params.leadId).order('timestamp');
    if (error) throw error;
    res.json(data.map(m => ({ ...m, leadId: m.lead_id })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET all messages
app.get('/api/messages', async (req, res) => {
  if (!supabase) return res.json([]);
  try {
    const { data, error } = await supabase.from('messages').select('*').order('timestamp');
    if (error) throw error;
    res.json(data.map(m => ({ ...m, leadId: m.lead_id })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST add a message
app.post('/api/messages', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { leadId, ...rest } = req.body;
    const row = { ...rest, lead_id: leadId };
    const { data, error } = await supabase.from('messages').insert(row).select();
    if (error) throw error;
    res.json({ ...data[0], leadId: data[0].lead_id });
  } catch (e) {
    console.error('Add message error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════
// WHATSAPP (Meta Cloud API)
// ════════════════════════════════════════════════════════════════

const WA_PHONE_ID    = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WA_TOKEN       = process.env.WHATSAPP_ACCESS_TOKEN;
const WA_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'dsocialtellers2024';

if (WA_PHONE_ID && WA_TOKEN) {
  console.log('✓ WhatsApp configured');
} else {
  console.log('⚠ WhatsApp not configured — add WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN to .env');
}

// Normalise phone number
function normalisePhone(raw) {
  let phone = raw.replace(/[\s\-().]/g, '');
  if (!phone.startsWith('+')) phone = '+' + phone;
  return phone;
}

// Send a WhatsApp text message (free-form — only works after lead has messaged first)
async function sendWhatsAppMessage(to, message) {
  const phone = normalisePhone(to);
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${WA_TOKEN}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: message }
      })
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data.error || data));
  return data;
}

// Send WhatsApp template message (for first contact with new numbers)
async function sendWhatsAppTemplate(to) {
  const phone = normalisePhone(to);
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${WA_TOKEN}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: 'social_tellers_outreach',
          language: { code: 'en_US' }
        }
      })
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data.error || data));
  return data;
}

// ── Send WhatsApp endpoint ─────────────────────────────────────
app.post('/api/send-whatsapp', async (req, res) => {
  const { to, message, leadId } = req.body;
  console.log(`\n→ Sending WhatsApp to ${to}`);

  if (!WA_PHONE_ID || !WA_TOKEN) {
    return res.status(500).json({ error: 'WhatsApp not configured. Add WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN to .env' });
  }
  if (!to) return res.status(400).json({ error: 'No phone number provided' });
  if (!message) return res.status(400).json({ error: 'No message provided' });

  try {
    // Check if this lead has had any previous conversation
    let hasReplied = false;
    if (supabase && leadId) {
      const { data: prevMsgs } = await supabase.from('messages')
        .select('id')
        .eq('lead_id', leadId)
        .eq('type', 'whatsapp')
        .eq('direction', 'inbound')
        .limit(1);
      hasReplied = prevMsgs && prevMsgs.length > 0;
    }

    let result;
    let sentContent = message;

    if (hasReplied) {
      // Lead has replied before — send free-form message
      console.log(`→ Sending free-form WhatsApp to ${to}`);
      result = await sendWhatsAppMessage(to, message);
    } else {
      // New lead — send template first to initiate conversation
      console.log(`→ Sending template WhatsApp to ${to} (first contact)`);
      result = await sendWhatsAppTemplate(to);
      sentContent = 'Hi, just wanted to reach out about your business. Do you have a moment to chat?';
    }

    console.log(`✓ WhatsApp sent: ${result.messages?.[0]?.id}`);

    // Log to Supabase
    if (supabase && leadId) {
      await supabase.from('messages').insert({
        id: `wa_${Date.now()}`,
        lead_id: leadId,
        type: 'whatsapp',
        direction: 'outbound',
        subject: null,
        content: sentContent,
        status: 'sent',
        timestamp: new Date().toISOString()
      });
      await supabase.from('leads').update({
        status: 'Contacted',
        channel: 'WhatsApp',
        last_action: TODAY()
      }).eq('id', leadId);
    }

    res.json({ 
      success: true, 
      messageId: result.messages?.[0]?.id,
      type: hasReplied ? 'free-form' : 'template'
    });
  } catch (error) {
    console.error('✗ WhatsApp error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── AI Auto-reply generator ────────────────────────────────────
async function generateWhatsAppReply(lead, incomingMessage) {
  if (!API_KEY) return null;

  const SOCIAL_TELLERS_CONTEXT = `You are replying on behalf of Social Tellers, a creative marketing agency in Dubai.

About Social Tellers:
- We help brands grow through social media, content production, creator collaborations and paid advertising
- Services: Social Media Marketing (Instagram, TikTok, Facebook, Google ads), Influencer & Creator Marketing, Content Production (videos, photography, reels), Personal Branding
- We've worked with: Kibo Catering, Wakey Wakey, Caffe Pralet, Kind Kones, Papa Jones BBQ & Grill
- Results we deliver: increased social media reach, higher engagement, more customers, viral content, paid ads performance
- Based in Dubai (in5 Media, Dubai Production City) and Singapore
- Founded by Dan — content creator, marketer, photographer/videographer and business owner
- Booking link: https://calendly.com/socialtellers/meeting

You are texting a potential client named ${lead.name || 'there'} who runs a ${lead.category || 'business'} in ${lead.location || 'Dubai'}.
We reached out to them about: ${lead.whatsapp_message || 'our marketing services'}.`;

  const system = `${SOCIAL_TELLERS_CONTEXT}

REPLY RULES — very important:
- Sound like a real person texting, not a corporate bot
- Keep replies SHORT — 2-4 sentences max
- Casual, warm, confident tone
- If they ask for examples or portfolio → mention 1-2 relevant brands we worked with and offer to share more on a call
- If they ask about pricing → say it depends on the scope, easier to discuss on a quick call, share the Calendly link
- If they are interested → acknowledge and push for a call with the Calendly link
- If they say not interested → be gracious, say no problem, leave the door open
- If they ask who we are → give a one-line description and what we can do for their specific business
- If unclear → ask one simple clarifying question
- NEVER use em-dashes (—)
- NEVER sound like AI or a template
- NEVER write more than 4 sentences
- Sign off naturally, no need for "Thanks, Social Tellers" in every message`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      system,
      messages: [{ role: 'user', content: `They just replied: "${incomingMessage}"

Write a natural WhatsApp reply from Social Tellers.` }]
    })
  });

  const data = await res.json();
  return data.content?.[0]?.text || null;
}

// ── Webhook — Meta verification + incoming messages ────────────
app.get('/api/whatsapp-webhook', (req, res) => {
  const mode  = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === WA_VERIFY_TOKEN) {
    console.log('✓ WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

app.post('/api/whatsapp-webhook', async (req, res) => {
  res.sendStatus(200); // always ack immediately so Meta doesn't retry
  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value?.messages) continue;

        for (const msg of value.messages) {
          if (msg.type !== 'text') continue;

          const fromPhone = msg.from; // e.g. "971501234567"
          const incomingText = msg.text?.body || '';
          const timestamp = new Date(parseInt(msg.timestamp) * 1000).toISOString();

          console.log(`\n📱 WhatsApp reply from ${fromPhone}: "${incomingText}"`);

          // Find matching lead by phone
          let matchedLead = null;
          if (supabase) {
            const { data: leads } = await supabase.from('leads').select('*');
            matchedLead = leads?.find(l => {
              if (!l.phone) return false;
              const clean = l.phone.replace(/[\s\-().+]/g, '');
              return fromPhone.endsWith(clean) || clean.endsWith(fromPhone);
            });
          }

          if (matchedLead) {
            console.log(`  Matched lead: ${matchedLead.name}`);

            // Log the inbound message
            if (supabase) {
              await supabase.from('messages').insert({
                id: `wa_in_${Date.now()}`,
                lead_id: matchedLead.id,
                type: 'whatsapp',
                direction: 'inbound',
                subject: null,
                content: incomingText,
                status: 'received',
                timestamp
              });
              await supabase.from('leads').update({
                status: 'Replied',
                last_action: TODAY()
              }).eq('id', matchedLead.id);
              console.log(`  Updated ${matchedLead.name} → Replied`);
            }

            // Generate and send AI auto-reply
            try {
              let autoReply;

              // Check if this is their FIRST reply
              const { data: prevInbound } = supabase ? await supabase.from('messages')
                .select('id').eq('lead_id', matchedLead.id)
                .eq('type', 'whatsapp').eq('direction', 'inbound')
                .limit(2) : { data: [] };

              const isFirstReply = !prevInbound || prevInbound.length <= 1;

              if (isFirstReply && matchedLead.whatsapp_message) {
                // First reply — send the personalized outreach message
                autoReply = matchedLead.whatsapp_message;
                console.log(`  → Sending personalized outreach as first auto-reply`);
              } else {
                // Subsequent replies — use Claude to respond naturally
                autoReply = await generateWhatsAppReply(matchedLead, incomingText);
              }

              if (autoReply) {
                await sendWhatsAppMessage(fromPhone, autoReply);
                console.log(`  ✓ Auto-reply sent to ${matchedLead.name}`);

                // Log the outbound auto-reply
                if (supabase) {
                  await supabase.from('messages').insert({
                    id: `wa_auto_${Date.now()}`,
                    lead_id: matchedLead.id,
                    type: 'whatsapp',
                    direction: 'outbound',
                    subject: null,
                    content: autoReply,
                    status: 'sent',
                    timestamp: new Date().toISOString()
                  });
                }
              }
            } catch (replyErr) {
              console.error(`  ✗ Auto-reply failed: ${replyErr.message}`);
            }

          } else {
            console.log(`  No matching lead found for ${fromPhone}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('WhatsApp webhook error:', err.message);
  }
});

// ════════════════════════════════════════════════════════════════
// EMAIL SENDING (Gmail via nodemailer)
// ════════════════════════════════════════════════════════════════

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

let mailer = null;
if (GMAIL_USER && GMAIL_APP_PASSWORD) {
  mailer = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
  });
  console.log('✓ Gmail configured');
} else {
  console.log('⚠ Gmail not configured — email sending disabled');
}

app.post('/api/send-email', async (req, res) => {
  const { to, subject, body, leadId, calendlyLink } = req.body;
  console.log(`\n→ Sending email to ${to}`);

  if (!mailer) return res.status(500).json({ error: 'Gmail not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to .env' });
  if (!to) return res.status(400).json({ error: 'No recipient email address' });

  try {
    // Strip any raw calendly URL from the body (we'll show a button instead)
    let cleanBody = body;
    if (calendlyLink) {
      cleanBody = cleanBody.replace(new RegExp(calendlyLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '').trim();
    }

    // Build a styled button (no helper text)
    const bookButton = calendlyLink ? `
      <div style="margin:20px 0;">
        <a href="${calendlyLink}" target="_blank"
           style="display:inline-block;background:#e8651e;color:#ffffff;text-decoration:none;
                  padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;
                  font-family:Arial,sans-serif;">
          📅 Book a Call
        </a>
      </div>` : '';

    // Insert the button BEFORE the "Thanks" sign-off if present, else at the end
    let bodyHtml = cleanBody.replace(/\n/g, '<br>');
    if (bookButton) {
      const signoffMatch = bodyHtml.match(/(<br>\s*)?Thanks,/i);
      if (signoffMatch) {
        bodyHtml = bodyHtml.replace(/(<br>\s*)?Thanks,/i, `${bookButton}<br>Thanks,`);
      } else {
        bodyHtml = bodyHtml + bookButton;
      }
    }

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#333;max-width:560px;">
        ${bodyHtml}
      </div>`;

    const info = await mailer.sendMail({
      from: `"Dsocialtellers" <${GMAIL_USER}>`,
      to,
      subject: subject || '(no subject)',
      text: body + (calendlyLink ? `\n\nBook a call: ${calendlyLink}` : ''),
      html: htmlBody
    });
    console.log(`✓ Email sent: ${info.messageId}`);

    // Log to Supabase if available
    if (supabase && leadId) {
      await supabase.from('messages').insert({
        id: `email_${Date.now()}`,
        lead_id: leadId,
        type: 'email',
        direction: 'outbound',
        subject,
        content: body,
        status: 'delivered',
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('✗ Email error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════
// CALENDLY WEBHOOK — fires when someone books a call
// ════════════════════════════════════════════════════════════════
app.post('/api/calendly-webhook', async (req, res) => {
  try {
    const event = req.body;
    console.log('\n📅 Calendly webhook received:', event.event);

    // Calendly sends invitee.created when someone books
    if (event.event === 'invitee.created') {
      const invitee = event.payload;
      const email = invitee?.email;
      const name = invitee?.name;
      const meetingTime = invitee?.scheduled_event?.start_time;

      console.log(`✓ New booking: ${name} (${email}) at ${meetingTime}`);

      // Try to match this booking to a lead by email, and update status
      if (supabase && email) {
        const { data: matches } = await supabase.from('leads').select('*').eq('email', email);
        if (matches && matches.length > 0) {
          const lead = matches[0];
          await supabase.from('leads').update({
            status: 'Interested',
            notes: `📅 Booked a call for ${meetingTime}. ${lead.notes || ''}`,
            last_action: new Date().toISOString().split('T')[0]
          }).eq('id', lead.id);

          // Log it as a message too
          await supabase.from('messages').insert({
            id: `booking_${Date.now()}`,
            lead_id: lead.id,
            type: 'email',
            direction: 'inbound',
            subject: 'Booked a call via Calendly',
            content: `${name} booked a call for ${meetingTime}`,
            status: 'received',
            timestamp: new Date().toISOString()
          });
          console.log(`✓ Updated lead ${lead.name} → Interested (meeting booked)`);
        } else {
          console.log(`  No matching lead found for ${email}`);
        }
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Calendly webhook error:', error.message);
    res.status(200).json({ received: true }); // always 200 so Calendly doesn't retry forever
  }
});

// ─── Serve frontend static files (production) ─────────────────────
app.use(express.static(join(__dirname, '../dist')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(join(__dirname, '../dist/index.html'));
  }
});

// ─── Health ────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    claude: API_KEY ? '✓ configured' : '✗ missing',
    apify: APIFY_KEY ? '✓ configured' : '✗ missing',
    supabase: supabase ? '✓ connected' : '✗ not configured',
    gmail: mailer ? '✓ configured' : '✗ not configured',
    whatsapp: (WA_PHONE_ID && WA_TOKEN) ? '✓ configured' : '✗ not configured',
    platforms: {
      google_maps: APIFY_KEY ? '✓ real Apify actor' : '✗ requires APIFY_API_KEY',
      instagram:   APIFY_KEY ? '✓ real Apify actor' : '✗ requires APIFY_API_KEY',
      linkedin:    APIFY_KEY ? '✓ real Apify actor' : '✗ requires APIFY_API_KEY',
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n✅ Backend at http://localhost:${PORT}`);
  console.log(`   Claude:   ${API_KEY ? '✓' : '✗ missing'}`);
  console.log(`   Apify:    ${APIFY_KEY ? '✓' : '✗ missing'}`);
  console.log(`   Supabase: ${supabase ? '✓ connected' : '✗ not configured'}`);
  console.log(`   Gmail:    ${mailer ? '✓ configured' : '✗ not configured'}`);
  console.log(`   Platforms: Google Maps | Instagram | LinkedIn (real Apify actors only)\n`);
});
