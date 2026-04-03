import axios from 'axios';
import { API_URL, API_TIMEOUT } from './constants';

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: API_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Get or create a session ID for anonymous cart.
 * Persisted in localStorage, synced to user on login.
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sid = localStorage.getItem('sessionId');
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem('sessionId', sid);
  }
  return sid;
}

// Interceptor para adicionar token JWT + sessionId
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Always send sessionId for cart
    config.headers['x-session-id'] = getSessionId();
  }
  return config;
});

// Interceptor para tratar erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
    }
    return Promise.reject(error);
  },
);
