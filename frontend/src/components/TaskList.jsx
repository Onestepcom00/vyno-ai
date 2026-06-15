import React from 'react';
import { Check, X, Loader, Clock } from 'lucide-react';

const STATUS_CONFIG = {
  pending:   { icon: <Clock size={12} />,  color: 'var(--color-text-muted)' },
  running:   { icon: <Loader size={12} />, color: '#fbbf24', spin: true },
  completed: { icon: <Check size={12} />,  color: 'var(--color-success)' },
  error:     { icon: <X size={12} />,      color: 'var(--color-error)' },
};

export default function TaskList({ tasks }) {
  if (!tasks || tasks.length === 0) return null;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10,
      overflow: 'hidden',
      marginTop: 4,
    }}>
      {tasks.map((task, i) => {
        const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
        return (
          <div
            key={task.id || i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 14px',
              borderBottom: i < tasks.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              animation: 'slideIn 0.2s ease',
            }}
          >
            <span style={{
              color: cfg.color,
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
              animation: cfg.spin ? 'spin 0.8s linear infinite' : 'none',
            }}>
              {cfg.icon}
            </span>
            <span style={{
              fontSize: 12,
              color: task.status === 'completed'
                ? 'var(--color-text-secondary)'
                : task.status === 'error'
                ? 'var(--color-error)'
                : task.status === 'running'
                ? 'var(--color-text)'
                : 'var(--color-text-muted)',
              flex: 1,
            }}>
              {task.label}
            </span>
            {task.status === 'completed' && task.output && (
              <span style={{ fontSize: 11, color: '#444', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {task.output}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
