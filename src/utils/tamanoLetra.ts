/**
 * Tamaño de la letra de la app, elegido en cada teléfono (Ajustes → Mi cuenta).
 *
 * Toda la app mide sus letras y espacios en rem: cambiar el tamaño base de la
 * página agranda a la vez textos, botones y separaciones, sin romper nada.
 */
export type TamanoLetra = 'normal' | 'grande' | 'muy_grande';

export const TAMANOS_LETRA: { id: TamanoLetra; descripcion: string; escala: number }[] = [
  { id: 'normal', descripcion: 'Normal', escala: 1.0625 },
  { id: 'grande', descripcion: 'Grande', escala: 1.1875 },
  { id: 'muy_grande', descripcion: 'Muy grande', escala: 1.3125 },
];

const CLAVE = 'lalan_tamano_letra';
const POR_DEFECTO: TamanoLetra = 'normal';

export function tamanoGuardado(): TamanoLetra {
  try {
    const t = localStorage.getItem(CLAVE) as TamanoLetra | null;
    return t && TAMANOS_LETRA.some((x) => x.id === t) ? t : POR_DEFECTO;
  } catch { return POR_DEFECTO; }
}

export function aplicarTamano(t: TamanoLetra) {
  const escala = TAMANOS_LETRA.find((x) => x.id === t)?.escala ?? 1;
  document.documentElement.style.fontSize = `${escala * 100}%`;
}

export function elegirTamano(t: TamanoLetra) {
  try { localStorage.setItem(CLAVE, t); } catch { /* sin almacenamiento: vale hasta cerrar la app */ }
  aplicarTamano(t);
}
