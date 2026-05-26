import React, { useState } from 'react';
import { Bot, Search, FlaskConical, PenTool, Database, Zap, Play, CheckCircle, AlertCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '../../lib/store';
import { runFullPipeline, scrapeLeads } from '../../agents/pipeline';
import { Button, Card, Input, Select, Spinner, Badge, PageHeader } from '../ui';

const AGENTS = [
  { id: 'validation', label: 'Data Validation Agent', icon: CheckCircle, desc: 'Validates and cleans lead data. Ensures contact info exists.', color: '#10b981' },
  { id: 'research', label: 'Business Research Agent', icon: FlaskConical, desc: 'Analyzes website & social media. Identifies marketing weaknesses.', color: '#00d4ff' },
  { id: 'strategy', label: 'Personalization Strategy', icon: Zap, desc: 'Crafts messaging angle and pain point focus per lead.', color: '#f59e0b' },
  { id: 'copy', label: 'Copywriting Agent', icon: PenTool, desc: 'Generates cold email + WhatsApp message using research.', color: '#7c3aed' },
  { id: 'crm', label: 'CRM Update Agent', icon: Database, desc: 'Logs all actions, updates statuses and pipeline stages.', color: '#f97316' },
];

export default function AgentPage({ onNavigate }) {
  const [scrapeQuery, setScrapeQuery] = useState('');
  const [scrapeLocation, setScrapeLocation] = useState('Dubai');
  const [scrapeSource, setScrapeSource] = useState('Google Maps');
  const [scraping, setScraping] = useState(false);
  const [scrapeLog, setScrapeLog] = useState([]);

  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState([]);
  const [batchLogs, setBatchLogs] = useState([]);

  const [expandedAgent, setExpandedAgent] = useState(null);

  const runScrape = async () => {
    if (!scrapeQuery.trim()) return;
    setScraping(true);
    setScrapeLog([{ msg: `Initializing Apify scraper for "${scrapeQuery}" in ${scrapeLocation}...`, type: 'info' }]);
    try {
      setScrapeLog(l => [...l, { msg: `Calling ${scrapeSource} scraper actor via Apify...`, type: 'info' }]);
      const newLeads = await scrapeLeads(scrapeQuery, scrapeLocation, scrapeSource);
      if (Array.isArray(newLeads)) {
        newLeads.forEach(lead => db.addLead({ ...lead, id: `scraped_${Date.now()}_${Math.random().toString(36).slice(2,6)}` }));
        setScrapeLog(l => [...l,
          { msg: `✓ Scraped ${newLeads.length} leads successfully`, type: 'success' },
          ...newLeads.map(n => ({ msg: `  → ${n.name} | ${n.location} | ${n.category}`, type: 'result' })),
          { msg: `Leads added to database. Run AI pipeline to generate outreach.`, type: 'info' }
        ]);
      }
    } catch (e) {
      setScrapeLog(l => [...l, { msg: `Error: ${e.message}`, type: 'error' }]);
    } finally {
      setScraping(false);
    }
  };

  const runBatchPipeline = async () => {
    const newLeads = db.getLeads().filter(l => l.status === 'New' && !l.email_body);
    if (newLeads.length === 0) {
      alert('No "New" leads without copy to process.');
      return;
    }
    setBatchRunning(true);
    setBatchProgress([]);
    setBatchLogs([{ msg: `Starting batch pipeline for ${newLeads.length} leads...`, type: 'info' }]);

    for (let i = 0; i < newLeads.length; i++) {
      const lead = newLeads[i];
      setBatchProgress(prev => [...prev.filter(p => p.id !== lead.id), { id: lead.id, name: lead.name, status: 'running', pct: 0, step: 'Starting...' }]);
      setBatchLogs(l => [...l, { msg: `[${i+1}/${newLeads.length}] Processing: ${lead.name}`, type: 'info' }]);

      try {
        await runFullPipeline(lead, (p) => {
          setBatchProgress(prev => prev.map(pp => pp.id === lead.id ? { ...pp, pct: p.pct, step: p.step } : pp));
        });
        const updated = db.getLead(lead.id);
        setBatchProgress(prev => prev.map(p => p.id === lead.id ? { ...p, status: 'done', pct: 100, step: 'Complete' } : p));
        setBatchLogs(l => [...l, { msg: `  ✓ ${lead.name} — copy generated, status: Contacted`, type: 'success' }]);
      } catch (e) {
        setBatchProgress(prev => prev.map(p => p.id === lead.id ? { ...p, status: 'error', step: e.message } : p));
        setBatchLogs(l => [...l, { msg: `  ✗ ${lead.name} — ${e.message}`, type: 'error' }]);
      }

      await new Promise(r => setTimeout(r, 500));
    }

    setBatchLogs(l => [...l, { msg: `Batch complete. Processed ${newLeads.length} leads.`, type: 'success' }]);
    setBatchRunning(false);
  };

  const logColor = { info: 'var(--text-secondary)', success: '#10b981', error: '#ef4444', result: 'var(--accent-primary)' };

  return (
    <div style={{ padding: '0 0 32px' }}>
      <PageHeader
        title="AI Agent Control Panel"
        subtitle="Orchestrate your 5-agent intelligence pipeline"
      />

      <div style={{ padding: '0 28px' }}>
        {/* Agent pipeline visualization */}
        <Card style={{ marginBottom: 20, background: 'linear-gradient(135deg, rgba(0,212,255,0.04), rgba(124,58,237,0.04))' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>
            Agent Pipeline Architecture
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {AGENTS.map((agent, i) => {
              const Icon = agent.icon;
              return (
                <React.Fragment key={agent.id}>
                  <div
                    onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                      background: `${agent.color}10`,
                      border: `1px solid ${agent.color}30`,
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = `${agent.color}20`}
                    onMouseLeave={e => e.currentTarget.style.background = `${agent.color}10`}
                  >
                    <Icon size={13} color={agent.color} />
                    <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>{i+1}. {agent.label}</span>
                    {expandedAgent === agent.id ? <ChevronUp size={11} color="var(--text-muted)" /> : <ChevronDown size={11} color="var(--text-muted)" />}
                  </div>
                  {i < AGENTS.length - 1 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>→</div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
          {expandedAgent && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 7,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              fontSize: 12, color: 'var(--text-secondary)', animation: 'fadeIn 0.2s ease'
            }} className="animate-fadeIn">
              <strong style={{ color: 'var(--text-primary)' }}>{AGENTS.find(a => a.id === expandedAgent)?.label}:</strong>
              {' '}{AGENTS.find(a => a.id === expandedAgent)?.desc}
            </div>
          )}
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Scraping Panel */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Search size={13} color="#00d4ff" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Lead Scraper</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Powered by Apify</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 5 }}>BUSINESS TYPE</div>
                <Input value={scrapeQuery} onChange={e => setScrapeQuery(e.target.value)} placeholder="e.g. restaurants, beauty salons, gyms" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 5 }}>LOCATION</div>
                  <Input value={scrapeLocation} onChange={e => setScrapeLocation(e.target.value)} placeholder="Dubai Marina" />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 5 }}>SOURCE</div>
                  <Select value={scrapeSource} onChange={e => setScrapeSource(e.target.value)}
                    options={['Google Maps', 'Instagram', 'LinkedIn', 'Directories']} style={{ width: '100%' }} />
                </div>
              </div>
            </div>

            <Button onClick={runScrape} loading={scraping} style={{ width: '100%', marginBottom: 14 }} icon={Search}>
              {scraping ? 'Scraping...' : 'Start Scraping'}
            </Button>

            {scrapeLog.length > 0 && (
              <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 7, padding: '10px 12px', maxHeight: 180, overflow: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                {scrapeLog.map((l, i) => (
                  <div key={i} style={{ color: logColor[l.type] || 'var(--text-secondary)', marginBottom: 3 }}>
                    {l.msg}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Batch Pipeline Panel */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={13} color="#7c3aed" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Batch AI Pipeline</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Process all "New" leads automatically</div>
              </div>
            </div>

            <div style={{ padding: '10px 12px', borderRadius: 7, background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Runs all 5 agents sequentially on every "New" lead:<br/>
                <span style={{ color: 'var(--text-muted)' }}>Validation → Research → Strategy → Copy → CRM</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: '#7c3aed', fontFamily: 'var(--font-mono)' }}>
                {db.getLeads().filter(l => l.status === 'New' && !l.email_body).length} leads queued
              </div>
            </div>

            <Button
              variant={batchRunning ? 'secondary' : 'primary'}
              onClick={runBatchPipeline}
              loading={batchRunning}
              style={{ width: '100%', marginBottom: 14 }}
              icon={Play}
            >
              {batchRunning ? 'Running Pipeline...' : 'Run Batch Pipeline'}
            </Button>

            {/* Progress items */}
            {batchProgress.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {batchProgress.map(p => (
                  <div key={p.id} style={{
                    padding: '8px 10px', borderRadius: 6,
                    background: 'var(--bg-card)', border: `1px solid ${p.status === 'done' ? 'rgba(16,185,129,0.2)' : p.status === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(0,212,255,0.15)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                      <span style={{ fontSize: 10, color: p.status === 'done' ? '#10b981' : p.status === 'error' ? '#ef4444' : 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                        {p.status === 'done' ? '✓' : p.status === 'error' ? '✗' : `${p.pct}%`}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 5 }}>{p.step}</div>
                    <div style={{ height: 2, background: 'var(--border)', borderRadius: 1 }}>
                      <div style={{
                        width: `${p.pct}%`, height: '100%',
                        background: p.status === 'done' ? '#10b981' : p.status === 'error' ? '#ef4444' : 'var(--accent-primary)',
                        borderRadius: 1, transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Logs */}
            {batchLogs.length > 0 && (
              <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 7, padding: '10px 12px', maxHeight: 140, overflow: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                {batchLogs.map((l, i) => (
                  <div key={i} style={{ color: logColor[l.type] || 'var(--text-secondary)', marginBottom: 3 }}>
                    {l.msg}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* API Status */}
        <Card style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Integration Status</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { label: 'Claude Sonnet 4', key: 'claude', status: 'connected', detail: 'claude-sonnet-4-20250514' },
              { label: 'Apify Platform', key: 'apify', status: 'connected', detail: 'Google Maps Actor' },
              { label: 'WhatsApp API', key: 'wa', status: 'pending', detail: 'Configure in Settings' },
            ].map(({ label, status, detail }) => (
              <div key={label} style={{
                padding: '12px 14px', borderRadius: 8,
                background: status === 'connected' ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)',
                border: `1px solid ${status === 'connected' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: status === 'connected' ? '#10b981' : '#f59e0b' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{detail}</div>
                <div style={{ fontSize: 10, color: status === 'connected' ? '#10b981' : '#f59e0b', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>{status}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
