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
    const imagen = typeof d.imagen === 'string' && d.imagen
      ? (/^https?:\/\//.test(d.imagen) ? d.imagen : `${api}/${d.imagen.replace(/^\//, '')}`)
      : null;
    return { titulo: d.titulo, descripcion: typeof d.descripcion === 'string' ? d.descripcion : '', imagen };
  } catch {
    return null;
  }
}

const escapar = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** La página de la app con el título, la descripción y la foto de ese enlace */
export function conVistaPrevia(respuesta, previa, url) {
  const metas = [
    ['property', 'og:title', previa.titulo],
    ['property', 'og:description', previa.descripcion],
    ['property', 'og:url', `${url.origin}${url.pathname}`],
    ['property', 'og:type', 'website'],
    ['name', 'description', previa.descripcion],
    ['name', 'twitter:title', previa.titulo],
    ['name', 'twitter:description', previa.descripcion],
    ...(previa.imagen ? [['property', 'og:image', previa.imagen], ['name', 'twitter:image', previa.imagen]] : []),
  ];
  const quitar = new Set(metas.map(([, k]) => k));
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
        e.append(metas.map(([a, k, v]) => `<meta ${a}="${k}" content="${escapar(v)}" />`).join(''), { html: true });
      },
    })
    .transform(respuesta);
}
