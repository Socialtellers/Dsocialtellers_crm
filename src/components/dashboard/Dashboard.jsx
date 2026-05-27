import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, CheckCircle, Target, Mail, MessageSquare, ArrowRight, Bot } from 'lucide-react';
import { db, getStats, STATUS_COLORS, CRM_STATUSES } from '../../lib/store';
import { StatCard, Card, StatusBadge, PageHeader, Button, EmptyState } from '../ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(getStats());

  useEffect(() => { setStats(getStats()); }, []);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload?.length) return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{payload[0].value} leads</div>
      </div>
    );
    return null;
  };

  // Empty state when no leads
  if (stats.total === 0) {
    return (
      <div style={{ padding: '0 0 32px' }}>
        <PageHeader title="Intelligence Overview" subtitle="Start by scraping leads with the AI Agents" />
        <div style={{ padding: '0 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
            <StatCard label="Total Leads" value="0" sub="No leads yet" icon={Users} color="var(--accent-primary)" />
            <StatCard label="Closed Won" value="0" sub="0% conversion" icon={CheckCircle} color="#16a34a" />
            <StatCard label="Interested" value="0" sub="Hot leads" icon={TrendingUp} color="#f59e0b" />
            <StatCard label="Avg Score" value="—" sub="Quality index" icon={Target} color="var(--accent-secondary)" />
          </div>
          <Card style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Bot size={48} color="var(--accent-primary)" style={{ marginBottom: 20, opacity: 0.6 }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
              No leads yet
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
              Use the AI Agents to scrape businesses from Google Maps, Instagram or LinkedIn — then run the pipeline to generate personalized outreach.
            </div>
            <Button icon={ArrowRight} onClick={() => onNavigate('agents')}>
              Go to AI Agents
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const pipelineData = CRM_STATUSES.slice(0, 6).map(s => ({
    name: s, value: stats.byStatus[s] || 0, color: STATUS_COLORS[s]
  }));

  const sourceData = Object.entries(stats.bySource).map(([k, v]) => ({ name: k, value: v }));

  return (
    <div style={{ padding: '0 0 32px' }}>
      <PageHeader
        title="Intelligence Overview"
        subtitle="Real-time pipeline metrics & AI agent status"
        actions={
          <Button icon={ArrowRight} onClick={() => onNavigate('agents')}>
            Run AI Pipeline
          </Button>
        }
      />

      <div style={{ padding: '0 28px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          <StatCard label="Total Leads" value={stats.total} sub="In database" icon={Users} color="var(--accent-primary)" />
          <StatCard label="Closed Won" value={stats.closedWon} sub={`${Math.round((stats.closedWon / stats.total) * 100)}% conversion`} icon={CheckCircle} color="#16a34a" />
          <StatCard label="Interested" value={stats.interested} sub="Hot leads" icon={TrendingUp} color="#f59e0b" />
          <StatCard label="Avg Score" value={stats.avgScore || '—'} sub="Quality index" icon={Target} color="var(--accent-secondary)" />
        </div>

        {/* Charts */}
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

        {/* Recent activity + quality */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Brand Quality Split</div>
              {[['high', '#16a34a', stats.byQuality.high], ['medium', '#f59e0b', stats.byQuality.medium], ['low', '#ef4444', stats.byQuality.low]].map(([q, c, n]) => (
                <div key={q} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
                    <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{q}</span>
                    <span style={{ color: c, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{n}</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: stats.total ? `${(n / stats.total) * 100}%` : '0%', height: '100%', background: c, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </Card>

            <Card style={{ background: 'linear-gradient(135deg, rgba(232,101,30,0.05), rgba(192,65,15,0.05))' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Outreach Channels</div>
              {[
                { label: 'Email', icon: Mail, count: db.getAllMessages().filter(m => m.type === 'email').length, color: '#e8651e' },
                { label: 'WhatsApp', icon: MessageSquare, count: db.getAllMessages().filter(m => m.type === 'whatsapp').length, color: '#16a34a' },
              ].map(({ label, icon: Icon, count, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: `${color}15`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={13} color={color} />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1 }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'var(--font-display)' }}>{count}</span>
                </div>
              ))}
              <Button variant="secondary" size="sm" style={{ width: '100%', marginTop: 6 }} onClick={() => onNavigate('outreach')}>
                View All Messages
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
