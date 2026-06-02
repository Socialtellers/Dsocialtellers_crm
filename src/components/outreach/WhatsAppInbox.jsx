import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, RefreshCw, Phone, Search } from 'lucide-react';
import { db } from '../../lib/store';
import { settings } from '../../lib/settings';

const BACKEND = import.meta.env.VITE_BACKEND_URL || '';

export default function WhatsAppInbox() {
  const [leads, setLeads] = useState([]);
  const [conversations, setConversations] = useState({});
  const [selectedLead, setSelectedLead] = useState(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const messagesEndRef = useRef(null);

  const loadData = () => {
    const allLeads = db.getLeads().filter(l => l.phone);
    const allMessages = db.getAllMessages().filter(m => m.type === 'whatsapp');

    // Group messages by lead
    const convMap = {};
    allMessages.forEach(msg => {
      if (!convMap[msg.leadId || msg.lead_id]) convMap[msg.leadId || msg.lead_id] = [];
      convMap[msg.leadId || msg.lead_id].push(msg);
    });

    // Sort messages by time
    Object.keys(convMap).forEach(id => {
      convMap[id].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    });

    setLeads(allLeads);
    setConversations(convMap);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedLead, conversations]);

  const refresh = async () => {
    setRefreshing(true);
    loadData();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const sendReply = async () => {
    if (!message.trim() || !selectedLead?.phone) return;
    setSending(true);
    try {
      const res = await fetch(`${BACKEND}/api/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedLead.phone,
          message: message.trim(),
          leadId: selectedLead.id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');

      // Add to local state immediately
      const newMsg = {
        id: `wa_${Date.now()}`,
        leadId: selectedLead.id,
        lead_id: selectedLead.id,
        type: 'whatsapp',
        direction: 'outbound',
        content: message.trim(),
        timestamp: new Date().toISOString(),
        status: 'sent'
      };
      setConversations(prev => ({
        ...prev,
        [selectedLead.id]: [...(prev[selectedLead.id] || []), newMsg]
      }));
      setMessage('');
    } catch (e) {
      alert(`Failed: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  const filteredLeads = leads.filter(l =>
    !search || l.name?.toLowerCase().includes(search.toLowerCase())
  );

  // Sort by latest message
  const sortedLeads = [...filteredLeads].sort((a, b) => {
    const aLast = conversations[a.id]?.slice(-1)[0]?.timestamp || a.last_action || '0';
    const bLast = conversations[b.id]?.slice(-1)[0]?.timestamp || b.last_action || '0';
    return new Date(bLast) - new Date(aLast);
  });

  const selectedConv = selectedLead ? (conversations[selectedLead.id] || []) : [];

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg-base)' }}>

      {/* Left — conversation list */}
      <div style={{ width: 300, flexShrink: 0, borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)' }}>

        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={16} color="#16a34a" />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                WhatsApp
              </span>
            </div>
            <button onClick={refresh} style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 4 }}>
              <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={11} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts..."
              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 7, padding: '6px 10px 6px 28px', fontSize: 12,
                color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sortedLeads.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              No leads with phone numbers yet
            </div>
          ) : sortedLeads.map(lead => {
            const conv = conversations[lead.id] || [];
            const lastMsg = conv[conv.length - 1];
            const unread = conv.filter(m => m.direction === 'inbound').length > 0;
            const isSelected = selectedLead?.id === lead.id;

            return (
              <div key={lead.id} onClick={() => setSelectedLead(lead)}
                style={{
                  padding: '12px 14px', cursor: 'pointer',
                  background: isSelected ? 'rgba(22,163,74,0.08)' : 'transparent',
                  borderLeft: `3px solid ${isSelected ? '#16a34a' : 'transparent'}`,
                  borderBottom: '1px solid var(--border)',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: '#16a34a20', border: '1px solid #16a34a30',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: '#16a34a', fontFamily: 'var(--font-display)'
                    }}>
                      {lead.name?.charAt(0) || '?'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>
                        {lead.name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Phone size={8} /> {lead.phone}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    {lastMsg && <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {formatTime(lastMsg.timestamp)}
                    </span>}
                    {conv.filter(m => m.direction === 'inbound').length > 0 && (
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#16a34a',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, color: '#fff', fontWeight: 700 }}>
                        {conv.filter(m => m.direction === 'inbound').length}
                      </div>
                    )}
                  </div>
                </div>

                {lastMsg && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 38,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {lastMsg.direction === 'outbound' ? '✓ ' : ''}{lastMsg.content?.slice(0, 50)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right — chat window */}
      {selectedLead ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

          {/* Chat header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)',
            background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#16a34a20',
              border: '1px solid #16a34a30', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 700, color: '#16a34a', fontFamily: 'var(--font-display)' }}>
              {selectedLead.name?.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedLead.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Phone size={9} /> {selectedLead.phone} · {selectedLead.category} · {selectedLead.location}
              </div>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 10,
                background: selectedLead.status === 'Replied' ? 'rgba(22,163,74,0.1)' : 'rgba(232,101,30,0.1)',
                color: selectedLead.status === 'Replied' ? '#16a34a' : 'var(--accent-primary)',
                fontFamily: 'var(--font-mono)' }}>
                {selectedLead.status}
              </span>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px',
            background: '#0d1a0d', display: 'flex', flexDirection: 'column', gap: 8 }}>

            {selectedConv.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 40 }}>
                No messages yet. Send the first WhatsApp from the Outreach page.
              </div>
            ) : selectedConv.map(msg => (
              <div key={msg.id} style={{
                display: 'flex',
                justifyContent: msg.direction === 'outbound' ? 'flex-end' : 'flex-start'
              }}>
                <div style={{
                  maxWidth: '70%', padding: '8px 12px', borderRadius: 10,
                  background: msg.direction === 'outbound' ? '#005c4b' : '#1f2c34',
                  borderTopRightRadius: msg.direction === 'outbound' ? 2 : 10,
                  borderTopLeftRadius: msg.direction === 'inbound' ? 2 : 10,
                }}>
                  {msg.direction === 'inbound' && (
                    <div style={{ fontSize: 10, color: '#16a34a', marginBottom: 3, fontWeight: 600 }}>
                      {selectedLead.name}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: '#e9edef', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'right', marginTop: 3 }}>
                    {formatTime(msg.timestamp)}
                    {msg.direction === 'outbound' && ' ✓✓'}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)',
            background: '#1f2c34', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }}}
              placeholder="Type a message..."
              rows={2}
              style={{ flex: 1, background: '#2a3942', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#e9edef',
                outline: 'none', resize: 'none', fontFamily: 'var(--font-body)' }}
            />
            <button onClick={sendReply} disabled={sending || !message.trim()}
              style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: message.trim() ? '#16a34a' : 'rgba(255,255,255,0.1)',
                border: 'none', cursor: message.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s'
              }}>
              <Send size={16} color="#fff" />
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0d1a0d', flexDirection: 'column', gap: 12 }}>
          <MessageSquare size={40} color="rgba(255,255,255,0.1)" />
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>Select a conversation</div>
        </div>
      )}
    </div>
  );
}
