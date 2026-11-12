// Single entry point the UI uses to read and write data.
//
//   VITE_DATA_SOURCE=local   (default) → JSON seed + localStorage, no server, no keys.
//   VITE_DATA_SOURCE=remote            → plain fetch() to VITE_API_BASE_URL (the original
//                                        Express server in server.ts, or any backend that
//                                        implements the same /api/... routes).
//
// To add Supabase later, write a new adapter that implements the same
// (method, path, body) → JSON contract and select it here.
import { handleLocalRequest } from './localBackend';

export const DATA_SOURCE: 'local' | 'remote' =
  (import.meta.env.VITE_DATA_SOURCE as string | undefined) === 'remote' ? 'remote' : 'local';

const REMOTE_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) || '').replace(/\/$/, '');

export interface ApiOptions {
  /** Bearer token for the remote backend. Ignored in local mode. */
  token?: string | null;
}

export async function apiRequest<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  options: ApiOptions = {}
): Promise<T> {
  if (DATA_SOURCE === 'remote') {
    const res = await fetch(`${REMOTE_BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as any).error || 'خطا در ارتباط با سرور');
    return data as T;
  }

  return (await handleLocalRequest(method, path, body as Record<string, any> | undefined)) as T;
}

export { resetLocalData } from './localBackend';
