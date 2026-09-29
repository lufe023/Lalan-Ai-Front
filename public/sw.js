/**
 * Service Worker para Lalan AI PWA
 *
 * Estrategia de caché:
 * 1. App Shell (HTML de /app/, scripts JS compilados, estilos CSS, fuentes e iconos):
 *    - Navegación a /app/: Network-First con fallback a la caché local. Abre al instante
 *      incluso sin conexión a internet o en modo avión en el iPhone.
 *    - Archivos estáticos (js, css, fuentes, png, svg): Stale-While-Revalidate.
 * 2. Datos y APIs (/api/*, WebSockets, métodos POST/PUT/DELETE):
 *    - Network-Only: Nunca se sirve información de dinero, citas o turnos vieja.
 */

// CACHE_NAME: Se sincroniza y reemplaza automáticamente en tiempo de ejecución
// y de compilación usando la variable de entorno VITE_CACHE_NAME (desde .env.local).
const CACHE_NAME = 'lalan-shell-v3';

const ASSETS_CORE = [
  '/app/',
  '/app/index.html',
  '/manifest.webmanifest',
  '/icono-192.png',
  '/icono-512.png',
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
  self.skipWaiting();
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

  // Peticiones de navegación (cuando el usuario entra o refresca /app/):
  // Intentar red primero; si falla (modo avión / sin internet), entregar el HTML cacheado de /app/
  if (req.mode === 'navigate' || url.pathname.startsWith('/app/')) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const respClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, respClone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          return caches.match('/app/') || caches.match('/app/index.html');
        })
    );
    return;
  }

  // Archivos estáticos de Vite y assets (JS, CSS, fuentes, imágenes):
  // Stale-While-Revalidate: responder rápido con caché si existe y actualizar en segundo plano
  const isStatic =
    url.pathname.includes('/assets/') ||
    url.pathname.includes('/src/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico');

  if (isStatic) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        const fetchPromise = fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Todo lo demás: pasar a red con fallback a caché
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

