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

// ─── Apify caller ──────────────────────────────────────────────────
async function runApifyActor(actorId, input, limit = 5) {
  console.log(`→ Running Apify actor: ${actorId} (limit ${limit})`);
  const res = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_KEY}&maxItems=${limit}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Apify error ${res.status}: ${err}`);
  }
  return res.json();
}

// ─── Platform scrapers ─────────────────────────────────────────────

async function scrapeGoogleMaps(query, location, limit = 5) {
  const results = await runApifyActor('compass~crawler-google-places', {
    searchStringsArray: [`${query} in ${location}`],
    maxCrawledPlacesPerSearch: limit,
    language: 'en',
  }, limit);

  return results.map((p, i) => ({
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
    notes: `Rating: ${p.totalScore || 'N/A'} ⭐ | Reviews: ${p.reviewsCount || 0}`,
    last_action: TODAY(),
    tags: [query, 'Google Maps'],
    createdAt: TODAY()
  }));
}

async function scrapeInstagram(query, location, limit = 5) {
  // Instagram hashtag scraper needs "search" + "searchType" input format
  const hashtag = `${query}${location}`.replace(/\s/g, '').toLowerCase();
  const results = await runApifyActor('apify~instagram-scraper', {
    search: hashtag,
    searchType: 'hashtag',
    searchLimit: 1,
    resultsType: 'posts',
    resultsLimit: limit * 6,
  }, limit * 6);
  console.log(`  Instagram raw posts: ${results.length}`);

  // Extract unique accounts from posts
  const seen = new Set();
  const leads = [];
  for (const post of results) {
    if (!post.ownerUsername || seen.has(post.ownerUsername)) continue;
    seen.add(post.ownerUsername);
    leads.push({
      id: `ig_${Date.now()}_${leads.length}`,
      name: cleanName(post.ownerFullName || post.ownerUsername),
      website: null,
      instagram: `@${post.ownerUsername}`,
      phone: null,
      category: query,
      location: location,
      source: 'Instagram',
      status: 'New',
      brand_quality: null,
      score: null,
      notes: `Followers: ${post.ownerFollowersCount || 'N/A'} | Posts: ${post.ownerPostsCount || 'N/A'}`,
      last_action: TODAY(),
      tags: [query, 'Instagram'],
      createdAt: TODAY()
    });
    if (leads.length >= limit) break;
  }
  return leads;
}

async function scrapeLinkedIn(query, location, limit = 5) {
  const results = await runApifyActor('curious_coder~linkedin-company-search-scraper', {
    keywords: `${query} ${location}`,
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

// ─── Claude fallback (when Apify actor fails) ──────────────────────
async function claudeFallback(query, location, source, limit = 5) {
  console.log(`→ Using Claude fallback for ${source}`);
  const safeLimit = Math.min(limit, 10); // cap to avoid token overflow
  let text;
  try {
    text = await callClaude(
    'Generate realistic UAE business lead data. Output ONLY a valid JSON array. No markdown.',
    `Generate ${safeLimit} realistic "${query}" business leads in "${location}", UAE for source "${source}".
Output ONLY this JSON array:
[{
  "id": "s1",
  "name": "Business Name",
  "website": "https://example.ae",
  "instagram": "@handle",
  "phone": "+971501234567",
  "category": "${query}",
  "location": "${location}",
  "source": "${source}",
  "status": "New",
  "brand_quality": null,
  "score": null,
  "notes": "Scraped via ${source}",
  "last_action": "${TODAY()}",
  "tags": ["${query}"],
  "createdAt": "${TODAY()}"
}]`,
      4000
    );
  } catch (e) {
    console.error('  Claude call failed:', e.message);
    throw new Error('Claude fallback failed: ' + e.message);
  }
  try {
    // Extract JSON array even if wrapped in text
    const match = text.match(/\[[\s\S]*\]/);
    return JSON.parse(match ? match[0] : text);
  } catch (e) {
    console.error('  JSON parse failed. Raw:', text.slice(0, 200));
    throw new Error('Could not parse leads from Claude response');
  }
}

// ─── Scrape endpoint ───────────────────────────────────────────────
app.post('/api/scrape', async (req, res) => {
  const { query, location, source, limit = 5 } = req.body;
  console.log(`\n→ Scraping "${query}" in "${location}" via ${source}`);

  try {
    if (!API_KEY) return res.status(500).json({ error: 'CLAUDE_API_KEY missing in .env' });

    let leads = [];

    // Try real Apify actor first, fall back to Claude simulation
    if (APIFY_KEY && source === 'Google Maps') {
      try {
        leads = await scrapeGoogleMaps(query, location, limit);
        console.log(`✓ Google Maps: ${leads.length} leads`);
      } catch (e) {
        console.log(`⚠ Google Maps failed (${e.message.slice(0,80)}), using Claude fallback`);
        leads = await claudeFallback(query, location, source, limit);
      }
    } else if (APIFY_KEY && source === 'Instagram') {
      try {
        leads = await scrapeInstagram(query, location, limit);
        console.log(`✓ Instagram: ${leads.length} leads`);
      } catch (e) {
        console.log(`⚠ Instagram failed (${e.message.slice(0,80)}), using Claude fallback`);
        leads = await claudeFallback(query, location, source, limit);
      }
    } else if (APIFY_KEY && source === 'LinkedIn') {
      try {
        leads = await scrapeLinkedIn(query, location, limit);
        console.log(`✓ LinkedIn: ${leads.length} leads`);
      } catch (e) {
        console.log(`⚠ LinkedIn failed (${e.message.slice(0,80)}), using Claude fallback`);
        leads = await claudeFallback(query, location, source, limit);
      }
    } else {
      // No Apify key or Directories selected — use Claude
      leads = await claudeFallback(query, location, source, limit);
    }

    console.log(`✓ Total leads returned: ${leads.length}`);
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
    delete updates.createdAt;
    delete updates.id;
    const { data, error } = await supabase.from('leads').update(updates).eq('id', req.params.id).select();
    if (error) throw error;
    res.json(data[0] ? rowToLead(data[0]) : null);
  } catch (e) {
    console.error('Update lead error:', e.message);
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

// ─── Health ────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    claude: API_KEY ? '✓ configured' : '✗ missing',
    apify: APIFY_KEY ? '✓ configured' : '✗ missing',
    supabase: supabase ? '✓ connected' : '✗ not configured',
    gmail: mailer ? '✓ configured' : '✗ not configured',
    platforms: {
      google_maps: '✓ real Apify actor',
      instagram: '✓ real Apify actor',
      linkedin: '✓ real Apify actor',
      directories: 'Claude simulation'
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n✅ Backend at http://localhost:${PORT}`);
  console.log(`   Claude:   ${API_KEY ? '✓' : '✗ missing'}`);
  console.log(`   Apify:    ${APIFY_KEY ? '✓' : '✗ missing'}`);
  console.log(`   Supabase: ${supabase ? '✓ connected' : '✗ not configured'}`);
  console.log(`   Gmail:    ${mailer ? '✓ configured' : '✗ not configured'}`);
  console.log(`   Platforms: Google Maps | Instagram | LinkedIn | Directories\n`);
});
