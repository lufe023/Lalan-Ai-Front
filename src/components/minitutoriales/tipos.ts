/**
 * Minitutoriales: fotos paso a paso de lo que se hace FUERA de la app
 * (instalarla, dar permisos, el lado de Meta…). El equipo de Lalan los sube
 * en Plataforma → Guías; el contrato está en el servidor
 * (src/modules/minitutoriales/minitutoriales.contrato.ts).
 *
 * Las marcas no van pegadas a la foto: la app las dibuja encima con
 * coordenadas de 0 a 1, así se ven nítidas en cualquier pantalla.
 */

export const APARATOS = ['todos', 'iphone', 'android-chrome', 'android-samsung', 'pc-chrome', 'pc-edge', 'mac-safari'] as const;
export type Aparato = (typeof APARATOS)[number];

export const NOMBRE_APARATO: Record<Aparato, string> = {
  todos: 'Todos los aparatos',
  iphone: 'iPhone o iPad (Safari)',
  'android-chrome': 'Android con Chrome',
  'android-samsung': 'Samsung Internet',
  'pc-chrome': 'Computadora con Chrome',
  'pc-edge': 'Computadora con Edge',
  'mac-safari': 'Mac con Safari',
};

export type TipoMarca = 'flecha' | 'circulo' | 'burbuja';
export interface Marca {
  tipo: TipoMarca;
  /** La punta de la flecha, el centro del círculo o la burbuja (0 a 1) */
  x: number;
  y: number;
  /** Flecha: de dónde sale */
  x0?: number;
  y0?: number;
  /** Círculo: radio en proporción al ancho de la foto */
  r?: number;
  /** Burbuja: el texto corto */
  texto?: string;
}
export interface PasoTutorial { imagenId: string | null; texto: string; marcas: Marca[] }
export interface Minitutorial {
  id: string;
  tema: string;
  aparato: Aparato;
  titulo: string;
  pasos: PasoTutorial[];
  publicado: boolean;
  actualizadoEn: string;
}

export const LIMITES = { pasos: 8, marcas: 6, texto: 300, burbuja: 60, titulo: 120 } as const;

/** Qué versión le toca a este aparato (si no hay, el servidor da la de "todos") */
export function aparatoActual(): Aparato {
  const ua = navigator.userAgent;
  const iPadDeEscritorio = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || iPadDeEscritorio) return 'iphone';
  if (/SamsungBrowser/i.test(ua)) return 'android-samsung';
  if (/Android/i.test(ua)) return 'android-chrome';
  if (/Edg\//i.test(ua)) return 'pc-edge';
  if (/Macintosh/i.test(ua) && /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Firefox/i.test(ua)) return 'mac-safari';
  return 'pc-chrome';
}
