import { useEffect, useState } from 'react';

/**
 * Pantalla completa, para pantallas que cuelgan de una pared.
 *
 * Se escucha el evento del navegador en vez de fiarse del clic: de la
 * pantalla completa también se sale con Escape o con el mando del televisor,
 * y un botón que guardara su propio estado acabaría diciendo lo contrario de
 * lo que se ve.
 *
 * Quien lo use tiene que dejar SIEMPRE una forma de salir sin teclado —tocar
 * la pantalla, un botón grande—: en un televisor no hay Escape que pulsar, y
 * quien espera no se va a levantar de la silla.
 */
/**
 * Pedir y soltar la pantalla completa del NAVEGADOR (la que esconde la barra
 * de direcciones).
 *
 * Casi todos los navegadores exigen que venga de un toque reciente del
 * usuario, así que pedida desde el teléfono por el socket puede fallar — y
 * falla en silencio a propósito: el vídeo grande de la app no depende de
 * esto, se dibuja con CSS y se ve igual de completo con la barra encima.
 */
export async function pedirPantallaCompleta() {
  try { await document.documentElement.requestFullscreen(); return true; }
  catch { return false; }
}

export async function salirPantallaCompleta() {
  try { if (document.fullscreenElement) await document.exitFullscreen(); return true; }
  catch { return false; }
}

export function usarPantallaCompleta() {
  const [completa, setCompleta] = useState(false);

  useEffect(() => {
    const alCambiar = () => setCompleta(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', alCambiar);
    return () => document.removeEventListener('fullscreenchange', alCambiar);
  }, []);

  const alternar = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* El navegador puede negarse (permisos, un iframe). Se refleja el
         estado real para que el botón no mienta. */
      setCompleta(!!document.fullscreenElement);
    }
  };

  return { completa, alternar };
}
