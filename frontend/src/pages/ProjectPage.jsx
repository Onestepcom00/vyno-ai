import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { api, streamChat, streamRender } from '../services/api.js';
import { toast } from '../store/toast.js';
import Sidebar from '../components/Sidebar.jsx';
import ChatMessage from '../components/ChatMessage.jsx';
import ChatInput from '../components/ChatInput.jsx';
import TypingIndicator from '../components/TypingIndicator.jsx';
import TaskList from '../components/TaskList.jsx';
import VideoPlayer from '../components/VideoPlayer.jsx';
import Spinner from '../components/Spinner.jsx';

export default function ProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [messages, setMessages] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [renderExists, setRenderExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [thinkContent, setThinkContent] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [activeTasks, setActiveTasks] = useState([]);
  const [renderKey, setRenderKey] = useState(0);
  const [taskComments, setTaskComments] = useState([]);
  const [msgAssets, setMsgAssets] = useState({}); // { messageId: [filenames] }

  const chatEndRef = useRef(null);
  const cancelStreamRef = useRef(null);
  const initialMsgSentRef = useRef(false);
  const thinkContentRef = useRef('');

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages, activeTasks, thinking]);

  const loadProject = useCallback(async () => {
    try {
      const data = await api.projects.get(id);
      setProject(data.project);
      setMessages(data.messages);
      setTasks(data.tasks);
      setRenderExists(data.renderExists);

      // Rebuild msgAssets from message metadata (chat history)
      const assetsMap = {};
      for (const msg of data.messages) {
        if (msg.role === 'user' && msg.metadata) {
          try {
            const meta = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
            if (meta?.assets?.length) assetsMap[msg.id] = meta.assets;
          } catch {}
        }
      }
      setMsgAssets(assetsMap);

      return data;
    } catch (err) {
      if (err.status === 404) {
        toast.error('Project not found');
        navigate('/projects');
      } else {
        toast.error('Failed to load project');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // Auto-send prompt if project was just created (no messages yet)
  const pendingPromptKey = `vyno_pending_${id}`;

  useEffect(() => {
    if (!project || loading || initialMsgSentRef.current) return;
    if (messages.length > 0) return;

    const pending = sessionStorage.getItem(pendingPromptKey);
    if (pending) {
      initialMsgSentRef.current = true;
      sessionStorage.removeItem(pendingPromptKey);
      sendMessage(pending);
    }
  }, [project, loading, messages.length]);

  const sendMessage = async (content, attachments = []) => {
    if (streaming) return;

    setStreaming(true);
    setThinking(true);
    setThinkContent('');
    thinkContentRef.current = '';
    setActiveTasks([]);
    setTaskComments([]);

    // Optimistically add user message
    const tempId = `temp-${Date.now()}`;
    const tempUserMsg = { id: tempId, role: 'user', content };
    setMessages((prev) => [...prev, tempUserMsg]);

    // Show asset previews near the message optimistically
    if (attachments && attachments.length > 0) {
      setMsgAssets((prev) => ({ ...prev, [tempId]: attachments.map(f => f.name) }));
    }

    cancelStreamRef.current = streamChat(id, content, (event) => {
      switch (event.type) {
        case 'think':
          thinkContentRef.current = event.content;
          setThinkContent(event.content);
          setThinking(false);
          break;

        case 'plan':
          setThinking(false);
          setActiveTasks(event.tasks.map((t) => ({ ...t, status: 'pending' })));
          if (event.metadata) {
            setProject((prev) => ({
              ...prev,
              ...event.metadata,
              visual_identity: event.metadata.visual_identity,
            }));
          }
          break;

        case 'task_start':
          setActiveTasks((prev) =>
            prev.map((t) => (t.id === event.id ? { ...t, status: 'running' } : t))
          );
          break;

        case 'task_done':
          setActiveTasks((prev) =>
            prev.map((t) =>
              t.id === event.id ? { ...t, status: 'completed', output: event.output } : t
            )
          );
          break;

        case 'task_error':
          setActiveTasks((prev) =>
            prev.map((t) =>
              t.id === event.id ? { ...t, status: 'error', error: event.error } : t
            )
          );
          break;

        case 'asset_upload':
          // Map backend messageId to asset names, and remove from temp key
          setMsgAssets((prev) => {
            const next = { ...prev };
            // Remove the temp entry
            Object.keys(next).forEach(k => { if (k.startsWith('temp-')) delete next[k]; });
            next[event.messageId] = event.assets;
            return next;
          });
          break;

        case 'task_comment':
          setTaskComments((prev) => [...prev, event.comment]);
          break;

        case 'message':
          setMessages((prev) => {
            const withoutTemp = prev.filter((m) => !m.id.startsWith('temp-'));
            return [
              ...withoutTemp,
              {
                id: event.id,
                role: 'assistant',
                content: event.content,
                think_content: thinkContentRef.current || undefined,
              },
            ];
          });
          setActiveTasks([]);
          setTaskComments([]);
          setThinkContent('');
          thinkContentRef.current = '';
          break;

        case 'done':
          setStreaming(false);
          setThinking(false);
          if (event.renderPath) {
            setRenderExists(true);
            setRenderKey((k) => k + 1);
          }
          loadProject();
          break;

        case 'error':
          toast.error(event.message || 'Stream error');
          setStreaming(false);
          setThinking(false);
          setActiveTasks([]);
          break;
      }
    }, attachments);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size={24} color="#444" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />

      {/* Chat Panel */}
      <div style={{
        width: 420,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        background: '#0d0d0d',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}>
          <button
            onClick={() => navigate('/projects')}
            style={{
              display: 'flex', alignItems: 'center',
              color: '#555', padding: 4, borderRadius: 6,
              transition: '150ms',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#888'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#555'}
          >
            <ArrowLeft size={15} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: 14, fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {project?.name || 'New Project'}
            </p>
            {project?.description && (
              <p style={{
                fontSize: 11, color: '#555', marginTop: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {project.description}
              </p>
            )}
          </div>
        </div>

        {/* Auto-resume banner — only if project started but render didn't finish */}
        {project?.status === 'in_progress' && !renderExists && !streaming && messages.length > 0 && (
          <div style={{
            margin: '8px 12px 0',
            padding: '10px 14px',
            background: 'rgba(251,191,36,0.06)',
            border: '1px solid rgba(251,191,36,0.15)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 10,
            flexShrink: 0,
          }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, color: '#fbbf24', fontWeight: 500 }}>Render incomplete</p>
              <p style={{ fontSize: 11, color: '#7a6520', marginTop: 1 }}>Files written, render didn't finish.</p>
            </div>
            <button
              onClick={() => {
                setStreaming(true);
                setActiveTasks([{ id: 'render', label: 'Rendering video', status: 'running' }]);
                cancelStreamRef.current = streamRender(id, (event) => {
                  if (event.type === 'task_done' || event.type === 'done') {
                    setRenderExists(true);
                    setRenderKey((k) => k + 1);
                    setStreaming(false);
                    setActiveTasks([]);
                    loadProject();
                  } else if (event.type === 'task_error' || event.type === 'error') {
                    toast.error(event.error || event.message || 'Render failed');
                    setStreaming(false);
                    setActiveTasks([]);
                  }
                });
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 7,
                background: 'rgba(251,191,36,0.12)',
                border: '1px solid rgba(251,191,36,0.2)',
                color: '#fbbf24', fontSize: 11, fontWeight: 500, flexShrink: 0,
              }}
            >
              <RotateCcw size={10} />
              Render now
            </button>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          {messages.length === 0 && !streaming && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', gap: 12, color: '#333',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, color: '#333',
              }}>V</div>
              <p style={{ fontSize: 13, color: '#444', textAlign: 'center', lineHeight: 1.5 }}>
                Describe your motion design.<br />
                Be specific about style, duration, and content.
              </p>
            </div>
          )}

          {messages.map((msg) => {
            const assets = msgAssets[msg.id];
            return (
              <div key={msg.id} style={{ marginBottom: 16 }}>
                {assets && assets.length > 0 && msg.role === 'user' && (
                  <div style={{
                    display: 'flex', gap: 6, marginBottom: 6,
                    justifyContent: 'flex-end', flexWrap: 'wrap',
                  }}>
                    {assets.map((name) => (
                      <div key={name} style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, padding: '4px 8px',
                        fontSize: 11, color: '#555',
                        maxWidth: 160,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        <span style={{ fontSize: 13 }}>📎</span>
                        {name}
                      </div>
                    ))}
                  </div>
                )}
                <ChatMessage message={msg} />
              </div>
            );
          })}

          {/* Active tasks while streaming */}
          {activeTasks.length > 0 && (
            <div style={{ marginBottom: 8, animation: 'fadeIn 0.2s ease' }}>
              <div style={{ marginLeft: 32 }}>
                <TaskList tasks={activeTasks} />
              </div>
            </div>
          )}

          {/* Live narrative comments from backend */}
          {taskComments.length > 0 && (
            <div style={{ marginLeft: 32, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {taskComments.map((c, i) => (
                <p key={i} style={{
                  fontSize: 12, color: '#4a4a4a',
                  animation: 'fadeIn 0.2s ease',
                  lineHeight: 1.5,
                }}>
                  {c}
                </p>
              ))}
            </div>
          )}

          {/* Thinking indicator */}
          {thinking && <TypingIndicator label="Thinking..." />}

          {/* Typing indicator while executing tasks */}
          {streaming && !thinking && activeTasks.length > 0 && (
            <TypingIndicator label="Executing..." />
          )}

          <div ref={chatEndRef} />
        </div>

        <ChatInput
          onSend={sendMessage}
          disabled={streaming}
          placeholder="Describe your motion design..."
        />
      </div>

      {/* Video Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#080808' }}>
        {/* Panel header */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#555' }}>Preview</p>
          {project?.visual_identity && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {Object.values(project.visual_identity).filter(v => v?.startsWith?.('#')).slice(0, 4).map((c, i) => (
                <div key={i} style={{
                  width: 12, height: 12, borderRadius: 3,
                  background: c,
                  border: '1px solid rgba(255,255,255,0.1)',
                }} />
              ))}
            </div>
          )}
        </div>

        <VideoPlayer
          key={renderKey}
          projectId={id}
          renderExists={renderExists}
          onRenderComplete={() => {
            setRenderExists(true);
            setRenderKey((k) => k + 1);
          }}
        />
      </div>
    </div>
  );
}
