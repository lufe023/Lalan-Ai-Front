import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { guiaPorId, type GuiaApp, type PasoGuia } from '../../data/guias';
import { cargarRutas, elementoDelPaso, EVENTO_RUTAS, puntoDelPaso, rutaGrabada, rutasCargadas } from '../../data/rutasLalan';
import { pedirSeccionAjustes } from '../ajustes/MenuAjustes';
import { guardarSedeActiva, sedeActiva, sedePropia } from '../../services/sedeActiva';

/**
 * "Llévame": la guía que está en curso.
 *
 * Lalan deja una tarjeta con el botón Llévame; al tocarlo, la app abre la
 * pantalla de esa tarea y señala con un globito dónde tocar, paso a paso.
 * Lalan nunca toca por la persona: solo le muestra el camino.
 *
 * La guía se guarda en sessionStorage: sigue aunque la app se recargue (al
 * cambiar de sede la app se recarga entera).
 */

const CLAVE = 'lalan.guia';
const EVENTO = 'lalan:guia';
/** Si en este tiempo no aparece lo que hay que señalar, se dice con palabras */
const ESPERA_ANCLA_MS = 4000;
const MEDIR_CADA_MS = 250;
const MARGEN = 6;
const ANCHO_GLOBO = 320;

interface EstadoGuia {
  id: string;
  paso: number;
  /** La sede en la que se hace (la eligió Lalan con la persona) */
  sedeId: string | null;
  sede: string | null;
  /** Ya se abrió la pantalla de la tarea */
  abierta?: boolean;
}

function leer(): EstadoGuia | null {
  try {
    const s = sessionStorage.getItem(CLAVE);
    return s ? (JSON.parse(s) as EstadoGuia) : null;
  } catch { return null; }
}

function guardar(e: EstadoGuia | null) {
  try {
    if (e) sessionStorage.setItem(CLAVE, JSON.stringify(e));
    else sessionStorage.removeItem(CLAVE);
  } catch { /* sin almacenamiento: la guía vive mientras no se recargue */ }
  window.dispatchEvent(new Event(EVENTO));
}

/** Empieza una guía (el botón Llévame de la tarjeta de Lalan) */
export function iniciarGuia(id: string, sedeId: string | null = null, sede: string | null = null) {
  guardar({ id, paso: 0, sedeId, sede });
}

/** La sede que eligió Lalan para la guía en curso: las pantallas con su propio selector la toman */
export function sedeDeLaGuia(): string | null {
  return leer()?.sedeId ?? null;
}

/** Ajustes escucha esto para volver al menú (o abrir la sección del `detail`) y que la guía empiece ahí */
export const EVENTO_AJUSTES_MENU = 'lalan:ajustes-menu';

/** Lo que señala un paso: su elemento o, si se grabó un punto, ese punto (y cuánto desplazar para verlo) */
function buscarPaso(p: PasoGuia): { caja: DOMRect; mostrar: () => void } | null {
  const el = elementoDelPaso(p);
  const r = el?.getBoundingClientRect();
  if (el && r && r.width > 0 && r.height > 0) return { caja: r, mostrar: () => el.scrollIntoView({ block: 'center', behavior: 'smooth' }) };
  const punto = puntoDelPaso(p);
  if (!punto) return null;
  const { contenedor, arriba } = punto;
  return { caja: punto.caja, mostrar: () => contenedor.scrollTo({ top: Math.max(0, arriba - contenedor.clientHeight / 2), behavior: 'smooth' }) };
}

export const GuiaEnCurso: React.FC = () => {
  const { navigateTo, currentScreen } = useApp();
  const [estado, setEstado] = useState<EstadoGuia | null>(() => leer());
  const [caja, setCaja] = useState<DOMRect | null>(null);
  const [perdida, setPerdida] = useState(false);
  const desde = useRef(Date.now());
  const yaSeMovio = useRef<string>('');

  // Las rutas grabadas en Plataforma mandan sobre las de la app
  const [, setRutas] = useState(0);
  useEffect(() => {
    const oir = () => setEstado(leer());
    const oirRutas = () => setRutas((n) => n + 1);
    window.addEventListener(EVENTO, oir);
    window.addEventListener(EVENTO_RUTAS, oirRutas);
    void cargarRutas();
    return () => { window.removeEventListener(EVENTO, oir); window.removeEventListener(EVENTO_RUTAS, oirRutas); };
  }, []);

  // Hasta que lleguen las rutas no se empieza: una grabada puede cambiar la de la app
  const guia: GuiaApp | null = estado && rutasCargadas() ? rutaGrabada(estado.id) ?? guiaPorId(estado.id) : null;
  const paso = guia && estado ? guia.pasos[estado.paso] ?? null : null;
  const total = guia?.pasos.length ?? 0;

  const terminar = useCallback(() => guardar(null), []);
  const avanzar = useCallback(() => {
    const e = leer();
    if (!e || !guia) return;
    if (e.paso + 1 >= guia.pasos.length) guardar(null);
    else guardar({ ...e, paso: e.paso + 1 });
  }, [guia]);

  // Abrir la pantalla de la tarea (una sola vez por guía)
  useEffect(() => {
    // Una tarea que no está en la app puede venir en las rutas grabadas: se espera a que lleguen
    if (!estado || !guia) { if (estado && !guia && rutasCargadas()) guardar(null); return; }
    if (estado.abierta) return;
    const primero = guia.pasos[0];
    // Lo que trabaja con la sede activa se hace en la sede que eligió Lalan:
    // la app cambia de sede (y se recarga, como al elegirla en el menú)
    if (guia.cambiaSede && estado.sedeId && !sedePropia() && sedeActiva() !== estado.sedeId) {
      guardarSedeActiva(estado.sedeId);
      try { sessionStorage.setItem('lalan.pantallaActual', guia.pantalla); } catch { /* nada */ }
      guardar({ ...estado, abierta: true });
      window.location.reload();
      return;
    }
    guardar({ ...estado, abierta: true });
    // Grabada dentro de una sección de Ajustes: empieza en esa sección
    if (guia.pantalla === 'settings' && primero?.seccion) {
      if (currentScreen === 'settings') window.dispatchEvent(new CustomEvent(EVENTO_AJUSTES_MENU, { detail: primero.seccion }));
      else pedirSeccionAjustes(primero.seccion);
    }
    if (currentScreen !== guia.pantalla) navigateTo(guia.pantalla);
    if (guia.ajustes) window.dispatchEvent(new Event(EVENTO_AJUSTES_MENU));
  }, [estado, guia, currentScreen, navigateTo]);

  // Un paso grabado en otra pantalla: si la persona no llegó tocando, la app la lleva
  useEffect(() => {
    if (!estado?.abierta || !paso?.pantalla || estado.paso === 0) return;
    const t = window.setTimeout(() => { if (paso.pantalla && paso.pantalla !== currentScreen) navigateTo(paso.pantalla); }, 600);
    return () => window.clearTimeout(t);
  }, [estado?.abierta, estado?.paso, paso, currentScreen, navigateTo]);

  // Buscar lo que hay que señalar y seguirlo (se mueve con el scroll y las animaciones)
  useEffect(() => {
    setCaja(null);
    setPerdida(false);
    if (!paso || !estado?.abierta) return;
    desde.current = Date.now();
    const clave = `${estado.id}:${estado.paso}`;
    const medir = () => {
      const hallado = buscarPaso(paso);
      if (hallado) {
        // Cada paso lleva la pantalla hasta su globito, aunque la persona esté arriba del todo
        if (yaSeMovio.current !== clave) {
          yaSeMovio.current = clave;
          hallado.mostrar();
        }
        setCaja(hallado.caja);
        setPerdida(false);
      } else {
        setCaja(null);
        if (Date.now() - desde.current > ESPERA_ANCLA_MS) setPerdida(true);
      }
    };
    medir();
    const t = window.setInterval(medir, MEDIR_CADA_MS);
    window.addEventListener('resize', medir);
    return () => { window.clearInterval(t); window.removeEventListener('resize', medir); };
  }, [paso, estado?.id, estado?.paso, estado?.abierta]);

  // Tocar lo señalado lleva al paso siguiente
  useEffect(() => {
    if (!paso || paso.leer) return;
    const alTocar = (ev: MouseEvent) => {
      const t = ev.target as Node | null;
      const el = elementoDelPaso(paso);
      let tocado = !!(el && t && el.contains(t));
      if (!tocado && !el) {
        // Un punto grabado: vale tocar dentro de su círculo
        const r = puntoDelPaso(paso)?.caja;
        tocado = !!r && ev.clientX >= r.left - MARGEN && ev.clientX <= r.right + MARGEN && ev.clientY >= r.top - MARGEN && ev.clientY <= r.bottom + MARGEN;
      }
      if (tocado) window.setTimeout(avanzar, 350);
    };
    document.addEventListener('click', alTocar, true);
    return () => document.removeEventListener('click', alTocar, true);
  }, [paso, avanzar]);

  if (!guia || !paso || !estado?.abierta) return null;

  const ultimo = estado.paso + 1 >= total;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const ancho = Math.min(ANCHO_GLOBO, vw - 32);
  // El globito va debajo de lo señalado; si no cabe, arriba; si no hay nada que señalar, centrado
  let arriba: number;
  let izquierda: number;
  if (caja) {
    izquierda = Math.min(Math.max(16, caja.left + caja.width / 2 - ancho / 2), vw - ancho - 16);
    arriba = caja.bottom + 14 + 170 < vh ? caja.bottom + 14 : Math.max(16, caja.top - 14 - 170);
  } else {
    izquierda = (vw - ancho) / 2;
    arriba = vh / 2 - 90;
  }

  return createPortal(
    <div className="fixed inset-0 z-[400] pointer-events-none" aria-live="polite">
      <AnimatePresence>
        {caja && (
          <motion.div
            key="foco"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, left: caja.left - MARGEN, top: caja.top - MARGEN, width: caja.width + MARGEN * 2, height: caja.height + MARGEN * 2 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="foco-guia fixed rounded-2xl"
          >
            {/* Un latido suave al llegar: se ve dónde tocar también en modo oscuro */}
            <motion.span aria-hidden="true" className="absolute inset-0 rounded-2xl ring-2 ring-[var(--primary)]"
              initial={{ opacity: 0.9, scale: 1 }} animate={{ opacity: 0, scale: 1.12 }}
              transition={{ duration: 1.4, ease: 'easeOut', repeat: 2, repeatDelay: 0.3 }} />
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        key={`${estado.id}:${estado.paso}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="fixed pointer-events-auto rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-2xl p-3.5 space-y-2.5"
        style={{ left: izquierda, top: arriba, width: ancho }}
        role="dialog"
        aria-label={`Guía: ${guia.nombre}`}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
          <span className="flex-1 min-w-0 text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400 truncate">
            {guia.nombre}{estado.sede ? ` · ${estado.sede}` : ''}
          </span>
          <span className="text-[0.6875rem] text-slate-400 tabular-nums shrink-0">{estado.paso + 1} de {total}</span>
          <button type="button" onClick={terminar} aria-label="Cerrar la guía" className="p-1 -mr-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[0.875rem] leading-snug text-slate-700 dark:text-neutral-200">{paso.texto}</p>
        {perdida && (
          <p className="text-[0.75rem] leading-snug text-slate-500 dark:text-neutral-400">
            No lo veo en tu pantalla. Sube o baja para buscarlo; si ya lo hiciste, toca Siguiente.
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={terminar} className="px-3 py-2 rounded-xl text-[0.8125rem] font-semibold text-slate-500 dark:text-neutral-400 cursor-pointer">
            Lo hago luego
          </button>
          {(paso.leer || perdida) && (
            <button type="button" onClick={avanzar} className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold cursor-pointer">
              {ultimo ? 'Listo' : 'Siguiente'}
            </button>
          )}
        </div>
      </motion.div>
    </div>,
    document.body,
  );
};
