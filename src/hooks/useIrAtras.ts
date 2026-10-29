import { useEffect, useRef } from 'react';

/** Desde qué distancia del borde izquierdo empieza el gesto (como en el iPhone) */
const BORDE_PX = 28;
/** Cuánto hay que arrastrar para volver */
const DISTANCIA_PARA_VOLVER = 90;
/** Si se mueve más en vertical que esto antes de decidirse, es un scroll, no un "atrás" */
const TOLERANCIA_VERTICAL = 30;

/**
 * Sobre esto el clic derecho conserva su menú de siempre: copiar y pegar en un
 * campo, abrir un enlace en otra pestaña, guardar una foto, el mapa.
 */
const CON_MENU_PROPIO = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], a[href], img, video, audio, canvas, .leaflet-container, [data-menu-propio]';
const DIALOGO = '[aria-modal="true"], [role="dialog"], [role="alertdialog"]';

interface Entrada { volver: { current: (() => void) | undefined }; enDialogo: boolean; orden: number }

/**
 * Las pantallas con "atrás" abiertas ahora mismo. Manda la de más adentro: con
 * "Atrás" arriba y "Todos los roles" dentro, el gesto vuelve primero a la lista
 * de roles. React dibuja de afuera hacia adentro, así que la que se dibujó
 * última por primera vez es la de más adentro.
 */
const pila: Entrada[] = [];
let contador = 0;
let quitarEscuchas: (() => void) | null = null;

const arriba = () => pila.reduce<Entrada | undefined>((a, e) => (!a || e.orden > a.orden ? e : a), undefined);

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

/** Con el clic derecho la flechita sale un instante, para que se entienda qué pasó */
const destello = () => {
  mostrar(DISTANCIA_PARA_VOLVER);
  const esta = flecha;
  window.setTimeout(() => { if (esta) esta.style.opacity = '0'; }, 180);
  window.setTimeout(() => { if (flecha === esta) quitar(); }, 360);
};

function escuchar() {
  let inicio: { x: number; y: number } | null = null;
  let decidido: 'atras' | 'no' | null = null;
  let avance = 0;
  // El "mantener pulsado" en el teléfono también abre el menú: ese no vuelve
  let ultimoPuntero = 'mouse';

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
    if (listo) arriba()?.volver.current?.();
  };

  const alApuntar = (e: PointerEvent) => { ultimoPuntero = e.pointerType || 'mouse'; };
  const alClicDerecho = (e: MouseEvent) => {
    const entrada = arriba();
    if (!entrada?.volver.current || e.defaultPrevented) return;
    // Mayúsculas + clic derecho (o Ctrl en Mac) deja el menú del navegador
    if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
    const tipo = (e as PointerEvent).pointerType || ultimoPuntero;
    if (tipo === 'touch' || tipo === 'pen') return;
    if (window.getSelection()?.toString()) return;
    const objetivo = e.target instanceof Element ? e.target : null;
    if (objetivo?.closest(CON_MENU_PROPIO)) return;
    // Encima de una ventana que no es la del "atrás", la ventana manda
    if (!entrada.enDialogo && objetivo?.closest(DIALOGO)) return;
    e.preventDefault();
    destello();
    entrada.volver.current();
  };

  window.addEventListener('touchstart', alTocar, { passive: true });
  window.addEventListener('touchmove', alMover, { passive: false });
  window.addEventListener('touchend', alSoltar);
  window.addEventListener('touchcancel', alSoltar);
  window.addEventListener('pointerdown', alApuntar, true);
  window.addEventListener('contextmenu', alClicDerecho);
  return () => {
    quitar();
    window.removeEventListener('touchstart', alTocar);
    window.removeEventListener('touchmove', alMover);
    window.removeEventListener('touchend', alSoltar);
    window.removeEventListener('touchcancel', alSoltar);
    window.removeEventListener('pointerdown', alApuntar, true);
    window.removeEventListener('contextmenu', alClicDerecho);
  };
}

/**
 * "Atrás" en toda la app, igual en todas partes:
 * - En el teléfono, deslizar desde el borde izquierdo hacia la derecha, como en
 *   las apps del iPhone. Una flechita sigue al dedo; al soltar pasada la
 *   distancia, vuelve.
 * - En la computadora, el clic derecho. Menos en campos de texto, enlaces,
 *   fotos o con texto marcado, donde sigue el menú de siempre.
 *
 * Cada pantalla que tiene un botón de "atrás" llama esto con lo mismo que hace
 * su botón. Solo cuando `activo` (si la pantalla tiene a dónde volver).
 * `enDialogo`: el "atrás" es de una ventana (la bienvenida, la reserva), y el
 * clic derecho dentro de ella también vuelve.
 */
export function useIrAtras(onVolver: (() => void) | undefined, activo = true, opciones: { enDialogo?: boolean } = {}) {
  const volver = useRef(onVolver);
  volver.current = onVolver;
  const enDialogo = !!opciones.enDialogo;
  const orden = useRef(0);
  if (!orden.current) orden.current = ++contador;

  useEffect(() => {
    if (!activo || !onVolver) return;
    const entrada: Entrada = { volver, enDialogo, orden: orden.current };
    pila.push(entrada);
    if (!quitarEscuchas) quitarEscuchas = escuchar();
    return () => {
      const i = pila.indexOf(entrada);
      if (i >= 0) pila.splice(i, 1);
      if (!pila.length && quitarEscuchas) { quitarEscuchas(); quitarEscuchas = null; }
    };
  }, [activo, !!onVolver, enDialogo]); // eslint-disable-line react-hooks/exhaustive-deps
}
