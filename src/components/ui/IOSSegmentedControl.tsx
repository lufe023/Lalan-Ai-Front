import React from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
}

interface IOSSegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  id?: string;
  size?: 'sm' | 'md';
}

/** Cuánto hay que mover el mouse para que sea un arrastre y no un clic */
const UMBRAL_ARRASTRE_PX = 5;
/** Las flechas mueven casi una pantalla de pestañas (deja una a la vista para no perderse) */
const PASO_FLECHA = 0.7;
/** Margen al traer la pestaña elegida a la vista */
const MARGEN_VISTA_PX = 24;

/**
 * Las pestañas en "pastilla" de iOS.
 *
 * Cuando no caben (Plataforma tiene nueve), se desplazan de lado. En el
 * teléfono basta el dedo; en la computadora no había forma: la barra de
 * desplazamiento está escondida y la rueda movía la página. Ahora la rueda
 * y el arrastre con el mouse las mueven, unas flechas en los bordes avisan
 * que hay más, y la pestaña elegida siempre queda a la vista.
 */
export function IOSSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  id,
  size = 'md',
}: IOSSegmentedControlProps<T>) {
  // Cada control tiene su propia "pastilla": si dos comparten nombre, la animación salta de uno a otro
  const propio = React.useId();
  const caja = React.useRef<HTMLDivElement>(null);
  const [lados, setLados] = React.useState({ izq: false, der: false });
  const arrastre = React.useRef<{ x: number; inicio: number; movio: boolean } | null>(null);

  const medir = React.useCallback(() => {
    const c = caja.current;
    if (!c) return;
    setLados({ izq: c.scrollLeft > 1, der: c.scrollLeft + c.clientWidth < c.scrollWidth - 1 });
  }, []);

  React.useEffect(() => {
    const c = caja.current;
    if (!c) return;
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(c);
    // La rueda vertical mueve las pestañas de lado; en los extremos deja pasar el scroll a la página
    const rueda = (e: WheelEvent) => {
      if (c.scrollWidth <= c.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const puede = e.deltaY > 0 ? c.scrollLeft + c.clientWidth < c.scrollWidth - 1 : c.scrollLeft > 1;
      if (!puede) return;
      e.preventDefault();
      c.scrollLeft += e.deltaY;
    };
    c.addEventListener('wheel', rueda, { passive: false });
    return () => { obs.disconnect(); c.removeEventListener('wheel', rueda); };
  }, [medir, options.length]);

  // La pestaña elegida siempre a la vista (sin mover la página entera, como haría scrollIntoView)
  React.useEffect(() => {
    const c = caja.current;
    const b = c?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!c || !b) return;
    const izq = b.offsetLeft - MARGEN_VISTA_PX;
    const der = b.offsetLeft + b.offsetWidth + MARGEN_VISTA_PX - c.clientWidth;
    if (c.scrollLeft > izq) c.scrollTo({ left: izq, behavior: 'smooth' });
    else if (c.scrollLeft < der) c.scrollTo({ left: der, behavior: 'smooth' });
  }, [value]);

  const mover = (dir: 1 | -1) => {
    const c = caja.current;
    if (c) c.scrollBy({ left: dir * c.clientWidth * PASO_FLECHA, behavior: 'smooth' });
  };

  // Arrastrar con el mouse, como con el dedo (el dedo ya lo hace el navegador)
  const alBajar = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !caja.current) return;
    arrastre.current = { x: e.clientX, inicio: caja.current.scrollLeft, movio: false };
  };
  const alMover = (e: React.PointerEvent) => {
    const a = arrastre.current;
    if (!a || !caja.current) return;
    const dx = e.clientX - a.x;
    if (!a.movio && Math.abs(dx) < UMBRAL_ARRASTRE_PX) return;
    a.movio = true;
    caja.current.scrollLeft = a.inicio - dx;
  };
  // Se suelta después del clic, para que el clic sepa si fue un arrastre
  const alSoltar = () => { setTimeout(() => { arrastre.current = null; }, 0); };
  const alClicCaptura = (e: React.MouseEvent) => { if (arrastre.current?.movio) { e.stopPropagation(); e.preventDefault(); } };

  const desvanecer = lados.izq || lados.der
    ? `linear-gradient(to right, ${lados.izq ? 'transparent 0, #000 28px' : '#000 0'}, ${lados.der ? '#000 calc(100% - 28px), transparent 100%' : '#000 100%'})`
    : undefined;
  const flecha = 'absolute top-1/2 -translate-y-1/2 z-20 hidden [@media(pointer:fine)]:flex items-center justify-center w-6 h-6 rounded-full bg-white dark:bg-neutral-700 shadow text-slate-600 dark:text-neutral-200 cursor-pointer';

  return (
    <div className="relative max-w-full min-w-0">
      <div
        id={id}
        ref={caja}
        role="tablist"
        onScroll={medir}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerLeave={alSoltar}
        onClickCapture={alClicCaptura}
        style={desvanecer ? { maskImage: desvanecer, WebkitMaskImage: desvanecer } : undefined}
        className={`relative flex items-center max-w-full overflow-x-auto hide-scrollbar p-1 rounded-xl bg-slate-200/80 dark:bg-neutral-800/90 border border-slate-300/40 dark:border-neutral-700/50 select-none ${
          size === 'sm' ? 'h-8 text-xs' : 'h-10 text-xs'
        }`}
      >
        {options.map(option => {
          const isSelected = value === option.id;

          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onChange(option.id)}
              className={`relative flex-1 shrink-0 flex items-center justify-center gap-1.5 px-3 whitespace-nowrap font-semibold transition-colors duration-150 z-10 rounded-lg h-full ios-touch cursor-pointer ${
                isSelected
                  ? 'text-slate-900 dark:text-white font-bold'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isSelected && (
                <motion.div
                  layoutId={`segmented-active-pill-${id || propio}`}
                  className="absolute inset-0 bg-white dark:bg-neutral-700 rounded-lg shadow-sm -z-10"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}

              {option.icon && <span className="shrink-0">{option.icon}</span>}
              <span>{option.label}</span>

              {option.badge !== undefined && option.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[0.6875rem] font-bold bg-[var(--primary)] text-white">
                  {option.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {lados.izq && (
        <button type="button" aria-label="Ver pestañas anteriores" onClick={() => mover(-1)} className={`${flecha} -left-2`}>
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      {lados.der && (
        <button type="button" aria-label="Ver más pestañas" onClick={() => mover(1)} className={`${flecha} -right-2`}>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
