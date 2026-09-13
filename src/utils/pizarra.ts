/**
 * La composición de la pizarra: qué bloques hay y dónde.
 *
 * Vive aquí y no dentro de una pantalla porque lo usan DOS: la pared, que
 * los pinta, y el editor de Ajustes, que los coloca. Tener el catálogo en un
 * solo sitio es lo que evita que el editor ofrezca un bloque que la pared no
 * sabe dibujar.
 */

export const COLS = 12;
export const FILAS = 8;

export type TipoBloque =
  | 'llamando' | 'en_atencion' | 'esperando' | 'reloj' | 'marca' | 'texto'
  | 'musica';

export interface Bloque {
  id: string;
  tipo: TipoBloque;
  /** 1..12 */
  col: number;
  /** 1..8 */
  fila: number;
  ancho: number;
  alto: number;
  config?: { texto?: string };
}

/** Qué es cada bloque, para el editor */
export const CATALOGO: {
  tipo: TipoBloque; nombre: string; icono: string; descripcion: string;
  ancho: number; alto: number;
}[] = [
  {
    tipo: 'llamando', nombre: 'Llamando', icono: '📣',
    descripcion: 'El turno que se está llamando, en grande',
    ancho: 8, alto: 5,
  },
  {
    tipo: 'en_atencion', nombre: 'En atención', icono: '💺',
    descripcion: 'Quién está en sillón',
    ancho: 4, alto: 4,
  },
  {
    tipo: 'esperando', nombre: 'En espera', icono: '⏳',
    descripcion: 'La cola, como fichas. Desaparece si no hay nadie',
    ancho: 4, alto: 2,
  },
  {
    tipo: 'reloj', nombre: 'Reloj', icono: '🕐',
    descripcion: 'La hora',
    ancho: 3, alto: 1,
  },
  {
    tipo: 'marca', nombre: 'Marca', icono: '✨',
    descripcion: 'Nombre del salón y de la sede',
    ancho: 6, alto: 1,
  },
  {
    tipo: 'musica', nombre: 'Música', icono: '🎵',
    descripcion: 'Qué suena ahora mismo. Solo muestra: desde la pared no se toca',
    ancho: 4, alto: 2,
  },
  {
    tipo: 'texto', nombre: 'Mensaje', icono: '💬',
    descripcion: 'Un texto fijo que escribes tú',
    ancho: 4, alto: 1,
  },
];

export const infoDe = (tipo: TipoBloque) =>
  CATALOGO.find(c => c.tipo === tipo) ?? CATALOGO[0];

/**
 * El diseño de fábrica: exactamente lo que la pared enseñaba antes de que
 * esto fuera configurable.
 *
 * Se calcula en el NAVEGADOR y no en el servidor a propósito: así una pared
 * que nunca se configuró sigue viéndose bien aunque el servidor cambie de
 * opinión sobre cuál es el diseño bonito, y no hay que migrar nada.
 */
export const LAYOUT_POR_DEFECTO: Bloque[] = [
  { id: 'marca',       tipo: 'marca',       col: 1, fila: 1, ancho: 8, alto: 1 },
  { id: 'reloj',       tipo: 'reloj',       col: 10, fila: 1, ancho: 3, alto: 1 },
  { id: 'llamando',    tipo: 'llamando',    col: 1, fila: 2, ancho: 8, alto: 7 },
  { id: 'en_atencion', tipo: 'en_atencion', col: 9, fila: 2, ancho: 4, alto: 5 },
  { id: 'esperando',   tipo: 'esperando',   col: 9, fila: 7, ancho: 4, alto: 2 },
];

/** Lo que llega del servidor puede ser null, basura o un diseño válido */
export function normalizar(bloques: any): Bloque[] {
  if (!Array.isArray(bloques) || !bloques.length) return LAYOUT_POR_DEFECTO;
  const validos = bloques.filter(
    (b: any) => b && CATALOGO.some(c => c.tipo === b.tipo),
  );
  return validos.length ? (validos as Bloque[]) : LAYOUT_POR_DEFECTO;
}

/**
 * Busca el primer hueco libre para un bloque nuevo.
 *
 * Sin esto, cada bloque añadido caería encima del anterior en la esquina y
 * el editor sería inservible: habría que mover a mano todo lo que ya estaba.
 */
export function primerHueco(bloques: Bloque[], ancho: number, alto: number) {
  const ocupada = (c: number, f: number) =>
    bloques.some(b =>
      c >= b.col && c < b.col + b.ancho && f >= b.fila && f < b.fila + b.alto);

  for (let fila = 1; fila + alto - 1 <= FILAS; fila++) {
    for (let col = 1; col + ancho - 1 <= COLS; col++) {
      let libre = true;
      for (let f = fila; f < fila + alto && libre; f++) {
        for (let c = col; c < col + ancho && libre; c++) {
          if (ocupada(c, f)) libre = false;
        }
      }
      if (libre) return { col, fila };
    }
  }
  return null;   // no cabe: quien llama decide qué decir
}
