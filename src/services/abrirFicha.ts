import { ABRIR_CLIENTA } from './saberProductos';
import type { ScreenName } from '../context/AppContext';

/**
 * La ficha se abrió desde otra pantalla (un chat): al cerrarla se vuelve ahí,
 * con el chat abierto como estaba, en vez de quedarse en el directorio.
 */
export const FICHA_VUELVE = 'lalan.fichaVuelve';

/**
 * Abrir la ficha de una clienta desde donde se está (el nombre o la foto en un
 * chat). Clientas la abre al montarse; si ya estaba abierta, el evento le avisa.
 */
/** En la computadora, la ventanita del chat se minimiza para no tapar la ficha */
export const EVENTO_MINIMIZAR_CHAT = 'lalan:minimizar-chat';

export function abrirFichaDeClienta(clientId: string, actual: ScreenName, navigateTo: (s: ScreenName) => void, conversacionId?: string) {
  if (conversacionId) window.dispatchEvent(new CustomEvent(EVENTO_MINIMIZAR_CHAT, { detail: conversacionId }));
  try {
    sessionStorage.setItem(ABRIR_CLIENTA, clientId);
    // Solo se vuelve si de verdad se cambió de pantalla (si no, Atrás iría a otro lado)
    if (actual !== 'clients') sessionStorage.setItem(FICHA_VUELVE, '1');
  } catch { /* sin almacenamiento: se abre igual el directorio */ }
  navigateTo('clients');
  window.dispatchEvent(new Event('lalan:abrir-clienta'));
}
