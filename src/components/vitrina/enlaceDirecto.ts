/**
 * El enlace directo a un servicio o producto de la Vitrina:
 * /<salón>/<sede>/<nombre>-<código>. Las mismas reglas del servidor
 * (enlace-directo.ts): el código son los últimos 6 caracteres del id, así el
 * enlace que la dueña ya pegó sigue abriendo aunque le cambie el nombre.
 */

const LARGO_CODIGO = 6;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "Baño de color" → "bano-de-color" (como slugDe del servidor) */
function slug(texto: string): string {
  return (texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

const codigoDeId = (id: string) => id.replace(/-/g, '').slice(-LARGO_CODIGO).toLowerCase();

function parteDelItem(nombre: string, id: string): string {
  const limpio = slug(nombre).slice(0, 40).replace(/-+$/g, '');
  return limpio ? `${limpio}-${codigoDeId(id)}` : codigoDeId(id);
}

/** El servicio o producto de esa parte del enlace (o de su id), o null */
export function buscarPorParte<T extends { id: string; nombre: string }>(items: T[], parte: string | null | undefined): T | null {
  const texto = String(parte ?? '').trim().toLowerCase().replace(/\/+$/, '');
  if (!texto) return null;
  if (UUID.test(texto)) return items.find((x) => x.id.toLowerCase() === texto) ?? null;
  const codigo = texto.split('-').pop() ?? '';
  const porCodigo = items.filter((x) => codigoDeId(x.id) === codigo);
  if (porCodigo.length === 1) return porCodigo[0];
  if (porCodigo.length > 1) return porCodigo.find((x) => parteDelItem(x.nombre, x.id) === texto) ?? porCodigo[0];
  return items.find((x) => slug(x.nombre) === texto) ?? null;
}

/**
 * Lo que pide el enlace: la parte de la dirección corta, o el `?servicio=` /
 * `?producto=` de la dirección larga (antes o después del #).
 */
export function pedidoDelEnlace(item: string | null | undefined): { tipo: 'servicio' | 'producto' | null; texto: string } | null {
  if (item) return { tipo: null, texto: item };
  const deHash = window.location.hash.split('?')[1] ?? '';
  for (const q of [window.location.search, deHash]) {
    const p = new URLSearchParams(q);
    const servicio = p.get('servicio');
    if (servicio) return { tipo: 'servicio', texto: servicio.slice(0, 80) };
    const producto = p.get('producto');
    if (producto) return { tipo: 'producto', texto: producto.slice(0, 80) };
  }
  return null;
}
