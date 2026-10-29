import { api, ErrorPublico, sesionLocal, URL_API } from './api';

const DEVICE_ID_KEY = 'lalan_quick_device_id';
/** Solo de versiones viejas: el secreto ahora vive en una cookie httpOnly que pone el servidor */
const DEVICE_SECRET_KEY = 'lalan_quick_device_secret';
const DEVICE_USER_KEY = 'lalan_quick_device_user';
const DEVICE_NAME_KEY = 'lalan_quick_device_name';

export interface QuickAuthUser {
  id: string;
  name: string;
  email: string;
  role?: string;
  avatar?: string;
}

export interface QuickAuthRegistration {
  isRegistered: boolean;
  deviceId: string | null;
  deviceName: string | null;
  user: QuickAuthUser | null;
}

/**
 * Detecta el nombre legible del dispositivo actual (ej: "iPhone (PWA)", "Android", etc.)
 */
export function getFriendlyDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Dispositivo';
  const ua = navigator.userAgent || '';
  const isStandalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;

  let base = 'Navegador';
  if (/iPhone/i.test(ua)) base = 'iPhone';
  else if (/iPad/i.test(ua)) base = 'iPad';
  else if (/Android/i.test(ua)) base = 'Android';
  else if (/Macintosh/i.test(ua)) base = 'Mac';
  else if (/Windows/i.test(ua)) base = 'PC Windows';

  return isStandalone ? `${base} (PWA)` : base;
}

/**
 * Genera un secreto criptográfico de 256 bits en hexadecimal
 */
function generateCryptoSecret(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint8Array(32);
    window.crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback con Math.random + timestamp
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/**
 * Obtiene o crea un ID persistente para este dispositivo físico
 */
export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'dev_' + generateCryptoSecret().slice(0, 24);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'dev_ephemeral_' + Date.now();
  }
}

export const quickAuth = {
  /**
   * Consulta si este dispositivo ya tiene el Acceso Rápido configurado
   */
  getRegistration(): QuickAuthRegistration {
    try {
      const deviceId = localStorage.getItem(DEVICE_ID_KEY);
      const userRaw = localStorage.getItem(DEVICE_USER_KEY);
      const deviceName = localStorage.getItem(DEVICE_NAME_KEY) || getFriendlyDeviceName();

      if (deviceId && userRaw) {
        return {
          isRegistered: true,
          deviceId,
          deviceName,
          user: JSON.parse(userRaw),
        };
      }
    } catch {}

    return {
      isRegistered: false,
      deviceId: null,
      deviceName: null,
      user: null,
    };
  },

  /**
   * Registra el dispositivo actual en el backend y guarda las credenciales locales
   */
  async registerDevice(user: QuickAuthUser): Promise<void> {
    const deviceId = getOrCreateDeviceId();
    const deviceName = getFriendlyDeviceName();

    // 1. Registrar en el backend: el servidor crea el secreto y lo deja en una cookie httpOnly
    await api.post('/auth/quick-login/register', { deviceId, deviceName });

    // 2. Aquí solo queda lo que no abre nada: el id, el nombre y a quién mostrar en el botón
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    localStorage.removeItem(DEVICE_SECRET_KEY);
    localStorage.setItem(DEVICE_NAME_KEY, deviceName);
    localStorage.setItem(DEVICE_USER_KEY, JSON.stringify(user));
  },

  /**
   * Inicia sesión con 1 solo toque usando el dispositivo registrado
   */
  async loginWithDevice(): Promise<{ user: any }> {
    const deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) throw new Error('Dispositivo no configurado para acceso rápido.');
    // Un aparato vinculado con una versión vieja aún guarda su secreto: se manda una vez y se borra
    const viejo = localStorage.getItem(DEVICE_SECRET_KEY);

    // 1. Endpoint público de acceso rápido; la cookie del aparato viaja sola
    let res: Response;
    try {
      res = await fetch(`${URL_API}/auth/quick-login`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Sesion': 'cookie' },
        body: JSON.stringify(viejo ? { deviceId, deviceSecret: viejo } : { deviceId }),
      });
    } catch {
      throw new ErrorPublico('No hay conexión. Revisa tu internet e inténtalo de nuevo.', 0);
    }
    if (!res.ok) {
      const cuerpo = await res.json().catch(() => null);
      const m = cuerpo?.message?.message ?? cuerpo?.message ?? 'No se pudo entrar';
      // 401: desvinculado, vencido o secreto viejo. El botón deja de salir y se entra con clave.
      if (res.status === 401) {
        localStorage.removeItem(DEVICE_SECRET_KEY);
        localStorage.removeItem(DEVICE_USER_KEY);
        localStorage.removeItem(DEVICE_NAME_KEY);
      }
      throw new ErrorPublico(Array.isArray(m) ? m.join(' | ') : String(m), res.status);
    }
    const datos: { user: any } = await res.json();

    // 2. La sesión y el secreto nuevo del aparato ya quedaron en cookies httpOnly
    localStorage.removeItem(DEVICE_SECRET_KEY);
    sesionLocal.guardar(datos.user ?? {});

    // 3. Actualizar datos del usuario local
    if (datos.user) {
      localStorage.setItem(DEVICE_USER_KEY, JSON.stringify(datos.user));
    }

    return { user: datos.user };
  },

  /**
   * Desvincula y revoca el acceso rápido en este dispositivo
   */
  async revokeDevice(): Promise<void> {
    const deviceId = localStorage.getItem(DEVICE_ID_KEY);
    try {
      if (deviceId && sesionLocal.hay()) {
        await api.delete(`/auth/quick-login/${encodeURIComponent(deviceId)}`).catch(() => {});
      }
    } finally {
      localStorage.removeItem(DEVICE_SECRET_KEY);
      localStorage.removeItem(DEVICE_USER_KEY);
      localStorage.removeItem(DEVICE_NAME_KEY);
    }
  },
};
