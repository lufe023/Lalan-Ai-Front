/**
 * La tarjeta que sale al pegar un enlace de la Vitrina en WhatsApp,
 * Instagram o Facebook: el nombre del servicio, su precio y su foto. Esos
 * robots no corren la app, solo leen las etiquetas <meta> de la página, así
 * que se ponen aquí, antes de responder.
 *
 * La dirección de la API es la misma que usa la app (VITE_API_URL): al
 * compilar se guarda en /lalan-api.json. API_URL en las variables del worker
 * la cambia si hiciera falta.
 */

/** Lo que más espera la página por la tarjeta: sin ella, sale igual */
const ESPERA_MS = 2500;

let apiGuardada = null;

async function direccionDeLaApi(env, url) {
  if (env.API_URL) return String(env.API_URL).replace(/\/+$/, '');
  if (apiGuardada) return apiGuardada;
  try {
    const r = await env.ASSETS.fetch(new Request(new URL('/lalan-api.json', url)));
    const api = r.ok ? (await r.json())?.api : null;
    if (typeof api === 'string' && /^https?:\/\//.test(api)) apiGuardada = api.replace(/\/+$/, '');
  } catch { /* sin tarjeta */ }
  return apiGuardada;
}

/** { titulo, descripcion, imagen } del servidor, o null si no se pudo */
export async function vistaPrevia(env, url, corta) {
  const api = await direccionDeLaApi(env, url);
  if (!api) return null;
  const q = new URLSearchParams();
  if (corta.sede) q.set('sede', corta.sede);
  if (corta.item) q.set('item', corta.item);
  try {
    const r = await fetch(`${api}/vitrina/publica/nombre/${encodeURIComponent(corta.nombre)}/vista-previa?${q}`, {
      signal: AbortSignal.timeout(ESPERA_MS),
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d || typeof d.titulo !== 'string') return null;
    const foto = (x) => (typeof x === 'string' && x ? (/^https?:\/\//.test(x) ? x : `${api}/${x.replace(/^\//, '')}`) : null);
    const imagen = foto(d.imagen);
    // Con dirección oficial, la página se deja encontrar en Google (ver conVistaPrevia)
    const canonica = typeof d.canonica === 'string' && /^\/[A-Za-z0-9._\/-]+$/.test(d.canonica) ? d.canonica : null;
    const negocio = d.negocio && typeof d.negocio.salon === 'string'
      ? { salon: d.negocio.salon, sede: d.negocio.sede || null, direccion: d.negocio.direccion || null, imagen: foto(d.negocio.imagen) }
      : null;
    const item = d.item && typeof d.item.nombre === 'string' ? { tipo: d.item.tipo === 'producto' ? 'producto' : 'servicio', nombre: d.item.nombre } : null;
    return { titulo: d.titulo, descripcion: typeof d.descripcion === 'string' ? d.descripcion : '', imagen, canonica, negocio, item };
  } catch {
    return null;
  }
}

const escapar = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Los datos estructurados (schema.org) de una Vitrina: el negocio con su
 * dirección y, en la página de un servicio o producto, ese servicio o
 * producto. Es lo que Google usa para mostrarla al buscar «balayage en Piantini».
 */
export function datosEstructurados(previa, direccion) {
  const n = previa.negocio;
  if (!n) return null;
  const negocio = {
    '@type': 'HealthAndBeautyBusiness',
    name: n.sede ? `${n.salon} · ${n.sede}` : n.salon,
    url: previa.item ? direccion.replace(/\/[^/]+$/, '') : direccion,
    ...(n.imagen ? { image: n.imagen } : {}),
    ...(n.direccion ? { address: { '@type': 'PostalAddress', streetAddress: n.direccion } } : {}),
  };
  if (!previa.item) return { '@context': 'https://schema.org', ...negocio };
  const base = { '@context': 'https://schema.org', name: previa.item.nombre, url: direccion, description: previa.descripcion, ...(previa.imagen ? { image: previa.imagen } : {}) };
  return previa.item.tipo === 'producto'
    ? { ...base, '@type': 'Product', brand: { '@type': 'Brand', name: n.salon } }
    : { ...base, '@type': 'Service', provider: negocio };
}

/** La página de la app con el título, la descripción y la foto de ese enlace */
export function conVistaPrevia(respuesta, previa, url) {
  // La dirección oficial (con el nombre de hoy del salón); sin ella, la de la barra
  const direccion = previa.canonica ? `${url.origin}${previa.canonica}` : `${url.origin}${url.pathname}`;
  const metas = [
    ['property', 'og:title', previa.titulo],
    ['property', 'og:description', previa.descripcion],
    ['property', 'og:url', direccion],
    ['property', 'og:type', 'website'],
    ['name', 'description', previa.descripcion],
    ['name', 'twitter:title', previa.titulo],
    ['name', 'twitter:description', previa.descripcion],
    ...(previa.imagen ? [['property', 'og:image', previa.imagen], ['name', 'twitter:image', previa.imagen]] : []),
  ];
  const quitar = new Set(metas.map(([, k]) => k));
  // La app lleva «noindex»: una Vitrina publicada sí se deja encontrar
  if (previa.canonica) quitar.add('robots');
  const datos = previa.canonica ? datosEstructurados(previa, direccion) : null;
  const extra = previa.canonica
    ? `<link rel="canonical" href="${escapar(direccion)}" />`
      + (datos ? `<script type="application/ld+json">${JSON.stringify(datos).replace(/</g, '\\u003c')}</script>` : '')
    : '';
  return new HTMLRewriter()
    .on('title', { element(e) { e.setInnerContent(previa.titulo); } })
    .on('meta', {
      element(e) {
        const k = e.getAttribute('property') || e.getAttribute('name');
        if (k && quitar.has(k)) e.remove();
      },
    })
    .on('head', {
      element(e) {
        e.append(metas.map(([a, k, v]) => `<meta ${a}="${k}" content="${escapar(v)}" />`).join('') + extra, { html: true });
      },
    })
    .transform(respuesta);
}

/**
 * /sitemap-vitrinas.xml: las Vitrinas publicadas, sus sedes, servicios y
 * productos, para que Google las encuentre. La lista la da el servidor
 * (vitrina/publica/mapa) y se guarda una hora.
 */
export async function mapaDeVitrinas(env, url) {
  const api = await direccionDeLaApi(env, url);
  let rutas = [];
  if (api) {
    try {
      const r = await fetch(`${api}/vitrina/publica/mapa`, { signal: AbortSignal.timeout(8000), cf: { cacheTtl: 3600, cacheEverything: true } });
      const d = r.ok ? await r.json() : null;
      if (Array.isArray(d?.rutas)) rutas = d.rutas.filter((x) => typeof x === 'string' && /^\/[A-Za-z0-9._\/-]+$/.test(x));
    } catch { /* sin lista: el mapa sale vacío */ }
  }
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + rutas.map((r) => `  <url><loc>${escapar(url.origin + r)}</loc></url>`).join('\n')
    + '\n</urlset>\n';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
