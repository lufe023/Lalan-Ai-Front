/**
 * Qué pantalla pública se abrió por última vez en ESTE aparato.
 *
 * Existe por la instalación como aplicación. El manifiesto tiene una sola
 * dirección de arranque para todo el sistema —no puede llevar el token de
 * una sede dentro—, así que la app instalada abriría la pantalla de login
 * en vez de la pared. Guardando aquí lo último que se abrió, el aparato
 * instalado vuelve solo a lo suyo.
 *
 * Solo se usa cuando la ventana corre como aplicación instalada. En una
 * pestaña normal no se toca: quien abre la web en su navegador espera la
 * aplicación, no el televisor.
 */

const LLAVE = 'lalan.pantalla';

export type TipoPantalla = 'pantalla' | 'reproductor';

export function recordarPantalla(tipo: TipoPantalla, token: string) {
  try { localStorage.setItem(LLAVE, JSON.stringify({ tipo, token })); }
  catch { /* modo incógnito o almacenamiento lleno: se vive sin ello */ }
}

export function pantallaRecordada(): { tipo: TipoPantalla; token: string } | null {
  try {
    const crudo = localStorage.getItem(LLAVE);
    if (!crudo) return null;
    const x = JSON.parse(crudo);
    if (!x?.token || (x.tipo !== 'pantalla' && x.tipo !== 'reproductor')) return null;
    return x;
  } catch { return null; }
}

/** ¿Esta ventana es la aplicación instalada, y no una pestaña del navegador? */
export function esAplicacionInstalada(): boolean {
  try {
    return window.matchMedia('(display-mode: fullscreen)').matches
      || window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
  } catch { return false; }
}
