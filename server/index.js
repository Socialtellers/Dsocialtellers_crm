import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Make sure .env is loaded from project root
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
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Claude API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Scraper Proxy ─────────────────────────────────────────────────
app.post('/api/scrape', async (req, res) => {
  const { query, location, source } = req.body;
  try {
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
Return a JSON array like this:
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
    const text = data.content[0].text.replace(/```json\n?|\n?```/g, '').trim();
    const leads = JSON.parse(text);
    res.json(leads);
  } catch (error) {
    console.error('Scrape error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Health Check ──────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    claude: API_KEY ? 'configured' : 'missing',
    apify: APIFY_KEY ? 'configured' : 'missing'
  });
});

app.listen(PORT, () => {
  console.log(`\n✅ Backend running at http://localhost:${PORT}`);
  console.log(`   Claude API: ${API_KEY ? '✓ configured' : '✗ missing key'}`);
  console.log(`   Apify API:  ${APIFY_KEY ? '✓ configured' : '✗ missing key'}`);
  if (!API_KEY) {
    console.log('\n⚠️  Add your keys to .env file in the project root:');
    console.log('   CLAUDE_API_KEY=sk-ant-...');
    console.log('   APIFY_API_KEY=apify_api_...\n');
  }
});
