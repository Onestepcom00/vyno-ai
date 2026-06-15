import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      background: '#0a0a0a',
    }}>
      <p style={{ fontSize: 60, fontWeight: 700, color: '#1a1a1a' }}>404</p>
      <p style={{ fontSize: 15, fontWeight: 500, color: '#555' }}>Page not found</p>
      <button
        onClick={() => navigate('/projects')}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 18px',
          borderRadius: 9,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#666', fontSize: 13,
        }}
      >
        <ArrowLeft size={14} />
        Back to projects
      </button>
    </div>
  );
}
