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

/** Un número de WhatsApp que la dueña autorizó en Meta */
export interface NumeroWhatsapp { id: string; wabaId: string; numero: string | null; nombre: string | null }

/** Cómo termina Conectar WhatsApp: conectado, o varios números para elegir */
export interface ResultadoWhatsapp {
  conectado: boolean; locationId: string; numero: string | null; nombre: string | null; avisos: string[];
  elegir?: { pendiente: string; numeros: NumeroWhatsapp[] };
}

/** Lo que vuelve de Meta por la misma pestaña: las páginas (Facebook) o el WhatsApp */
export type RetornoFacebook = PaginasPendientes | { canal: 'whatsapp'; locationId: string; whatsapp: ResultadoWhatsapp };

/** Números de WhatsApp para elegir que esperan a la pantalla de conectar */
export interface NumerosPendientes { canal: 'whatsapp'; locationId: string; pendiente: string; numeros: NumeroWhatsapp[] }

/** Dónde se guardan un momento las páginas entre la vuelta de Facebook y la pantalla de conectar */
const CLAVE_PENDIENTES = 'lalan-paginas-pendientes';
const CLAVE_NUMEROS = 'lalan-numeros-pendientes';

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

/**
 * Conectar WhatsApp en la app instalada: la ventanita de Meta no existe ahí
 * (antes se intentaba abrir el navegador y en el iPhone solo se recargaba la
 * app). Se va a Meta en esta pestaña y se vuelve por /facebook-conectado.
 */
export async function irAWhatsapp(coexistencia: boolean, sede?: string) {
  const q = new URLSearchParams({ coexistencia: coexistencia ? '1' : '0', ...(sede ? { sede } : {}) });
  const { url } = await api.get<{ url: string }>(`/bots/conexion/whatsapp/url?${q}`);
  window.location.assign(url);
}

export async function terminarFacebook(code: string, state: string): Promise<RetornoFacebook> {
  return api.post<RetornoFacebook>('/bots/conexion/facebook', { code, state });
}

export function guardarNumeros(p: NumerosPendientes) {
  try { sessionStorage.setItem(CLAVE_NUMEROS, JSON.stringify(p)); } catch { /* sin almacenamiento: habrá que volver a conectar */ }
}

/** Los números que dejó la vuelta de Meta (una sola vez: se borran al leerlos) */
export function tomarNumeros(): NumerosPendientes | null {
  try {
    const t = sessionStorage.getItem(CLAVE_NUMEROS);
    sessionStorage.removeItem(CLAVE_NUMEROS);
    return t ? JSON.parse(t) as NumerosPendientes : null;
  } catch { return null; }
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
