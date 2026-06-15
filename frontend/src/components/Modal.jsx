import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, width = 480 }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#141414',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          width,
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.2s ease',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
          <button
            onClick={onClose}
            style={{
              color: '#555', display: 'flex', alignItems: 'center',
              padding: 4, borderRadius: 6, transition: '150ms',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#888'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#555'}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
