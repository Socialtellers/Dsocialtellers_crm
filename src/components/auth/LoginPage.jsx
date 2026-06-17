import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey);

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      onLogin(data.session);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', fontFamily: 'var(--font-body)'
    }}>
      <div style={{ position: 'fixed', inset: 0, opacity: 0.03, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle at 1px 1px, var(--text-primary) 1px, transparent 0)',
        backgroundSize: '32px 32px' }} />

      <div style={{ width: '100%', maxWidth: 400, padding: '0 24px', animation: 'fadeIn 0.4s ease forwards' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(99,102,241,0.3)'
          }}>
            <span style={{ fontSize: 24 }}>⚡</span>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800,
            color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: 6 }}>
            Social Tellers CRM
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sign in to your workspace</div>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)',
          padding: '32px 28px', boxShadow: 'var(--shadow-card)' }}>
          <form onSubmit={handleLogin}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Email
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required
                style={{ width: '100%', padding: '11px 14px', background: 'var(--bg-input)',
                  border: '1px solid var(--border)', borderRadius: 8, fontSize: 14,
                  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'} />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Password
              </label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                style={{ width: '100%', padding: '11px 14px', background: 'var(--bg-input)',
                  border: '1px solid var(--border)', borderRadius: 8, fontSize: 14,
                  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'} />
            </div>

            {error && (
              <div style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 16,
                background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)',
                fontSize: 13, color: '#dc2626' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '12px',
                background: loading ? 'var(--border)' : 'var(--accent-primary)',
                border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 12px rgba(99,102,241,0.3)' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
          Social Tellers · AI Lead Intelligence OS
        </div>
      </div>
    </div>
  );
}
