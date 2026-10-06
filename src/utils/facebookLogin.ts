/**
 * Conectar Facebook (Messenger e Instagram por la página) sin la ventanita
 * del SDK. En la app instalada del iPhone esa ventana se abre aparte y nunca
 * le avisa a Lalan: el botón se quedaba girando. Aquí se va a Facebook en la
 * misma pestaña y se vuelve por /facebook-conectado → /app/?fb_code=…
 */
import { api } from '../services/api';
import type { CommunicationChannel } from '../types';

/** Lo que devuelve el backend al volver: el permiso de la dueña y sus páginas, para elegir */
export interface PaginasPendientes {
  tokenUsuario: string;
  canal: CommunicationChannel;
  locationId: string | null;
  paginas: { id: string; nombre: string; instagram: string | null; foto?: string | null; seguidores?: number | null; negocio?: string | null }[];
}

/** Dónde se guardan un momento las páginas entre la vuelta de Facebook y la pantalla de conectar */
const CLAVE_PENDIENTES = 'lalan-paginas-pendientes';

/** La app instalada (o un teléfono): ahí las ventanitas de Facebook no vuelven */
export function necesitaRedireccion(): boolean {
  const instalada = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  const telefono = window.matchMedia?.('(pointer: coarse)').matches;
  return !!(instalada || telefono);
}

export function esAppInstalada(): boolean {
  return !!(window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);
}

export async function irAFacebook(canal: CommunicationChannel, sede?: string) {
  const q = new URLSearchParams({ canal, ...(sede ? { sede } : {}) });
  const { url } = await api.get<{ url: string }>(`/bots/conexion/facebook/url?${q}`);
  window.location.assign(url);
}

export async function terminarFacebook(code: string, state: string): Promise<PaginasPendientes> {
  return api.post<PaginasPendientes>('/bots/conexion/facebook', { code, state });
}

export function guardarPendientes(p: PaginasPendientes) {
  try { sessionStorage.setItem(CLAVE_PENDIENTES, JSON.stringify(p)); } catch { /* sin almacenamiento: habrá que volver a conectar */ }
}

/** Las páginas que dejó la vuelta de Facebook (una sola vez: se borran al leerlas) */
export function tomarPendientes(): PaginasPendientes | null {
  try {
    const t = sessionStorage.getItem(CLAVE_PENDIENTES);
    sessionStorage.removeItem(CLAVE_PENDIENTES);
    return t ? JSON.parse(t) as PaginasPendientes : null;
  } catch { return null; }
}
