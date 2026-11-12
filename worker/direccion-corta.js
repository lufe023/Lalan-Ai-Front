/**
 * La dirección corta de la Vitrina: /<salón>, /<salón>/<sede> o, para un
 * servicio o producto, /<salón>/<sede>/<nombre>-<código>, como un usuario de
 * Instagram. Las reglas son las del servidor (direccion-corta.contrato.ts y
 * enlace-directo.ts): el salón, 3 a 30 letras, números, punto, guion y guion
 * bajo; la sede y el servicio, letras, números y guiones.
 */
export const RUTA_CORTA = /^\/([A-Za-z0-9._-]{3,30})(?:\/([A-Za-z0-9-]{1,40})(?:\/([A-Za-z0-9-]{1,80}))?)?\/?$/;

/** { nombre, sede, item } si la ruta es una dirección corta; null si no */
export function direccionCorta(pathname) {
  const m = RUTA_CORTA.exec(pathname);
  if (!m || m[1].startsWith('.') || m[1].endsWith('.') || m[1].includes('..')) return null;
  return { nombre: m[1].toLowerCase(), sede: m[2] ? m[2].toLowerCase() : null, item: m[3] ? m[3].toLowerCase() : null };
}
