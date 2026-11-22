import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Una fila de botones que corre de lado (días, atajos…). En el teléfono se
 * desliza con el dedo; en la PC se arrastra con el mouse, corre con la
 * ruedita y trae flechas cuando hay más de lo que se ve.
 * El elemento llega por un ref de función: la fila puede aparecer después.
 */
export function useCarrilHorizontal<T extends HTMLElement = HTMLDivElement>() {
  const [el, ref] = useState<T | null>(null);
  const [puede, setPuede] = useState({ izquierda: false, derecha: false });
  const arrastre = useRef<{ x: number; inicio: number; movio: boolean } | null>(null);

  const medir = useCallback(() => {
    if (!el) return;
    setPuede({ izquierda: el.scrollLeft > 2, derecha: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  }, [el]);

  useEffect(() => {
    if (!el) return;
    medir();
    const alCorrer = () => medir();
    // La ruedita (vertical) mueve la fila de lado, sin mover la conversación
    const rueda = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const antes = el.scrollLeft;
      el.scrollLeft += e.deltaY;
      if (el.scrollLeft !== antes) e.preventDefault();
    };
    // Arrastrar con el mouse (el dedo ya lo hace el navegador)
    const bajar = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      arrastre.current = { x: e.clientX, inicio: el.scrollLeft, movio: false };
    };
    const mover = (e: PointerEvent) => {
      const a = arrastre.current;
      if (!a) return;
      const dx = e.clientX - a.x;
      if (!a.movio && Math.abs(dx) < 5) return;
      a.movio = true;
      el.style.cursor = 'grabbing';
      el.scrollLeft = a.inicio - dx;
    };
    const soltar = () => {
      const a = arrastre.current;
      arrastre.current = null;
      el.style.cursor = '';
      // Si arrastró, ese clic no abre el botón donde soltó
      if (a?.movio) {
        const tragar = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); };
        el.addEventListener('click', tragar, { capture: true, once: true });
        setTimeout(() => el.removeEventListener('click', tragar, { capture: true }), 0);
      }
    };
    const observar = new ResizeObserver(medir);
    observar.observe(el);
    el.addEventListener('scroll', alCorrer, { passive: true });
    el.addEventListener('wheel', rueda, { passive: false });
    el.addEventListener('pointerdown', bajar);
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    return () => {
      observar.disconnect();
      el.removeEventListener('scroll', alCorrer);
      el.removeEventListener('wheel', rueda);
      el.removeEventListener('pointerdown', bajar);
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
    };
  }, [el, medir]);

  /** Las flechas: corre casi lo que se ve */
  const correr = (lado: 1 | -1) => {
    if (el) el.scrollBy({ left: lado * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return { ref, puede, correr, medir };
}
