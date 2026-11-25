/** Asks the host (auth.php) whether this visitor may edit. Without the PHP files (local dev) mode is 'none'. */
export interface HostAuth {
  mode: 'none' | 'password' | 'wordpress';
  canEdit: boolean;
  loggedIn: boolean;
  name: string;
  loginUrl: string;
  error?: string;
}

const NONE: HostAuth = { mode: 'none', canEdit: false, loggedIn: false, name: '', loginUrl: '' };

export async function fetchHostAuth(): Promise<HostAuth> {
  try {
    const res = await fetch(`./auth.php?t=${Date.now()}`, { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) return NONE;
    const j = await res.json();
    if (j && (j.mode === 'wordpress' || j.mode === 'password')) return { ...NONE, ...j };
    return NONE;
  } catch {
    return NONE;
  }
}

/** Headers/credentials for save-data.php in WordPress-login mode. */
export const SAVE_HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'barzok' };

import { useEffect, useState } from 'react';

let cached: Promise<HostAuth> | null = null;
/** undefined while the first answer is pending. */
export function useHostAuth(): HostAuth | undefined {
  const [auth, setAuth] = useState<HostAuth | undefined>();
  useEffect(() => {
    let live = true;
    cached = cached ?? fetchHostAuth();
    cached.then((a) => live && setAuth(a));
    return () => {
      live = false;
    };
  }, []);
  return auth;
}
