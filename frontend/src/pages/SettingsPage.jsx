import React, { useState, useRef } from 'react';
import { LogOut, Save, Camera } from 'lucide-react';
import { useAuthStore } from '../store/auth.js';
import { api } from '../services/api.js';
import { toast } from '../store/toast.js';
import Sidebar from '../components/Sidebar.jsx';
import Spinner from '../components/Spinner.jsx';

export default function SettingsPage() {
  const { user, setAuth, logout, setUser } = useAuthStore();
  const [username, setUsername] = useState(user?.username || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarHover, setAvatarHover] = useState(false);
  const avatarInputRef = useRef(null);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const data = await api.user.uploadAvatar(file);
      if (data.user?.avatar_url) setUser({ ...user, avatar_url: data.user.avatar_url });
      toast.success('Profile picture updated');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!username.trim() || saving) return;
    setSaving(true);
    try {
      const data = await api.user.updateProfile({ username: username.trim() });
      setAuth(localStorage.getItem('vyno_token'), data.user);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', padding: '32px 36px', maxWidth: 600 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 28 }}>Settings</h1>

        {/* Profile section */}
        <section style={{
          background: '#111',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14,
          padding: 24,
          marginBottom: 20,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 18 }}>Profile</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Avatar */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 10 }}>
                Profile picture
              </label>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handleAvatarUpload}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  onClick={() => !uploadingAvatar && avatarInputRef.current?.click()}
                  onMouseEnter={() => setAvatarHover(true)}
                  onMouseLeave={() => setAvatarHover(false)}
                  style={{
                    width: 72, height: 72, borderRadius: 14,
                    overflow: 'hidden', position: 'relative', cursor: 'pointer',
                    background: '#1a1a1a',
                    border: `1px solid ${avatarHover ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)'}`,
                    transition: '150ms', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {uploadingAvatar ? (
                    <Spinner size={20} color="#555" />
                  ) : user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt="profile"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: 26, fontWeight: 700, color: '#444' }}>
                      {user?.username?.[0]?.toUpperCase() || 'U'}
                    </span>
                  )}
                  {avatarHover && !uploadingAvatar && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(0,0,0,0.6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Camera size={18} style={{ color: '#ccc' }} />
                    </div>
                  )}
                </div>
                <div>
                  <p style={{ fontSize: 13, color: '#aaa', marginBottom: 4 }}>{user?.username}</p>
                  <p style={{ fontSize: 11.5, color: '#444', lineHeight: 1.4 }}>
                    Click the avatar to upload.<br />JPG, PNG or WebP. Max 5MB.
                  </p>
                </div>
              </div>
            </div>
            <Field label="Email" value={user?.email || ''} disabled />
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 6 }}>
                Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: '#161616',
                  border: '1px solid rgba(255,255,255,0.07)',
                  color: '#e0e0e0',
                  fontSize: 13.5,
                  outline: 'none',
                }}
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving || username === user?.username}
              style={{
                alignSelf: 'flex-start',
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 18px',
                borderRadius: 9,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#bbb', fontSize: 13, fontWeight: 500,
                opacity: saving || username === user?.username ? 0.5 : 1,
              }}
            >
              {saving ? <Spinner size={13} /> : <Save size={13} />}
              Save changes
            </button>
          </div>
        </section>

        {/* Danger zone */}
        <section style={{
          background: '#111',
          border: '1px solid rgba(248, 113, 113, 0.1)',
          borderRadius: 14,
          padding: 24,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#f87171' }}>
            Account
          </h2>
          <p style={{ fontSize: 13, color: '#555', marginBottom: 16 }}>
            Signing out will remove your session.
          </p>
          <button
            onClick={logout}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 18px',
              borderRadius: 9,
              background: 'rgba(248,113,113,0.06)',
              border: '1px solid rgba(248,113,113,0.15)',
              color: '#f87171', fontSize: 13, fontWeight: 500,
            }}
          >
            <LogOut size={13} />
            Sign out
          </button>
        </section>
      </main>
    </div>
  );
}

function Field({ label, value, disabled }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 6 }}>
        {label}
      </label>
      <input
        value={value}
        disabled={disabled}
        readOnly
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 8,
          background: '#0f0f0f',
          border: '1px solid rgba(255,255,255,0.05)',
          color: '#555',
          fontSize: 13.5,
          cursor: 'default',
        }}
      />
    </div>
  );
}
