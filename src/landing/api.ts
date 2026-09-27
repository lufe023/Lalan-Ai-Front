/** La misma dirección del servidor que usa la app */
export const API = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api/v1';

/** La sesión de la app, si esta persona ya entró alguna vez (misma web, mismo almacenamiento) */
export const CLAVE_TOKEN = 'lalan_access_token';

export function leerToken(): string | null {
  try { return localStorage.getItem(CLAVE_TOKEN); } catch { return null; }
}

/** El panel abre la landing con ?calor=pc|movil|tableta para dibujar el mapa de calor */
export const MODO_CALOR = (() => {
  const v = new URLSearchParams(location.search).get('calor');
  return v === 'pc' || v === 'movil' || v === 'tableta' ? v : null;
})();
