/**
 * "No", "ninguno", "no prefiere bebida": contestaban la pregunta de Lalan,
 * pero no son gustos. Antes se guardaban; no se muestran como tales.
 * La misma regla que usa el servidor al guardar.
 */
export function noEsUnGusto(valor: string): boolean {
  const v = valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return !v || /^(no|nada|ningun[oa]?|nop|nel|ninguna en especial|nada en especial|cualquier[a]?|me da igual|igual|lo que sea|n a)$/.test(v) || /^no /.test(v);
}
