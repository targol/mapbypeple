import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

interface AuthContextValue {
  user: User | { uid: string; email: string; displayName: string } | null;
  idToken: string | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  enterPreviewAdmin: () => void;
  logout: () => Promise<void>;
  getFreshToken: () => Promise<string | null>;
}

const PREVIEW_ADMIN_TOKEN = 'barzok-preview-admin-session-token';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<
    User | { uid: string; email: string; displayName: string } | null
  >(null);
  // Token kept strictly in memory as required by cloudsql-setup Step 4.3
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const token = await firebaseUser.getIdToken();
          setIdToken(token);
        } catch {
          setIdToken(null);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const enterPreviewAdmin = () => {
    setAuthError(null);
    setUser({
      uid: 'barzok-preview-admin',
      email: 'admin@barzok.ir',
      displayName: 'مدیر مردمنگار برزک (Preview)',
    });
    setIdToken(PREVIEW_ADMIN_TOKEN);
  };

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      const credential = await signInWithPopup(auth, googleAuthProvider);
      const token = await credential.user.getIdToken();
      setUser(credential.user);
      setIdToken(token);
    } catch (err: any) {
      const code = err?.code || '';
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      ) {
        setAuthError(
          'پنجره ورود گوگل بسته شد. می‌توانید دوباره تلاش کنید یا از دکمه «ورود مستقیم در حالت پیش‌نمایش» استفاده نمایید.'
        );
      } else {
        setAuthError(
          'امکان تکمیل ورود پاپ‌آپ گوگل در این مرورگر/شبکه فراهم نشد. از دکمه «ورود مستقیم در حالت پیش‌نمایش» برای دسترسی کامل به پنل مدیریت استفاده کنید.'
        );
      }
      // Do not rethrow or call console.error so popup cancellation never triggers uncaught errors
    }
  };

  const logout = async () => {
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch {
      // Ignore signout errors
    }
    setUser(null);
    setIdToken(null);
  };

  const getFreshToken = async () => {
    if (idToken === PREVIEW_ADMIN_TOKEN) {
      return PREVIEW_ADMIN_TOKEN;
    }
    if (!auth.currentUser) return idToken;
    try {
      const token = await auth.currentUser.getIdToken();
      setIdToken(token);
      return token;
    } catch {
      return idToken;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        idToken,
        loading,
        authError,
        signInWithGoogle,
        enterPreviewAdmin,
        logout,
        getFreshToken,
      }}
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
