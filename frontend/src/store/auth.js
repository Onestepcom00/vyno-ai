import { create } from 'zustand';
import { api } from '../services/api.js';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('vyno_token') || null,
  loading: true,

  setAuth: (token, user) => {
    localStorage.setItem('vyno_token', token);
    set({ token, user, loading: false });
  },

  setUser: (user) => set({ user }),

  logout: () => {
    localStorage.removeItem('vyno_token');
    set({ token: null, user: null, loading: false });
  },

  init: async () => {
    const token = localStorage.getItem('vyno_token');
    if (!token) {
      set({ loading: false });
      return;
    }
    try {
      const data = await api.auth.me();
      set({ user: data.user, token, loading: false });
    } catch {
      localStorage.removeItem('vyno_token');
      set({ token: null, user: null, loading: false });
    }
  },
}));
