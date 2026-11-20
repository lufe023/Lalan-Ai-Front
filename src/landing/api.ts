/** La misma dirección del servidor que usa la app */
export const API = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api/v1';

/**
 * El texto de un error del servidor. El filtro de excepciones lo anida
 * ({ message: { message, error } }) y class-validator manda una lista: sin
 * esto el formulario mostraba «[object Object]».
 */
export function mensajeDeError(d: unknown, porDefecto = 'No se pudo enviar.'): string {
  const sacar = (m: unknown): string | null => {
    if (typeof m === 'string') return m;
    if (Array.isArray(m)) return sacar(m[0]);
    if (m && typeof m === 'object') return sacar((m as { message?: unknown }).message);
    return null;
  };
  const texto = sacar(d);
  // Los de class-validator vienen en inglés: mejor el texto en español
  return texto && !/must|should|longer|shorter/i.test(texto) ? texto : porDefecto;
}

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
