import { useEffect, useState } from 'react';

/**
 * «Toca para que suene».
 *
 * El iPhone (y Safari) no deja que un video de YouTube suene con sonido si el
 * play no nace de un toque en la pantalla. Cuando una canción pedida tiene
 * que sonar en este aparato y el teléfono no la deja, el puente de música lo
 * avisa aquí y la pantalla de música muestra un botón para tocarla.
 */
export interface EsperaToque {
  videoId: string;
  titulo: string;
}

const EVENTO = 'lalan:musica-espera-toque';
let actual: EsperaToque | null = null;

/** `null` quita el aviso (ya suena, o la tocaron) */
export function avisarEsperaToque(e: EsperaToque | null) {
  actual = e;
  window.dispatchEvent(new CustomEvent(EVENTO));
}

/** La canción que espera un toque, o null */
export function useEsperaToque(): EsperaToque | null {
  const [e, setE] = useState<EsperaToque | null>(actual);
  useEffect(() => {
    const alCambiar = () => setE(actual);
    window.addEventListener(EVENTO, alCambiar);
    alCambiar();
    return () => window.removeEventListener(EVENTO, alCambiar);
  }, []);
  return e;
}
