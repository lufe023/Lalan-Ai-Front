import { guardarSedeActiva, sedeActiva, sedePropia } from './sedeActiva';

/**
 * La sede del LOCAL donde está este aparato (Lounge, música, bienvenida a
 * quien llega, mostrador). Es la misma sede activa que se elige en el menú de
 * la cuenta: ver `sedeActiva.ts`.
 */
export { sedePropia };
export const sedeLocal = sedeActiva;
export const elegirSedeLocal = guardarSedeActiva;

/** `?sede=` (o `&sede=`) para las rutas del Lounge; vacío si no hay elección */
export function conSedeLocal(ruta: string): string {
  const sede = sedeLocal();
  if (!sede) return ruta;
  return `${ruta}${ruta.includes('?') ? '&' : '?'}sede=${encodeURIComponent(sede)}`;
}
