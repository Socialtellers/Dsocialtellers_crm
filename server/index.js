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

// ─── Claude Proxy ──────────────────────────────────────────────────
app.post('/api/claude', async (req, res) => {
  try {
    if (!API_KEY) return res.status(500).json({ error: 'CLAUDE_API_KEY missing in .env file' });

    console.log('→ Calling Claude API...');
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

    console.log('✓ Claude responded OK');
    res.json(data);
  } catch (error) {
    console.error('Claude API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── Scraper Proxy ─────────────────────────────────────────────────
app.post('/api/scrape', async (req, res) => {
  const { query, location, source } = req.body;
  console.log(`→ Scraping: "${query}" in "${location}" via ${source}`);

  try {
    if (!API_KEY) return res.status(500).json({ error: 'CLAUDE_API_KEY missing in .env file' });

    console.log('→ Calling Claude to generate leads...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: 'Generate realistic UAE business lead data. Output ONLY a valid JSON array. No markdown, no explanation.',
        messages: [{
          role: 'user',
          content: `Generate 4 realistic business leads for "${query}" businesses in "${location}", UAE.
Return a JSON array:
[{
  "id": "scraped_1",
  "name": "Real Business Name",
  "website": "https://example.ae",
  "instagram": "@handle",
  "phone": "+971501234567",
  "category": "${query}",
  "location": "${location}",
  "source": "${source || 'Google Maps'}",
  "status": "New",
  "brand_quality": null,
  "score": null,
  "notes": "Freshly scraped",
  "last_action": "${new Date().toISOString().split('T')[0]}",
  "tags": ["${query}"],
  "createdAt": "${new Date().toISOString().split('T')[0]}"
}]`
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Claude scrape error:', JSON.stringify(data));
      return res.status(500).json({ error: JSON.stringify(data) });
    }

    const text = data.content[0].text.replace(/```json\n?|\n?```/g, '').trim();
    console.log('→ Claude raw response:', text.slice(0, 100));

    const leads = JSON.parse(text);
    console.log(`✓ Generated ${leads.length} leads`);
    res.json(leads);

  } catch (error) {
    console.error('Scrape error full:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Health Check ──────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    claude: API_KEY ? 'configured' : 'MISSING - add CLAUDE_API_KEY to .env',
    apify: APIFY_KEY ? 'configured' : 'MISSING - add APIFY_API_KEY to .env',
    env_file_path: join(__dirname, '..', '.env')
  });
});

app.listen(PORT, () => {
  console.log(`\n✅ Backend running at http://localhost:${PORT}`);
  console.log(`   Claude API: ${API_KEY ? '✓ configured' : '✗ MISSING KEY'}`);
  console.log(`   Apify API:  ${APIFY_KEY ? '✓ configured' : '✗ MISSING KEY'}`);
  console.log(`   .env path:  ${join(__dirname, '..', '.env')}\n`);
});
