import { direccionCorta } from './direccion-corta.js';
import { conVistaPrevia, vistaPrevia } from './vista-previa.js';

/**
 * Cloudflare sirve primero los archivos de dist. Este código solo corre
 * cuando ninguno coincide: si la ruta es una dirección corta de la Vitrina
 * (/lalanspa, /lalanspa/piantini, /lalanspa/piantini/balayage-1f0001)
 * responde con la app, que la resuelve sin cambiar la dirección. Antes le
 * pone el título, la descripción y la foto del servicio: es lo que muestran
 * WhatsApp, Instagram y Facebook al pegar el enlace. Lo demás sigue dando el
 * "no existe" de siempre.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corta = (request.method === 'GET' || request.method === 'HEAD') ? direccionCorta(url.pathname) : null;
    if (corta) {
      const [app, previa] = await Promise.all([
        env.ASSETS.fetch(new Request(new URL('/app/', url), request)),
        vistaPrevia(env, url, corta),
      ]);
      if (app.ok) {
        const r = new Response(app.body, app);
        r.headers.set('Cache-Control', 'no-cache');
        return previa ? conVistaPrevia(r, previa, url) : r;
      }
    }
    return env.ASSETS.fetch(request);
  },
};
