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
import { pronunciar } from '../landing/vozNavegador';
import { pedirAudio } from '../services/api';

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

/**
 * Lo que eligió esta persona: una voz del aparato (gratis) o la voz natural
 * de la nube (la de pago que activa Plataforma), guardada como "nube" o
 * "nube:celeste". Si nunca eligió y Plataforma tiene encendida la nube, la nube.
 */
const PREFIJO_NUBE = 'nube';
export const vozDeNube = (aura?: string | null) => (aura ? `${PREFIJO_NUBE}:${aura}` : PREFIJO_NUBE);
export function usaVozDeNube(): boolean {
  if (ajustesLalan().motorVoz === 'aparato') return false;
  const g = vozGuardada();
  return !g || g === PREFIJO_NUBE || g.startsWith(`${PREFIJO_NUBE}:`);
}
/** La voz de Aura-2 que eligió (null = la de Plataforma) */
export function auraElegida(): string | null {
  const g = vozGuardada();
  return g?.startsWith(`${PREFIJO_NUBE}:`) ? g.slice(PREFIJO_NUBE.length + 1) : null;
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
  // "nube…" no es una voz del aparato: aquí vale la preferida
  const exacta = guardada && !guardada.startsWith(PREFIJO_NUBE) ? voces.find((v) => v.name === guardada) : null;
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
  despertarAudio();
  if (!hayVoz()) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch { /* noop */ }
}

// ── La voz de Cloudflare (MeloTTS / Aura-2), cuando el super admin la eligió ──

/** Un mp3 mudo de 50 ms: tocarlo en el toque "abre" el reproductor en el iPhone */
const MUDO = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//NwwAAAAAAAAAAAAEluZm8AAAAPAAAABAAAAlgAenp6enp6enp6enp6enp6enp6enp6enp6pqampqampqampqampqampqampqampqamptPT09PT09PT09PT09PT09PT09PT09PT09P/////////////////////////////////AAAAAExhdmM2MC4zMQAAAAAAAAAAAAAAACQCcQAAAAAAAAJY+/rsqgAAAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NCxKMAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
let reproductor: HTMLAudioElement | null = null;
let pedidos: AbortController | null = null;

function elReproductor(): HTMLAudioElement {
  if (!reproductor) { reproductor = new Audio(); reproductor.preload = 'auto'; }
  return reproductor;
}

/** Se llama en un toque: después el iPhone deja reproducir la voz sin otro toque */
export function despertarAudio() {
  try { const a = elReproductor(); a.src = MUDO; void a.play().catch(() => undefined); } catch { /* noop */ }
}

// ── Lo que la esfera necesita para moverse con la voz ─────────────

/**
 * El volumen de la voz natural, momento a momento. Se saca del mp3 antes de
 * que suene (se decodifica aparte, sin tocar el audio que se oye: conectar el
 * reproductor a un AudioContext en el iPhone puede dejarlo mudo).
 */
let envolvente: { url: string; niveles: Float32Array; paso: number } | null = null;
/** Cuándo dijo la última palabra la voz del teléfono (no deja leer su audio) */
let ultimaPalabra = 0;
const VENTANA_ENVOLVENTE_S = 0.02;

async function calcularEnvolvente(blob: Blob, url: string) {
  try {
    const Offline = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    if (!Offline) return;
    const ctx = new Offline(1, 1, 22050);
    const datos = await blob.arrayBuffer();
    const audio: AudioBuffer = await new Promise((ok, mal) => {
      const p = ctx.decodeAudioData(datos, ok, mal);
      if (p && typeof (p as Promise<AudioBuffer>).then === 'function') (p as Promise<AudioBuffer>).then(ok, mal);
    });
    const canal = audio.getChannelData(0);
    const tam = Math.max(1, Math.round(audio.sampleRate * VENTANA_ENVOLVENTE_S));
    const niveles = new Float32Array(Math.ceil(canal.length / tam));
    for (let i = 0; i < niveles.length; i++) {
      let suma = 0;
      const desde = i * tam, hasta = Math.min(canal.length, desde + tam);
      for (let j = desde; j < hasta; j++) suma += canal[j] * canal[j];
      niveles[i] = Math.sqrt(suma / Math.max(1, hasta - desde));
    }
    // Se normaliza con lo más fuerte de ESTA frase (sin el 3 % de picos), para que toda voz llene la esfera igual
    const orden = Array.from(niveles).sort((a, b) => a - b);
    const tope = orden[Math.floor(orden.length * 0.97)] || 1;
    for (let i = 0; i < niveles.length; i++) niveles[i] = Math.min(1, Math.sqrt(niveles[i] / tope));
    envolvente = { url, niveles, paso: VENTANA_ENVOLVENTE_S };
  } catch { /* sin envolvente: la esfera usa el ritmo de habla */ }
}

/**
 * Qué tan fuerte suena Lalan AHORA (0 a 1), para la esfera. Con la voz
 * natural es el volumen real; con la del teléfono, un ritmo de sílabas que
 * se aviva con cada palabra (el navegador no deja leer ese audio).
 */
export function nivelDeLalan(t = performance.now()): number {
  const a = reproductor;
  if (a && !a.paused && !a.ended) {
    if (envolvente && a.src === envolvente.url) {
      const i = Math.floor(a.currentTime / envolvente.paso);
      return envolvente.niveles[Math.min(envolvente.niveles.length - 1, Math.max(0, i))] ?? 0;
    }
    return ritmoDeHabla(t, t);
  }
  try { if (window.speechSynthesis?.speaking) return ritmoDeHabla(t, ultimaPalabra); } catch { /* noop */ }
  return 0;
}

/** Sílabas (~4–7 por segundo) que no se repiten, más un empujón al empezar cada palabra */
export function ritmoDeHabla(t: number, palabra: number) {
  const s = t / 1000;
  const silabas = 0.5 + 0.28 * Math.sin(s * 2 * Math.PI * 4.3) + 0.16 * Math.sin(s * 2 * Math.PI * 6.7 + 1.3) + 0.1 * Math.sin(s * 2 * Math.PI * 2.1 + 2.6);
  const empujon = Math.exp(-(t - palabra) / 260);
  return Math.max(0, Math.min(1, silabas * (0.65 + 0.35 * empujon)));
}

/** Toca un mp3 y espera a que termine (o a que la corten) */
function tocar(blob: Blob, mio: number, alHablar?: () => void): Promise<void> {
  return new Promise((listo) => {
    const a = elReproductor();
    const url = URL.createObjectURL(blob);
    void calcularEnvolvente(blob, url);
    // La esfera late mientras habla (el audio no avisa palabra por palabra)
    const latido = window.setInterval(() => { if (mio === turno) alHablar?.(); }, 190);
    const fin = () => {
      window.clearInterval(latido); a.onended = null; a.onerror = null; a.onpause = null; URL.revokeObjectURL(url);
      if (envolvente?.url === url) envolvente = null;
      listo();
    };
    a.onended = fin;
    a.onerror = fin;
    a.onpause = () => { if (mio !== turno) fin(); };
    a.src = url;
    a.playbackRate = ajustesLalan().velocidadVoz;
    void a.play().catch(fin);
  });
}

/**
 * Con la voz de Cloudflare: pide la primera frase y, mientras suena, ya pide
 * la siguiente. Devuelve las frases que NO pudo decir (para que las diga la
 * voz del aparato): si la nube falla o el servidor dice "usa el aparato".
 */
async function decirConNube(partes: string[], mio: number, alHablar?: () => void): Promise<string[]> {
  pedidos?.abort();
  const control = new AbortController();
  pedidos = control;
  // La primera frase sola (corta = llega rápido y Lalan empieza a hablar antes);
  // las demás se piden TODAS de una vez mientras suena la primera
  const [primera, ...resto] = partes;
  const corte = primera.search(/[.!?](\s|$)/);
  const lista = corte > 0 && corte < primera.length - 1
    ? [primera.slice(0, corte + 1).trim(), primera.slice(corte + 1).trim(), ...resto].filter(Boolean)
    : partes;
  const audios = lista.map((t) => {
    const aura = ajustesLalan().motorVoz === 'aura2' ? auraElegida() : null;
    const p = pedirAudio('/asistente/voz-lalan', aura ? { texto: t, voz: aura } : { texto: t }, control.signal);
    p.catch(() => undefined);
    return p;
  });
  for (let i = 0; i < lista.length; i++) {
    let audio: Blob | null;
    try { audio = await audios[i]; } catch { return mio === turno ? lista.slice(i) : []; }
    if (mio !== turno) return [];
    if (!audio) return lista.slice(i);
    await tocar(audio, mio, alHablar);
    if (mio !== turno) return [];
  }
  return [];
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
export async function decirComoLalan(texto: string, alHablar?: () => void): Promise<void> {
  callarLalan();
  if (!texto.trim()) return;
  const mio = ++turno;
  let partes = trozos(texto);
  if (usaVozDeNube()) {
    partes = await decirConNube(partes, mio, alHablar);
    if (!partes.length || mio !== turno) return;
  }
  return decirConAparato(partes, mio, alHablar);
}

/** Con la voz del aparato (gratis): frase por frase */
function decirConAparato(partes: string[], mio: number, alHablar?: () => void): Promise<void> {
  if (!hayVoz()) return Promise.resolve();
  const voz = vozDeLalan();
  return new Promise((listo) => {
    let i = 0;
    const siguiente = () => {
      if (mio !== turno || i >= partes.length) { listo(); return; }
      const u = new SpeechSynthesisUtterance(pronunciar(partes[i++], ajustesLalan().pronunciaLalan));
      if (voz) { u.voice = voz; u.lang = voz.lang; } else u.lang = 'es-MX';
      u.rate = ajustesLalan().velocidadVoz;
      u.pitch = ajustesLalan().tonoVoz;
      u.onboundary = () => { ultimaPalabra = performance.now(); alHablar?.(); };
      u.onstart = () => { ultimaPalabra = performance.now(); };
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
  pedidos?.abort();
  pedidos = null;
  try { reproductor?.pause(); } catch { /* noop */ }
  try { window.speechSynthesis?.cancel?.(); } catch { /* noop */ }
}

export function lalanHablando(): boolean {
  try { return !!window.speechSynthesis?.speaking || (!!reproductor && !reproductor.paused && !reproductor.ended); } catch { return false; }
}
