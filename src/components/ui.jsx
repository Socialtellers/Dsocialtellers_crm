import React from 'react';
import { STATUS_COLORS, BRAND_QUALITY } from '../lib/store';

export function Badge({ label, color, size = 'sm' }) {
  const sizes = { xs: { fontSize: 9, padding: '2px 6px' }, sm: { fontSize: 10, padding: '3px 8px' }, md: { fontSize: 11, padding: '4px 10px' } };
  return (
    <span style={{
      ...sizes[size],
      background: `${color}18`,
      color: color,
      border: `1px solid ${color}30`,
      borderRadius: 4,
      fontFamily: 'var(--font-mono)',
      fontWeight: 500,
      display: 'inline-flex', alignItems: 'center', gap: 4,
      whiteSpace: 'nowrap'
    }}>
      {label}
    </span>
  );
}

export function StatusBadge({ status }) {
  return <Badge label={status} color={STATUS_COLORS[status] || '#7a99bb'} />;
}

export function QualityBadge({ quality }) {
  return <Badge label={quality?.toUpperCase()} color={BRAND_QUALITY[quality] || '#7a99bb'} />;
}

export function ScorePill({ score }) {
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        border: `2px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, color, fontFamily: 'var(--font-mono)'
      }}>{score}</div>
    </div>
  );
}

export function Card({ children, style = {}, glow = false }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
      boxShadow: glow ? 'var(--shadow-glow)' : 'var(--shadow-card)',
      ...style
    }}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub, icon: Icon, color = 'var(--accent-primary)', trend }) {
  return (
    <Card style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: -10, right: -10,
        width: 60, height: 60, borderRadius: '50%',
        background: `${color}10`
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            {label}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 1 }}>
            {value}
          </div>
          {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>{sub}</div>}
        </div>
        {Icon && (
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: `${color}15`,
            border: `1px solid ${color}25`,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Icon size={16} color={color} />
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div style={{ marginTop: 10, fontSize: 10, color: trend >= 0 ? '#10b981' : '#ef4444', fontFamily: 'var(--font-mono)' }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last week
        </div>
      )}
    </Card>
  );
}

export function Spinner({ size = 16, color = 'var(--accent-primary)' }) {
  return (
    <div className="spinner" style={{
      width: size, height: size,
      border: `2px solid ${color}30`,
      borderTop: `2px solid ${color}`,
      borderRadius: '50%'
    }} />
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{
      padding: '24px 28px 0',
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      marginBottom: 24
    }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          {title}
        </h1>
        {subtitle && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{actions}</div>}
    </div>
  );
}

export function Button({ children, onClick, variant = 'primary', size = 'md', disabled, loading, icon: Icon, style: customStyle = {} }) {
  const sizes = {
    sm: { fontSize: 12, padding: '6px 12px', gap: 5 },
    md: { fontSize: 13, padding: '8px 16px', gap: 7 },
    lg: { fontSize: 14, padding: '10px 20px', gap: 8 }
  };
  const variants = {
    primary: {
      background: 'var(--accent-primary)', color: '#000',
      border: '1px solid var(--accent-primary)', fontWeight: 600
    },
    secondary: {
      background: 'var(--bg-hover)', color: 'var(--text-primary)',
      border: '1px solid var(--border)', fontWeight: 500
    },
    ghost: {
      background: 'transparent', color: 'var(--text-secondary)',
      border: '1px solid transparent', fontWeight: 500
    },
    danger: {
      background: 'rgba(239,68,68,0.1)', color: '#ef4444',
      border: '1px solid rgba(239,68,68,0.2)', fontWeight: 500
    }
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        ...sizes[size], ...variants[variant],
        borderRadius: 7, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, transition: 'all 0.15s',
        fontFamily: 'var(--font-body)',
        ...customStyle
      }}
    >
      {loading ? <Spinner size={12} color={variant === 'primary' ? '#000' : 'var(--accent-primary)'} /> : Icon ? <Icon size={sizes[size].gap === 5 ? 12 : 14} /> : null}
      {children}
    </button>
  );
}

export function Input({ value, onChange, placeholder, style = {}, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        borderRadius: 7,
        padding: '8px 12px',
        color: 'var(--text-primary)',
        fontSize: 13,
        outline: 'none',
        width: '100%',
        fontFamily: 'var(--font-body)',
        ...style
      }}
      onFocus={e => e.target.style.borderColor = 'rgba(0,212,255,0.4)'}
      onBlur={e => e.target.style.borderColor = 'var(--border)'}
    />
  );
}

export function Select({ value, onChange, options, style = {} }) {
  return (
    <select
      value={value}
      onChange={onChange}
      style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        borderRadius: 7,
        padding: '8px 12px',
        color: 'var(--text-primary)',
        fontSize: 13,
        outline: 'none',
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        ...style
      }}
    >
      {options.map(o => (
        <option key={o.value || o} value={o.value || o}>{o.label || o}</option>
      ))}
    </select>
  );
}

export function Tag({ label, onRemove }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'rgba(0,212,255,0.08)',
      border: '1px solid rgba(0,212,255,0.15)',
      color: 'var(--accent-primary)',
      fontSize: 10, padding: '2px 8px', borderRadius: 20,
      fontFamily: 'var(--font-mono)'
    }}>
      {label}
      {onRemove && <span onClick={onRemove} style={{ cursor: 'pointer', opacity: 0.6, marginLeft: 2 }}>×</span>}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, description }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
      {Icon && <Icon size={32} style={{ marginBottom: 12, opacity: 0.4 }} />}
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>{title}</div>
      {description && <div style={{ fontSize: 12 }}>{description}</div>}
    </div>
  );
}
