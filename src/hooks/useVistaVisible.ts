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
export function useVistaVisible(activa: boolean): VistaVisible | null {
  const [vista, setVista] = useState<VistaVisible | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!activa || !vv) { setVista(null); return; }
    const medir = () => setVista({
      arriba: vv.offsetTop,
      alto: vv.height,
      // Más de 120 px menos que la ventana: es el teclado, no la barra del navegador
      teclado: window.innerHeight - vv.height > 120,
    });
    medir();
    vv.addEventListener('resize', medir);
    vv.addEventListener('scroll', medir);
    return () => { vv.removeEventListener('resize', medir); vv.removeEventListener('scroll', medir); };
  }, [activa]);
  return vista;
}
