// ─── Base API client (native fetch + JWT) ────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

const TOKEN_KEY = 'lalan_access_token';
const REFRESH_KEY = 'lalan_refresh_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  setRefresh: (t: string) => localStorage.setItem(REFRESH_KEY, t),
  clear: () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_KEY); },
};

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) { tokenStore.clear(); return null; }
    const data = await res.json();
    tokenStore.set(data.accessToken);
    tokenStore.setRefresh(data.refreshToken);
    return data.accessToken;
  } catch {
    tokenStore.clear();
    return null;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = tokenStore.get();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) return apiFetch<T>(path, options, false);
    tokenStore.clear();
    window.dispatchEvent(new Event('lalan:logout'));
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    // El filtro de excepciones anida el error: { message: { message, error } }.
    // Sin desanidarlo, los toasts mostraban "[object Object]" en vez del motivo.
    const desanidar = (m: any): string => {
      if (m == null) return 'API error';
      if (typeof m === 'string') return m;
      if (Array.isArray(m)) return m.map(desanidar).join(' | ');
      if (typeof m === 'object') return desanidar(m.message ?? m.error ?? null);
      return String(m);
    };
    const msg = desanidar(err.message ?? err);
    throw new Error(msg);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Fetch SIN sesión, para la pantalla de pared.
 *
 * No usa `apiFetch` a propósito: aquel adjunta el JWT, y ante un 401 intenta
 * refrescar y dispara el evento de cierre de sesión. En un televisor sin
 * nadie delante eso no tiene sentido — y peor, si alguien dejó la sesión
 * abierta en esa tablet, un fallo de la pantalla la cerraría.
 */
export async function publicFetch<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(res.status === 404 ? 'Pantalla no encontrada' : 'Sin conexión');
  return res.json() as Promise<T>;
}

/** La URL completa de la pantalla, para copiarla o meterla en un QR */
export const urlDePantalla = (token: string) =>
  `${window.location.origin}${window.location.pathname}#/pantalla/${token}`;

export const api = {
  get:    <T>(path: string) => apiFetch<T>(path, { method: 'GET' }),
  post:   <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
