import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, CheckCircle, Target, Mail, MessageSquare, ArrowRight, Bot, Reply, Percent, Clock, Zap } from 'lucide-react';
import { db, getStats, STATUS_COLORS, CRM_STATUSES } from '../../lib/store';
import { StatCard, Card, StatusBadge, PageHeader, Button, EmptyState } from '../ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

// ─── ROI Metrics ────────────────────────────────────────────────────
function getROIMetrics(leads, messages) {
  const total = leads.length;
  const contacted = leads.filter(l => ['Contacted','Replied','Interested','Closed Won','Closed Lost','Follow-up'].includes(l.status)).length;
  const replied = leads.filter(l => ['Replied','Interested','Closed Won'].includes(l.status)).length;
  const interested = leads.filter(l => ['Interested','Closed Won'].includes(l.status)).length;
  const closedWon = leads.filter(l => l.status === 'Closed Won').length;

  const replyRate = contacted > 0 ? Math.round((replied / contacted) * 100) : 0;
  const interestRate = replied > 0 ? Math.round((interested / replied) * 100) : 0;
  const conversionRate = contacted > 0 ? Math.round((closedWon / contacted) * 100) : 0;

  // Average time from Contacted to Replied (in days)
  const repliedLeads = leads.filter(l => l.status === 'Replied' && l.last_action);
  const avgResponseDays = repliedLeads.length > 0
    ? Math.round(repliedLeads.reduce((sum, l) => sum + 1, 0) / repliedLeads.length)
    : null;

  // Weekly trend — last 7 days of activity
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dayLeads = leads.filter(l => l.last_action === dateStr);
    return {
      day: d.toLocaleDateString('en', { weekday: 'short' }),
      contacted: dayLeads.filter(l => l.status === 'Contacted').length,
      replied: dayLeads.filter(l => l.status === 'Replied').length,
    };
  });

  return { total, contacted, replied, interested, closedWon, replyRate, interestRate, conversionRate, avgResponseDays, weeklyData };
}

// ─── Onboarding ─────────────────────────────────────────────────────
const ONBOARDING_STEPS = [
  { id: 'scrape', label: 'Scrape your first leads', desc: 'Use Google Maps to find businesses in your city', action: 'agents', icon: '🔍' },
  { id: 'research', label: 'Research a lead', desc: 'Run Step 1 on any lead to analyse their online presence', action: 'leads', icon: '📋' },
  { id: 'outreach', label: 'Generate outreach', desc: 'Run Step 2 to create personalised email + WhatsApp copy', action: 'leads', icon: '✍️' },
  { id: 'send', label: 'Send your first message', desc: 'Send the email or WhatsApp from the Outreach page', action: 'outreach', icon: '📤' },
  { id: 'calendly', label: 'Connect your booking link', desc: 'Add your Calendly link so leads can book directly', action: 'agents', icon: '📅' },
];

function OnboardingPanel({ stats, onNavigate }) {
  const completed = {
    scrape: stats.total > 0,
    research: stats.byStatus['Researched'] > 0 || stats.byStatus['Contacted'] > 0,
    outreach: stats.byStatus['Contacted'] > 0,
    send: stats.byStatus['Contacted'] > 0,
    calendly: false, // can't detect without checking settings
  };
  const doneCount = Object.values(completed).filter(Boolean).length;
  const allDone = doneCount === ONBOARDING_STEPS.length;
  if (allDone) return null;

  return (
    <Card style={{ marginBottom: 24, border: '1px solid rgba(232,101,30,0.3)', background: 'linear-gradient(135deg, rgba(232,101,30,0.04), rgba(192,65,15,0.02))' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', marginBottom: 3 }}>
            ⚡ Get started — {doneCount}/{ONBOARDING_STEPS.length} steps done
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Complete these steps to send your first outreach</div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-display)' }}>
          {Math.round((doneCount / ONBOARDING_STEPS.length) * 100)}%
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ width: `${(doneCount / ONBOARDING_STEPS.length) * 100}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: 2, transition: 'width 0.5s ease' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {ONBOARDING_STEPS.map((step) => {
          const done = completed[step.id];
          return (
            <div key={step.id}
              onClick={() => !done && onNavigate(step.action)}
              style={{
                padding: '12px 10px', borderRadius: 8, textAlign: 'center',
                background: done ? 'rgba(22,163,74,0.08)' : 'var(--bg-card)',
                border: `1px solid ${done ? 'rgba(22,163,74,0.3)' : 'var(--border)'}`,
                cursor: done ? 'default' : 'pointer', transition: 'all 0.15s'
              }}
              onMouseEnter={e => { if (!done) e.currentTarget.style.borderColor = 'rgba(232,101,30,0.3)'; }}
              onMouseLeave={e => { if (!done) e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <div style={{ fontSize: 20, marginBottom: 6 }}>{done ? '✅' : step.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: done ? '#16a34a' : 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3 }}>{step.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.3 }}>{step.desc}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── ROI Dashboard Panel ────────────────────────────────────────────
function ROIDashboard({ metrics }) {
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 11 }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
        {payload.map(p => (
          <div key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {p.value}</div>
        ))}
      </div>
    );
    return null;
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
      {/* Reply Rate */}
      <Card style={{ textAlign: 'center', background: metrics.replyRate >= 20 ? 'linear-gradient(135deg, rgba(22,163,74,0.06), transparent)' : undefined }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Reply Rate</div>
        <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-display)', color: metrics.replyRate >= 20 ? '#16a34a' : metrics.replyRate >= 10 ? '#f59e0b' : 'var(--text-primary)', lineHeight: 1 }}>
          {metrics.replyRate}%
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          {metrics.replied} of {metrics.contacted} replied
        </div>
        <div style={{ marginTop: 8, fontSize: 10, padding: '3px 8px', borderRadius: 10, display: 'inline-block',
          background: metrics.replyRate >= 20 ? 'rgba(22,163,74,0.1)' : metrics.replyRate >= 10 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
          color: metrics.replyRate >= 20 ? '#16a34a' : metrics.replyRate >= 10 ? '#f59e0b' : '#ef4444'
        }}>
          {metrics.replyRate >= 20 ? '🔥 Excellent' : metrics.replyRate >= 10 ? '👍 Good' : '📈 Needs work'}
        </div>
      </Card>

      {/* Interest Rate */}
      <Card style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Interest Rate</div>
        <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-display)', color: '#f59e0b', lineHeight: 1 }}>
          {metrics.interestRate}%
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          {metrics.interested} of {metrics.replied} interested
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>Replied → Interested</div>
      </Card>

      {/* Conversion Rate */}
      <Card style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Conversion Rate</div>
        <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-display)', color: '#16a34a', lineHeight: 1 }}>
          {metrics.conversionRate}%
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          {metrics.closedWon} deals closed
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>Contacted → Closed Won</div>
      </Card>

      {/* Pipeline Velocity */}
      <Card style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Avg Response</div>
        <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--accent-primary)', lineHeight: 1 }}>
          {metrics.avgResponseDays ?? '—'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          {metrics.avgResponseDays ? 'days to reply' : 'No replies yet'}
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>Since first contact</div>
      </Card>

      {/* Weekly Activity Chart - spans full width */}
      <Card style={{ gridColumn: '1 / -1' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>
          7-Day Activity
        </div>
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={metrics.weeklyData}>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="contacted" name="Contacted" stroke="var(--accent-primary)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="replied" name="Replied" stroke="#16a34a" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
            <div style={{ width: 12, height: 2, background: 'var(--accent-primary)' }} /> Contacted
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
            <div style={{ width: 12, height: 2, background: '#16a34a' }} /> Replied
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────
export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(getStats());
  const [leads, setLeads] = useState(db.getLeads());
  const [messages, setMessages] = useState(db.getAllMessages());

  useEffect(() => {
    setStats(getStats());
    setLeads(db.getLeads());
    setMessages(db.getAllMessages());
  }, []);

  const metrics = getROIMetrics(leads, messages);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload?.length) return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{payload[0].value} leads</div>
      </div>
    );
    return null;
  };

  const pipelineData = CRM_STATUSES.slice(0, 6).map(s => ({
    name: s, value: stats.byStatus[s] || 0, color: STATUS_COLORS[s]
  }));
  const sourceData = Object.entries(stats.bySource).map(([k, v]) => ({ name: k, value: v }));

  return (
    <div style={{ padding: '0 0 32px' }}>
      <PageHeader
        title="Dashboard"
        subtitle="Reply rates, pipeline metrics & ROI"
        actions={<Button icon={ArrowRight} onClick={() => onNavigate('agents')}>Run AI Pipeline</Button>}
      />

      <div style={{ padding: '0 28px' }}>
        {/* Onboarding — shows until all steps complete */}
        <OnboardingPanel stats={stats} onNavigate={onNavigate} />

        {/* Top stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          <StatCard label="Total Leads" value={stats.total} sub="In database" icon={Users} color="var(--accent-primary)" />
          <StatCard label="Contacted" value={metrics.contacted} sub={`${metrics.replyRate}% reply rate`} icon={Mail} color="#7c3aed" />
          <StatCard label="Replied" value={metrics.replied} sub="Engaged leads" icon={Reply} color="#16a34a" />
          <StatCard label="Closed Won" value={metrics.closedWon} sub={`${metrics.conversionRate}% conversion`} icon={CheckCircle} color="#16a34a" />
        </div>

        {/* ROI Dashboard */}
        {metrics.contacted > 0 && <ROIDashboard metrics={metrics} />}

        {/* Pipeline + Sources */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14, marginBottom: 24 }}>
          <Card>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pipeline Distribution</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={pipelineData} barSize={22}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {pipelineData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 }}>Lead Sources</div>
            {sourceData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={sourceData} cx="50%" cy="50%" outerRadius={60} dataKey="value">
                      {sourceData.map((_, i) => <Cell key={i} fill={['#e8651e', '#c0410f', '#16a34a', '#f59e0b'][i % 4]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {sourceData.map((s, i) => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: ['#e8651e', '#c0410f', '#16a34a', '#f59e0b'][i % 4] }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{s.name}</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <EmptyState title="No sources yet" />}
          </Card>
        </div>

        {/* Recent activity */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Recent Activity</div>
            <Button size="sm" variant="ghost" onClick={() => onNavigate('crm')}>View All</Button>
          </div>
          {stats.recentActivity.length === 0
            ? <EmptyState title="No activity yet" description="Scrape and process leads to see activity" />
            : stats.recentActivity.map(lead => (
              <div key={lead.id} onClick={() => onNavigate('leads', lead)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', cursor: 'pointer', marginBottom: 8, transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(232,101,30,0.3)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${STATUS_COLORS[lead.status]}15`, border: `1px solid ${STATUS_COLORS[lead.status]}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: STATUS_COLORS[lead.status] }}>
                  {lead.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{lead.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lead.category} · {lead.location}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <StatusBadge status={lead.status} />
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{lead.last_action}</div>
                </div>
              </div>
            ))
          }
        </Card>
      </div>
    </div>
  );
}
