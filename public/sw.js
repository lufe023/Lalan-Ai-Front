/**
 * Service worker mínimo, y mínimo a propósito.
 *
 * Existe por UNA razón: Chrome solo ofrece "Instalar aplicación" a un sitio
 * que tenga uno registrado y que atienda peticiones. No guarda nada en
 * caché — deja pasar todo a la red tal cual.
 *
 * Y no guardar nada es una decisión, no una simplificación: una pantalla de
 * pared que sirviera una versión vieja de sí misma desde la caché sería un
 * televisor mostrando turnos de ayer, y nadie en el salón sabría por qué.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => { e.respondWith(fetch(e.request)); });
