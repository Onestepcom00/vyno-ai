import { create } from 'zustand';

let toastId = 0;

export const useToastStore = create((set, get) => ({
  toasts: [],

  add: (message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    if (duration > 0) {
      setTimeout(() => get().remove(id), duration);
    }
    return id;
  },

  remove: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

export const toast = {
  success: (msg) => useToastStore.getState().add(msg, 'success'),
  error: (msg) => useToastStore.getState().add(msg, 'error'),
  info: (msg) => useToastStore.getState().add(msg, 'info'),
};
