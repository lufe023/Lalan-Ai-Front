import { useEffect, useRef } from 'react';

/** Desde qué distancia del borde izquierdo empieza el gesto (como en el iPhone) */
const BORDE_PX = 28;
/** Cuánto hay que arrastrar para volver */
const DISTANCIA_PARA_VOLVER = 90;
/** Si se mueve más en vertical que esto antes de decidirse, es un scroll, no un "atrás" */
const TOLERANCIA_VERTICAL = 30;

/**
 * Deslizar desde el borde izquierdo hacia la derecha = "Atrás", como en las
 * apps del iPhone. Muestra una flechita que sigue al dedo; al soltar pasada la
 * distancia, vuelve. Solo cuando `activo` (si la pantalla tiene a dónde volver).
 */
export function useDeslizarParaVolver(onVolver: (() => void) | undefined, activo = true) {
  const volver = useRef(onVolver);
  volver.current = onVolver;

  useEffect(() => {
    if (!activo || !onVolver) return;
    let inicio: { x: number; y: number } | null = null;
    let decidido: 'atras' | 'no' | null = null;
    let avance = 0;
    let flecha: HTMLDivElement | null = null;

    const mostrar = (dx: number) => {
      if (!flecha) {
        flecha = document.createElement('div');
        flecha.setAttribute('aria-hidden', 'true');
        flecha.style.cssText = 'position:fixed;left:0;top:50%;z-index:9999;width:2.6rem;height:2.6rem;margin-top:-1.3rem;border-radius:999px;'
          + 'display:flex;align-items:center;justify-content:center;background:var(--primary,#C46B7C);color:#fff;'
          + 'box-shadow:0 4px 14px rgba(0,0,0,.25);pointer-events:none;transition:opacity .15s;';
        flecha.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
        document.body.appendChild(flecha);
      }
      const p = Math.min(dx / DISTANCIA_PARA_VOLVER, 1);
      flecha.style.transform = `translateX(${Math.min(dx * 0.45, 48) - 20}px) scale(${0.7 + p * 0.3})`;
      flecha.style.opacity = String(0.35 + p * 0.65);
    };
    const quitar = () => { flecha?.remove(); flecha = null; };

    const alTocar = (e: TouchEvent) => {
      const t = e.touches[0];
      if (e.touches.length !== 1 || t.clientX > BORDE_PX) { inicio = null; return; }
      inicio = { x: t.clientX, y: t.clientY }; decidido = null; avance = 0;
    };
    const alMover = (e: TouchEvent) => {
      if (!inicio) return;
      const t = e.touches[0];
      const dx = t.clientX - inicio.x;
      const dy = Math.abs(t.clientY - inicio.y);
      if (!decidido) {
        if (dy > TOLERANCIA_VERTICAL && dy > dx) { decidido = 'no'; return; }
        if (dx > 12) decidido = 'atras';
      }
      if (decidido !== 'atras') return;
      avance = Math.max(0, dx);
      mostrar(avance);
      if (e.cancelable) e.preventDefault();
    };
    const alSoltar = () => {
      const listo = decidido === 'atras' && avance >= DISTANCIA_PARA_VOLVER;
      quitar(); inicio = null; decidido = null; avance = 0;
      if (listo) volver.current?.();
    };

    window.addEventListener('touchstart', alTocar, { passive: true });
    window.addEventListener('touchmove', alMover, { passive: false });
    window.addEventListener('touchend', alSoltar);
    window.addEventListener('touchcancel', alSoltar);
    return () => {
      quitar();
      window.removeEventListener('touchstart', alTocar);
      window.removeEventListener('touchmove', alMover);
      window.removeEventListener('touchend', alSoltar);
      window.removeEventListener('touchcancel', alSoltar);
    };
  }, [activo, !!onVolver]); // eslint-disable-line react-hooks/exhaustive-deps
}
