/**
 * Service Worker para Lalan AI PWA
 *
 * Estrategia de caché:
 * 1. App Shell (HTML de /app/, scripts JS compilados, estilos CSS, fuentes e iconos):
 *    - Navegación a /app/: Network-First con timeout protector (2s) y fallback inmediato a la caché local.
 *      Abre al instante incluso sin conexión a internet o en modo avión en el iPhone.
 *    - Archivos estáticos (js, css, fuentes, png, svg): Cache-First con Stale-While-Revalidate en segundo plano.
 * 2. Datos y APIs (/api/*, WebSockets, métodos POST/PUT/DELETE):
 *    - Network-Only: Nunca se sirve información de dinero, citas o turnos vieja.
 */

// CACHE_NAME: Se sincroniza y reemplaza automáticamente en tiempo de ejecución
// y de compilación usando la variable de entorno VITE_CACHE_NAME (desde .env.local).
const CACHE_NAME = 'lalan-shell-v3';

const ASSETS_CORE = [
  '/app/',
  '/app/index.html',
  '/index.html',
  '/manifest.webmanifest',
  '/icono-192.png',
  '/icono-512.png',
  '/icono-maskable-512.png',
  '/apple-touch-icon.png',
  '/favicon.svg',
];

// Instalación: precachear el cascarón de la app
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_CORE).catch(() => {});
    })
  );
  // NOTA: NO llamamos skipWaiting() automáticamente aquí para que el Service Worker
  // nuevo pase a estado 'waiting' y la UI muestre la notificación "Nueva versión disponible".
  // Cuando el usuario pulsa "Actualizar", la app envía { type: 'SKIP_WAITING' }.
});

// Activación: limpiar versiones viejas de caché
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Mensajes desde la interfaz de la aplicación (ej: botón Actualizar)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/** Página mínima cuando no hay red ni copia guardada (en vez de una pantalla rota) */
function paginaSinConexion() {
  const html = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Lalan</title>' +
    '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#09090b;color:#fafafa;font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:24px}' +
    'button{margin-top:18px;background:#e11d48;color:#fff;border:0;border-radius:12px;padding:12px 22px;font-size:15px;font-weight:700}</style></head>' +
    '<body><div><div style="font-size:22px;font-weight:700">No pudimos abrir Lalan</div>' +
    '<p style="color:#a1a1aa;font-size:14px;line-height:1.5">Revisa tu conexión a internet e inténtalo de nuevo.</p>' +
    '<button onclick="location.reload()">Reintentar</button></div></body></html>';
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// Intercepción de peticiones
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo interceptar peticiones GET
  if (req.method !== 'GET') {
    return;
  }

  // APIs y WebSockets: siempre van a la red directa
  if (url.pathname.startsWith('/api/') || url.pathname.includes('socket.io')) {
    return;
  }

  // Navegación (abrir o recargar la app): red primero; si falla o responde
  // algo que no es una página, la copia guardada; y si tampoco hay, una
  // página propia de "sin conexión". NUNCA una respuesta vacía: el iPhone la
  // muestra como un archivo descargado ("app · 0 KB").
  // Páginas fuera de la app (landing, /privacidad, /terminos): las sirve el
  // sitio tal cual. Cloudflare redirige "/privacidad.html" a "/privacidad" y
  // una redirección NO debe acabar mostrando la app.
  if (req.mode === 'navigate' && !url.pathname.startsWith('/app')) {
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const esPagina = (r) =>
          r && r.ok && r.type !== 'opaqueredirect' &&
          (r.headers.get('content-type') || '').includes('text/html');
        const guardada = async () =>
          (await caches.match(req)) || (await caches.match('/app/')) || (await caches.match('/app/index.html'));

        if (!navigator.onLine) {
          const c = await guardada();
          if (esPagina(c)) return c;
          return paginaSinConexion();
        }
        try {
          const r = await Promise.race([
            fetch(req),
            new Promise((_, rej) => setTimeout(() => rej(new Error('tiempo')), 6000)),
          ]);
          // Una redirección se le devuelve al navegador para que la siga
          if (r && r.type === 'opaqueredirect') return r;
          if (esPagina(r)) {
            const copia = r.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copia)).catch(() => {});
            return r;
          }
          const c = await guardada();
          return esPagina(c) ? c : (r && r.body ? r : paginaSinConexion());
        } catch {
          const c = await guardada();
          return esPagina(c) ? c : paginaSinConexion();
        }
      })()
    );
    return;
  }

  // Archivos estáticos de Vite y assets (JS, CSS, fuentes, imágenes):
  // Cache-First con Stale-While-Revalidate en segundo plano
  const isStatic =
    url.pathname.includes('/assets/') ||
    url.pathname.includes('/src/') ||
    url.pathname.includes('@vite') ||
    url.pathname.includes('@fs') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.ttf') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.ico') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isStatic) {
    event.respondWith(
      (async () => {
        // Cache-First
        const cachedResponse = await caches.match(req);
        if (cachedResponse) {
          // Si hay internet, refrescar silenciosamente en segundo plano
          if (typeof navigator === 'undefined' || navigator.onLine) {
            fetch(req)
              .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                  const clone = networkResponse.clone();
                  caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                }
              })
              .catch(() => {});
          }
          return cachedResponse;
        }

        // Si no estaba en caché, pedir a la red y guardar
        try {
          const networkResponse = await fetch(req);
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        } catch {
          return cachedResponse || new Response('Offline asset unavailable', { status: 503 });
        }
      })()
    );
    return;
  }

  // Todo lo demás: pasar a red con fallback a caché
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

// ── Notificaciones en la pantalla del teléfono (Web Push) ────────────
// El backend manda { titulo, cuerpo, ir, etiqueta }. "ir" es la pantalla que
// se abre al tocarla.
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { cuerpo: event.data ? event.data.text() : '' }; }
  const titulo = d.titulo || 'Lalan';
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: d.cuerpo || '',
      icon: '/icono-192.png',
      badge: '/icono-192.png',
      tag: d.etiqueta || undefined,
      renotify: !!d.etiqueta,
      data: { ir: d.ir || 'dashboard', aviso: d.aviso || null, conversacion: d.conversacion || null },
    }).then(() => (self.navigator && 'setAppBadge' in self.navigator ? self.navigator.setAppBadge().catch(() => {}) : undefined))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const datos = event.notification.data || {};
  const ir = datos.ir || 'dashboard';
  let url = '/app/?ir=' + encodeURIComponent(ir);
  if (datos.aviso) url += '&aviso=' + encodeURIComponent(datos.aviso);
  if (datos.conversacion) url += '&conversacion=' + encodeURIComponent(datos.conversacion);
  event.waitUntil((async () => {
    if (self.navigator && 'clearAppBadge' in self.navigator) self.navigator.clearAppBadge().catch(() => {});
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const v of ventanas) {
      if (v.url.includes('/app')) {
        v.postMessage({ tipo: 'ir', pantalla: ir, aviso: datos.aviso || null, conversacion: datos.conversacion || null });
        return v.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
