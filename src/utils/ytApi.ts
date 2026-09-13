/**
 * Carga https://www.youtube.com/iframe_api una sola vez por pestaña.
 *
 * La promesa se guarda en `window` y no en un módulo a propósito: la usan el
 * reproductor global de la app y la ventana pública del salón, y si cada uno
 * cargara el script por su cuenta, el segundo pisaría el
 * `onYouTubeIframeAPIReady` del primero y ese player no arrancaría nunca.
 */
export function cargarApiYouTube(): Promise<any> {
  const w = window as any;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (!w.__lalanYtApiPromise) {
    w.__lalanYtApiPromise = new Promise((resolve) => {
      const anterior = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        anterior?.();
        resolve(w.YT);
      };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    });
  }
  return w.__lalanYtApiPromise;
}
