import { useSyncExternalStore } from 'react';

/**
 * Que la dueña se entere de que la esfera es una asistente con IA. Mientras
 * no haya abierto a Lalan nunca, la esfera respira con un halo y saca una
 * pastilla «Pregúntale a Lalan». La primera vez que la abre (por donde sea)
 * queda descubierta y todo eso se apaga para siempre en ese aparato.
 */

const CLAVE = 'lalan_descubierta';
const CLAVE_VECES = 'lalan_pista_veces';
/** Cuántas veces sale la pastilla como mucho, aunque no la abra: luego deja de insistir */
export const MAX_PISTAS = 6;

let descubierta = leer();
const oyentes = new Set<() => void>();

function leer(): boolean {
  try { return localStorage.getItem(CLAVE) === '1'; } catch { return false; }
}

/** Ya abrió a Lalan alguna vez: se acaban el halo y la pastilla */
export function marcarLalanDescubierta() {
  if (descubierta) return;
  descubierta = true;
  try { localStorage.setItem(CLAVE, '1'); } catch { /* nada */ }
  oyentes.forEach((f) => f());
}

export function useLalanDescubierta(): boolean {
  return useSyncExternalStore(
    (f) => { oyentes.add(f); return () => { oyentes.delete(f); }; },
    () => descubierta,
  );
}

/** Cuenta una vez que se mostró la pastilla; dice si todavía toca mostrarla */
export function tocaPista(): boolean {
  if (descubierta) return false;
  try {
    const veces = Number(localStorage.getItem(CLAVE_VECES) || '0');
    if (veces >= MAX_PISTAS) return false;
    localStorage.setItem(CLAVE_VECES, String(veces + 1));
  } catch { /* sin almacenamiento: se muestra igual */ }
  return true;
}
