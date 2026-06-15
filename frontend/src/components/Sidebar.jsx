import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FolderOpen, Settings, Plus } from 'lucide-react';
import { useAuthStore } from '../store/auth.js';
import { api } from '../services/api.js';
import { toast } from '../store/toast.js';
import Spinner from './Spinner.jsx';

const NAV_ITEMS = [
  { icon: FolderOpen, label: 'Projects', path: '/projects' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [creating, setCreating] = useState(false);

  const handleNewProject = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const { project } = await api.projects.create();
      navigate(`/projects/${project.id}`);
    } catch (err) {
      toast.error(err.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const initial = user?.username?.[0]?.toUpperCase() || 'U';

  return (
    <aside style={{
      width: 52,
      height: '100vh',
      background: '#0d0d0d',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '14px 0',
      gap: 4,
      flexShrink: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div
        onClick={() => navigate('/projects')}
        style={{
          cursor: 'pointer',
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: '-0.5px',
          color: '#fff',
          padding: '6px 0',
          marginBottom: 8,
        }}
      >
        V
      </div>

      {/* New project */}
      <SidebarBtn
        icon={<Plus size={16} />}
        label="New Project"
        onClick={handleNewProject}
        loading={creating}
      />

      <div style={{ flex: 1 }} />

      {/* Nav items */}
      {NAV_ITEMS.map((item) => {
        const active = location.pathname.startsWith(item.path);
        return (
          <SidebarBtn
            key={item.path}
            icon={<item.icon size={16} />}
            label={item.label}
            onClick={() => navigate(item.path)}
            active={active}
          />
        );
      })}

      {/* Avatar — display only, click goes to Settings */}
      <div style={{ marginTop: 4 }}>
        <SidebarBtn
          icon={
            user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt="avatar"
                style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: '#1e1e1e',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600, color: '#555',
              }}>
                {initial}
              </div>
            )
          }
          label={user?.username || 'Profile'}
          onClick={() => navigate('/settings')}
        />
      </div>
    </aside>
  );
}

function SidebarBtn({ icon, label, onClick, active, loading }) {
  const [hover, setHover] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={label}
        style={{
          width: 36,
          height: 36,
          borderRadius: 9,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: active ? '#fff' : '#555',
          background: active ? 'rgba(255,255,255,0.08)' : hover ? 'rgba(255,255,255,0.05)' : 'transparent',
          transition: '150ms',
        }}
      >
        {loading ? (
          <span style={{
            width: 14, height: 14,
            border: '2px solid rgba(255,255,255,0.1)',
            borderTopColor: '#555',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }} />
        ) : icon}
      </button>

      {/* Tooltip */}
      {hover && (
        <div style={{
          position: 'absolute',
          left: 44,
          top: '50%',
          transform: 'translateY(-50%)',
          background: '#1e1e1e',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 7,
          padding: '5px 10px',
          fontSize: 12,
          fontWeight: 500,
          color: '#ccc',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 200,
        }}>
          {label}
        </div>
      )}
    </div>
  );
}
