/**
 * El sonido de llamada de la pizarra.
 *
 * Se sintetiza, no se descarga. Un archivo de audio habría que alojarlo,
 * servirlo y esperar a que cargue; dos osciladores suenan igual de bien,
 * pesan cero y funcionan aunque el televisor no tenga conexión en ese
 * instante.
 *
 * ── El obstáculo de verdad: el autoplay ──────────────────────────────
 *
 * Ningún navegador deja sonar audio antes de que alguien toque la página.
 * En un televisor colgado de la pared nadie va a tocar nada, así que hace
 * falta **un gesto una sola vez** al montarlo: eso es lo que hace
 * `activarSonido()`, y hasta que ocurra el `AudioContext` está suspendido y
 * no suena nada.
 *
 * Esto mismo es el requisito de la música que viene después: quien monte la
 * pantalla ya habrá dado ese gesto, y el reproductor podrá arrancar.
 */

let contexto: AudioContext | null = null;

/** ¿Se puede sonar ya, o falta el gesto? */
export const sonidoListo = () => contexto?.state === 'running';

/**
 * Llamar desde un manejador de clic REAL. Desde un temporizador o una
 * respuesta de red el navegador lo ignora.
 */
export async function activarSonido(): Promise<boolean> {
  try {
    const Ctx = (window as any).AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return false;
    if (!contexto) contexto = new Ctx();
    if (contexto!.state === 'suspended') await contexto!.resume();
    // Un pitido mudo confirma que el navegador nos dejó, sin molestar a nadie
    pitar(880, 0.001, 0.01);

    // La síntesis de voz necesita SU PROPIO gesto en varios navegadores, y
    // aprovecha este. Sin esta línea el primer anuncio se lo tragaba el
    // navegador y solo hablaba a partir del segundo turno llamado.
    try {
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        window.speechSynthesis.speak(u);
      }
    } catch { /* si no hay síntesis, queda el tono */ }

    return sonidoListo();
  } catch { return false; }
}

/** Un tono con entrada y salida suaves: un cuadrado seco suena a error */
function pitar(hz: number, volumen: number, segundos: number, retraso = 0) {
  if (!contexto) return;
  const t0 = contexto.currentTime + retraso;
  const osc = contexto.createOscillator();
  const gan = contexto.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(hz, t0);

  // Rampas en vez de saltos: un corte brusco produce un chasquido audible
  gan.gain.setValueAtTime(0.0001, t0);
  gan.gain.exponentialRampToValueAtTime(volumen, t0 + 0.02);
  gan.gain.exponentialRampToValueAtTime(0.0001, t0 + segundos);

  osc.connect(gan).connect(contexto.destination);
  osc.start(t0);
  osc.stop(t0 + segundos + 0.05);
}

/**
 * Dos notas descendentes, como el timbre de un ascensor. Se oye por encima
 * del ruido de un salón sin sonar a alarma: quien espera tiene que mirar la
 * pantalla, no asustarse.
 */
export function campanaDeLlamada() {
  if (!sonidoListo()) return;
  pitar(987.77, 0.35, 0.45);        // si5
  pitar(659.25, 0.35, 0.7, 0.22);   // mi5
}

/** Más corto y discreto: alguien pasó a un sillón, no hay que llamar a nadie */
export function tinDeCambio() {
  if (!sonidoListo()) return;
  pitar(1318.51, 0.14, 0.18);       // mi6
}


// ═════════════════════════════════════════════════════════════════════
//  VOZ
// ═════════════════════════════════════════════════════════════════════

/**
 * Las voces las instala el SISTEMA, no la web.
 *
 * Esto tiene una consecuencia que hay que decir en voz alta: la voz que se
 * elija desde el móvil en Ajustes puede no existir en el televisor. Por eso
 * se guarda el NOMBRE y aquí se busca; si no está, se cae a cualquier voz en
 * español, y si tampoco hay, a la que sea. Hablar con acento raro es mejor
 * que quedarse mudo.
 *
 * Además el catálogo llega tarde en algunos navegadores: la primera llamada
 * a getVoices() devuelve vacío y se puebla después, por eso el evento
 * `voiceschanged`.
 */
export function vocesDisponibles(): SpeechSynthesisVoice[] {
  try { return window.speechSynthesis?.getVoices?.() ?? []; } catch { return []; }
}

export function alCargarVoces(fn: () => void): () => void {
  try {
    window.speechSynthesis?.addEventListener?.('voiceschanged', fn);
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', fn);
  } catch { return () => {}; }
}

export const hayVoz = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

function elegirVoz(preferida?: string | null): SpeechSynthesisVoice | null {
  const voces = vocesDisponibles();
  if (!voces.length) return null;
  if (preferida) {
    const exacta = voces.find(v => v.name === preferida);
    if (exacta) return exacta;
  }
  return voces.find(v => v.lang?.toLowerCase().startsWith('es')) ?? voces[0] ?? null;
}

/**
 * Dice el texto, EN COLA.
 *
 * Antes cancelaba lo que estuviera sonando para que la voz no fuera por
 * detrás de la pantalla. Mala idea en un salón: si se llaman dos turnos
 * seguidos, cortar el primero deja a esa clienta sin enterarse. Ahora se
 * encolan y se oyen una tras otra — `speechSynthesis` ya lo hace solo, era
 * mi `cancel()` el que lo rompía.
 *
 * El precio, y conviene saberlo: con varias llamadas seguidas la voz puede
 * ir unos segundos por detrás de lo que muestra la pared. Es el intercambio
 * correcto: quien espera oye su turno completo aunque llegue tarde, en vez
 * de perdérselo por la mitad.
 *
 * `retrasoMs` deja pasar la campanada antes: el tono llama la atención y la
 * voz llega cuando ya están mirando.
 */
export function decir(texto: string, opts: { voz?: string | null; retrasoMs?: number } = {}) {
  if (!hayVoz() || !texto.trim()) return;
  const lanzar = () => {
    try {
      const u = new SpeechSynthesisUtterance(texto);
      const v = elegirVoz(opts.voz);
      if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'es-ES'; }
      u.rate = 0.95;   // un pelín lento: se entiende mejor de lejos
      u.pitch = 1;
      u.volume = 1;
      window.speechSynthesis.speak(u);
    } catch { /* si el televisor no tiene síntesis, queda el tono */ }
  };
  if (opts.retrasoMs) window.setTimeout(lanzar, opts.retrasoMs);
  else lanzar();
}

/** "Turno G15, Camila. Pase con Carlos M." — frases cortas, sin florituras */
export function fraseDeTurno(code: string, nombre?: string | null, destino?: string | null) {
  // El código se deletrea separado: "G 15" se entiende, "G15" suena a palabra
  const codigoHablado = code.replace(/([A-Za-z]+)(\d+)/, '$1 $2');
  const partes = [`Turno ${codigoHablado}`];
  if (nombre) partes.push(nombre);
  const frase = partes.join(', ');
  return destino ? `${frase}. Pase con ${destino}` : frase;
}

/** Corta lo que esté hablando. Solo para limpiar al cerrar la pantalla */
export function callar() {
  try { window.speechSynthesis?.cancel?.(); } catch { /* noop */ }
}
