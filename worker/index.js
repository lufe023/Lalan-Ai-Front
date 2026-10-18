import { direccionCorta } from './direccion-corta.js';

/**
 * Cloudflare sirve primero los archivos de dist. Este código solo corre
 * cuando ninguno coincide: si la ruta es una dirección corta de la Vitrina
 * (/lalanspa, /lalanspa/piantini) responde con la app, que la resuelve sin
 * cambiar la dirección. Lo demás sigue dando el "no existe" de siempre.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if ((request.method === 'GET' || request.method === 'HEAD') && direccionCorta(url.pathname)) {
      const app = await env.ASSETS.fetch(new Request(new URL('/app/', url), request));
      if (app.ok) {
        const r = new Response(app.body, app);
        r.headers.set('Cache-Control', 'no-cache');
        return r;
      }
    }
    return env.ASSETS.fetch(request);
  },
};
