/**
 * La voz de Lalan en su pantalla: la del propio teléfono o computadora
 * (speechSynthesis). Gratis y sin claves. Las voces las instala el sistema,
 * así que cada aparato guarda la suya.
 *
 * Las preferidas, en orden (las que mejor suenan, probadas por Luis):
 *  · iPhone / Mac: Paulina (español de México).
 *  · Chrome en Windows o Android: "Google español de Estados Unidos".
 * Si no está ninguna, cualquier voz en español.
 */
import { alCargarVoces, hayVoz, vocesDisponibles } from './campana';
import { ajustesLalan, type Pausa } from './ajustesLalan';

const CLAVE_VOZ = 'lalan_asistente_voz';
const CLAVE_CALLADA = 'lalan_asistente_callada';
const CLAVE_SEGUIR = 'lalan_asistente_seguir_escuchando';
const CLAVE_PAUSA = 'lalan_asistente_pausa';
const IDIOMAS = ['es-mx', 'es-us', 'es-do', 'es-419', 'es-es'];
/** Chrome corta las frases largas a los ~15 s: se dice frase por frase */
const LARGO_TROZO = 180;

export { alCargarVoces, hayVoz };

export function vocesEnEspanol(): SpeechSynthesisVoice[] {
  return vocesDisponibles().filter((v) => v.lang?.toLowerCase().startsWith('es'));
}

export function vozGuardada(): string | null {
  try { return localStorage.getItem(CLAVE_VOZ); } catch { return null; }
}
export function guardarVoz(nombre: string | null) {
  try { if (nombre) localStorage.setItem(CLAVE_VOZ, nombre); else localStorage.removeItem(CLAVE_VOZ); } catch { /* sin almacenamiento: usa la preferida */ }
}
export function estaCallada(): boolean {
  try { return localStorage.getItem(CLAVE_CALLADA) === '1'; } catch { return false; }
}
export function callarSiempre(si: boolean) {
  try { if (si) localStorage.setItem(CLAVE_CALLADA, '1'); else localStorage.removeItem(CLAVE_CALLADA); } catch { /* noop */ }
}

/** Conversación continua: lo que eligió este aparato, o null si nunca eligió (vale lo global) */
export function seguirEscuchando(): boolean | null {
  try { const v = localStorage.getItem(CLAVE_SEGUIR); return v === null ? null : v !== '0'; } catch { return null; }
}
export function guardarSeguirEscuchando(si: boolean) {
  try { localStorage.setItem(CLAVE_SEGUIR, si ? '1' : '0'); } catch { /* noop */ }
}
/** La pausa que eligió este aparato, o null si nunca eligió (vale la global) */
export function pausaGuardada(): Pausa | null {
  try { const p = localStorage.getItem(CLAVE_PAUSA); return p === 'corta' || p === 'normal' || p === 'larga' ? p : null; } catch { return null; }
}
export function guardarPausa(p: Pausa) {
  try { localStorage.setItem(CLAVE_PAUSA, p); } catch { /* noop */ }
}

/**
 * Un solo contexto de audio mientras la pantalla de Lalan está abierta. Se
 * crea en un TOQUE (el iPhone no deja arrancarlo de otra forma) y así la
 * escucha puede abrirse sola cuando Lalan termina de hablar.
 */
let contexto: AudioContext | null = null;
export function contextoDeAudio(): AudioContext | null { return contexto; }
export function prepararAudio() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!contexto || contexto.state === 'closed') contexto = new Ctx();
    void contexto.resume().catch(() => undefined);
  } catch { contexto = null; }
}
export function soltarAudio() {
  void contexto?.close().catch(() => undefined);
  contexto = null;
}

/** Un "tilín" suave: avisa que el micrófono se abrió (como Siri) */
export function tonoEscucho() {
  if (!ajustesLalan().tonoAlEscuchar) return;
  const c = contexto;
  if (!c || c.state !== 'running') return;
  try {
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(740, t);
    o.frequency.exponentialRampToValueAtTime(1180, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.25);
  } catch { /* sin tono */ }
}

/** La voz que se usará: la guardada, si no la mejor que haya */
export function vozDeLalan(): SpeechSynthesisVoice | null {
  const voces = vocesEnEspanol();
  if (!voces.length) return vocesDisponibles()[0] ?? null;
  const guardada = vozGuardada();
  const exacta = guardada ? voces.find((v) => v.name === guardada) : null;
  if (exacta) return exacta;
  // Las preferidas las pone el super admin (Plataforma → Lalan), en orden
  const norma = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  for (const nombre of ajustesLalan().vocesPreferidas.split(',').map(norma).filter(Boolean)) {
    const v = voces.find((x) => norma(x.name).includes(nombre));
    if (v) return v;
  }
  for (const l of IDIOMAS) { const v = voces.find((x) => x.lang.toLowerCase() === l); if (v) return v; }
  return voces[0];
}

/**
 * El iPhone solo deja hablar después de un toque. Se llama al tocar la
 * esfera: una frase vacía "abre" la voz para lo que venga después.
 */
export function despertarVoz() {
  if (!hayVoz()) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch { /* noop */ }
}

function trozos(texto: string): string[] {
  const frases = texto.replace(/\s+/g, ' ').trim().match(/[^.!?¿¡]+[.!?]*|[¿¡][^?!]+[?!]/g) ?? [texto];
  const salida: string[] = [];
  let actual = '';
  for (const f of frases.map((x) => x.trim()).filter(Boolean)) {
    if ((actual + ' ' + f).trim().length > LARGO_TROZO && actual) { salida.push(actual); actual = f; }
    else actual = `${actual} ${f}`.trim();
  }
  if (actual) salida.push(actual);
  return salida;
}

let turno = 0;

/**
 * Lalan dice el texto. Devuelve cuando termina (o cuando la cortan).
 * `alHablar` se llama con cada palabra: sirve para animar la esfera.
 */
export function decirComoLalan(texto: string, alHablar?: () => void): Promise<void> {
  callarLalan();
  if (!hayVoz() || !texto.trim()) return Promise.resolve();
  const mio = ++turno;
  const voz = vozDeLalan();
  const partes = trozos(texto);
  return new Promise((listo) => {
    let i = 0;
    const siguiente = () => {
      if (mio !== turno || i >= partes.length) { listo(); return; }
      const u = new SpeechSynthesisUtterance(partes[i++]);
      if (voz) { u.voice = voz; u.lang = voz.lang; } else u.lang = 'es-MX';
      u.rate = ajustesLalan().velocidadVoz;
      u.pitch = ajustesLalan().tonoVoz;
      u.onboundary = () => alHablar?.();
      u.onend = siguiente;
      u.onerror = siguiente;
      try { window.speechSynthesis.speak(u); } catch { listo(); }
    };
    siguiente();
  });
}

/** Cortar a Lalan al instante (la dueña tocó la esfera o se fue) */
export function callarLalan() {
  turno++;
  try { window.speechSynthesis?.cancel?.(); } catch { /* noop */ }
}

export function lalanHablando(): boolean {
  try { return !!window.speechSynthesis?.speaking; } catch { return false; }
}
