import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Circle, Hand, MousePointerClick, Square } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { indiceConNombre, nombreDe, SELECTOR_TOCABLES } from '../../data/rutasLalan';
import type { PasoGuia } from '../../data/guias';
import type { SeccionAjustes } from '../ajustes/MenuAjustes';

/**
 * El grabador de rutas del Llévame. Plataforma → Lalan → Lo que sabe hacer
 * abre la app en un marco con `?grabar=ruta` y aquí se dibuja la ruta a
 * clics, como se ve el mapa de calor:
 *
 * - «Marcar pasos»: lo que se toca NO se hace; se elige como paso, se le
 *   escribe el globito y se guarda (y, si se quiere, se toca de verdad para
 *   seguir a la pantalla siguiente).
 * - «Usar la app»: la app funciona normal, para llegar a donde empieza el
 *   paso siguiente sin grabar nada.
 *
 * Cada paso se manda al panel de Plataforma, que es donde se ordena y guarda.
 */

export const MENSAJE_PASO = 'lalan:paso-grabado';

interface Elegido { el: HTMLElement | null; caja: DOMRect; paso: PasoGuia }

const ANCLA = '[data-guia]';

function describir(p: PasoGuia): string {
  if (p.ancla) return `Marca fija «${p.ancla}»`;
  if (p.etiqueta) return `«${p.etiqueta}»${p.indice ? ` (el ${p.indice + 1}.º con ese nombre)` : ''}`;
  return 'Un punto de la pantalla';
}

export const GrabadorRuta: React.FC = () => {
  const { currentScreen } = useApp();
  const [marcando, setMarcando] = useState(true);
  const [encima, setEncima] = useState<DOMRect | null>(null);
  const [elegido, setElegido] = useState<Elegido | null>(null);
  const [texto, setTexto] = useState('');
  const [leer, setLeer] = useState(false);
  const [grabados, setGrabados] = useState(0);
  const dejarPasar = useRef(false);
  const globoRef = useRef<HTMLDivElement>(null);
  const [altoGlobo, setAltoGlobo] = useState(300);
  useLayoutEffect(() => { if (elegido && globoRef.current) setAltoGlobo(globoRef.current.offsetHeight); }, [elegido]);

  /** Qué paso sale de tocar en (x, y) sobre `objetivo` */
  const pasoDe = useCallback((objetivo: Element, x: number, y: number): Elegido => {
    const conAncla = objetivo.closest<HTMLElement>(ANCLA);
    const tocable = objetivo.closest<HTMLElement>(SELECTOR_TOCABLES);
    const seccion = (document.querySelector('[data-seccion-ajustes]')?.getAttribute('data-seccion-ajustes') || undefined) as SeccionAjustes | undefined;
    const paso: PasoGuia = { pantalla: currentScreen, texto: '', ...(currentScreen === 'settings' && seccion ? { seccion } : {}) };
    // Lo más firme primero: la marca fija; si no, el nombre; y siempre el punto, por si lo demás cambia
    // Una marca que envuelve una tarjeta entera no es el botón tocado: manda el botón
    const usarAncla = !!conAncla && (!tocable || conAncla === tocable || tocable.contains(conAncla));
    const el = usarAncla ? conAncla : tocable;
    if (usarAncla) paso.ancla = conAncla!.getAttribute('data-guia') ?? undefined;
    else if (tocable) {
      const nombre = nombreDe(tocable);
      if (nombre) { paso.etiqueta = nombre; paso.indice = indiceConNombre(tocable, nombre); }
    }
    const desplazable = objetivo.closest<HTMLElement>('[data-desplazable]');
    if (desplazable) {
      const r = desplazable.getBoundingClientRect();
      paso.x = Math.min(1, Math.max(0, (x - r.left) / r.width));
      paso.y = Math.min(1, Math.max(0, (y - r.top + desplazable.scrollTop) / Math.max(desplazable.scrollHeight, 1)));
    }
    const caja = el?.getBoundingClientRect() ?? new DOMRect(x - 22, y - 22, 44, 44);
    return { el, caja, paso };
  }, [currentScreen]);

  // Marcar: resaltar lo que está bajo el cursor y atrapar el toque
  useEffect(() => {
    if (!marcando || elegido) { setEncima(null); return; }
    const fuera = (t: EventTarget | null) => !(t instanceof Element) || !!t.closest('[data-grabador]');
    const mover = (ev: MouseEvent) => {
      if (fuera(ev.target)) { setEncima(null); return; }
      const el = (ev.target as Element).closest<HTMLElement>(`${ANCLA}, ${SELECTOR_TOCABLES}`);
      setEncima(el ? el.getBoundingClientRect() : new DOMRect(ev.clientX - 22, ev.clientY - 22, 44, 44));
    };
    const atrapar = (ev: MouseEvent) => {
      if (dejarPasar.current || fuera(ev.target)) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.type !== 'click') return;
      const e = pasoDe(ev.target as Element, ev.clientX, ev.clientY);
      setElegido(e);
      setTexto('');
      // Lo que no es un botón se lee; lo que se toca avanza al tocarlo
      setLeer(!e.paso.ancla && !e.paso.etiqueta);
    };
    document.addEventListener('mousemove', mover, true);
    for (const t of ['pointerdown', 'mousedown', 'click'] as const) document.addEventListener(t, atrapar, true);
    return () => {
      document.removeEventListener('mousemove', mover, true);
      for (const t of ['pointerdown', 'mousedown', 'click'] as const) document.removeEventListener(t, atrapar, true);
    };
  }, [marcando, elegido, pasoDe]);

  const guardar = (tocarlo: boolean) => {
    if (!elegido || !texto.trim()) return;
    const paso: PasoGuia = { ...elegido.paso, texto: texto.trim(), leer };
    window.parent?.postMessage({ tipo: MENSAJE_PASO, paso }, window.location.origin);
    setGrabados((n) => n + 1);
    const el = elegido.el;
    setElegido(null);
    // Tocarlo de verdad para seguir grabando en la pantalla que abre
    if (tocarlo && el) {
      dejarPasar.current = true;
      el.click();
      window.setTimeout(() => { dejarPasar.current = false; }, 0);
    }
  };

  const ancho = Math.min(340, window.innerWidth - 32);
  const globo = elegido && {
    left: Math.min(Math.max(16, elegido.caja.left + elegido.caja.width / 2 - ancho / 2), window.innerWidth - ancho - 16),
    // Debajo de lo elegido; si no cabe, arriba; y nunca cortado por el borde
    top: Math.max(16, Math.min(
      elegido.caja.bottom + 12 + altoGlobo < window.innerHeight - 72 ? elegido.caja.bottom + 12 : elegido.caja.top - 12 - altoGlobo,
      window.innerHeight - 72 - altoGlobo,
    )),
  };

  return createPortal(
    <div data-grabador className="fixed inset-0 z-[500] pointer-events-none">
      {(encima || elegido) && (
        <div className="fixed rounded-xl border-2 border-dashed border-fuchsia-500 bg-fuchsia-500/10 transition-all duration-75"
          style={{ left: (elegido?.caja ?? encima)!.left - 4, top: (elegido?.caja ?? encima)!.top - 4, width: (elegido?.caja ?? encima)!.width + 8, height: (elegido?.caja ?? encima)!.height + 8 }} />
      )}

      {/* Mientras se escribe el globito, la app no recibe toques */}
      {elegido && <div className="fixed inset-0 pointer-events-auto" />}

      {elegido && globo && (
        <div ref={globoRef} className="fixed pointer-events-auto rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-2xl p-3.5 space-y-2.5"
          style={{ left: globo.left, top: globo.top, width: ancho }} role="dialog" aria-label="Paso nuevo">
          <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">Paso {grabados + 1} · {describir(elegido.paso)}</p>
          <textarea autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={300} rows={3} placeholder="Lo que dice el globito. Ej.: Toca «Vitrina»."
            className="w-full px-3 py-2 rounded-xl text-[0.8125rem] text-slate-800 dark:text-neutral-100 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 resize-none" />
          <div className="flex gap-1.5 text-[0.75rem] font-semibold">
            <button type="button" onClick={() => setLeer(false)} disabled={!elegido.paso.ancla && !elegido.paso.etiqueta && elegido.paso.x === undefined}
              className={`flex-1 px-2 py-1.5 rounded-lg border cursor-pointer disabled:opacity-40 ${!leer ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300'}`}>Avanza al tocarlo</button>
            <button type="button" onClick={() => setLeer(true)}
              className={`flex-1 px-2 py-1.5 rounded-lg border cursor-pointer ${leer ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300'}`}>Se lee y sigue</button>
          </div>
          {!elegido.paso.ancla && !elegido.paso.etiqueta && (
            <p className="text-[0.6875rem] text-amber-600">Esto no tiene nombre fijo: se guarda el punto. Si la pantalla cambia, puede quedar corrido.</p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setElegido(null)} className="px-3 py-2 rounded-xl text-[0.8125rem] font-semibold text-slate-500 cursor-pointer">Cancelar</button>
            {elegido.el && (
              <button type="button" onClick={() => guardar(true)} disabled={!texto.trim()} className="px-3 py-2 rounded-xl text-[0.8125rem] font-semibold border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 disabled:opacity-50 cursor-pointer">Guardar y tocarlo</button>
            )}
            <button type="button" onClick={() => guardar(false)} disabled={!texto.trim()} className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold disabled:opacity-50 cursor-pointer">Guardar paso</button>
          </div>
        </div>
      )}

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-1 p-1 rounded-full bg-slate-900/95 text-white shadow-2xl">
        <span className="flex items-center gap-1.5 pl-3 pr-2 text-[0.75rem] font-bold"><Circle className="w-2.5 h-2.5 fill-rose-500 text-rose-500 animate-pulse" /> Grabando · {grabados}</span>
        <button type="button" onClick={() => setMarcando(true)} aria-pressed={marcando}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.75rem] font-semibold cursor-pointer ${marcando ? 'bg-white text-slate-900' : 'text-white/80'}`}><MousePointerClick className="w-3.5 h-3.5" /> Marcar pasos</button>
        <button type="button" onClick={() => { setMarcando(false); setElegido(null); }} aria-pressed={!marcando}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.75rem] font-semibold cursor-pointer ${!marcando ? 'bg-white text-slate-900' : 'text-white/80'}`}><Hand className="w-3.5 h-3.5" /> Usar la app</button>
        {!marcando && <span className="hidden sm:flex items-center gap-1 px-2 text-[0.6875rem] text-amber-300"><Square className="w-3 h-3" /> Lo que toques se hace de verdad</span>}
      </div>
    </div>,
    document.body,
  );
};
