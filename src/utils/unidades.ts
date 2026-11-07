/**
 * Igual que el backend (products/preparados.ts): pasar la cantidad de una
 * receta a la unidad en que se cuenta el insumo.
 */
const VOLUMEN: Record<string, number> = { ml: 1, l: 1000, oz: 29.5735 };
const PESO: Record<string, number> = { g: 1, kg: 1000, oz: 28.3495 };
export const UNIDAD_POR_PIEZA = 'unit';

/** ml↔oz↔L, g↔kg↔oz. null si no se puede (g contra ml, piezas) */
export function convertirUnidad(cantidad: number, de: string, a: string): number | null {
  const x = (de ?? '').toLowerCase();
  const y = (a ?? '').toLowerCase();
  if (x === y) return cantidad;
  // Volumen va primero: oz contra ml es onza líquida; oz contra g, onza de peso
  for (const familia of [VOLUMEN, PESO]) {
    if (familia[x] != null && familia[y] != null) return (cantidad * familia[x]) / familia[y];
  }
  return null;
}

/** La receta pide 1.5 oz y la botella trae 750 ml → 0,059 botellas */
export function aUnidadDeStock(
  cantidad: number, unidad: string,
  insumo: { unit: string; unitQty?: number | null; unitQtyUnit?: string | null },
): number {
  const contenido = insumo.unitQty ?? 0;
  if (insumo.unit === UNIDAD_POR_PIEZA) {
    if (unidad === UNIDAD_POR_PIEZA || contenido <= 0) return cantidad;
    const enContenido = insumo.unitQtyUnit ? convertirUnidad(cantidad, unidad, insumo.unitQtyUnit) : null;
    return (enContenido ?? cantidad) / contenido;
  }
  if (unidad === insumo.unit) return cantidad;
  return convertirUnidad(cantidad, unidad, insumo.unit) ?? cantidad;
}
