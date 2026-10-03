import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { aplicarTamano, tamanoGuardado } from './utils/tamanoLetra';

// La letra que eligió esta persona en este teléfono, antes de pintar nada
aplicarTamano(tamanoGuardado());

/* El service worker (abrir sin internet, actualizaciones) es SOLO para la app
   compilada. En desarrollo guardaba en caché el código mientras se editaba:
   servía versiones viejas y, si el servidor se reiniciaba, hasta una
   respuesta vacía que el iPhone mostraba como un archivo "app" de 0 KB. */
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((r) => r.update().catch(() => {})).catch(() => {});
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
    if ('caches' in window) caches.keys().then((ks) => ks.filter((k) => k.startsWith('lalan')).forEach((k) => caches.delete(k))).catch(() => {});
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
