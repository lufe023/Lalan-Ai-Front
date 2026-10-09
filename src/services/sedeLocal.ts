import { tokenStore } from './api';

/**
 * La sede del LOCAL donde está este aparato: la del Lounge, la música y la
 * bienvenida a quien llega.
 *
 * Quien tiene sede propia no elige nada: el servidor siempre usa la suya.
 * Dirección ve toda la cadena, pero la música y el Lounge suenan dentro de
 * un local, así que elige uno aquí (se recuerda en este aparato). Sin elegir,
 * el servidor usa la sede principal, que con un solo local es la correcta.
 */
const CLAVE = 'lalan.sedeLocal';

/** La sede del token, si el usuario está atado a una */
export function sedePropia(): string | null {
  try {
    const t = tokenStore.get();
    if (!t) return null;
    const base = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const datos = JSON.parse(atob(base + '='.repeat((4 - (base.length % 4)) % 4)));
    return typeof datos?.locationId === 'string' ? datos.locationId : null;
  } catch { return null; }
}

export function sedeLocal(): string {
  if (sedePropia()) return '';
  try { return localStorage.getItem(CLAVE) ?? ''; } catch { return ''; }
}

export function elegirSedeLocal(id: string) {
  try {
    if (id) localStorage.setItem(CLAVE, id);
    else localStorage.removeItem(CLAVE);
  } catch { /* sin almacenamiento, el servidor usa la principal */ }
}

/** `?sede=` (o `&sede=`) para las rutas del Lounge; vacío si no hay elección */
export function conSedeLocal(ruta: string): string {
  const sede = sedeLocal();
  if (!sede) return ruta;
  return `${ruta}${ruta.includes('?') ? '&' : '?'}sede=${encodeURIComponent(sede)}`;
}
