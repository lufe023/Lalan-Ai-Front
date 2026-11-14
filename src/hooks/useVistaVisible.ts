import { useEffect, useState } from 'react';

export interface VistaVisible {
  /** Desde dónde empieza lo que se ve (el iPhone corre la página al abrir el teclado) */
  arriba: number;
  /** Lo alto que se ve, sin el teclado */
  alto: number;
  /** El teclado está abierto */
  teclado: boolean;
}

/**
 * Lo que de verdad se ve de la pantalla. En el iPhone el teclado no achica la
 * página: la tapa y la corre hacia arriba. Una capa `fixed inset-0` queda
 * entonces debajo del teclado. Con esto se ajusta a lo visible.
 */
/** Lo más alto que se ha visto la pantalla sin teclado (por orientación) */
let altoSinTeclado = 0;
let anchoVisto = 0;

export function useVistaVisible(activa: boolean): VistaVisible | null {
  const [vista, setVista] = useState<VistaVisible | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!activa || !vv) { setVista(null); return; }
    const medir = () => {
      // En la app instalada (PWA) del iPhone la ventana también se achica con el
      // teclado: comparar con la ventana no lo detecta y quedaba el espacio de la
      // raya de abajo encima del teclado. Se compara con lo más alto que se ha visto
      // en esta orientación.
      const ancho = Math.round(window.innerWidth);
      if (ancho !== anchoVisto) { anchoVisto = ancho; altoSinTeclado = 0; }
      altoSinTeclado = Math.max(altoSinTeclado, window.innerHeight, vv.height);
      setVista({
        arriba: vv.offsetTop,
        alto: vv.height,
        // Más de 120 px menos: es el teclado, no la barra del navegador
        teclado: window.innerHeight - vv.height > 120 || altoSinTeclado - vv.height > 120,
      });
    };
    // El teclado del iPhone entra animado: lo que mide al empezar no es donde termina.
    // Se vuelve a medir al acabar de moverse (si no, queda un hueco encima del teclado)
    let tarde = 0;
    const alCambiar = () => {
      medir();
      window.clearTimeout(tarde);
      tarde = window.setTimeout(medir, 350);
    };
    medir();
    vv.addEventListener('resize', alCambiar);
    vv.addEventListener('scroll', alCambiar);
    window.addEventListener('focusin', alCambiar);
    window.addEventListener('focusout', alCambiar);
    return () => {
      window.clearTimeout(tarde);
      vv.removeEventListener('resize', alCambiar); vv.removeEventListener('scroll', alCambiar);
      window.removeEventListener('focusin', alCambiar); window.removeEventListener('focusout', alCambiar);
    };
  }, [activa]);
  return vista;
}
