import React from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { useToastStore } from '../store/toast.js';

const icons = {
  success: <CheckCircle size={15} />,
  error: <XCircle size={15} />,
  info: <Info size={15} />,
};

const colors = {
  success: '#4ade80',
  error: '#f87171',
  info: '#888888',
};

export default function Toast() {
  const { toasts, remove } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      zIndex: 9999,
    }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#1a1a1a',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10,
          padding: '10px 14px',
          minWidth: 260,
          maxWidth: 380,
          color: '#f0f0f0',
          fontSize: 13,
          animation: 'fadeIn 0.2s ease',
          backdropFilter: 'blur(8px)',
        }}>
          <span style={{ color: colors[t.type], flexShrink: 0 }}>
            {icons[t.type]}
          </span>
          <span style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</span>
          <button
            onClick={() => remove(t.id)}
            style={{
              color: '#555',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              transition: '150ms',
            }}
            onMouseEnter={(e) => e.target.style.color = '#888'}
            onMouseLeave={(e) => e.target.style.color = '#555'}
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
