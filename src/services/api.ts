import { cabeceraSede } from './sedeActiva';
// ─── Base API client (native fetch + JWT) ────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
/** La dirección del servidor, para las pantallas sin sesión que llevan su propia cabecera (el quiosco) */
export const URL_API = BASE_URL;

/*
 * La sesión vive en cookies httpOnly que pone el servidor: ningún script de
 * la página puede leerla. Aquí solo queda una marca NO secreta (rol y sede)
 * para saber, sin preguntar al servidor, si en este aparato hay alguien
 * dentro y de qué sede es. Antes los tokens vivían en localStorage.
 */
const MARCA = 'lalan_sesion';
/** Las claves de antes: solo se leen una vez para pasar la sesión a cookies */
const TOKEN_VIEJO = 'lalan_access_token';
const REFRESH_VIEJO = 'lalan_refresh_token';
/** Marca de que se está dentro del salón de un cliente como soporte */
export const MARCA_SOPORTE = 'lalan_sesion_propia';

export interface MarcaSesion { role?: string; locationId?: string | null }

export const sesionLocal = {
  hay: (): boolean => {
    try { return !!localStorage.getItem(MARCA) || !!localStorage.getItem(REFRESH_VIEJO); } catch { return false; }
  },
  leer: (): MarcaSesion | null => {
    try { return JSON.parse(localStorage.getItem(MARCA) || 'null'); } catch { return null; }
  },
  guardar: (u: MarcaSesion) => {
    try { localStorage.setItem(MARCA, JSON.stringify({ role: u.role, locationId: u.locationId ?? null })); } catch { /* sin almacenamiento */ }
  },
  borrar: () => {
    try { [MARCA, TOKEN_VIEJO, REFRESH_VIEJO].forEach((k) => localStorage.removeItem(k)); } catch { /* sin almacenamiento */ }
  },
};

/** Lo que va en todo pedido con sesión: la sede activa y el aviso de que la sesión va en cookies */
export const cabecerasDeSesion = (extra?: HeadersInit) => ({ ...cabeceraSede(extra), 'X-Sesion': 'cookie' });

/**
 * Pasa una sesión de antes (tokens en localStorage) a cookies: el servidor
 * renueva con el refresh viejo y responde poniendo las cookies. Después las
 * claves viejas se borran. Nadie tiene que volver a entrar.
 */
export async function migrarSesionVieja(): Promise<void> {
  let viejo: string | null = null;
  try { viejo = localStorage.getItem(REFRESH_VIEJO); } catch { return; }
  if (!viejo) return;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Sesion': 'cookie' },
      body: JSON.stringify({ refreshToken: viejo }),
    });
    if (!res.ok && res.status !== 401 && res.status !== 403) return; // servidor caído: se intenta la próxima vez
  } catch {
    return;
  }
  try { localStorage.removeItem(TOKEN_VIEJO); localStorage.removeItem(REFRESH_VIEJO); } catch { /* nada */ }
}

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

/**
 * El refresco no pudo ni preguntar (sin red, o el servidor caído o
 * reiniciándose en un despliegue). La sesión NO se da por cerrada: antes se
 * borraban los tokens y quien estaba trabajando caía al inicio de sesión.
 */
export class SinServidor extends Error {
  constructor() { super('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'); }
}

/**
 * Devuelve algo (no vacío) si la sesión se renovó, o null si el servidor
 * dijo que ya no vale. Lanza `SinServidor` si no se pudo saber.
 */
export function refrescarSesion(): Promise<string | null> {
  if (!refrescoEnCurso) {
    refrescoEnCurso = refrescarEntrePestanas().finally(() => { refrescoEnCurso = null; });
  }
  return refrescoEnCurso;
}

/**
 * Las pestañas comparten las cookies. El candado hace que refresquen de una
 * en una: la segunda ya manda la cookie que rotó la primera.
 */
function refrescarEntrePestanas(): Promise<string | null> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks) return refreshAccessToken();
  return locks.request('lalan-refresco', () => refreshAccessToken());
}

async function refreshAccessToken(): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Sesion': 'cookie' },
      body: '{}',
    });
  } catch {
    throw new SinServidor();
  }
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new SinServidor();
  /* Si se estaba en soporte, este refresco es porque la entrada al salón
     caducó: el servidor ya la borró y la sesión es otra vez la propia. Se
     recarga para que nada del salón ajeno se quede en pantalla. */
  try {
    if (localStorage.getItem(MARCA_SOPORTE)) {
      localStorage.removeItem(MARCA_SOPORTE);
      window.location.reload();
    }
  } catch { /* nada */ }
  return 'cookie';
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const { 'X-Sede': _sede, ...propias } = (options.headers as Record<string, string> ?? {});
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...propias,
    // La sede activa que eligió dirección (ver sedeActiva.ts) y la sesión en cookies
    ...cabecerasDeSesion(options.headers),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers, credentials: 'include' });

  if (res.status === 401 && retry) {
    // Sin marca de sesión no hay nada que renovar (pantallas antes de entrar)
    const renovada = sesionLocal.hay() ? await refrescarSesion() : null;
    if (renovada) return apiFetch<T>(path, options, false);
    sesionLocal.borrar();
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

/** La Vitrina pública de una sede, para compartirla o meterla en un QR */
export const urlDeVitrina = (slug: string) =>
  `${window.location.origin}${window.location.pathname}#/v/${slug}`;

/** La dirección corta de la Vitrina ("lalanspa/piantini"), sin /app/ ni # */
export const urlCortaDeVitrina = (direccion: string) => `${window.location.origin}/${direccion}`;

/**
 * Avisa al servidor que esta sesión se cierra (deja de salir en Mi cuenta y
 * su refresh ya no sirve). keepalive: llega aunque la página se recargue.
 */
export function salirEnServidor() {
  // Público en el servidor: cierra la sesión de la cookie aunque el acceso ya caducó, y borra las cookies
  void fetch(`${BASE_URL}/auth/salir`, {
    method: 'POST', keepalive: true, credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Sesion': 'cookie' }, body: '{}',
  }).catch(() => undefined);
}

export const api = {
  get:    <T>(path: string) => apiFetch<T>(path, { method: 'GET' }),
  post:   <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};

/**
 * Pedidos de toda la cadena, aunque haya una sede activa: lo que se configura
 * para todas las sedes a la vez (la lista de sedes en la bienvenida).
 */
const DE_LA_CADENA = { 'X-Sede': '' };
export const apiCadena = {
  get:   <T>(path: string) => apiFetch<T>(path, { method: 'GET', headers: DE_LA_CADENA }),
  post:  <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body), headers: DE_LA_CADENA }),
  patch: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body), headers: DE_LA_CADENA }),
  put:   <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body), headers: DE_LA_CADENA }),
};

/**
 * Descarga un archivo del backend (PDF, Excel) con la sesión y lo guarda.
 * En iPhone abre la vista del PDF, desde donde se comparte o se guarda.
 */
export async function descargarArchivo(path: string, nombre: string): Promise<void> {
  const pedir = () => fetch(`${BASE_URL}${path}`, { headers: cabecerasDeSesion(), credentials: 'include' });
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
  const pedir = () => fetch(`${BASE_URL}${path}`, { headers: cabecerasDeSesion(), credentials: 'include' });
  let res = await pedir();
  if (res.status === 401 && (await refrescarSesion())) res = await pedir();
  if (!res.ok) throw new Error('No se pudo cargar el archivo');
  return URL.createObjectURL(await res.blob());
}

/** Subir un archivo (multipart) con la sesión: notas de voz del chat */
export async function subirArchivo<T>(path: string, formulario: FormData): Promise<T> {
  const pedir = () => fetch(`${BASE_URL}${path}`, {
    method: 'POST', body: formulario, headers: cabecerasDeSesion(), credentials: 'include',
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
    headers: { 'Content-Type': 'application/json', ...cabecerasDeSesion() }, credentials: 'include',
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
