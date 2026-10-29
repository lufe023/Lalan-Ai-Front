/**
 * Sesión de soporte: entrar al salón de un cliente para ayudarle y volver.
 *
 * El servidor pone la entrada al salón en su propia cookie httpOnly, que
 * manda sobre la sesión propia mientras exista. Aquí solo queda una marca
 * (no secreta) de que se está en soporte. Al caducar (o al tocar "Salir")
 * el servidor borra esa cookie y vuelve la sesión propia, que nunca se tocó.
 * Se recarga la página al entrar y al salir: así nada de lo cargado de un
 * salón se queda en pantalla del otro.
 */
import { MARCA_SOPORTE, URL_API } from './api';

export function enSoporte(): boolean {
  try { return !!localStorage.getItem(MARCA_SOPORTE); } catch { return false; }
}

export function entrarComoSoporte(): void {
  try { localStorage.setItem(MARCA_SOPORTE, '1'); } catch { /* sin almacenamiento: igual se entra */ }
  window.location.reload();
}

export async function salirDeSoporte(): Promise<void> {
  // El servidor cierra la entrada (el token deja de servir ya, no a las 2 h) y borra su cookie
  await fetch(`${URL_API}/auth/salir`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Sesion': 'cookie' }, body: '{}',
  }).catch(() => undefined);
  try { localStorage.removeItem(MARCA_SOPORTE); } catch { /* nada */ }
  window.location.reload();
}
