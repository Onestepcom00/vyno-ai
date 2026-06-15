import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, ChevronUp } from 'lucide-react';
import TaskList from './TaskList.jsx';

export default function ChatMessage({ message }) {
  const [showThink, setShowThink] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      animation: 'fadeIn 0.25s ease',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '100%',
    }}>
      {!isUser && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 2,
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, color: '#666',
            flexShrink: 0,
          }}>
            V
          </div>
          <span style={{ fontSize: 12, color: '#444', fontWeight: 500 }}>Vyno</span>
        </div>
      )}

      {/* Think block */}
      {message.think_content && (
        <div style={{ marginLeft: isUser ? 0 : 32, marginBottom: 4 }}>
          <button
            onClick={() => setShowThink((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, color: '#444',
              padding: '3px 8px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 6,
            }}
          >
            {showThink ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            Thinking
          </button>
          {showThink && (
            <div style={{
              marginTop: 6,
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 8,
              fontSize: 12,
              color: '#555',
              lineHeight: 1.6,
              fontStyle: 'italic',
              maxHeight: 200,
              overflow: 'auto',
            }}>
              {message.think_content}
            </div>
          )}
        </div>
      )}

      {/* Message bubble */}
      <div style={{
        maxWidth: '78%',
        marginLeft: !isUser ? 32 : 0,
      }}>
        {isUser ? (
          <div style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '14px 14px 4px 14px',
            padding: '10px 14px',
            fontSize: 13.5,
            color: '#e0e0e0',
            lineHeight: 1.55,
          }}>
            {message.content}
          </div>
        ) : (
          <div style={{
            fontSize: 13.5,
            color: '#c0c0c0',
            lineHeight: 1.65,
          }}>
            <ReactMarkdown
              components={{
                p: ({ children }) => <p style={{ marginBottom: 8 }}>{children}</p>,
                code: ({ children }) => (
                  <code style={{
                    background: 'rgba(255,255,255,0.06)',
                    padding: '1px 5px', borderRadius: 4,
                    fontFamily: 'monospace', fontSize: 12,
                  }}>
                    {children}
                  </code>
                ),
                pre: ({ children }) => (
                  <pre style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 8, padding: '10px 12px',
                    overflow: 'auto', fontSize: 12,
                    marginBottom: 8,
                  }}>
                    {children}
                  </pre>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Tasks inline (if message has tasks attached) */}
      {message.tasks && message.tasks.length > 0 && (
        <div style={{ marginLeft: 32, width: '100%', maxWidth: 480 }}>
          <TaskList tasks={message.tasks} />
        </div>
      )}
    </div>
  );
}
