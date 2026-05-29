import React, { useState } from 'react';
import { MapPin, Globe, Phone, Mail, Instagram, Star } from 'lucide-react';
import { db, CRM_STATUSES, STATUS_COLORS } from '../../lib/store';
import { QualityBadge, PageHeader } from '../ui';

export default function CRMPage({ onNavigate }) {
  const [leads, setLeads] = useState(db.getLeads());
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const byStatus = CRM_STATUSES.reduce((acc, s) => ({
    ...acc, [s]: leads.filter(l => l.status === s)
  }), {});

  const handleDrop = (status) => {
    if (dragging && dragging.status !== status) {
      db.updateLead(dragging.id, { status, last_action: new Date().toISOString().split('T')[0] });
      setLeads(db.getLeads());
    }
    setDragging(null);
    setDragOver(null);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader title="CRM Pipeline" subtitle="Drag & drop leads across pipeline stages" />
      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
        <div style={{ display: 'flex', gap: 12, minWidth: 'max-content', height: '100%' }}>
          {CRM_STATUSES.map(status => {
            const color = STATUS_COLORS[status];
            const statusLeads = byStatus[status] || [];
            const isOver = dragOver === status;
            return (
              <div key={status}
                onDragOver={e => { e.preventDefault(); setDragOver(status); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => handleDrop(status)}
                style={{
                  width: 240, flexShrink: 0,
                  background: isOver ? `${color}08` : 'var(--bg-surface)',
                  border: `1px solid ${isOver ? color + '40' : 'var(--border)'}`,
                  borderRadius: 10, display: 'flex', flexDirection: 'column',
                  transition: 'all 0.2s', maxHeight: 'calc(100vh - 160px)'
                }}>
                <div style={{
                  padding: '12px 14px', borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: `${color}08`, borderRadius: '10px 10px 0 0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{status}</span>
                  </div>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                    background: `${color}20`, color, padding: '2px 7px', borderRadius: 10 }}>
                    {statusLeads.length}
                  </span>
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: '10px' }}>
                  {statusLeads.map(lead => (
                    <KanbanCard key={lead.id} lead={lead} color={color}
                      onDragStart={() => setDragging(lead)}
                      onDragEnd={() => { setDragging(null); setDragOver(null); }}
                      onClick={() => onNavigate('leads', lead)} />
                  ))}
                  {statusLeads.length === 0 && (
                    <div style={{ height: 60, border: `2px dashed ${color}25`, borderRadius: 7,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, color: 'var(--text-muted)' }}>
                      Drop here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KanbanCard({ lead, color, onDragStart, onDragEnd, onClick }) {
  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onClick}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '10px 12px', marginBottom: 8, cursor: 'grab',
        transition: 'border-color 0.15s, transform 0.15s', userSelect: 'none' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}40`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}>

      {/* Name + quality */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {lead.name}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <MapPin size={8} /> {lead.location}
          </div>
        </div>
        {lead.brand_quality && (
          <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginLeft: 6, marginTop: 3,
            background: { high: '#16a34a', medium: '#f59e0b', low: '#ef4444' }[lead.brand_quality] }} />
        )}
      </div>

      {/* Category + rating */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 7 }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--bg-surface)',
          padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>
          {lead.category}
        </span>
        {lead.rating && (
          <span style={{ fontSize: 9, color: '#f59e0b', background: 'rgba(245,158,11,0.1)',
            padding: '2px 6px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Star size={8} fill="#f59e0b" /> {lead.rating}
          </span>
        )}
      </div>

      {/* Contact info */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 7, flexWrap: 'wrap' }}>
        {lead.phone && (
          <span title={lead.phone} style={{ fontSize: 9, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Phone size={8} /> {lead.phone.slice(0, 13)}
          </span>
        )}
        {lead.email && (
          <span title={lead.email} style={{ fontSize: 9, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Mail size={8} /> email
          </span>
        )}
        {lead.website && (
          <span title={lead.website} style={{ fontSize: 9, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Globe size={8} /> web
          </span>
        )}
        {lead.instagram && (
          <span title={lead.instagram} style={{ fontSize: 9, color: '#ec4899', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Instagram size={8} /> ig
          </span>
        )}
      </div>

      {/* Score bar */}
      {lead.score && (
        <div style={{ height: 2, background: 'var(--border)', borderRadius: 1, marginBottom: 5 }}>
          <div style={{ width: `${lead.score}%`, height: '100%', borderRadius: 1,
            background: lead.score >= 70 ? '#16a34a' : lead.score >= 45 ? '#f59e0b' : '#ef4444' }} />
        </div>
      )}

      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
        {lead.last_action}
      </div>
    </div>
  );
}
