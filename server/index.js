import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
const API_KEY = process.env.VITE_CLAUDE_API_KEY;
const APIFY_KEY = process.env.VITE_APIFY_API_KEY;

// ─── Claude Proxy ──────────────────────────────────────────────────
app.post('/api/claude', async (req, res) => {
  try {
    const response = await fetch(CLAUDE_API, {
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

// ─── Apify Scraper Proxy ───────────────────────────────────────────
app.post('/api/scrape', async (req, res) => {
  const { query, location, source } = req.body;

  try {
    // For Google Maps scraping via Apify
    if (source === 'Google Maps') {
      const runRes = await fetch(
        `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${APIFY_KEY}&maxItems=5`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            searchStringsArray: [`${query} in ${location}`],
            maxCrawledPlacesPerSearch: 5,
            language: 'en',
          })
        }
      );

      if (!runRes.ok) throw new Error(`Apify error: ${runRes.status}`);
      const places = await runRes.json();

      // Map Apify results to our lead format
      const leads = places.map((p, i) => ({
        id: `scraped_${Date.now()}_${i}`,
        name: p.title || p.name,
        website: p.website || null,
        instagram: null,
        phone: p.phone || p.phoneUnformatted || null,
        category: p.categoryName || query,
        location: p.neighborhood || p.city || location,
        source: 'Google Maps',
        status: 'New',
        brand_quality: null,
        score: null,
        notes: 'Freshly scraped via Apify',
        last_action: new Date().toISOString().split('T')[0],
        tags: [query],
        createdAt: new Date().toISOString().split('T')[0]
      }));

      return res.json(leads);
    }

    // Fallback: use Claude to simulate leads
    const claudeRes = await fetch(CLAUDE_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: 'Generate realistic business lead data for Dubai/UAE. Output ONLY valid JSON array, no markdown.',
        messages: [{
          role: 'user',
          content: `Generate 4 realistic business leads for "${query}" in "${location}", source: ${source}.
Return JSON array:
[{
  "id": "scraped_1",
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
  "notes": "Freshly scraped",
  "last_action": "${new Date().toISOString().split('T')[0]}",
  "tags": ["${query}"],
  "createdAt": "${new Date().toISOString().split('T')[0]}"
}]`
        }]
      })
    });

    const claudeData = await claudeRes.json();
    const text = claudeData.content[0].text.replace(/```json\n?|\n?```/g, '').trim();
    const leads = JSON.parse(text);
    res.json(leads);

  } catch (error) {
    console.error('Scrape error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Health check ──────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    claude: API_KEY ? 'configured' : 'missing',
    apify: APIFY_KEY ? 'configured' : 'missing'
  });
});

app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
  console.log(`   Claude API: ${API_KEY ? '✓ configured' : '✗ missing key'}`);
  console.log(`   Apify API:  ${APIFY_KEY ? '✓ configured' : '✗ missing key'}`);
});
