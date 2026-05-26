# AI Lead Intelligence & Outreach OS
### Built for Dsocialtellers — Dubai's AI-Powered Marketing Agency

A full-stack SaaS platform that automates lead generation, AI research, personalized outreach, and CRM management for marketing agencies.

---

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`

---

## 🧱 System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│  Dashboard | Leads | CRM Kanban | Outreach | Agents     │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│               AI AGENT PIPELINE                          │
│                                                          │
│  [Scraper] → [Validator] → [Researcher] →               │
│  [Strategist] → [Copywriter] → [CRM Agent]              │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│                INTEGRATIONS                              │
│  Claude Sonnet 4 (AI) │ Apify (Scraping)               │
│  Gmail API │ WhatsApp Cloud API                         │
└─────────────────────────────────────────────────────────┘
```

---

## ⚙️ Agent Pipeline

| Agent | Responsibility | Input → Output |
|-------|---------------|----------------|
| **1. Validation** | Clean & validate lead data | Raw lead → `{valid, clean_data}` |
| **2. Research** | Analyze digital presence | Lead → `{weaknesses, opportunities, quality}` |
| **3. Strategy** | Define outreach angle | Research → `{hook, pain_point, positioning}` |
| **4. Copywriting** | Generate email + WhatsApp | Strategy → `{email_subject, email_body, whatsapp}` |
| **5. CRM** | Track pipeline state | Action → `{status, notes, last_action}` |

---

## 🗄️ Database Schema

### leads
```sql
id, name, website, instagram, phone, category, location, source,
status, channel, brand_quality, score,
business_summary, marketing_weaknesses[], growth_opportunities[], tone,
email_subject, email_body, whatsapp_message,
notes, last_action, tags[], createdAt
```

### messages
```sql
id, leadId, type (email|whatsapp), direction (inbound|outbound),
subject, content, timestamp, status
```

### agent_jobs
```sql
id, type, input, status (pending|running|done|failed),
progress, logs[], createdAt
```

---

## 📊 CRM Statuses
`New → Contacted → Replied → Interested → Follow-up → Closed Won / Closed Lost / Not Interested`

---

## 🔌 Integrations

### Claude API (Active)
- Model: `claude-sonnet-4-20250514`
- Used for: Research, Strategy, Copywriting, CRM agents
- File: `src/agents/pipeline.js`

### Apify (Active)
- API Key: configured in `src/agents/pipeline.js`
- Actors: Google Maps Scraper, Instagram Scraper
- Simulated in MVP; swap `scrapeLeads()` for real actor calls

### Email (Configure)
- Smartlead / Instantly / Gmail API
- Add credentials in Settings → Integrations

### WhatsApp (Configure)
- WhatsApp Cloud API / Twilio
- Add credentials in Settings → Integrations

---

## 🧩 Tech Stack

### MVP (Current)
- **Frontend**: React 18, Vite, Recharts
- **AI**: Anthropic Claude Sonnet 4
- **Scraping**: Apify
- **State**: In-memory store (swap for Supabase)

### Scale Version
- **Backend**: Node.js + Fastify or Python FastAPI
- **Database**: PostgreSQL (Supabase or Railway)
- **Queue**: BullMQ + Redis
- **Auth**: Clerk or Supabase Auth
- **Deploy**: Vercel (frontend) + Railway (backend)

---

## 💰 Monetization Tiers

| Tier | Price | Leads/mo | Agents | Users |
|------|-------|----------|--------|-------|
| **Starter** | $97/mo | 200 | All | 1 |
| **Growth** | $297/mo | 1,000 | All + Batch | 3 |
| **Agency** | $697/mo | Unlimited | All + API | 10 |
| **Enterprise** | Custom | Unlimited | White-label | Unlimited |

---

## 📁 Project Structure

```
src/
├── agents/
│   └── pipeline.js          # All 5 AI agents + Apify scraper
├── components/
│   ├── Sidebar.jsx           # Navigation
│   ├── ui.jsx                # Shared UI components
│   ├── dashboard/
│   │   └── Dashboard.jsx     # Metrics + charts
│   ├── leads/
│   │   └── LeadsPage.jsx     # Lead database + detail panel
│   ├── crm/
│   │   └── CRMPage.jsx       # Kanban pipeline board
│   ├── outreach/
│   │   └── OutreachPage.jsx  # Message composer + history
│   └── agents/
│       └── AgentPage.jsx     # Agent control panel
├── lib/
│   └── store.js              # Data store + mock data
├── styles/
│   └── globals.css           # Design system
├── App.jsx
└── main.jsx
```

---

## 🛣️ Roadmap

- [ ] Supabase backend integration
- [ ] Real Apify actor calls (Google Maps, Instagram)  
- [ ] Email sending via Smartlead/Instantly API
- [ ] WhatsApp Cloud API integration
- [ ] Follow-up sequence automation
- [ ] Reply tracking webhook
- [ ] Multi-user auth (Clerk)
- [ ] CSV import/export
- [ ] Reporting & analytics exports
- [ ] Chrome extension for manual lead capture
