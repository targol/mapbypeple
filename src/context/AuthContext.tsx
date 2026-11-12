// Demo-only admin session for the local prototype.
//
// There is NO real authentication here: the admin panel is reachable from the browser and
// edits only touch this browser's localStorage. When a real backend is added (Supabase,
// Firebase, your own server), replace this provider and keep the same context shape —
// the original Firebase implementation is archived in docs/future-google-maps/.
import React, { createContext, useContext, useEffect, useState } from 'react';

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
}

interface AuthContextValue {
  user: AdminUser | null;
  idToken: string | null;
  loading: boolean;
  authError: string | null;
  enterPreviewAdmin: () => void;
  logout: () => Promise<void>;
  getFreshToken: () => Promise<string | null>;
}

const DEMO_ADMIN_TOKEN = 'barzok-local-demo-admin-token';
const SESSION_KEY = 'barzok-demo-admin-session';

const DEMO_USER: AdminUser = {
  uid: 'barzok-demo-admin',
  email: 'demo-admin@local',
  displayName: 'مدیر نمایشی (حالت محلی)',
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError] = useState<string | null>(null);

  // Restore the demo session for the current tab, if any.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(SESSION_KEY) === '1') {
        setUser(DEMO_USER);
        setIdToken(DEMO_ADMIN_TOKEN);
      }
    } catch {
      // sessionStorage blocked (sandboxed iframe) → start signed out
    }
    setLoading(false);
  }, []);

  const enterPreviewAdmin = () => {
    setUser(DEMO_USER);
    setIdToken(DEMO_ADMIN_TOKEN);
    try {
      window.sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      // ignore
    }
  };

  const logout = async () => {
    setUser(null);
    setIdToken(null);
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  };

  const getFreshToken = async () => idToken;

  return (
    <AuthContext.Provider
      value={{ user, idToken, loading, authError, enterPreviewAdmin, logout, getFreshToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
