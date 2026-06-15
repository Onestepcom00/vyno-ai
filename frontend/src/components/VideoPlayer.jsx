import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, RotateCcw, Download, Clock } from 'lucide-react';
import Spinner from './Spinner.jsx';
import { streamRender, api } from '../services/api.js';
import { toast } from '../store/toast.js';

export default function VideoPlayer({ projectId, renderExists, onRenderComplete }) {
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState('');
  const [activeVideoSrc, setActiveVideoSrc] = useState(null);
  const [history, setHistory] = useState([]);
  const videoRef = useRef(null);
  const cancelRef = useRef(null);

  const loadHistory = useCallback(async () => {
    try {
      const { renders } = await api.projects.renders(projectId);
      setHistory(renders || []);
    } catch {}
  }, [projectId]);

  useEffect(() => {
    if (renderExists) {
      setActiveVideoSrc(api.projects.videoUrl(projectId));
      loadHistory();
    }
  }, [renderExists, projectId, loadHistory]);

  const triggerRender = () => {
    if (rendering) return;
    setRendering(true);
    setRenderProgress('Starting render...');

    cancelRef.current = streamRender(projectId, (event) => {
      if (event.type === 'task_start') setRenderProgress('Rendering...');
      if (event.type === 'task_done') {
        setRenderProgress('');
        setRendering(false);
        setActiveVideoSrc(api.projects.videoUrl(projectId) + '&r=' + Date.now());
        onRenderComplete?.();
        loadHistory();
        toast.success('Video rendered successfully');
      }
      if (event.type === 'task_error') {
        setRenderProgress('');
        setRendering(false);
        toast.error(event.error || 'Render failed');
      }
      if (event.type === 'error') {
        setRenderProgress('');
        setRendering(false);
        toast.error(event.message || 'Render error');
      }
    });
  };

  const handleDownload = (filename) => {
    const a = document.createElement('a');
    a.href = filename
      ? api.projects.historyVideoUrl(projectId, filename)
      : api.projects.videoUrl(projectId);
    a.download = filename || 'output.mp4';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!renderExists) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 16, color: '#333', padding: 32,
      }}>
        {rendering ? (
          <>
            <Spinner size={28} color="#555" />
            <p style={{ fontSize: 13, color: '#555' }}>{renderProgress || 'Rendering...'}</p>
          </>
        ) : (
          <>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Play size={22} style={{ color: '#333', marginLeft: 2 }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: '#555', fontWeight: 500 }}>No video yet</p>
              <p style={{ fontSize: 12, color: '#333', marginTop: 4 }}>
                Generate a motion design to see your video here
              </p>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Main video */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 14, padding: '20px 24px 12px',
        minHeight: 0,
      }}>
        <div style={{
          borderRadius: 12, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
          maxWidth: '100%', background: '#000',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          <video
            ref={videoRef}
            key={activeVideoSrc}
            src={activeVideoSrc}
            controls
            playsInline
            style={{ display: 'block', maxWidth: '100%', maxHeight: '52vh' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={triggerRender}
            disabled={rendering}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: rendering ? '#444' : '#999',
              fontSize: 12, fontWeight: 500, transition: '150ms',
            }}
          >
            {rendering ? <Spinner size={11} /> : <RotateCcw size={11} />}
            {rendering ? renderProgress : 'Re-render'}
          </button>

          <button
            onClick={() => handleDownload(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#999', fontSize: 12, fontWeight: 500, transition: '150ms',
            }}
          >
            <Download size={11} />
            Download
          </button>
        </div>
      </div>

      {/* History strip */}
      {history.length > 0 && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          padding: '12px 16px',
          flexShrink: 0,
        }}>
          <p style={{ fontSize: 10, color: '#333', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Render History
          </p>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {history.map((r) => {
              const date = new Date(r.timestamp);
              const label = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
              const isActive = activeVideoSrc?.includes(r.name);
              return (
                <div
                  key={r.name}
                  style={{
                    flexShrink: 0,
                    background: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 8, padding: '6px 10px',
                    display: 'flex', alignItems: 'center', gap: 6,
                    cursor: 'pointer', transition: '150ms',
                  }}
                  onClick={() => setActiveVideoSrc(api.projects.historyVideoUrl(projectId, r.name))}
                >
                  <Clock size={10} style={{ color: '#444' }} />
                  <span style={{ fontSize: 11, color: isActive ? '#bbb' : '#555' }}>{label}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownload(r.name); }}
                    title="Download this version"
                    style={{
                      color: '#333', display: 'flex', alignItems: 'center',
                      padding: '2px', borderRadius: 4, transition: '150ms',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#777'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#333'}
                  >
                    <Download size={9} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
