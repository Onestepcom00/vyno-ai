import React, { useRef, useState, useEffect } from 'react';
import { ArrowUp, Paperclip, X, Film } from 'lucide-react';

export default function ChatInput({ onSend, disabled, placeholder = 'Send a message...' }) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState([]);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || disabled) return;
    onSend(trimmed, attachments);
    setValue('');
    setAttachments([]);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/')
    ).slice(0, 4);
    setAttachments((prev) => [...prev, ...valid].slice(0, 4));
    e.target.value = '';
  };

  const removeAttachment = (idx) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const hasContent = value.trim().length > 0 || attachments.length > 0;

  return (
    <div style={{
      padding: '10px 14px 14px',
      background: '#0d0d0d',
      borderTop: '1px solid rgba(255,255,255,0.05)',
      flexShrink: 0,
    }}>
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {attachments.map((file, i) => {
            const isVideo = file.type.startsWith('video/');
            const url = URL.createObjectURL(file);
            return (
              <div key={i} style={{
                position: 'relative',
                width: 52, height: 52,
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.1)',
                background: '#1a1a1a',
                flexShrink: 0,
              }}>
                {isVideo ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Film size={18} style={{ color: '#555' }} />
                  </div>
                ) : (
                  <img src={url} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                <button
                  onClick={() => removeAttachment(i)}
                  style={{
                    position: 'absolute', top: 2, right: 2,
                    width: 16, height: 16, borderRadius: 4,
                    background: 'rgba(0,0,0,0.7)',
                    color: '#aaa',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={9} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Input box */}
      <div style={{
        background: '#141414',
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 14,
        transition: '150ms',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, padding: '10px 12px' }}>
          {/* Attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || attachments.length >= 4}
            title="Attach image or video"
            style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              color: disabled ? '#333' : '#555',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              transition: '150ms',
            }}
          >
            <Paperclip size={13} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFiles}
            style={{ display: 'none' }}
          />

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            placeholder={disabled ? 'Vyno is working...' : placeholder}
            disabled={disabled}
            rows={1}
            style={{
              flex: 1,
              fontSize: 13.5,
              lineHeight: 1.55,
              color: disabled ? '#3a3a3a' : '#e0e0e0',
              resize: 'none',
              background: 'none',
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--font)',
              overflowY: 'auto',
              maxHeight: 160,
            }}
          />

          {/* Send button */}
          {hasContent && !disabled && (
            <button
              onClick={handleSend}
              style={{
                width: 30, height: 30,
                borderRadius: 8,
                background: '#fff',
                color: '#000',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transition: '150ms',
                animation: 'fadeIn 0.15s ease',
              }}
            >
              <ArrowUp size={15} />
            </button>
          )}

          {/* Working indicator */}
          {disabled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2, flexShrink: 0 }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: '#fbbf24',
                animation: 'pulse 1.2s ease infinite',
              }} />
            </div>
          )}
        </div>

        {/* Bottom toolbar */}
        <div style={{
          padding: '0 12px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <p style={{ fontSize: 11, color: '#2a2a2a' }}>
            {attachments.length > 0
              ? `${attachments.length} file${attachments.length > 1 ? 's' : ''} attached`
              : 'Shift+Enter for new line'}
          </p>
          <p style={{ fontSize: 11, color: '#2a2a2a' }}>
            Enter to send
          </p>
        </div>
      </div>
    </div>
  );
}
