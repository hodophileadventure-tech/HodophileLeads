import React, { createContext, useContext, useState, useCallback } from 'react';
import { useDataStore } from './store';
import apiClient from '../utils/api';

let ws: WebSocket | null = null;

async function initWS(_token: string | null, _userId: string, onNotification: (n: any) => void) {
  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5001/api' : `${window.location.origin}/api`);
    const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL || apiBaseUrl.replace(/\/api\/?$/, '');
    const protocol = wsBaseUrl.startsWith('https:') ? 'wss' : wsBaseUrl.startsWith('http:') ? 'ws' : (window.location.protocol === 'https:' ? 'wss' : 'ws');
    const token = localStorage.getItem('token');
    const base = wsBaseUrl.startsWith('http') ? wsBaseUrl.replace(/^http/, protocol) : `${protocol}://${window.location.host}`;
    const url = `${base.replace(/\/$/, '')}/ws`;
    ws = new WebSocket(url, token ? ['jwt', token] : ['jwt']);
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg?.event === 'notification') {
          onNotification(msg.payload);
        } else if (msg?.event === 'screen-capture-request' || msg?.event === 'screen-capture-result') {
          window.dispatchEvent(new CustomEvent(msg.event, { detail: msg.payload }));
        }
      } catch (e) {}
    };
    ws.onclose = () => { ws = null; };
  } catch (e) {
    // ignore
  }
}
import type { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await apiClient.post('/auth/login', { email: String(email).trim(), password });
      const { user: userData, token } = response.data || {};
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', token);
      // init websocket to receive realtime notifications
      const setNotifications = useDataStore.getState().setNotifications;
      const push = (n: any) => {
        const current = useDataStore.getState().notifications || [];
        setNotifications([n, ...current]);
      };
      initWS(token, userData.id, push);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    void apiClient.post('/auth/logout').catch(() => undefined);
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    try { ws?.close(); } catch(e) {}
  }, []);

  // refresh token periodically and reconnect websocket when it rotates
  React.useEffect(() => {
    if (!user) return;

    let mounted = true;
    const rotate = async () => {
      try {
        const currentToken = localStorage.getItem('token');
        if (!currentToken) return;
        const response = await apiClient.post('/auth/refresh', {}, {
          headers: { Authorization: `Bearer ${currentToken}` }
        });
        const { token: nextToken } = response.data || {};
        if (!nextToken) return;
        localStorage.setItem('token', nextToken);
        try { ws?.close(); } catch (e) {}
        const push = (n: any) => {
          const current = useDataStore.getState().notifications || [];
          useDataStore.getState().setNotifications([n, ...current]);
        };
        initWS(nextToken, user.id, push);
      } catch (e) {
        // ignore
      }
    };

    rotate();
    const id = window.setInterval(() => {
      if (mounted) rotate();
    }, 15 * 60 * 1000);
    return () => { mounted = false; window.clearInterval(id); };
  }, [user]);

  const hasRole = useCallback((role: UserRole) => {
    return user?.role === role;
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
