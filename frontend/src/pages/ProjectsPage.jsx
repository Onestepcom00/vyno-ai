import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Film, Clock, Trash2, CheckCircle, AlertCircle, Loader, Play } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuthStore } from '../store/auth.js';
import { toast } from '../store/toast.js';
import Sidebar from '../components/Sidebar.jsx';
import Spinner from '../components/Spinner.jsx';

const STATUS_LABELS = {
  initializing: { label: 'Initializing', color: '#888', icon: <Loader size={11} /> },
  in_progress:  { label: 'In Progress',  color: '#fbbf24', icon: <Loader size={11} /> },
  completed:    { label: 'Completed',    color: '#4ade80', icon: <CheckCircle size={11} /> },
  error:        { label: 'Error',        color: '#f87171', icon: <AlertCircle size={11} /> },
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const load = async () => {
    try {
      const { projects } = await api.projects.list();
      setProjects(projects);
    } catch (err) {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const { project } = await api.projects.create();
      navigate(`/projects/${project.id}`);
    } catch (err) {
      toast.error(err.message || 'Failed to create project');
      setCreating(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (deletingId) return;
    if (!confirm('Delete this project?')) return;
    setDeletingId(id);
    try {
      await api.projects.delete(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast.success('Project deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete project');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', padding: '32px 36px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 28,
        }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>Projects</h1>
            <p style={{ fontSize: 13, color: '#555', marginTop: 3 }}>
              Welcome back, {user?.username}
            </p>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px',
              borderRadius: 10,
              background: '#fff',
              color: '#000',
              fontSize: 13, fontWeight: 600,
              transition: '150ms',
              opacity: creating ? 0.7 : 1,
            }}
          >
            {creating ? <Spinner size={13} color="#000" /> : <Plus size={14} />}
            New Project
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <Spinner size={22} color="#444" />
          </div>
        ) : projects.length === 0 ? (
          <EmptyState onNew={handleCreate} creating={creating} />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 14,
          }}>
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => navigate(`/projects/${project.id}`)}
                onDelete={(e) => handleDelete(e, project.id)}
                deleting={deletingId === project.id}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ProjectCard({ project, onClick, onDelete, deleting }) {
  const [hover, setHover] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const videoRef = useRef(null);
  const status = STATUS_LABELS[project.status] || STATUS_LABELS.initializing;
  const isReady = project.status === 'completed' && project.render_path;

  // Capture a poster frame from the video element on load
  const handleVideoLoaded = () => {
    try {
      if (videoRef.current) videoRef.current.currentTime = 0.5;
    } catch {}
  };

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? '#161616' : '#111',
        border: `1px solid ${hover ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 14,
        cursor: 'pointer',
        transition: '160ms',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Banner — video thumbnail or plain */}
      <div style={{
        height: 130,
        position: 'relative',
        overflow: 'hidden',
        background: '#0a0a0a',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isReady && !thumbError ? (
          <>
            <video
              ref={videoRef}
              src={api.projects.videoUrl(project.id)}
              muted
              playsInline
              preload="metadata"
              onLoadedMetadata={handleVideoLoaded}
              onError={() => setThumbError(true)}
              style={{
                width: '100%', height: '100%',
                objectFit: 'cover',
                pointerEvents: 'none',
              }}
            />
            {/* Play overlay */}
            {hover && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.35)',
                backdropFilter: 'blur(2px)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Play size={14} style={{ color: '#fff', marginLeft: 2 }} />
                </div>
              </div>
            )}
          </>
        ) : (
          <Film size={20} style={{ color: 'rgba(255,255,255,0.08)' }} />
        )}

        {/* Status badge */}
        <div style={{
          position: 'absolute', top: 8, right: 10,
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: '3px 8px',
          fontSize: 10, fontWeight: 500,
          color: status.color,
          backdropFilter: 'blur(4px)',
        }}>
          {status.icon}
          {status.label}
        </div>

        {/* Delete button on hover */}
        {hover && (
          <button
            onClick={onDelete}
            style={{
              position: 'absolute', top: 8, left: 10,
              width: 26, height: 26, borderRadius: 7,
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(248,113,113,0.2)',
              color: '#f87171',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)',
              transition: '150ms',
            }}
            title="Delete project"
          >
            {deleting ? <Spinner size={11} color="#f87171" /> : <Trash2 size={11} />}
          </button>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px 13px' }}>
        <p style={{
          fontSize: 13, fontWeight: 600, color: '#e0e0e0',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginBottom: 3,
        }}>
          {project.name === 'New Project' ? (
            <span style={{ color: '#444', fontStyle: 'italic', fontWeight: 400 }}>Untitled project</span>
          ) : project.name}
        </p>

        <p style={{
          fontSize: 11.5,
          color: project.description ? '#4a4a4a' : '#2e2e2e',
          lineHeight: 1.5,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          minHeight: 34,
          fontStyle: project.description ? 'normal' : 'italic',
        }}>
          {project.description || 'No description yet'}
        </p>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          marginTop: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: '#2e2e2e' }}>
            <Clock size={9} />
            {new Date(project.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onNew, creating }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: 300, gap: 16, color: '#333',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Film size={24} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 15, fontWeight: 500, color: '#555' }}>No projects yet</p>
        <p style={{ fontSize: 13, color: '#333', marginTop: 5 }}>
          Start by creating your first motion design
        </p>
      </div>
      <button
        onClick={onNew}
        disabled={creating}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '10px 20px', borderRadius: 10,
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#bbb', fontSize: 13, fontWeight: 500,
        }}
      >
        {creating ? <Spinner size={13} /> : <Plus size={14} />}
        Create project
      </button>
    </div>
  );
}
