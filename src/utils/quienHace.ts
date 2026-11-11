import type { SalonStaff, SalonZone } from '../context/AppContext';
import { recibeCitas } from './recibeCitas';

/**
 * Quién hace qué, igual que lo decide Lalan en el servidor
 * (backend: chat/herramientas/especialistas.ts):
 *
 * - Si el servicio tiene gente marcada que trabaja en la sede y recibe citas,
 *   solo esa gente lo hace.
 * - Si no, la zona decide: la gente de la zona que tiene su categoría, más
 *   quien no tiene zona (hace de todo).
 */

/** Trabaja en la sede (sin sedes marcadas = en todas) */
export const trabajaEn = (e: SalonStaff, sedeId: string | null | undefined) =>
  !sedeId || !(e.sedes ?? []).length || (e.sedes ?? []).includes(sedeId);

/** Las categorías que hace por su zona; null = de todo */
export function categoriasPorZona(e: SalonStaff, zonas: SalonZone[]): string[] | null {
  if (!recibeCitas(e.atiendeCitas, e.role)) return [];
  const zona = zonas.find(z => z.id === e.zoneId && z.active);
  if (zona?.sinServicios) return [];
  if (!zona) return null;
  if ((zona.serviceCategories ?? []).length) return zona.serviceCategories as string[];
  const configurado = zonas.some(z => z.active && !z.sinServicios && (z.serviceCategories ?? []).length);
  return configurado ? [] : null;
}

export const haceLaCategoria = (e: SalonStaff, categoria: string, zonas: SalonZone[]) => {
  const c = categoriasPorZona(e, zonas);
  return c === null || c.includes(categoria);
};

/** Quiénes lo hacen en la sede: las marcadas, o las de la zona si no hay ninguna marcada aquí */
export function quienesLoHacen(
  personal: SalonStaff[], zonas: SalonZone[], servicio: { category: string; especialistaIds?: string[] },
  sedeId?: string | null,
): { gente: SalonStaff[]; porMarca: boolean } {
  const aqui = personal.filter(e => e.active && trabajaEn(e, sedeId));
  const marcadas = servicio.especialistaIds ?? [];
  const elegidas = aqui.filter(e => marcadas.includes(e.id) && recibeCitas(e.atiendeCitas, e.role));
  if (elegidas.length) return { gente: elegidas, porMarca: true };
  return { gente: aqui.filter(e => haceLaCategoria(e, servicio.category, zonas)), porMarca: false };
}
