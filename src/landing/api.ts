/** La misma dirección del servidor que usa la app */
export const API = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api/v1';

/**
 * ¿Esta persona ya entró a la app? (misma web, mismo almacenamiento). La
 * sesión vive en cookies httpOnly; aquí solo se mira la marca no secreta, o
 * los tokens de antes si aún no pasó a cookies.
 */
export function haySesion(): boolean {
  try { return !!localStorage.getItem('lalan_sesion') || !!localStorage.getItem('lalan_refresh_token'); } catch { return false; }
}

/** El panel abre la landing con ?calor=pc|movil|tableta para dibujar el mapa de calor */
export const MODO_CALOR = (() => {
  const v = new URLSearchParams(location.search).get('calor');
  return v === 'pc' || v === 'movil' || v === 'tableta' ? v : null;
})();
