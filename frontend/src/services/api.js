const BASE = '/api';

function getToken() {
  return localStorage.getItem('vyno_token');
}

function headers(extra = {}) {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return data;
}

export const api = {
  auth: {
    register: (body) => request('POST', '/auth/register', body),
    login: (body) => request('POST', '/auth/login', body),
    me: () => request('GET', '/auth/me'),
  },
  projects: {
    list: () => request('GET', '/projects'),
    get: (id) => request('GET', `/projects/${id}`),
    create: () => request('POST', '/projects/new'),
    delete: (id) => request('DELETE', `/projects/${id}`),
    renders: (id) => request('GET', `/projects/${id}/renders`),
    videoUrl: (id) => {
      const token = getToken();
      return `${BASE}/projects/${id}/video${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    },
    historyVideoUrl: (id, filename) => {
      const token = getToken();
      return `${BASE}/projects/${id}/video/${encodeURIComponent(filename)}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    },
  },
  user: {
    profile: () => request('GET', '/user/profile'),
    updateProfile: (body) => request('PATCH', '/user/profile', body),
    uploadAvatar: async (file) => {
      const form = new FormData();
      form.append('avatar', file);
      const token = getToken();
      const res = await fetch(`${BASE}/user/avatar`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    },
  },
};

/**
 * Opens an SSE stream for chat messages
 * @param {string} projectId
 * @param {string} content
 * @param {function} onEvent - called with each parsed event { type, ...data }
 * @returns {function} cancel — call to abort
 */
export function streamChat(projectId, content, onEvent, attachments = []) {
  const controller = new AbortController();

  (async () => {
    try {
      let fetchBody;
      let fetchHeaders;

      if (attachments && attachments.length > 0) {
        const form = new FormData();
        form.append('content', content || '');
        attachments.forEach((file) => form.append('assets', file));
        fetchBody = form;
        // Don't set Content-Type — browser sets it with boundary for FormData
        fetchHeaders = { Authorization: `Bearer ${getToken()}` };
      } else {
        fetchBody = JSON.stringify({ content });
        fetchHeaders = headers();
      }

      const res = await fetch(`${BASE}/chat/${projectId}/message`, {
        method: 'POST',
        headers: fetchHeaders,
        body: fetchBody,
        signal: controller.signal,
      });

      if (!res.ok) {
        onEvent({ type: 'error', message: `Server error ${res.status}` });
        onEvent({ type: 'done' });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              onEvent(event);
            } catch {}
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        onEvent({ type: 'error', message: err.message });
        onEvent({ type: 'done' });
      }
    }
  })();

  return () => controller.abort();
}

/**
 * Opens an SSE stream for rendering
 */
export function streamRender(projectId, onEvent) {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${BASE}/chat/${projectId}/render`, {
        method: 'POST',
        headers: headers(),
        signal: controller.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try { onEvent(JSON.parse(line.slice(6))); } catch {}
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        onEvent({ type: 'error', message: err.message });
        onEvent({ type: 'done' });
      }
    }
  })();

  return () => controller.abort();
}
