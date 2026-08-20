/**
 * TRUSTGRAPH – Auth Context
 *
 * Provides JWT-based authentication state across the application.
 * Components should consume this via the useAuth() hook.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, tokenStorage } from '../services/api';

interface AuthUser {
  username: string;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // On mount: check if a token already exists in storage (e.g., page refresh)
  useEffect(() => {
    const token = tokenStorage.get();
    if (token) {
      // In a real implementation you'd validate the token or fetch /me.
      // For now we trust the stored token and set a placeholder user.
      setUser({ username: 'investigator', role: 'Investigator SOC-L2' });
    }
    setIsLoading(false);
  }, []);

  // Listen for the 401 global event emitted by the Axios interceptor
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setError('Your session has expired. Please log in again.');
    };
    window.addEventListener('tg:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('tg:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.login({ username, password });
      setUser(response.user ?? { username, role: 'Investigator SOC-L2' });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Invalid credentials. Please try again.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    await authApi.logout();
    setUser(null);
    setIsLoading(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, logout, error, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
