import React from 'react';

export default function TypingIndicator({ label = 'Vyno is thinking' }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '12px 0',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: '#666',
        flexShrink: 0,
      }}>
        V
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{
              width: 5, height: 5,
              borderRadius: '50%',
              background: '#444',
              animation: `pulse 1.2s ease ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
        <span style={{ fontSize: 12, color: '#555', marginLeft: 4 }}>{label}</span>
      </div>
    </div>
  );
}
