import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuthStore } from '../store/auth.js';
import { toast } from '../store/toast.js';
import Spinner from '../components/Spinner.jsx';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      const fn = mode === 'login' ? api.auth.login : api.auth.register;
      const body = mode === 'login'
        ? { email: form.email, password: form.password }
        : { username: form.username, email: form.email, password: form.password };

      const data = await fn(body);
      setAuth(data.token, data.user);
      navigate('/projects');
    } catch (err) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === 'login';

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
    }}>
      <div style={{
        width: 380,
        background: '#111',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 18,
        padding: 32,
        animation: 'fadeIn 0.3s ease',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-1px' }}>Vyno</h1>
          <p style={{ fontSize: 13, color: '#555', marginTop: 6 }}>
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!isLogin && (
            <FormField
              label="Username"
              type="text"
              value={form.username}
              onChange={(v) => setForm((f) => ({ ...f, username: v }))}
              placeholder="your_username"
              required
            />
          )}
          <FormField
            label="Email"
            type="email"
            value={form.email}
            onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            placeholder="you@example.com"
            required
          />
          <FormField
            label="Password"
            type="password"
            value={form.password}
            onChange={(v) => setForm((f) => ({ ...f, password: v }))}
            placeholder="••••••••"
            required
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              padding: '11px',
              borderRadius: 10,
              background: '#fff',
              color: '#000',
              fontSize: 13.5,
              fontWeight: 600,
              transition: '150ms',
              opacity: loading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {loading && <Spinner size={14} color="#000" />}
            {isLogin ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12.5, color: '#555', marginTop: 20 }}>
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => setMode(isLogin ? 'register' : 'login')}
            style={{ color: '#888', fontWeight: 500, textDecoration: 'underline' }}
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}

function FormField({ label, type, value, onChange, placeholder, required }) {
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 6 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        required={required}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 8,
          background: '#161616',
          border: `1px solid ${focused ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)'}`,
          color: '#e0e0e0',
          fontSize: 13.5,
          outline: 'none',
          transition: '150ms',
          fontFamily: 'var(--font)',
        }}
      />
    </div>
  );
}
