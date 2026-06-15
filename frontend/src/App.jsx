import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.js';
import AuthPage from './pages/AuthPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import ProjectPage from './pages/ProjectPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import NotFound from './pages/NotFound.jsx';
import Toast from './components/Toast.jsx';
import Spinner from './components/Spinner.jsx';

function RequireAuth({ children }) {
  const { token, loading } = useAuthStore();

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: '#0a0a0a',
      }}>
        <Spinner size={24} color="#333" />
      </div>
    );
  }

  if (!token) return <Navigate to="/auth" replace />;
  return children;
}

export default function App() {
  const { init } = useAuthStore();

  useEffect(() => {
    init();
  }, []);

  return (
    <>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />

        <Route path="/projects" element={
          <RequireAuth><ProjectsPage /></RequireAuth>
        } />

        <Route path="/projects/:id" element={
          <RequireAuth><ProjectPage /></RequireAuth>
        } />

        <Route path="/settings" element={
          <RequireAuth><SettingsPage /></RequireAuth>
        } />

        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>

      <Toast />
    </>
  );
}
