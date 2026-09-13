import { io, Socket } from 'socket.io-client';
import { tokenStore } from './api';

/**
 * Tiempo real, un socket para toda la aplicación.
 *
 * Por aquí NO viajan datos, solo señales: el servidor avisa "cambió la sala"
 * y quien escuche vuelve a pedir lo suyo por HTTP con sus credenciales. Por
 * eso el mismo canal sirve para la app con sesión y para la pantalla de
 * pared sin ella: no hay nada que filtrar por destinatario.
 *
 * El sondeo no desaparece: se queda de red de seguridad y con un intervalo
 * mucho más largo. Un socket puede caerse sin avisar —proxy, wifi del local,
 * el navegador viejo de una smart TV— y una pantalla congelada sin que nadie
 * lo note es peor que una que tarda medio minuto.
 */

const URL_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000/api/v1';

/**
 * Ruta propia, no la de por defecto.
 *
 * Con `/socket.io` el backend reventaba al primer intento de conexión:
 * `handleUpgrade() was called more than once with the same socket`, que es
 * lo que pasa cuando dos servidores de sockets escuchan la misma ruta del
 * mismo puerto. Tiene que coincidir con `RUTA_SOCKET` del backend.
 */
const RUTA = '/rt';

/** El socket cuelga de la raíz del servidor, no del prefijo /api/v1 */
const origenDelServidor = () => {
  try { return new URL(URL_BASE, window.location.origin).origin; }
  catch { return window.location.origin; }
};

type Escucha = (carga: any) => void;

let socket: Socket | null = null;
let modoActual = '';
const escuchas = new Map<string, Set<Escucha>>();

function reenviar(evento: string, carga: any) {
  escuchas.get(evento)?.forEach(fn => {
    try { fn(carga); } catch { /* un oyente roto no puede tumbar a los demás */ }
  });
}

/**
 * `musica:cambio` y `musica:orden` son la excepción a lo de arriba: sí traen
 * datos. Qué suena no está en la base de datos —cambia cada segundo y no
 * significa nada mañana—, así que no hay endpoint al que ir a pedirlo. Y no
 * hace falta filtrar nada: es un título, una portada y un segundero, lo mismo
 * que ya se ve escrito en la pared.
 */
const EVENTOS = [
  'sala:cambio', 'turno:llamado', 'ventas:cambio',
  'musica:cambio', 'musica:orden', 'musica:permiso',
];

function conectar(auth: Record<string, any>, modo: string) {
  if (socket && modoActual === modo) return socket;
  desconectar();
  modoActual = modo;

  socket = io(origenDelServidor(), {
    auth,
    path: RUTA,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 8000,
  });

  for (const ev of EVENTOS) socket.on(ev, (carga: any) => reenviar(ev, carga));
  // Al reconectar puede haber pasado de todo mientras no estábamos
  socket.on('connect', () => {
    reenviar('sala:cambio', { motivo: 'reconectado' });
    reenviar('socket:conectado', { en: new Date().toISOString() });
  });
  /* Perder el enlace importa tanto como recuperarlo: mientras no lo haya,
     lo que esta pantalla cree saber del salón puede ser mentira. */
  socket.on('disconnect', () => reenviar('socket:desconectado', {}));
  return socket;
}

/** La app: se identifica con el JWT que ya tiene guardado */
export function conectarComoUsuario() {
  const token = tokenStore.get();
  if (!token) return null;
  return conectar({ tipo: 'app', token }, `app:${token.slice(-12)}`);
}

/** La pantalla de pared: su token público, y solo para escuchar */
export function conectarComoPantalla(token: string) {
  return conectar({ tipo: 'pantalla', token }, `pantalla:${token}`);
}

export function desconectar() {
  try { socket?.removeAllListeners(); socket?.disconnect(); } catch { /* noop */ }
  socket = null;
  modoActual = '';
}

/** Devuelve la función para dejar de escuchar */
export function alRecibir(evento: string, fn: Escucha): () => void {
  if (!escuchas.has(evento)) escuchas.set(evento, new Set());
  escuchas.get(evento)!.add(fn);
  return () => { escuchas.get(evento)?.delete(fn); };
}

export const estaConectado = () => !!socket?.connected;

/** Quiénes somos para el servidor. Cambia en cada reconexión. */
export const idSocket = () => socket?.id ?? null;

/**
 * Emitir hacia el servidor. Solo lo usa la música: el resto del sistema
 * escucha señales y pide por HTTP.
 *
 * Si no hay socket no pasa nada y no se lanza error a propósito — quien
 * pulsa "siguiente" sin conexión no necesita un diálogo rojo, necesita que
 * el botón no haga nada y que el estado de "sin enlace" ya visible se lo
 * explique.
 */
export function mandar(evento: string, carga?: any) {
  try { socket?.emit(evento, carga ?? {}); } catch { /* noop */ }
}

/** Se dispara en cada (re)conexión: sirve para volver a pedir estado */
export function alConectar(fn: () => void): () => void {
  return alRecibir('socket:conectado', fn);
}

/** Se cayó el enlace. Lo que sepamos del salón deja de ser fiable. */
export function alDesconectar(fn: () => void): () => void {
  return alRecibir('socket:desconectado', fn);
}
