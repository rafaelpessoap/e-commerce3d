'use client';

import { create } from 'zustand';
import type { User } from '@/types/user';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setUser: (user: User | null) => void;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isHydrated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  login: (user, accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    set({ user, isAuthenticated: true, isHydrated: true });
  },
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, isAuthenticated: false, isHydrated: true });
  },
  hydrate: async () => {
    if (get().isHydrated) return;

    const token = typeof window !== 'undefined'
      ? localStorage.getItem('accessToken')
      : null;

    if (!token) {
      set({ isHydrated: true });
      return;
    }

    try {
      const { api } = await import('@/lib/api-client');
      const { data } = await api.get('/users/me');
      const user = data.data ?? data;
      set({ user, isAuthenticated: true, isHydrated: true });
    } catch {
      // Token inválido ou expirado — limpar
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      set({ user: null, isAuthenticated: false, isHydrated: true });
    }
  },
}));
