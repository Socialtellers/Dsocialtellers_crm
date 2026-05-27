import React, { useState, useEffect } from 'react';
import { Search, Filter, Plus, Globe, Instagram, Phone, MapPin, X, Mail, MessageSquare, ChevronRight, Trash2, RefreshCw } from 'lucide-react';
import { db, CRM_STATUSES, STATUS_COLORS } from '../../lib/store';
import { StatusBadge, QualityBadge, ScorePill, Badge, Card, Button, Input, Select, Tag, PageHeader, EmptyState } from '../ui';
import { runFullPipeline } from '../../agents/pipeline';

export default function LeadsPage({ onNavigate, selectedLead: initLead }) {
  const [leads, setLeads] = useState(db.getLeads());
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterQuality, setFilterQuality] = useState('All');
  const [selected, setSelected] = useState(initLead || null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);

  const refresh = () => setLeads(db.getLeads());

  const filtered = leads.filter(l => {
    const matchSearch = !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.category?.toLowerCase().includes(search.toLowerCase()) || l.location?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'All' || l.status === filterStatus;
    const matchQuality = filterQuality === 'All' || l.brand_quality === filterQuality;
    return matchSearch && matchStatus && matchQuality;
  });

  const runPipeline = async (lead) => {
    setRunning(true);
    setProgress({ step: 'Initializing...', pct: 0 });
    try {
      const result = await runFullPipeline(lead, (p) => setProgress(p));
      db.updateLead(lead.id, {
        ...result.research,
        ...result.copy,
        status: 'Contacted',
        last_action: new Date().toISOString().split('T')[0]
      });
      refresh();
      setSelected(db.getLead(lead.id));
    } catch (e) {
      setProgress({ step: `Error: ${e.message}`, pct: 0, error: true });
    } finally {
      setRunning(false);
      setTimeout(() => setProgress(null), 3000);
    }
  };

  const updateStatus = (leadId, status) => {
    db.updateLead(leadId, { status, last_action: new Date().toISOString().split('T')[0] });
    refresh();
    if (selected?.id === leadId) setSelected(db.getLead(leadId));
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left: List */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
        <div style={{ padding: '24px 24px 16px' }}>
          <PageHeader title="Lead Database" subtitle={`${leads.length} total leads · ${filtered.length} shown`} />

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..." style={{ paddingLeft: 30 }} />
            </div>
            <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              options={['All', ...CRM_STATUSES].map(s => ({ value: s, label: s }))} style={{ width: 130 }} />
            <Select value={filterQuality} onChange={e => setFilterQuality(e.target.value)}
              options={['All', 'high', 'medium', 'low'].map(s => ({ value: s, label: s === 'All' ? 'All Quality' : s.charAt(0).toUpperCase() + s.slice(1) }))} style={{ width: 120 }} />
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
          {filtered.length === 0 ? (
            <EmptyState icon={Search} title="No leads found" description="Try adjusting your filters" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(lead => (
                <div key={lead.id}
                  onClick={() => setSelected(lead)}
                  style={{
                    padding: '14px 16px', borderRadius: 10,
                    background: selected?.id === lead.id ? 'var(--accent-glow)' : 'var(--bg-card)',
                    border: `1px solid ${selected?.id === lead.id ? 'rgba(232,101,30,0.3)' : 'var(--border)'}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 14
                  }}
                  onMouseEnter={e => { if (selected?.id !== lead.id) e.currentTarget.style.borderColor = 'rgba(232,101,30,0.2)'; }}
                  onMouseLeave={e => { if (selected?.id !== lead.id) e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                    background: `${STATUS_COLORS[lead.status] || '#e8651e'}15`,
                    border: `1px solid ${STATUS_COLORS[lead.status] || '#e8651e'}25`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14,
                    color: STATUS_COLORS[lead.status] || '#e8651e'
                  }}>
                    {lead.name.charAt(0)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{lead.name}</span>
                      {lead.brand_quality && <QualityBadge quality={lead.brand_quality} />}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lead.category}</span>
                      <span style={{ color: 'var(--border)' }}>·</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <MapPin size={9} /> {lead.location}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                    <StatusBadge status={lead.status} />
                    {lead.score && <ScorePill score={lead.score} />}
                  </div>
                  <ChevronRight size={14} color="var(--text-muted)" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Detail */}
      {selected && (
        <div style={{ width: 400, flexShrink: 0, overflow: 'auto', background: 'var(--bg-surface)' }} className="animate-slideIn">
          <LeadDetail
            lead={selected}
            onClose={() => setSelected(null)}
            onRunPipeline={runPipeline}
            onStatusChange={updateStatus}
            onNavigate={onNavigate}
            running={running}
            progress={progress}
          />
        </div>
      )}
    </div>
  );
}

function LeadDetail({ lead, onClose, onRunPipeline, onStatusChange, onNavigate, running, progress }) {
  const msgs = db.getMessages(lead.id);

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginBottom: 6 }}>{lead.name}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <StatusBadge status={lead.status} />
            {lead.brand_quality && <QualityBadge quality={lead.brand_quality} />}
            {lead.score && <Badge label={`Score: ${lead.score}`} color="#c0410f" />}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Contact info */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Contact Info</div>
          {[
            lead.website && { icon: Globe, label: 'Website', value: lead.website, href: lead.website },
            lead.instagram && { icon: Instagram, label: 'Instagram', value: lead.instagram },
            lead.phone && { icon: Phone, label: 'Phone', value: lead.phone },
            { icon: MapPin, label: 'Location', value: lead.location },
          ].filter(Boolean).map(({ icon: Icon, label, value, href }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
              <Icon size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 55, flexShrink: 0 }}>{label}</span>
              {href ? (
                <a href={href} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent-primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</a>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
              )}
            </div>
          ))}
        </div>

        {/* Status change */}
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Update Status</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {CRM_STATUSES.map(s => (
              <button key={s} onClick={() => onStatusChange(lead.id, s)} style={{
                fontSize: 10, padding: '4px 8px', borderRadius: 5, cursor: 'pointer', fontFamily: 'var(--font-mono)',
                background: lead.status === s ? `${STATUS_COLORS[s]}20` : 'var(--bg-card)',
                border: `1px solid ${lead.status === s ? STATUS_COLORS[s] : 'var(--border)'}`,
                color: lead.status === s ? STATUS_COLORS[s] : 'var(--text-muted)',
                transition: 'all 0.15s'
              }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* AI Research */}
        {lead.business_summary && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>AI Research</div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>{lead.business_summary}</p>
            {lead.marketing_weaknesses?.length > 0 && (
              <>
                <div style={{ fontSize: 10, color: '#ef4444', marginBottom: 5 }}>⚠ Weaknesses</div>
                {lead.marketing_weaknesses.map((w, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>· {w}</div>
                ))}
              </>
            )}
            {lead.growth_opportunities?.length > 0 && (
              <>
                <div style={{ fontSize: 10, color: '#16a34a', marginBottom: 5, marginTop: 10 }}>✦ Opportunities</div>
                {lead.growth_opportunities.map((o, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>· {o}</div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Generated Copy */}
        {lead.email_body && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Generated Outreach</div>
            <div style={{ fontSize: 10, color: '#e8651e', marginBottom: 4 }}>✉ Email Subject</div>
            <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 10, padding: '6px 10px', background: 'var(--bg-input)', borderRadius: 5 }}>{lead.email_subject}</div>
            {lead.whatsapp_message && (
              <>
                <div style={{ fontSize: 10, color: '#16a34a', marginBottom: 4 }}>💬 WhatsApp</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '6px 10px', background: 'var(--bg-input)', borderRadius: 5, lineHeight: 1.5 }}>{lead.whatsapp_message}</div>
              </>
            )}
            <Button variant="secondary" size="sm" style={{ width: '100%', marginTop: 10 }}
              onClick={() => onNavigate('outreach', lead)}>
              <Mail size={12} /> View Full Outreach
            </Button>
          </div>
        )}

        {/* Message history */}
        {msgs.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Message History ({msgs.length})</div>
            {msgs.map(m => (
              <div key={m.id} style={{
                padding: '8px 10px', borderRadius: 6, marginBottom: 6,
                background: m.direction === 'inbound' ? 'rgba(16,185,129,0.08)' : 'rgba(232,101,30,0.06)',
                border: `1px solid ${m.direction === 'inbound' ? 'rgba(16,185,129,0.2)' : 'rgba(232,101,30,0.15)'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: m.direction === 'inbound' ? '#16a34a' : '#e8651e', fontFamily: 'var(--font-mono)' }}>
                    {m.type.toUpperCase()} · {m.direction}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(m.timestamp).toLocaleDateString()}
                  </span>
                </div>
                {m.subject && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{m.subject}</div>}
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{m.content.slice(0, 80)}...</div>
              </div>
            ))}
          </div>
        )}

        {/* Tags */}
        {lead.tags?.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Tags</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {lead.tags.map(t => <Tag key={t} label={t} />)}
            </div>
          </div>
        )}

        {/* Run Pipeline */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          {progress && (
            <div style={{
              padding: '10px 12px', borderRadius: 7, marginBottom: 10,
              background: progress.error ? 'rgba(239,68,68,0.08)' : 'rgba(232,101,30,0.06)',
              border: `1px solid ${progress.error ? 'rgba(239,68,68,0.2)' : 'rgba(232,101,30,0.15)'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: progress.error ? '#ef4444' : 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{progress.step}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{progress.pct}%</span>
              </div>
              <div style={{ height: 3, background: 'var(--border)', borderRadius: 2 }}>
                <div style={{ width: `${progress.pct}%`, height: '100%', background: progress.error ? '#ef4444' : 'var(--accent-primary)', borderRadius: 2, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )}
          <Button
            onClick={() => onRunPipeline(lead)}
            loading={running}
            style={{ width: '100%' }}
          >
            <RefreshCw size={13} /> Run Full AI Pipeline
          </Button>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
            Research → Strategy → Copy → CRM Update
          </div>
        </div>
      </div>
    </div>
  );
}
