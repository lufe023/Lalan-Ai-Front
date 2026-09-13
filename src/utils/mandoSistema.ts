/**
 * Los controles del salón en la pantalla de bloqueo del teléfono.
 *
 * ── El problema ──────────────────────────────────────────────────────
 *
 * El sistema operativo enseña esos botones cuando UNA APLICACIÓN ESTÁ
 * REPRODUCIENDO AUDIO. Aquí no lo está: este teléfono es un mando, la
 * música sale del televisor. Para el teléfono no hay nada sonando, así que
 * no hay nada que controlar y no aparece ningún control.
 *
 * ── La solución, y por qué es un truco ───────────────────────────────
 *
 * Se reproduce un audio casi mudo en bucle. Con eso el sistema considera
 * que esta pestaña está poniendo música y publica sus controles; nosotros
 * atamos esos botones al socket, así que el dedo toca "siguiente" en la
 * pantalla de bloqueo y quien avanza es el televisor.
 *
 * Es un truco y hay que decirlo: los navegadores ajustan cada tanto qué
 * consideran "audio audible", así que en algún teléfono puede no aparecer.
 * Cuando no aparece no se rompe nada — el mando dentro de la app sigue
 * funcionando igual.
 *
 * Por eso el audio no es un silencio absoluto sino un rumor inaudible: un
 * silencio perfecto es justo lo que varios navegadores descartan por no
 * ser audible.
 */

import { ordenar } from '../services/musica';

let audio: HTMLAudioElement | null = null;
let contexto: AudioContext | null = null;
let encendido = false;

/**
 * El audio de fondo, como EMISIÓN EN DIRECTO y no como canción.
 *
 * La diferencia importa más de lo que parece, sobre todo en iPhone. Un
 * audio con duración es "una canción" para el sistema, y entonces la
 * pantalla de bloqueo enseña lo que enseña para una canción: retroceder
 * diez segundos, avanzar diez segundos y una barra de progreso que aquí no
 * significa nada —nuestro bucle no es la canción del salón—. Un flujo en
 * directo no tiene duración ni posición, así que el sistema deja de
 * ofrecer esos controles y pasa a los de pista.
 *
 * Por eso el sonido se fabrica con Web Audio y se entrega como MediaStream
 * en vez de como archivo.
 */
function flujoInaudible(): MediaStream | null {
  try {
    const Ctx = (window as any).AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return null;
    contexto = contexto ?? new Ctx();
    if (contexto!.state === 'suspended') void contexto!.resume();

    const destino = contexto!.createMediaStreamDestination();
    const oscilador = contexto!.createOscillator();
    const ganancia = contexto!.createGain();
    // Inaudible, pero NO silencio absoluto: un silencio perfecto es justo
    // lo que varios navegadores descartan por no ser audible, y entonces
    // no publican ningún control.
    ganancia.gain.value = 0.0001;
    oscilador.frequency.value = 40;
    oscilador.connect(ganancia).connect(destino);
    oscilador.start();
    return destino.stream;
  } catch { return null; }
}

/**
 * Plan B: un WAV corto generado aquí mismo, para navegadores sin Web Audio
 * o sin MediaStream en el elemento de audio. Vuelven los saltos de diez
 * segundos, pero al menos hay controles.
 */
function rumorInaudible(): string {
  const hz = 8000, segundos = 4;
  const muestras = hz * segundos;
  const buffer = new ArrayBuffer(44 + muestras);
  const v = new DataView(buffer);
  const texto = (pos: number, t: string) => {
    for (let i = 0; i < t.length; i++) v.setUint8(pos + i, t.charCodeAt(i));
  };
  texto(0, 'RIFF');
  v.setUint32(4, 36 + muestras, true);
  texto(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);      // PCM
  v.setUint16(22, 1, true);      // mono
  v.setUint32(24, hz, true);
  v.setUint32(28, hz, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);      // 8 bits
  texto(36, 'data');
  v.setUint32(40, muestras, true);
  for (let i = 0; i < muestras; i++) {
    // 128 es el silencio en 8 bits sin signo; ±1 es inaudible y no nulo
    v.setUint8(44 + i, 128 + (i % 2 ? 1 : -1));
  }
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

/**
 * Se llama DESDE UN TOQUE del usuario: reproducir audio sin un gesto está
 * prohibido, y este audio existe justamente para poder reproducirlo.
 */
export function encenderMandoSistema() {
  if (encendido) return;
  if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

  try {
    if (!audio) {
      audio = new Audio();
      audio.loop = true;
      audio.volume = 0.01;
      const flujo = flujoInaudible();
      if (flujo) audio.srcObject = flujo;
      else audio.src = rumorInaudible();   // sin Web Audio, el archivo sirve
    }
    void audio.play().then(() => { encendido = true; }).catch(() => { /* el sistema dijo que no */ });

    const poner = (accion: MediaSessionAction, fn: (() => void) | null) => {
      try { navigator.mediaSession.setActionHandler(accion, fn as any); }
      catch { /* esa acción no existe en este teléfono */ }
    };

    poner('play',          () => ordenar('play'));
    poner('pause',         () => ordenar('pause'));
    poner('stop',          () => ordenar('pause'));
    poner('nexttrack',     () => ordenar('next'));
    poner('previoustrack', () => ordenar('prev'));

    /* Saltar diez segundos o ir a un punto concreto no significan nada
       cuando lo que suena está en otro aparato: `seekto` se declara nulo
       para que el sistema no ofrezca la barra. Y si aun así ofrece los
       saltos —iOS a veces insiste—, quedan atados a canción anterior y
       siguiente: más vale que el botón haga lo razonable a que no haga
       nada, que es lo que pasaba. */
    poner('seekto', null);
    poner('seekbackward', () => ordenar('prev'));
    poner('seekforward',  () => ordenar('next'));
  } catch { /* si algo falla, simplemente no hay controles en el bloqueo */ }
}

/** Qué enseña la pantalla de bloqueo. Se llama en cada cambio de canción. */
export function actualizarMandoSistema(x: {
  titulo?: string | null; artista?: string | null; portada?: string | null;
  sonando: boolean;
}) {
  if (!encendido || !('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: x.titulo || 'Música del salón',
      artist: x.artista || 'Lalan AI',
      album: 'Sonando en el salón',
      artwork: x.portada
        ? [{ src: x.portada, sizes: '512x512', type: 'image/jpeg' }]
        : [],
    });
    /* El estado se declara aunque nuestro audio siga corriendo: lo que el
       usuario tiene que ver es si el SALÓN está en pausa, no si este rumor
       de fondo lo está. */
    navigator.mediaSession.playbackState = x.sonando ? 'playing' : 'paused';
  } catch { /* noop */ }
}

/** Al dejar de ser mando: se suelta el audio y los controles desaparecen. */
export function apagarMandoSistema() {
  encendido = false;
  try {
    audio?.pause();
    // El oscilador sigue vivo dentro del contexto; soltarlo evita que el
    // teléfono siga creyendo que esta pestaña hace audio.
    void contexto?.close(); contexto = null;
    if (audio) { audio.srcObject = null; audio = null; }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    }
  } catch { /* noop */ }
}
