import type { TargetAndTransition } from 'motion/react';

/**
 * Cómo se va la pantalla de Lalán a su burbuja al minimizar (a mano o porque
 * un botón lleva a otro lado de la app). Cada efecto termina justo donde está
 * la burbuja; la burbuja aparece cuando el efecto llega.
 */

export type EstiloMinimizar = 'esfera' | 'iris' | 'morph' | 'tarjeta' | 'gota' | 'genio';

export const ESTILOS_MINIMIZAR: { id: EstiloMinimizar; nombre: string }[] = [
  { id: 'esfera', nombre: 'La esfera vuela' },
  { id: 'iris', nombre: 'Círculo que se cierra' },
  { id: 'morph', nombre: 'Se encoge en círculo' },
  { id: 'tarjeta', nombre: 'Tarjeta que vuela' },
  { id: 'gota', nombre: 'Gota' },
  { id: 'genio', nombre: 'Genio' },
];

/** Lo que dura cada efecto (ms): la burbuja aparece al llegar */
export const DURACION_MINIMIZAR: Record<EstiloMinimizar, number> = {
  esfera: 520, iris: 480, morph: 520, tarjeta: 560, gota: 620, genio: 600,
};

const CLAVE = 'lalan_minimizar';
const DEFECTO: EstiloMinimizar = 'esfera';

export function estiloMinimizar(): EstiloMinimizar {
  try {
    const v = localStorage.getItem(CLAVE) as EstiloMinimizar | null;
    if (v && ESTILOS_MINIMIZAR.some((e) => e.id === v)) return v;
  } catch { /* nada */ }
  return DEFECTO;
}

export function guardarEstiloMinimizar(e: EstiloMinimizar) {
  try { localStorage.setItem(CLAVE, e); } catch { /* nada */ }
}

/** El centro y el tamaño de la burbuja en la pantalla */
export interface Destino { cx: number; cy: number; tam: number }

/** Una curva tipo iOS: arranca decidida y frena suave */
const SUAVE: [number, number, number, number] = [0.32, 0.72, 0, 1];
const ENTRA: [number, number, number, number] = [0.65, 0, 0.35, 1];

/**
 * El `exit` de la pantalla de Lalán para cada efecto. La pantalla mide toda la
 * ventana, así que mover su centro al de la burbuja es (cx - ancho/2, cy - alto/2).
 */
export function salidaHaciaBurbuja(estilo: EstiloMinimizar, d: Destino): TargetAndTransition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const r = d.tam / 2;
  const dx = d.cx - vw / 2;
  const dy = d.cy - vh / 2;
  const seg = DURACION_MINIMIZAR[estilo] / 1000;
  const lejos = Math.hypot(Math.max(d.cx, vw - d.cx), Math.max(d.cy, vh - d.cy));

  switch (estilo) {
    case 'iris':
      return {
        clipPath: [`circle(${lejos}px at ${d.cx}px ${d.cy}px)`, `circle(${r}px at ${d.cx}px ${d.cy}px)`],
        opacity: [1, 1, 0],
        transition: { duration: seg, ease: ENTRA, opacity: { duration: seg, times: [0, 0.8, 1] } },
      };
    case 'morph':
      return {
        clipPath: [
          'inset(0px 0px 0px 0px round 0px)',
          `inset(${d.cy - r}px ${vw - d.cx - r}px ${vh - d.cy - r}px ${d.cx - r}px round ${r}px)`,
        ],
        scale: [1, 0.97],
        opacity: [1, 1, 0],
        transition: { duration: seg, ease: SUAVE, opacity: { duration: seg, times: [0, 0.82, 1] } },
      };
    case 'tarjeta': {
      const s = d.tam / vw;
      return {
        borderRadius: [0, 40, 30],
        scale: [1, 0.86, s],
        x: [0, 0, dx],
        y: [0, -12, dy],
        opacity: [1, 1, 0],
        boxShadow: ['0 0 0 rgba(0,0,0,0)', '0 30px 80px rgba(0,0,0,0.35)', '0 8px 20px rgba(0,0,0,0.2)'],
        transition: { duration: seg, times: [0, 0.32, 1], ease: ['easeOut', SUAVE], opacity: { duration: seg, times: [0, 0.85, 1] } },
      };
    }
    case 'gota': {
      // Primero se recoge en una gota en el centro; después la gota vuela a la burbuja
      const rg = vw * 0.42;
      const s = d.tam / (rg * 2);
      const centro = `${vw / 2}px ${vh / 2}px`;
      return {
        clipPath: [`circle(${Math.hypot(vw, vh) / 2}px at ${centro})`, `circle(${rg}px at ${centro})`, `circle(${rg}px at ${centro})`],
        scaleX: [1, 0.94, s * 1.08, s],
        scaleY: [1, 1.05, s * 0.92, s],
        x: [0, 0, dx * 0.85, dx],
        y: [0, 0, dy * 0.85, dy],
        opacity: [1, 1, 1, 0],
        transition: { duration: seg, times: [0, 0.4, 0.85, 1], ease: 'easeInOut' },
      };
    }
    case 'genio':
      // Lo de abajo se angosta primero hacia la burbuja; lo de arriba lo sigue
      return {
        clipPath: [
          `polygon(0px 0px, ${vw}px 0px, ${vw}px ${vh}px, 0px ${vh}px)`,
          `polygon(0px 0px, ${vw}px 0px, ${d.cx + r}px ${d.cy + r}px, ${d.cx - r}px ${d.cy + r}px)`,
          `polygon(${d.cx - r}px ${d.cy - r}px, ${d.cx + r}px ${d.cy - r}px, ${d.cx + r}px ${d.cy + r}px, ${d.cx - r}px ${d.cy + r}px)`,
        ],
        opacity: [1, 1, 0],
        transition: { duration: seg, times: [0, 0.5, 1], ease: 'easeIn', opacity: { duration: seg, times: [0, 0.85, 1] } },
      };
    case 'esfera':
    default:
      // La pantalla se disuelve; la esfera (aparte) es la que viaja a la burbuja
      return {
        opacity: 0,
        scale: 1.04,
        filter: 'blur(8px)',
        transition: { duration: seg * 0.7, ease: 'easeOut' },
      };
  }
}
