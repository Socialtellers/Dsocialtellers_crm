import React, { useState } from 'react';
import { Mail, MessageSquare, Send, Copy, Check, ChevronDown, User, Phone, Globe, Instagram, MapPin, Star, Pencil, Trash2, X } from 'lucide-react';
import { db } from '../../lib/store';
import { settings } from '../../lib/settings';
import { Button, Card, Badge, PageHeader, EmptyState } from '../ui';

export default function OutreachPage({ selectedLead, onNavigate }) {
  const [tab, setTab] = useState('all');
  const [copied, setCopied] = useState(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingWA, setEditingWA] = useState(false);
  const [emailDraft, setEmailDraft] = useState({});
  const [waDraft, setWaDraft] = useState('');
  const leads = db.getLeads().filter(l => l.email_body || l.whatsapp_message);
  const allMessages = db.getAllMessages();

  const displayLead = selectedLead && leads.find(l => l.id === selectedLead.id) ? selectedLead : null;
  const [activeLead, setActiveLead] = useState(displayLead || (leads[0] || null));

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const sendMessage = async (lead, type) => {
    if (type === 'email') {
      if (!lead.website && !lead.email && !lead.contact_email) {
        // We need an email address — try to use a contact field
      }
      // Determine recipient email. Many scraped leads won't have email — prompt if missing.
      let recipient = lead.email || lead.contact_email;
      if (!recipient) {
        recipient = window.prompt(`No email on file for ${lead.name}. Enter recipient email:`);
        if (!recipient) return;
      }
      try {
        const res = await fetch((import.meta.env.VITE_BACKEND_URL || '') + '/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: recipient,
            subject: lead.email_subject,
            body: lead.email_body,
            leadId: lead.id,
            calendlyLink: settings.getCalendly()
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Send failed');
        await db.updateLead(lead.id, { status: 'Contacted', channel: 'Email', last_action: new Date().toISOString().split('T')[0] });
        alert(`✓ Email sent to ${recipient}`);
      } catch (e) {
        alert(`✗ Email failed: ${e.message}`);
      }
      return;
    }

    // WhatsApp — send via Meta Cloud API
    let phone = lead.phone;
    if (!phone) {
      phone = window.prompt(`No phone number on file for ${lead.name}. Enter WhatsApp number (e.g. +971501234567):`);
      if (!phone) return;
    }
    try {
      const res = await fetch((import.meta.env.VITE_BACKEND_URL || '') + '/api/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phone,
          message: lead.whatsapp_message,
          leadId: lead.id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      await db.updateLead(lead.id, { status: 'Contacted', channel: 'WhatsApp', last_action: new Date().toISOString().split('T')[0] });
      alert(`✓ WhatsApp sent to ${phone}`);
    } catch (e) {
      alert(`✗ WhatsApp failed: ${e.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Sidebar: leads with copy */}
      <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px 20px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Outreach Center</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{leads.length} leads with generated copy</div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '10px' }}>
          {leads.length === 0 ? (
            <EmptyState icon={Send} title="No copy generated" description="Run AI pipeline on leads first" />
          ) : leads.map(lead => (
            <div key={lead.id}
              onClick={() => setActiveLead(lead)}
              style={{
                padding: '10px 12px', borderRadius: 8, marginBottom: 6, cursor: 'pointer',
                background: activeLead?.id === lead.id ? 'var(--accent-glow)' : 'var(--bg-card)',
                border: `1px solid ${activeLead?.id === lead.id ? 'rgba(232,101,30,0.3)' : 'var(--border)'}`,
                transition: 'all 0.15s', position: 'relative'
              }}
            >
              <button
                onClick={e => { e.stopPropagation(); deleteLead(lead.id); }}
                style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none',
                  cursor: 'pointer', color: 'var(--text-muted)', padding: 2, borderRadius: 4 }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                title="Delete lead">
                <Trash2 size={11} />
              </button>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, paddingRight: 16 }}>{lead.name}</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {lead.email_body && <span style={{ fontSize: 9, color: '#e8651e', background: 'rgba(232,101,30,0.08)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>✉ Email</span>}
                {lead.whatsapp_message && <span style={{ fontSize: 9, color: '#16a34a', background: 'rgba(16,185,129,0.08)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>💬 WhatsApp</span>}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{lead.category} · {lead.location}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main: message display */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeLead ? (
          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {activeLead.name}
                </h2>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{activeLead.category} · {activeLead.location}</div>
              </div>
            </div>

            {/* Contact Info */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Contact Info</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeLead.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Phone size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 64, flexShrink: 0 }}>Phone</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{activeLead.phone}</span>
                  </div>
                )}
                {activeLead.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Mail size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 64, flexShrink: 0 }}>Email</span>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{activeLead.email}</span>
                  </div>
                )}
                {activeLead.website && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Globe size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 64, flexShrink: 0 }}>Website</span>
                    <a href={activeLead.website} target="_blank" rel="noreferrer"
                      style={{ fontSize: 13, color: 'var(--accent-primary)', textDecoration: 'none' }}>
                      {activeLead.website.replace('https://','').replace('http://','').split('/')[0]}
                    </a>
                  </div>
                )}
                {activeLead.instagram && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Instagram size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 64, flexShrink: 0 }}>Instagram</span>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{activeLead.instagram}</span>
                  </div>
                )}
                {activeLead.location && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <MapPin size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 64, flexShrink: 0 }}>Location</span>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{activeLead.location}</span>
                  </div>
                )}
                {activeLead.notes && (
                  <div style={{ marginTop: 4, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Notes</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{activeLead.notes}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Email */}
            {activeLead.email_body && (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(232,101,30,0.1)', border: '1px solid rgba(232,101,30,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Mail size={13} color="#e8651e" />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Cold Email</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setEmailDraft({ subject: activeLead.email_subject, body: activeLead.email_body }); setEditingEmail(true); }}
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--text-muted)' }}
                      title="Edit email">
                      <Pencil size={12} />
                    </button>
                    <button onClick={async () => { await db.updateLead(activeLead.id, { email_subject: null, email_body: null }); setActiveLead({ ...activeLead, email_subject: null, email_body: null }); }}
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--text-muted)' }}
                      onMouseEnter={e => e.currentTarget.style.color='#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}
                      title="Delete email">
                      <Trash2 size={12} />
                    </button>
                    <Button size="sm" variant="secondary" onClick={() => copy(activeLead.email_body, 'email_body')} icon={copied === 'email_body' ? Check : Copy}>
                      {copied === 'email_body' ? 'Copied!' : 'Copy'}
                    </Button>
                    <Button size="sm" onClick={() => sendMessage(activeLead, 'email')} icon={Send}>
                      Send Email
                    </Button>
                  </div>
                </div>

                {editingEmail ? (
                  <div style={{ background: 'rgba(232,101,30,0.05)', border: '1px solid rgba(232,101,30,0.3)', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>EDITING EMAIL</div>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Subject</div>
                      <input value={emailDraft.subject || ''} onChange={e => setEmailDraft(d => ({...d, subject: e.target.value}))}
                        style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Body</div>
                      <textarea value={emailDraft.body || ''} onChange={e => setEmailDraft(d => ({...d, body: e.target.value}))}
                        rows={8} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--text-primary)', outline: 'none', resize: 'vertical', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={async () => { await db.updateLead(activeLead.id, { email_subject: emailDraft.subject, email_body: emailDraft.body }); setActiveLead({...activeLead, email_subject: emailDraft.subject, email_body: emailDraft.body}); setEditingEmail(false); }}
                        style={{ flex: 1, background: 'var(--accent-primary)', border: 'none', borderRadius: 7, padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
                        Save Changes
                      </button>
                      <button onClick={() => setEditingEmail(false)}
                        style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 0', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>SUBJECT LINE</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{activeLead.email_subject}</div>
                </div>
                )}

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>BODY</div>
                  {(() => {
                    const link = settings.getCalendly();
                    let body = activeLead.email_body;
                    if (link) body = body.replace(link, '').trim();

                    // Split body at "Thanks," to place button before sign-off
                    const idx = body.search(/Thanks,/i);
                    const beforeSignoff = idx >= 0 ? body.slice(0, idx).trim() : body;
                    const signoff = idx >= 0 ? body.slice(idx) : '';

                    const BookButton = link ? (
                      <div style={{ margin: '14px 0' }}>
                        <a href={link} target="_blank" rel="noreferrer"
                          style={{
                            display: 'inline-block', background: 'var(--accent-primary)', color: '#fff',
                            textDecoration: 'none', padding: '12px 24px', borderRadius: 8,
                            fontWeight: 600, fontSize: 14
                          }}>
                          📅 Book a Call
                        </a>
                      </div>
                    ) : null;

                    return (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                        <div style={{ whiteSpace: 'pre-line' }}>{beforeSignoff}</div>
                        {BookButton}
                        {signoff && <div style={{ whiteSpace: 'pre-line' }}>{signoff}</div>}
                      </div>
                    );
                  })()}
                </div>
              </Card>
            )}

            {/* WhatsApp */}
            {activeLead.whatsapp_message && (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MessageSquare size={13} color="#16a34a" />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>WhatsApp Message</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setWaDraft(activeLead.whatsapp_message); setEditingWA(true); }}
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--text-muted)' }}
                      title="Edit message">
                      <Pencil size={12} />
                    </button>
                    <button onClick={async () => { await db.updateLead(activeLead.id, { whatsapp_message: null }); setActiveLead({...activeLead, whatsapp_message: null}); }}
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--text-muted)' }}
                      onMouseEnter={e => e.currentTarget.style.color='#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}
                      title="Delete message">
                      <Trash2 size={12} />
                    </button>
                    <Button size="sm" variant="secondary" onClick={() => copy(activeLead.whatsapp_message, 'wa')} icon={copied === 'wa' ? Check : Copy}>
                      {copied === 'wa' ? 'Copied!' : 'Copy'}
                    </Button>
                    <Button size="sm" style={{ background: '#16a34a', borderColor: '#16a34a', color: '#fff' }} onClick={() => sendMessage(activeLead, 'whatsapp')} icon={Send}>
                      Send WhatsApp
                    </Button>
                  </div>
                </div>

                {editingWA && (
                  <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: '#16a34a', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>EDITING WHATSAPP</div>
                    <textarea value={waDraft} onChange={e => setWaDraft(e.target.value)}
                      rows={5} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--text-primary)', outline: 'none', resize: 'vertical', fontFamily: 'var(--font-body)', boxSizing: 'border-box', marginBottom: 10 }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={async () => { await db.updateLead(activeLead.id, { whatsapp_message: waDraft }); setActiveLead({...activeLead, whatsapp_message: waDraft}); setEditingWA(false); }}
                        style={{ flex: 1, background: '#16a34a', border: 'none', borderRadius: 7, padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
                        Save Changes
                      </button>
                      <button onClick={() => setEditingWA(false)}
                        style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 0', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* WhatsApp bubble preview */}
                <div style={{ background: '#0d1a0d', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 10, padding: '16px' }}>
                  <div style={{ fontSize: 10, color: 'rgba(16,185,129,0.6)', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>
                    PREVIEW
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{
                      background: '#005c4b', borderRadius: '12px 12px 0 12px',
                      padding: '10px 14px', maxWidth: '85%'
                    }}>
                      <div style={{ fontSize: 13, color: '#e9edef', lineHeight: 1.5 }}>{activeLead.whatsapp_message}</div>
                      <div style={{ fontSize: 10, color: 'rgba(233,237,239,0.5)', textAlign: 'right', marginTop: 5 }}>
                        {new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} ✓✓
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Message Log */}
            {db.getMessages(activeLead.id).length > 0 && (
              <Card>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 14 }}>Message History</div>
                {db.getMessages(activeLead.id).map(m => (
                  <div key={m.id} style={{
                    display: 'flex', gap: 10, padding: '8px 0',
                    borderBottom: '1px solid var(--border)'
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                      background: m.direction === 'inbound' ? 'rgba(16,185,129,0.1)' : 'rgba(232,101,30,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {m.type === 'email' ? <Mail size={11} color={m.direction === 'inbound' ? '#16a34a' : '#e8651e'} /> : <MessageSquare size={11} color={m.direction === 'inbound' ? '#16a34a' : '#e8651e'} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {m.subject && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{m.subject}</div>}
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.content}</div>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                      {new Date(m.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <EmptyState icon={Send} title="Select a lead" description="Choose a lead with generated copy to view outreach" />
          </div>
        )}
      </div>
    </div>
  );
}
