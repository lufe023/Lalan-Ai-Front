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

/**
 * Renovar la sesión sin molestar a nadie.
 *
 * Se exporta porque el socket también la necesita: cuando el servidor le
 * rechaza la conexión por token caducado, renueva y vuelve a entrar. Si no,
 * el tiempo real se quedaba muerto aunque la parte HTTP siguiera viva.
 *
 * Las llamadas simultáneas comparten UNA sola petición: al volver el
 * teléfono de la pantalla de bloqueo se disparan cinco peticiones a la vez,
 * las cinco dan 401, y sin esto se pedirían cinco refrescos — y como el
 * servidor ROTA el token en cada refresco, cuatro de ellos invalidarían al
 * quinto y la sesión se caería justo al intentar salvarla.
 */
let refrescoEnCurso: Promise<string | null> | null = null;

export function refrescarSesion(): Promise<string | null> {
  if (!refrescoEnCurso) {
    refrescoEnCurso = refreshAccessToken().finally(() => { refrescoEnCurso = null; });
  }
  return refrescoEnCurso;
}

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
    const newToken = await refrescarSesion();
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

/**
 * Petición SIN sesión que sí dice la verdad cuando falla.
 *
 * `publicFetch` traduce cualquier error a "Sin conexión", que sirve para una
 * pared pero no para una clienta: si le dicen que "ya usó sus 3 canciones",
 * el mensaje tiene que llegarle tal cual. Aquí se devuelve el motivo que
 * manda el servidor, y se distingue "no hay red" de "el servidor dijo que no".
 */
export class ErrorPublico extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function publicRequest<T = unknown>(
  path: string,
  opciones: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: opciones.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
    });
  } catch {
    throw new ErrorPublico('No hay conexión. Revisa tu internet e inténtalo de nuevo.', 0);
  }
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    const desanidar = (m: any): string => {
      if (m == null) return '';
      if (typeof m === 'string') return m;
      if (Array.isArray(m)) return m.map(desanidar).filter(Boolean).join(' | ');
      if (typeof m === 'object') return desanidar(m.message ?? m.error ?? null);
      return String(m);
    };
    const motivo = desanidar(cuerpo?.message ?? cuerpo) || 'No se pudo completar. Inténtalo de nuevo.';
    throw new ErrorPublico(motivo, res.status);
  }
  return res.json() as Promise<T>;
}

/** La URL completa de la pantalla, para copiarla o meterla en un QR */
export const urlDePantalla = (token: string) =>
  `${window.location.origin}${window.location.pathname}#/pantalla/${token}`;

/**
 * El reproductor del salón. Mismo token público que la pared, otra ventana.
 * Va aparte porque es un aparato que se queda encendido a la vista de todos:
 * ahí no se deja una sesión abierta con la agenda y la caja dentro.
 */
export const urlDeReproductor = (token: string) =>
  `${window.location.origin}${window.location.pathname}#/reproductor/${token}`;

/**
 * Enlace público para que las clientas pidan o sugieran canciones desde su móvil
 * al escanear el QR en la pantalla de turnos o en la mesa.
 */
export const urlDePedirCancion = (token: string) =>
  `${window.location.origin}${window.location.pathname}#/pedir-cancion/${token}`;

export const api = {
  get:    <T>(path: string) => apiFetch<T>(path, { method: 'GET' }),
  post:   <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};

/**
 * Descarga un archivo del backend (PDF, Excel) con la sesión y lo guarda.
 * En iPhone abre la vista del PDF, desde donde se comparte o se guarda.
 */
export async function descargarArchivo(path: string, nombre: string): Promise<void> {
  const pedir = () => fetch(`${BASE_URL}${path}`, { headers: tokenStore.get() ? { Authorization: `Bearer ${tokenStore.get()}` } : {} });
  let res = await pedir();
  if (res.status === 401 && (await refrescarSesion())) res = await pedir();
  if (!res.ok) throw new Error('No se pudo descargar el archivo');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Un archivo protegido (foto o video de un chat) como dirección local para
 * <img>/<video>: esas etiquetas no mandan el token, así que se pide con
 * sesión y se convierte en un blob. Quien la pide la libera al desmontarse.
 */
export async function blobProtegido(path: string): Promise<string> {
  const pedir = () => fetch(`${BASE_URL}${path}`, { headers: tokenStore.get() ? { Authorization: `Bearer ${tokenStore.get()}` } : {} });
  let res = await pedir();
  if (res.status === 401 && (await refrescarSesion())) res = await pedir();
  if (!res.ok) throw new Error('No se pudo cargar el archivo');
  return URL.createObjectURL(await res.blob());
}

/** Subir un archivo (multipart) con la sesión: notas de voz del chat */
export async function subirArchivo<T>(path: string, formulario: FormData): Promise<T> {
  const pedir = () => fetch(`${BASE_URL}${path}`, {
    method: 'POST', body: formulario, headers: tokenStore.get() ? { Authorization: `Bearer ${tokenStore.get()}` } : {},
  });
  let res = await pedir();
  if (res.status === 401 && (await refrescarSesion())) res = await pedir();
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const m = err?.message?.message ?? err?.message ?? 'No se pudo enviar';
    throw new Error(Array.isArray(m) ? m.join(' | ') : String(m));
  }
  return res.json() as Promise<T>;
}

/** Dirección completa de un recurso del backend (para <img src>) */
export const urlApi = (path: string) => `${BASE_URL}${path}`;

/**
 * La foto de una clienta o de un chat. Las de Instagram y Messenger las
 * guarda la API ("public/perfiles/…", ruta relativa a la API); las demás
 * ya son una dirección completa.
 */
export function urlDeFoto(foto?: string | null): string | undefined {
  if (!foto) return undefined;
  return /^(https?:|data:|blob:)/.test(foto) ? foto : `${BASE_URL}/${foto.replace(/^\//, '')}`;
}

/**
 * Un audio que genera el servidor (la voz de Lalan). Devuelve null si el
 * servidor dice "usa la voz del aparato" (204). Lanza si falla: quien llama
 * cae a la voz del aparato.
 */
export async function pedirAudio(path: string, cuerpo: unknown, senal?: AbortSignal): Promise<Blob | null> {
  const pedir = () => fetch(`${BASE_URL}${path}`, {
    method: 'POST', signal: senal, body: JSON.stringify(cuerpo),
    headers: { 'Content-Type': 'application/json', ...(tokenStore.get() ? { Authorization: `Bearer ${tokenStore.get()}` } : {}) },
  });
  let res = await pedir();
  if (res.status === 401 && (await refrescarSesion())) res = await pedir();
  if (res.status === 204) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const e = new Error(String(err?.message ?? 'Sin voz')) as Error & { estado?: number };
    e.estado = res.status;
    throw e;
  }
  return res.blob();
}
