import { api, tokenStore, publicRequest, ErrorPublico } from './api';

const DEVICE_ID_KEY = 'lalan_quick_device_id';
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
      const secret = localStorage.getItem(DEVICE_SECRET_KEY);
      const userRaw = localStorage.getItem(DEVICE_USER_KEY);
      const deviceName = localStorage.getItem(DEVICE_NAME_KEY) || getFriendlyDeviceName();

      if (deviceId && secret && userRaw) {
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
    const deviceSecret = generateCryptoSecret();
    const deviceName = getFriendlyDeviceName();

    // 1. Registrar en el backend
    await api.post('/auth/quick-login/register', {
      deviceId,
      deviceSecret,
      deviceName,
    });

    // 2. Guardar en almacenamiento seguro local
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    localStorage.setItem(DEVICE_SECRET_KEY, deviceSecret);
    localStorage.setItem(DEVICE_NAME_KEY, deviceName);
    localStorage.setItem(DEVICE_USER_KEY, JSON.stringify(user));
  },

  /**
   * Inicia sesión con 1 solo toque usando el dispositivo registrado
   */
  async loginWithDevice(): Promise<{ user: any; accessToken: string }> {
    const deviceId = localStorage.getItem(DEVICE_ID_KEY);
    const deviceSecret = localStorage.getItem(DEVICE_SECRET_KEY);

    if (!deviceId || !deviceSecret) {
      throw new Error('Dispositivo no configurado para acceso rápido.');
    }

    // 1. Enviar petición al endpoint público de acceso rápido
    let res: { accessToken: string; refreshToken: string; user: any; newDeviceSecret?: string };
    try {
      res = await publicRequest('/auth/quick-login', { method: 'POST', body: { deviceId, deviceSecret } });
    } catch (e) {
      // 401: desvinculado, vencido o secreto viejo. El botón deja de salir y se entra con clave.
      if (e instanceof ErrorPublico && e.status === 401) {
        localStorage.removeItem(DEVICE_SECRET_KEY);
        localStorage.removeItem(DEVICE_USER_KEY);
        localStorage.removeItem(DEVICE_NAME_KEY);
      }
      throw e;
    }

    // 2. Guardar tokens de sesión
    tokenStore.set(res.accessToken);
    tokenStore.setRefresh(res.refreshToken);

    // 3. Rotación de secreto (Seguridad: el secreto cambia en cada inicio de sesión)
    if (res.newDeviceSecret) {
      localStorage.setItem(DEVICE_SECRET_KEY, res.newDeviceSecret);
    }

    // 4. Actualizar datos del usuario local
    if (res.user) {
      localStorage.setItem(DEVICE_USER_KEY, JSON.stringify(res.user));
    }

    return { user: res.user, accessToken: res.accessToken };
  },

  /**
   * Desvincula y revoca el acceso rápido en este dispositivo
   */
  async revokeDevice(): Promise<void> {
    const deviceId = localStorage.getItem(DEVICE_ID_KEY);
    try {
      if (deviceId && tokenStore.get()) {
        await api.delete(`/auth/quick-login/${encodeURIComponent(deviceId)}`).catch(() => {});
      }
    } finally {
      localStorage.removeItem(DEVICE_SECRET_KEY);
      localStorage.removeItem(DEVICE_USER_KEY);
      localStorage.removeItem(DEVICE_NAME_KEY);
    }
  },
};
