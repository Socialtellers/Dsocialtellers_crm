import React from 'react';
import { LayoutDashboard, Users, Kanban, Send, Bot, Settings, Zap, ChevronRight } from 'lucide-react';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'leads', label: 'Lead Database', icon: Users },
  { id: 'crm', label: 'CRM Pipeline', icon: Kanban },
  { id: 'outreach', label: 'Outreach', icon: Send },
  { id: 'agents', label: 'AI Agents', icon: Bot },
];

export default function Sidebar({ currentPage, onNavigate }) {
  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #e8651e, #f5a623)',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Zap size={16} color="#fff" fill="#fff" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              Dsocialtellers
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
              AI Outreach OS
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px' }}>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 1, padding: '0 10px 8px', textTransform: 'uppercase' }}>
          Platform
        </div>
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = currentPage === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 7, marginBottom: 2,
                background: active ? 'var(--accent-glow)' : 'transparent',
                border: active ? '1px solid rgba(232,101,30,0.2)' : '1px solid transparent',
                color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: active ? 600 : 400,
                cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left'
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}}
            >
              <Icon size={15} />
              <span style={{ flex: 1 }}>{label}</span>
              {active && <ChevronRight size={12} />}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
        <div style={{
          padding: '10px 12px', borderRadius: 8,
          background: 'linear-gradient(135deg, rgba(232,101,30,0.1), rgba(245,166,35,0.1))',
          border: '1px solid rgba(232,101,30,0.1)'
        }}>
          <div style={{ fontSize: 11, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
            ● SYSTEM ONLINE
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            AI Agents Active
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            Claude Sonnet 4 · Apify
          </div>
        </div>
      </div>
    </aside>
  );
}
