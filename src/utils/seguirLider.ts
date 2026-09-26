import { ahoraServidor, type EstadoSala } from '../services/musica';

/**
 * Que varios altavoces suenen como uno.
 *
 * No hay streaming: cada aparato reproduce por su cuenta la misma canción y
 * lo único que viaja es "qué suena y en qué segundo va". Lo que los separa
 * son tres cosas distintas, y cada una se arregla de una manera:
 *
 *  1. ARRANCAR JUNTOS. Las órdenes de play, pausa y salto llevan una hora
 *     del servidor. Al llegar la orden, cada aparato SALTA YA a la posición
 *     que tocará en esa hora —para que le dé tiempo a cargar— y se queda
 *     esperando; a la hora, solo pulsa play. Esto es lo que antes fallaba:
 *     el salto se hacía en el último instante y la recarga del vídeo se
 *     comía cientos de milisegundos, distintos en cada aparato.
 *
 *  2. NO SEPARARSE. Cada segundo se compara la posición propia con la del
 *     líder; si la diferencia pasa de medio segundo, se salta. Un salto
 *     interrumpe el audio, así que este arreglo es solo para desfases
 *     grandes (una recarga, una pestaña dormida).
 *
 *  3. EL DESFASE FINO. Lo que queda —décimas— es que cada aparato tarda un
 *     poco distinto en empezar a sonar. Eso NO se arregla con saltos: se
 *     arregla adelantando su posición. Se mide solo (`Calibrador`) y se
 *     guarda por aparato; lo que la máquina no puede ver —lo que tarda el
 *     altavoz de un televisor en sacar el sonido— se remata a mano desde la
 *     lista de altavoces.
 */

/** Diferencia (s) a partir de la cual se corrige con un salto */
export const UMBRAL_S = 0.5;
/** Descanso mínimo (ms) entre dos saltos de corrección */
export const DESCANSO_MS = 4000;

/** El mínimo que se usa del reproductor de YouTube, para poder probarlo */
export interface ReproductorLike {
  getCurrentTime?: () => number;
  getPlayerState?: () => number;
  playVideo?: () => void;
  pauseVideo?: () => void;
  seekTo?: (s: number, permitirAdelante?: boolean) => void;
}

/**
 * En qué segundo debería ir este aparato AHORA.
 *
 * El líder midió `posicion` en `posicionEn` (hora del servidor). Si sigue
 * sonando, ha pasado tiempo desde entonces. `ajusteMs` es lo que este
 * aparato va por detrás: se le adelanta la posición otro tanto.
 */
export function posicionObjetivo(
  sala: Pick<EstadoSala, 'posicion' | 'posicionEn' | 'sonando' | 'duracion'>,
  ajusteMs = 0,
  ahora = ahoraServidor(),
): number {
  let t = Number(sala.posicion) || 0;
  if (sala.sonando) {
    const desde = Number(sala.posicionEn) || 0;
    // Sin marca de tiempo no se extrapola; con ella, como mucho 10 s (un
    // mensaje antiguo no puede lanzar el vídeo al final)
    if (desde > 0) t += Math.max(0, Math.min(10, (ahora - desde) / 1000));
  }
  t += ajusteMs / 1000;
  const d = Number(sala.duracion) || 0;
  if (d > 0) t = Math.min(t, Math.max(0, d - 0.5));
  return Math.max(0, t);
}

/**
 * Dejar el vídeo listo en la posición que tocará, y arrancarlo a la hora.
 *
 * El salto se hace AHORA, no a la hora: saltar recarga el vídeo y eso tarda
 * lo que tarde en cada aparato. Cuando llega el momento, lo único que queda
 * por hacer es pulsar play, que es instantáneo.
 */
export function arrancarSincronizado(
  p: ReproductorLike | null | undefined,
  posicionEnLaHora: number,
  ajusteMs: number,
  en: number,
  programar: (en: number, fn: () => void) => void,
): void {
  if (!p) return;
  const destino = Math.max(0, posicionEnLaHora + ajusteMs / 1000);
  /* Pausar antes de saltar: si no, el vídeo sigue corriendo desde la
     posición nueva durante la espera y llega a la hora ya adelantado. */
  try { p.pauseVideo?.(); } catch { /* noop */ }
  try { p.seekTo?.(destino, true); } catch { /* el player aún no está listo */ }
  programar(en, () => { try { p.playVideo?.(); } catch { /* noop */ } });
}

export interface MemoriaSeguidor { ultimoSalto: number }

/**
 * Una pasada de corrección gruesa. Devuelve qué hizo (para probarlo y para
 * logs). Solo actúa si el reproductor ya tiene cargada LA canción del líder:
 * el cambio de canción lo hace quien carga el vídeo, no esto.
 */
export function corregirSeguidor(
  p: ReproductorLike | null | undefined,
  sala: Pick<EstadoSala, 'posicion' | 'posicionEn' | 'sonando' | 'duracion'>,
  ajusteMs: number,
  memoria: MemoriaSeguidor,
  ahoraLocal = Date.now(),
  ahoraSrv = ahoraServidor(),
): 'nada' | 'arranque' | 'pausa' | 'salto' {
  if (!p) return 'nada';
  let estado = -1;
  let actual = 0;
  try { estado = p.getPlayerState?.() ?? -1; } catch { return 'nada'; }
  try { actual = p.getCurrentTime?.() ?? 0; } catch { /* noop */ }

  const suena = estado === 1 || estado === 3;   // reproduciendo o cargando

  if (sala.sonando) {
    const t = posicionObjetivo(sala, ajusteMs, ahoraSrv);
    if (!suena) {
      try { p.seekTo?.(t, true); p.playVideo?.(); } catch { /* noop */ }
      memoria.ultimoSalto = ahoraLocal;
      return 'arranque';
    }
    // Cargando (3) no se toca: saltar mientras carga solo lo retrasa más
    if (estado === 1 && Math.abs(actual - t) > UMBRAL_S && ahoraLocal - memoria.ultimoSalto > DESCANSO_MS) {
      try { p.seekTo?.(t, true); } catch { /* noop */ }
      memoria.ultimoSalto = ahoraLocal;
      return 'salto';
    }
    return 'nada';
  }

  // El líder está en pausa
  if (suena) {
    try { p.pauseVideo?.(); } catch { /* noop */ }
    return 'pausa';
  }
  // En pausa los dos: se deja en el mismo punto, para que el próximo play
  // salga parejo. Con un margen ancho, para no ir tocando un vídeo quieto.
  const t = Number(sala.posicion) || 0;
  if (Math.abs(actual - t) > 1.5 && ahoraLocal - memoria.ultimoSalto > DESCANSO_MS) {
    try { p.seekTo?.(t, true); } catch { /* noop */ }
    memoria.ultimoSalto = ahoraLocal;
    return 'salto';
  }
  return 'nada';
}

// ── Calibración automática ────────────────────────────────────────────

/** Por debajo de esto ya no se toca nada: es ruido de medida, no desfase */
export const ZONA_MUERTA_S = 0.06;
/** Muestras antes de decidir. Una sola lectura no vale: hay ruido */
export const MUESTRAS = 9;
/** Tras corregir, se espera a que el vídeo se asiente antes de medir otra vez */
export const REPOSO_MS = 6000;
/** Lo más que se mueve el ajuste de una vez, para no dar bandazos */
export const PASO_MAX_MS = 400;

/**
 * Mide sola cuánto va por detrás este aparato.
 *
 * Cada segundo se le pasa el error que queda (lo que dice el líder menos lo
 * que marca este reproductor, YA con el ajuste actual aplicado). Cuando
 * junta unas cuantas medidas se queda con la MEDIANA —no con la media: un
 * tropiezo puntual no puede mover el ajuste— y, si sigue habiendo desfase,
 * devuelve cuántos milisegundos hay que sumarle.
 *
 * Es un lazo: corrige, espera a que se asiente, vuelve a medir. Deja de
 * moverse solo cuando el error cae dentro de la zona muerta.
 */
export class Calibrador {
  private muestras: number[] = [];
  private reposoHasta = 0;

  /** Tras un salto, una orden o un cambio de canción, lo medido no vale */
  reiniciar(ahora = Date.now(), reposoMs = REPOSO_MS) {
    this.muestras = [];
    this.reposoHasta = ahora + reposoMs;
  }

  /** Devuelve el ajuste (ms) que hay que SUMAR, o null si no toca tocar nada */
  observar(errorS: number, ahora = Date.now()): number | null {
    if (ahora < this.reposoHasta) return null;
    if (!Number.isFinite(errorS) || Math.abs(errorS) > UMBRAL_S) {
      // Un error enorme no es desfase fino: lo arregla el salto, no esto
      this.muestras = [];
      return null;
    }
    this.muestras.push(errorS);
    if (this.muestras.length < MUESTRAS) return null;

    const ordenadas = [...this.muestras].sort((a, b) => a - b);
    const mediana = ordenadas[Math.floor(ordenadas.length / 2)];
    this.muestras = [];

    if (Math.abs(mediana) < ZONA_MUERTA_S) return null;   // ya está afinado
    this.reposoHasta = ahora + REPOSO_MS;
    const ms = Math.round(mediana * 1000);
    return Math.max(-PASO_MAX_MS, Math.min(PASO_MAX_MS, ms));
  }
}
