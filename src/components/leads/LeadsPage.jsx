import React, { useState } from 'react';
import { Search, Globe, Instagram, Phone, MapPin, X, Mail, ChevronRight, Trash2, RefreshCw, Pencil, Check, Plus, Star } from 'lucide-react';
import { db, CRM_STATUSES, STATUS_COLORS } from '../../lib/store';
import { StatusBadge, QualityBadge, ScorePill, Badge, Card, Button, Input, Select, Tag, PageHeader, EmptyState } from '../ui';
import { runFullPipeline } from '../../agents/pipeline';
import { settings } from '../../lib/settings';

export default function LeadsPage({ onNavigate, selectedLead: initLead }) {
  const [leads, setLeads] = useState(db.getLeads());
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterQuality, setFilterQuality] = useState('All');
  const [selected, setSelected] = useState(initLead || null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

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
      const result = await runFullPipeline(lead, async (p) => {
        setProgress(p);
        // Set status to Researched mid-pipeline as soon as research is done
        if (p.statusUpdate === 'Researched') {
          await db.updateLead(lead.id, {
            status: 'Researched',
            last_action: new Date().toISOString().split('T')[0]
          });
          refresh();
        }
      }, settings.getCalendly());
      // Final update — save all research + copy + set Contacted
      await db.updateLead(lead.id, {
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

  const deleteLead = async (leadId) => {
    await db.deleteLead(leadId);
    if (selected?.id === leadId) setSelected(null);
    refresh();
  };

  const saveLead = async (leadId, updates) => {
    await db.updateLead(leadId, updates);
    refresh();
    setSelected(db.getLead(leadId));
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

            <button onClick={() => setShowAddForm(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                background: 'var(--accent-primary)', border: 'none', borderRadius: 8,
                color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <Plus size={13} /> Add Lead
            </button>
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

                  {/* Delete button on row */}
                  <button
                    onClick={e => { e.stopPropagation(); deleteLead(lead.id); }}
                    title="Delete lead"
                    style={{
                      background: 'none', border: 'none', padding: 4, cursor: 'pointer',
                      color: 'var(--text-muted)', borderRadius: 5, flexShrink: 0,
                      transition: 'color 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <Trash2 size={13} />
                  </button>

                  <ChevronRight size={14} color="var(--text-muted)" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Lead Modal */}
      {showAddForm && (
        <AddLeadModal onClose={() => setShowAddForm(false)} onSave={async (data) => {
          const newLead = {
            id: `manual_${Date.now()}`,
            status: 'New',
            source: 'Manual',
            last_action: new Date().toISOString().split('T')[0],
            tags: [],
            ...data
          };
          await db.saveLead(newLead);
          refresh();
          setShowAddForm(false);
        }} />
      )}

      {/* Right: Detail */}
      {selected && (
        <div style={{ width: 420, flexShrink: 0, overflow: 'auto', background: 'var(--bg-surface)' }} className="animate-slideIn">
          <LeadDetail
            lead={selected}
            onClose={() => setSelected(null)}
            onRunPipeline={runPipeline}
            onStatusChange={updateStatus}
            onDelete={deleteLead}
            onSave={saveLead}
            onNavigate={onNavigate}
            running={running}
            progress={progress}
          />
        </div>
      )}
    </div>
  );
}

const EDIT_FIELDS = [
  { key: 'name',      label: 'Business Name', type: 'text' },
  { key: 'category',  label: 'Category',      type: 'text' },
  { key: 'location',  label: 'Location',      type: 'text' },
  { key: 'website',   label: 'Website',       type: 'text' },
  { key: 'instagram', label: 'Instagram',     type: 'text' },
  { key: 'phone',     label: 'Phone',         type: 'text' },
  { key: 'email',     label: 'Email',         type: 'text' },
  { key: 'notes',     label: 'Notes',         type: 'textarea' },
];

function LeadDetail({ lead, onClose, onRunPipeline, onStatusChange, onDelete, onSave, onNavigate, running, progress }) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const msgs = db.getMessages(lead.id);

  const startEdit = () => {
    setEditData({
      name: lead.name || '',
      category: lead.category || '',
      location: lead.location || '',
      website: lead.website || '',
      instagram: lead.instagram || '',
      phone: lead.phone || '',
      email: lead.email || '',
      notes: lead.notes || '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    await onSave(lead.id, editData);
    setEditing(false);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginBottom: 6 }}>{lead.name}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <StatusBadge status={lead.status} />
            {lead.brand_quality && <QualityBadge quality={lead.brand_quality} />}
            {lead.score && <Badge label={`Score: ${lead.score}`} color="#c0410f" />}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, marginLeft: 10, flexShrink: 0 }}>
          {/* Edit button */}
          <button
            onClick={() => editing ? setEditing(false) : startEdit()}
            title={editing ? 'Cancel edit' : 'Edit lead'}
            style={{
              background: editing ? 'rgba(232,101,30,0.1)' : 'var(--bg-card)',
              border: `1px solid ${editing ? 'rgba(232,101,30,0.3)' : 'var(--border)'}`,
              color: editing ? 'var(--accent-primary)' : 'var(--text-muted)',
              borderRadius: 7, padding: '6px 8px', cursor: 'pointer', transition: 'all 0.15s'
            }}
          >
            <Pencil size={13} />
          </button>

          {/* Delete button */}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete lead"
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', borderRadius: 7, padding: '6px 8px',
                cursor: 'pointer', transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <Trash2 size={13} />
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => onDelete(lead.id)}
                style={{
                  background: '#ef4444', border: '1px solid #ef4444',
                  color: '#fff', borderRadius: 7, padding: '4px 10px',
                  cursor: 'pointer', fontSize: 11, fontWeight: 600
                }}
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', borderRadius: 7, padding: '4px 8px',
                  cursor: 'pointer', fontSize: 11
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Close button */}
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
            <X size={16} />
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── EDIT FORM ── */}
        {editing ? (
          <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(232,101,30,0.3)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>
              Editing Lead
            </div>
            {EDIT_FIELDS.map(({ key, label, type }) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{label}</div>
                {type === 'textarea' ? (
                  <textarea
                    value={editData[key]}
                    onChange={e => setEditData(d => ({ ...d, [key]: e.target.value }))}
                    rows={3}
                    style={{
                      width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--text-primary)',
                      fontFamily: 'var(--font-body)', resize: 'vertical', outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                ) : (
                  <input
                    type="text"
                    value={editData[key]}
                    onChange={e => setEditData(d => ({ ...d, [key]: e.target.value }))}
                    style={{
                      width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--text-primary)',
                      fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box'
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                onClick={saveEdit}
                style={{
                  flex: 1, background: 'var(--accent-primary)', border: 'none',
                  color: '#fff', borderRadius: 7, padding: '9px 0', fontSize: 12,
                  fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 6
                }}
              >
                <Check size={13} /> Save Changes
              </button>
              <button
                onClick={() => setEditing(false)}
                style={{
                  flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', borderRadius: 7, padding: '9px 0',
                  fontSize: 12, cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Contact info */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Contact Info</div>
              {[
                lead.website   && { icon: Globe,     label: 'Website',   value: lead.website,   href: lead.website },
                lead.instagram && { icon: Instagram,  label: 'Instagram', value: lead.instagram },
                lead.phone     && { icon: Phone,      label: 'Phone',     value: lead.phone },
                lead.email     && { icon: Mail,       label: 'Email',     value: lead.email },
                               { icon: MapPin,      label: 'Location',  value: lead.location },
              ].filter(Boolean).map(({ icon: Icon, label, value, href }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                  <Icon size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 58, flexShrink: 0 }}>{label}</span>
                  {href ? (
                    <a href={href} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent-primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</a>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
                  )}
                </div>
              ))}
              {lead.notes && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Notes</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{lead.notes}</div>
                </div>
              )}
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
          </>
        )}

        {/* Run Pipeline */}
        {!editing && (
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
            <Button onClick={() => onRunPipeline(lead)} loading={running} style={{ width: '100%' }}>
              <RefreshCw size={13} /> Run Full AI Pipeline
            </Button>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
              Research → Strategy → Copy → CRM Update
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddLeadModal({ onClose, onSave }) {
  const [data, setData] = useState({
    name: '', category: '', location: 'Dubai', website: '',
    instagram: '', phone: '', email: '', notes: '', rating: ''
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setData(d => ({ ...d, [k]: v }));

  const handleSave = async () => {
    if (!data.name) return alert('Business name is required');
    setSaving(true);
    await onSave(data);
    setSaving(false);
  };

  const fields = [
    { key: 'name', label: 'Business Name *', placeholder: 'e.g. GymNation' },
    { key: 'category', label: 'Category', placeholder: 'e.g. Gym, Cafe, Salon' },
    { key: 'location', label: 'Location', placeholder: 'e.g. Dubai Marina' },
    { key: 'website', label: 'Website', placeholder: 'https://...' },
    { key: 'instagram', label: 'Instagram', placeholder: '@handle' },
    { key: 'phone', label: 'Phone', placeholder: '+971...' },
    { key: 'email', label: 'Email', placeholder: 'info@...' },
    { key: 'rating', label: 'Google Rating', placeholder: 'e.g. 3.5' },
    { key: 'notes', label: 'Notes', placeholder: 'Any notes...', textarea: true },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflow: 'auto', border: '1px solid var(--border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
              Add Lead Manually
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Enter the business details below
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Fields */}
        <div style={{ padding: '16px 24px' }}>
          {fields.map(({ key, label, placeholder, textarea }) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                {label}
              </label>
              {textarea ? (
                <textarea value={data[key]} onChange={e => set(key, e.target.value)}
                  placeholder={placeholder} rows={3}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
                    borderRadius: 7, padding: '8px 10px', fontSize: 12, color: 'var(--text-primary)',
                    fontFamily: 'var(--font-body)', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
              ) : (
                <input type="text" value={data[key]} onChange={e => set(key, e.target.value)}
                  placeholder={placeholder}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
                    borderRadius: 7, padding: '8px 10px', fontSize: 12, color: 'var(--text-primary)',
                    fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'} />
              )}
            </div>
          ))}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ flex: 1, background: 'var(--accent-primary)', border: 'none', borderRadius: 8,
                color: '#fff', padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Saving...' : 'Add Lead'}
            </button>
            <button onClick={onClose}
              style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text-secondary)', padding: '10px 0', fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
