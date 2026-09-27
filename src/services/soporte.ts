/**
 * Sesión de soporte: entrar al salón de un cliente para ayudarle y volver.
 *
 * La sesión propia se guarda aparte mientras tanto. El token de soporte no
 * se renueva: cuando caduca (o al tocar "Salir"), se vuelve a la propia.
 * Se recarga la página al entrar y al salir: así nada de lo cargado de un
 * salón se queda en pantalla del otro.
 */
import { tokenStore } from './api';

const CLAVE_PROPIA = 'lalan_sesion_propia';

interface SesionPropia { access: string | null; refresh: string | null }

export function enSoporte(): boolean {
  try { return !!localStorage.getItem(CLAVE_PROPIA); } catch { return false; }
}

export function entrarComoSoporte(accessToken: string): void {
  if (!enSoporte()) {
    const propia: SesionPropia = { access: tokenStore.get(), refresh: tokenStore.getRefresh() };
    localStorage.setItem(CLAVE_PROPIA, JSON.stringify(propia));
  }
  tokenStore.clear();
  tokenStore.set(accessToken);
  window.location.reload();
}

export function salirDeSoporte(): void {
  let propia: SesionPropia = { access: null, refresh: null };
  try { propia = JSON.parse(localStorage.getItem(CLAVE_PROPIA) || '{}'); } catch { /* sesión propia ilegible: se sale a secas */ }
  tokenStore.clear();
  if (propia.access) tokenStore.set(propia.access);
  if (propia.refresh) tokenStore.setRefresh(propia.refresh);
  localStorage.removeItem(CLAVE_PROPIA);
  window.location.reload();
}
