-- ════════════════════════════════════════════════════════════════
-- Dsocialtellers CRM — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ════════════════════════════════════════════════════════════════

-- ─── LEADS TABLE ───────────────────────────────────────────────────
create table if not exists leads (
  id text primary key,
  name text not null,
  website text,
  instagram text,
  phone text,
  email text,
  category text,
  location text,
  source text,
  status text default 'New',
  channel text,
  brand_quality text,
  score int,
  business_summary text,
  marketing_weaknesses jsonb default '[]'::jsonb,
  growth_opportunities jsonb default '[]'::jsonb,
  tone text,
  email_subject text,
  email_body text,
  whatsapp_message text,
  notes text,
  last_action text,
  tags jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- ─── MESSAGES TABLE ────────────────────────────────────────────────
create table if not exists messages (
  id text primary key,
  lead_id text references leads(id) on delete cascade,
  type text,                 -- 'email' | 'whatsapp'
  direction text,            -- 'inbound' | 'outbound'
  subject text,
  content text,
  status text,
  timestamp timestamptz default now()
);

-- ─── AGENT JOBS TABLE (optional — tracks pipeline runs) ────────────
create table if not exists agent_jobs (
  id text primary key,
  type text,
  input jsonb,
  status text default 'pending',
  progress int default 0,
  logs jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- ─── INDEXES for faster queries ────────────────────────────────────
create index if not exists idx_leads_status on leads(status);
create index if not exists idx_leads_source on leads(source);
create index if not exists idx_messages_lead on messages(lead_id);

-- ════════════════════════════════════════════════════════════════
-- Done! Your tables are ready.
-- ════════════════════════════════════════════════════════════════
