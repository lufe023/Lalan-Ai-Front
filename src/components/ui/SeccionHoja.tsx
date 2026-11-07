import React, { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

/**
 * Las secciones de una hoja (IOSModal) o de una pantalla de ajustes.
 *
 * Antes cada sección era un iconito, un título chico y una raya fina: al bajar
 * de "Información del producto" a "Receta" la dueña no se enteraba de que ya
 * estaba en otra parte.
 *
 * Ahora (lo que eligió Luis, 2026-11-07):
 *  · Arriba, pegada debajo del encabezado de la hoja, una barra de pestañas
 *    con una marca en degradado que se desliza. Se puede bajar libremente:
 *    la pestaña de la sección en la que estás se marca sola.
 *  · Tocar una pestaña lleva a esa sección (sube o baja suave).
 *  · Cada sección abre con su ícono en degradado y un título grande con la
 *    letra de la marca, y una línea que dice qué hay dentro.
 *
 * Uso:
 *   <SeccionesHoja>
 *     <SeccionHoja icono={<Tag />} titulo="Precios de venta" corto="Precios" detalle="Lo que cobra cada sede">…</SeccionHoja>
 *     …
 *   </SeccionesHoja>
 *
 * Con una sola sección la barra no sale. Una SeccionHoja fuera de
 * SeccionesHoja también funciona: solo su título.
 */

interface Registro { id: string; corto: string; el: HTMLElement }
const Ctx = createContext<((r: Registro) => () => void) | null>(null);

/** El contenedor que se desplaza (en una hoja, el cuerpo de IOSModal) */
function contenedorDe(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === 'auto' || o === 'scroll') return p;
  }
  return null;
}

/** Lo que se ve de más arriba en el contenedor (el relleno de la hoja) */
const ALTO_EXTRA = 12;

export const SeccionesHoja: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => {
  const mapa = useRef(new Map<string, Registro>());
  const [lista, setLista] = useState<Registro[]>([]);
  const [activa, setActiva] = useState(0);
  const barra = useRef<HTMLDivElement>(null);
  const fila = useRef<HTMLDivElement>(null);
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  const [marca, setMarca] = useState<{ left: number; width: number } | null>(null);
  // Mientras se desliza por un toque, la marca no salta por las secciones de en medio
  const yendo = useRef<number | null>(null);

  const ordenar = useCallback(() => {
    const todas = [...mapa.current.values()].filter(r => r.el.isConnected);
    todas.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    setLista(todas);
  }, []);

  const registrar = useCallback((r: Registro) => {
    mapa.current.set(r.id, r);
    ordenar();
    return () => { mapa.current.delete(r.id); ordenar(); };
  }, [ordenar]);

  // Cuál sección se está viendo
  useEffect(() => {
    const cont = contenedorDe(barra.current);
    if (!cont || lista.length < 2) return;
    const medir = () => {
      if (yendo.current !== null) return;
      const linea = cont.getBoundingClientRect().top + (barra.current?.offsetHeight ?? 0) + ALTO_EXTRA + 24;
      let i = 0;
      lista.forEach((r, k) => { if (r.el.getBoundingClientRect().top <= linea) i = k; });
      if (cont.scrollTop + cont.clientHeight >= cont.scrollHeight - 4) i = lista.length - 1;
      setActiva(i);
    };
    const fin = () => { yendo.current = null; medir(); };
    medir();
    cont.addEventListener('scroll', medir, { passive: true });
    cont.addEventListener('scrollend', fin);
    return () => { cont.removeEventListener('scroll', medir); cont.removeEventListener('scrollend', fin); };
  }, [lista]);

  // La marca se pone debajo de la pestaña activa, y la fila se corre para que se vea
  useLayoutEffect(() => {
    const poner = () => {
      const b = botones.current[activa];
      if (!b) return;
      setMarca({ left: b.offsetLeft, width: b.offsetWidth });
      const f = fila.current;
      if (f && f.scrollWidth > f.clientWidth) f.scrollTo({ left: b.offsetLeft - (f.clientWidth - b.offsetWidth) / 2, behavior: 'smooth' });
    };
    poner();
    const ro = new ResizeObserver(poner);
    if (fila.current) ro.observe(fila.current);
    return () => ro.disconnect();
  }, [activa, lista]);

  const ir = (i: number) => {
    const cont = contenedorDe(barra.current);
    const r = lista[i];
    if (!cont || !r) return;
    setActiva(i);
    yendo.current = i;
    const destino = cont.scrollTop + r.el.getBoundingClientRect().top - cont.getBoundingClientRect().top - (barra.current?.offsetHeight ?? 0) - ALTO_EXTRA;
    cont.scrollTo({ top: i === 0 ? 0 : Math.max(0, destino), behavior: 'smooth' });
    // Por si el navegador no avisa del final del desplazamiento
    window.setTimeout(() => { if (yendo.current === i) yendo.current = null; }, 900);
  };

  return (
    <Ctx.Provider value={registrar}>
      <div className={className}>
        {lista.length > 1 && (
          <div ref={barra}
            className="sticky top-[calc(-1*var(--hoja-relleno,1.25rem))] z-20 -mx-5 px-5 pt-3 pb-3 mb-3 bg-white dark:bg-neutral-900 shadow-[0_10px_14px_-14px_rgba(15,23,42,0.35)] dark:shadow-[0_10px_14px_-14px_rgba(0,0,0,0.9)]">
            <div ref={fila} role="tablist" aria-label="Secciones"
              className="relative flex p-1 rounded-2xl bg-slate-100 dark:bg-neutral-800 overflow-x-auto hide-scrollbar">
              {marca && (
                <span aria-hidden
                  className="absolute top-1 bottom-1 rounded-xl bg-[linear-gradient(120deg,var(--primary),var(--accent))] shadow-[0_8px_20px_-8px_var(--primary)] transition-[left,width] duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
                  style={{ left: marca.left, width: marca.width }} />
              )}
              {lista.map((r, i) => (
                <button key={r.id} type="button" role="tab" aria-selected={i === activa}
                  ref={el => { botones.current[i] = el; }}
                  onClick={() => ir(i)}
                  className={`relative z-10 flex-1 min-w-fit whitespace-nowrap px-3 py-2 rounded-xl text-[0.75rem] font-semibold transition-colors duration-300 ios-touch cursor-pointer ${i === activa ? 'text-white' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200'}`}>
                  {r.corto}
                </button>
              ))}
            </div>
          </div>
        )}
        {children}
      </div>
    </Ctx.Provider>
  );
};

interface Props {
  /** Ícono de lucide (o un emoji) */
  icono: React.ReactNode;
  titulo: string;
  /** Lo que dice su pestaña (por defecto, el título) */
  corto?: string;
  /** Una línea que dice qué hay en la sección ("Lo que sale del inventario al servirlo") */
  detalle?: React.ReactNode;
  /** Botón o etiqueta a la derecha del título */
  accion?: React.ReactNode;
  /** Su lugar en la hoja: entra en cascada detrás de la anterior */
  indice?: number;
  className?: string;
  children: React.ReactNode;
}

export const SeccionHoja: React.FC<Props> = ({ icono, titulo, corto, detalle, accion, indice = 0, className = '', children }) => {
  const registrar = useContext(Ctx);
  const ref = useRef<HTMLElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    if (!registrar || !ref.current) return;
    return registrar({ id, corto: corto ?? titulo, el: ref.current });
  }, [registrar, id, corto, titulo]);

  return (
    <section ref={ref} aria-label={titulo}
      className={`entrar-suave pt-1 pb-8 last:pb-2 ${className}`}
      style={{ animationDelay: `${Math.min(indice, 8) * 45}ms` }}>
      <header className="flex items-center gap-3 mb-4">
        <span className="w-11 h-11 shrink-0 rounded-2xl bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-white flex items-center justify-center text-lg leading-none shadow-[0_10px_24px_-10px_var(--primary)] [&>svg]:w-5 [&>svg]:h-5">
          {icono}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="font-serif text-[1.375rem] leading-tight font-semibold text-slate-900 dark:text-white">{titulo}</h4>
          {detalle && <p className="text-[0.8125rem] leading-snug text-slate-500 dark:text-neutral-400 mt-0.5">{detalle}</p>}
        </div>
        {accion && <div className="shrink-0">{accion}</div>}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
};
