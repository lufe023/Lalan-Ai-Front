/**
 * La SEDE ACTIVA: en qué sede está trabajando ahora quien usa la app.
 *
 * Quien está atada a una sede no elige nada: el servidor siempre usa la suya.
 * Dirección ve toda la cadena, y elige en el menú de su cuenta en qué sede
 * trabaja. Esa elección viaja en cada pedido (cabecera `X-Sede`) y el
 * servidor la trata como si estuviera atada a esa sede: Sala, El salón,
 * Agenda, Caja, inventario, Lounge, todo pasa a esa sede. Sin elegir ("Todas
 * las sedes"), ve la cadena entera como siempre.
 *
 * Se recuerda en este aparato. No importa nada de `api` a propósito: `api`
 * la usa para poner la cabecera.
 */
const CLAVE = 'lalan.sedeLocal';
const CLAVE_TOKEN = 'lalan_access_token';

/** La sede del token, si el usuario está atado a una */
export function sedePropia(): string | null {
  try {
    const t = localStorage.getItem(CLAVE_TOKEN);
    if (!t) return null;
    const base = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const datos = JSON.parse(atob(base + '='.repeat((4 - (base.length % 4)) % 4)));
    return typeof datos?.locationId === 'string' ? datos.locationId : null;
  } catch { return null; }
}

/** La sede elegida por dirección; vacío = todas (o atada a la suya) */
export function sedeActiva(): string {
  if (sedePropia()) return '';
  try { return localStorage.getItem(CLAVE) ?? ''; } catch { return ''; }
}

export function guardarSedeActiva(id: string) {
  try {
    if (id) localStorage.setItem(CLAVE, id);
    else localStorage.removeItem(CLAVE);
  } catch { /* sin almacenamiento: toda la cadena */ }
}

/** La cabecera para el servidor. Un pedido puede pedir toda la cadena con `X-Sede: ''` */
export function cabeceraSede(propias?: HeadersInit): Record<string, string> {
  const dadas = (propias ?? {}) as Record<string, string>;
  if ('X-Sede' in dadas) return dadas['X-Sede'] ? { 'X-Sede': dadas['X-Sede'] } : {};
  const sede = sedeActiva();
  return sede ? { 'X-Sede': sede } : {};
}
