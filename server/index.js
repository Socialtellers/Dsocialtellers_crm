import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
const PORT = 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

const API_KEY = process.env.CLAUDE_API_KEY || process.env.VITE_CLAUDE_API_KEY;
const APIFY_KEY = process.env.APIFY_API_KEY || process.env.VITE_APIFY_API_KEY;

// ─── Shared Claude caller ──────────────────────────────────────────
async function claude(system, userMsg, maxTokens = 1000) {
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
  console.log('Claude raw response:', JSON.stringify(data).slice(0, 200));

  if (!res.ok) throw new Error(`Claude API error: ${JSON.stringify(data)}`);
  if (!data.content || !data.content[0]) throw new Error(`Empty response from Claude: ${JSON.stringify(data)}`);

  return data.content[0].text.replace(/```json\n?|\n?```/g, '').trim();
}

// ─── Claude Proxy ──────────────────────────────────────────────────
app.post('/api/claude', async (req, res) => {
  try {
    if (!API_KEY) return res.status(500).json({ error: 'CLAUDE_API_KEY missing in .env' });
    console.log('→ Claude proxy call...');
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
    if (!response.ok) {
      console.error('Claude error:', data);
      return res.status(response.status).json({ error: data });
    }
    console.log('✓ Claude OK');
    res.json(data);
  } catch (error) {
    console.error('Claude proxy error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── Scraper ───────────────────────────────────────────────────────
app.post('/api/scrape', async (req, res) => {
  const { query, location, source } = req.body;
  console.log(`\n→ Scraping: "${query}" in "${location}"`);

  try {
    if (!API_KEY) return res.status(500).json({ error: 'CLAUDE_API_KEY missing in .env' });

    const today = new Date().toISOString().split('T')[0];
    const text = await claude(
      'You generate realistic UAE business lead data. Output ONLY a valid JSON array. No markdown. No explanation. Just the JSON array.',
      `Generate 4 realistic business leads for "${query}" in "${location}", UAE.
Output ONLY this JSON array with no other text:
[
  {
    "id": "s1",
    "name": "Business Name Here",
    "website": "https://example.ae",
    "instagram": "@handle",
    "phone": "+971501234567",
    "category": "${query}",
    "location": "${location}",
    "source": "${source}",
    "status": "New",
    "brand_quality": null,
    "score": null,
    "notes": "Freshly scraped",
    "last_action": "${today}",
    "tags": ["${query}"],
    "createdAt": "${today}"
  }
]`
    );

    console.log('→ Parsed text:', text.slice(0, 150));
    const leads = JSON.parse(text);
    console.log(`✓ Generated ${leads.length} leads`);
    res.json(leads);

  } catch (error) {
    console.error('✗ Scrape error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── Health ────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    claude: API_KEY ? 'configured' : 'MISSING',
    apify: APIFY_KEY ? 'configured' : 'MISSING',
    env_path: join(__dirname, '..', '.env')
  });
});

app.listen(PORT, () => {
  console.log(`\n✅ Backend running at http://localhost:${PORT}`);
  console.log(`   Claude API: ${API_KEY ? '✓ configured' : '✗ MISSING'}`);
  console.log(`   Apify API:  ${APIFY_KEY ? '✓ configured' : '✗ MISSING'}\n`);
});
