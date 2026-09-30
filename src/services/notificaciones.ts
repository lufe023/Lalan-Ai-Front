import { api } from './api';

/**
 * Notificaciones en la pantalla del teléfono (Web Push).
 * En iPhone solo existen con la app instalada en la pantalla de inicio
 * (iOS 16.4 o más nuevo) y el permiso se pide al tocar un botón.
 */
export type EstadoNotificaciones =
  | 'activas' | 'apagadas' | 'bloqueadas'
  /** iPhone en Safari: hay que instalar la app primero */
  | 'instalar'
  | 'no_soportado'
  /** El servidor todavía no tiene las llaves */
  | 'sin_servidor'
  /** npm run dev: sin service worker no hay notificaciones */
  | 'desarrollo';

const esIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalada = () => (navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches;

function aBytes(base64: string): Uint8Array {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4);
  const b = atob((base64 + relleno).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

async function registro(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function estadoNotificaciones(): Promise<EstadoNotificaciones> {
  if (import.meta.env.DEV) return 'desarrollo';
  if (esIOS() && !instalada()) return 'instalar';
  if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) return 'no_soportado';
  if (Notification.permission === 'denied') return 'bloqueadas';
  const reg = await registro();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'activas' : 'apagadas';
}

/** Pide el permiso y guarda el aparato en el servidor. Tiene que llamarse desde un toque. */
export async function activarNotificaciones(): Promise<EstadoNotificaciones> {
  const { clave } = await api.get<{ clave: string | null }>('/push/clave');
  if (!clave) return 'sin_servidor';
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return permiso === 'denied' ? 'bloqueadas' : 'apagadas';
  const reg = await registro();
  if (!reg) return 'no_soportado';
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clave) as BufferSource }));
  const j = sub.toJSON();
  await api.post('/push/suscripcion', {
    endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth,
    aparato: `${esIOS() ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android' : 'Computadora'}`,
  });
  return 'activas';
}

export async function apagarNotificaciones(): Promise<void> {
  const sub = await (await registro())?.pushManager.getSubscription();
  if (!sub) return;
  await api.post('/push/suscripcion/quitar', { endpoint: sub.endpoint }).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}

export const probarNotificacion = () => api.post<{ llegaron: number }>('/push/prueba', {});
