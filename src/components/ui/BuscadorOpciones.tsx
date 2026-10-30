import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Armchair, BarChart3, Calendar, CalendarCheck2, CornerDownLeft, Globe2, LayoutDashboard,
  MessageSquareText, MessagesSquare, Music, Receipt, Search, Sliders, Sparkles, Tag, Users, Wallet,
  CalendarRange,
  ShoppingCart,
} from 'lucide-react';
import { useApp, ScreenName } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { PERMISO_DE_PANTALLA } from '../../services/permisos';
import { usePlan } from '../../context/PlanContext';
import { gruposPara, pedirSeccionAjustes } from '../ajustes/MenuAjustes';
import type { SeccionAjustes } from '../ajustes/MenuAjustes';
import { EVENTO_AJUSTES_MENU } from '../guias/GuiaEnCurso';
import { abrirLalan, puedeHablarConLalan } from '../lalan/PantallaLalan';
import { EsferaLalan } from '../lalan/EsferaLalan';
import type { ClaveModulo } from '../../types/plataforma';

/**
 * El buscador de opciones (Ctrl+K o ⌘K): se escribe algo parecido al nombre
 * de una pantalla, un informe o una sección de Ajustes y se llega sin saber
 * dónde estaba en el menú.
 *
 * Solo lleva a sitios. No cambia la sede ni toca datos: cada pantalla sigue
 * mostrando lo de la sede activa con su propio selector, así que buscar no
 * puede cruzar el inventario ni la caja de una sede con otra.
 */

const EVENTO_ABRIR = 'lalan:buscador';
/** Abre el buscador desde cualquier botón (el menú lateral, la lupa del teléfono) */
export function abrirBuscador() { window.dispatchEvent(new Event(EVENTO_ABRIR)); }

/** En el Mac se ve ⌘K; en lo demás, Ctrl K */
export const ATAJO_BUSCADOR = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

interface Opcion {
  id: string;
  titulo: string;
  /** Dónde vive, para que la persona aprenda el camino */
  donde: string;
  /** Otras formas de llamarlo: lo que la gente escribe sin saber el nombre */
  palabras?: string;
  icono: React.ElementType;
  color: string;
  modulo?: ClaveModulo;
  ir: () => void;
}

/** Sin mayúsculas ni tildes: "conversión" y "conversion" son lo mismo */
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Cuántas letras hay que cambiar para pasar de una palabra a otra (con tope, para no gastar) */
function distancia(a: string, b: string, tope: number): number {
  if (Math.abs(a.length - b.length) > tope) return tope + 1;
  let previa = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    let menor = i;
    for (let j = 1; j <= b.length; j++) {
      fila[j] = Math.min(previa[j] + 1, fila[j - 1] + 1, previa[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      menor = Math.min(menor, fila[j]);
    }
    if (menor > tope) return tope + 1;
    previa = fila;
  }
  return previa[b.length];
}

/**
 * Qué tan bien una palabra buscada encaja en una opción (0 = nada).
 * Gana el título sobre los sinónimos, el principio de palabra sobre el medio,
 * y se perdona una letra mal puesta ("converciones", "agneda").
 */
function puntajePalabra(q: string, titulo: string, resto: string): number {
  const palabrasTitulo = titulo.split(/[^a-z0-9ñ]+/).filter(Boolean);
  if (titulo.startsWith(q)) return 100;
  if (palabrasTitulo.some((p) => p.startsWith(q))) return 80;
  if (titulo.includes(q)) return 60;
  const palabrasResto = resto.split(/[^a-z0-9ñ]+/).filter(Boolean);
  if (palabrasResto.some((p) => p.startsWith(q))) return 45;
  if (resto.includes(q)) return 30;
  if (q.length >= 4) {
    const tope = q.length >= 7 ? 2 : 1;
    // Se compara con el principio de cada palabra: "convers" encaja con "conversiones"
    const cerca = (p: string) => distancia(q, p.slice(0, q.length + 1), tope) <= tope || distancia(q, p, tope) <= tope;
    if (palabrasTitulo.some(cerca)) return 25;
    if (palabrasResto.some(cerca)) return 15;
  }
  return 0;
}

function puntaje(busqueda: string, o: Opcion): number {
  const titulo = normalizar(o.titulo);
  const resto = normalizar(`${o.palabras ?? ''} ${o.donde}`);
  let total = 0;
  for (const q of busqueda.split(/\s+/).filter(Boolean)) {
    const p = puntajePalabra(q, titulo, resto);
    if (!p) return 0; // Cada palabra escrita tiene que encajar en algo
    total += p;
  }
  return total;
}

export const BuscadorOpciones: React.FC = () => {
  const { currentScreen, navigateTo } = useApp();
  const { currentUser, puede } = useAuth();
  const { tieneModulo } = usePlan();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [activa, setActiva] = useState(0);
  const campoRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  // Ctrl+K / ⌘K abre y cierra, desde cualquier pantalla (incluso escribiendo en un campo)
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAbierto((a) => !a);
      }
    };
    const abrir = () => setAbierto(true);
    window.addEventListener('keydown', tecla);
    window.addEventListener(EVENTO_ABRIR, abrir);
    return () => { window.removeEventListener('keydown', tecla); window.removeEventListener(EVENTO_ABRIR, abrir); };
  }, []);

  useEffect(() => {
    if (!abierto) return;
    setTexto(''); setActiva(0);
    // Después de la animación de entrada, para que el teléfono no salte
    const t = window.setTimeout(() => campoRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [abierto]);

  const opciones = useMemo<Opcion[]>(() => {
    const pantalla = (id: ScreenName) => () => navigateTo(id);
    const ajustes = (s: SeccionAjustes) => () => {
      // Ya en Ajustes: se cambia de sección ahí mismo; si no, la pantalla la toma al abrir
      if (currentScreen === 'settings') window.dispatchEvent(new CustomEvent(EVENTO_AJUSTES_MENU, { detail: s }));
      else { pedirSeccionAjustes(s); navigateTo('settings'); }
    };
    const rol = currentUser?.role;
    // Los módulos son los mismos que esconden las pestañas del menú (MODULO_DE_PESTANA en IOSTabBar)
    const lista: Opcion[] = [
      { id: 'dashboard', titulo: 'Métricas', donde: 'Menú', palabras: 'inicio resumen panel tablero estadisticas', icono: LayoutDashboard, color: 'bg-sky-500', ir: pantalla('dashboard') },
      { id: 'informes', titulo: 'Informes', donde: 'Menú', palabras: 'reportes revista lalan productos lentos inventario dinero parado', icono: BarChart3, color: 'bg-violet-500', ir: pantalla('informes') },
      { id: 'conversiones-report', titulo: 'Informe de conversiones', donde: 'Informes', palabras: 'reporte chats mensajes citas compras ventas lalan plan', icono: MessagesSquare, color: 'bg-violet-500', modulo: 'informes', ir: pantalla('conversiones-report') },
      { id: 'citas-report', titulo: 'Informe de citas', donde: 'Informes', palabras: 'reporte agenda especialistas no llegan ausencias', icono: CalendarCheck2, color: 'bg-violet-500', modulo: 'informes', ir: pantalla('citas-report') },
      { id: 'ganancias', titulo: 'Ganancias', donde: 'Informes', palabras: 'reporte rentabilidad utilidad costos dinero', icono: Wallet, color: 'bg-violet-500', modulo: 'informes', ir: pantalla('ganancias') },
      { id: 'mi-semana', titulo: 'Mi semana', donde: 'Menú', palabras: 'planificador manana semana proximas citas recordatorios gustos alergias productos faltan', icono: CalendarRange, color: 'bg-rose-500', ir: pantalla('mi-semana') },
      { id: 'compras', titulo: 'Compras', donde: 'Menú', palabras: 'proveedores pedidos orden de compra cotizacion suplidor recibir mercancia faltan pedir', icono: ShoppingCart, color: 'bg-emerald-500', ir: pantalla('compras') },
      { id: 'calendar', titulo: 'Agenda', donde: 'Menú', palabras: 'citas calendario reservas turnos pendientes', icono: Calendar, color: 'bg-rose-500', ir: pantalla('calendar') },
      { id: 'sala', titulo: 'Sala', donde: 'Menú', palabras: 'turnos llegadas espera pantalla', icono: Armchair, color: 'bg-indigo-500', modulo: 'sala_turnos', ir: pantalla('sala') },
      { id: 'clients', titulo: 'Clientas', donde: 'Menú', palabras: 'clientes contactos fichas personas', icono: Users, color: 'bg-emerald-500', ir: pantalla('clients') },
      { id: 'lounge', titulo: 'Lounge', donde: 'Menú', palabras: 'musica canciones bebidas gustos', icono: Music, color: 'bg-amber-500', modulo: 'lounge_musica', ir: pantalla('lounge') },
      { id: 'caja', titulo: 'Caja', donde: 'Menú', palabras: 'cobrar cobros comandas cierre turno ventas pagos', icono: Receipt, color: 'bg-teal-500', modulo: 'caja', ir: pantalla('caja') },
      { id: 'chats', titulo: 'Chats', donde: 'Menú', palabras: 'mensajes whatsapp instagram messenger conversaciones', icono: MessageSquareText, color: 'bg-purple-500', ir: pantalla('chats') },
      { id: 'catalog', titulo: 'Catálogo', donde: 'Menú', palabras: 'servicios productos inventario existencias recetas fotos', icono: Sparkles, color: 'bg-fuchsia-500', ir: pantalla('catalog') },
      { id: 'price-lists', titulo: 'Precios', donde: 'Menú', palabras: 'listas de precios tarifas', icono: Tag, color: 'bg-orange-500', modulo: 'listas_precios', ir: pantalla('price-lists') },
      { id: 'settings', titulo: 'Ajustes', donde: 'Menú', palabras: 'configuracion opciones', icono: Sliders, color: 'bg-slate-500', ir: () => {
        // Ajustes abre su menú, no una sección
        if (currentScreen === 'settings') window.dispatchEvent(new Event(EVENTO_AJUSTES_MENU));
        else navigateTo('settings');
      } },
      ...gruposPara(rol).map((g): Opcion => ({
        id: `ajustes-${g.id}`, titulo: g.titulo, donde: 'Ajustes', palabras: `configuracion ${g.resumen} ${g.palabras ?? ''}`,
        icono: g.icono, color: g.color, ir: ajustes(g.id),
      })),
    ];
    if (rol === 'super_admin' || rol === 'support') {
      lista.push({ id: 'plataforma', titulo: rol === 'support' ? 'Clientes' : 'Plataforma', donde: 'Menú', palabras: 'salones negocios planes landing', icono: Globe2, color: 'bg-slate-700', ir: pantalla('plataforma') });
    }
    if (puedeHablarConLalan(rol)) {
      lista.push({ id: 'lalan', titulo: 'Habla con Lalan', donde: 'Lalan', palabras: 'asistente ayuda preguntar voz', icono: Sparkles, color: 'bg-[var(--primary)]', ir: abrirLalan });
    }
    // Lo que la dueña le apagó a la asistente tampoco sale en el buscador
    return lista.filter((o) => (!o.modulo || tieneModulo(o.modulo)) && puede(PERMISO_DE_PANTALLA[o.id as ScreenName]));
  }, [currentUser?.role, currentScreen, navigateTo, tieneModulo, puede]);

  const resultados = useMemo(() => {
    const q = normalizar(texto.trim());
    if (!q) return opciones;
    return opciones
      .map((o, i) => ({ o, i, p: puntaje(q, o) }))
      .filter((r) => r.p > 0)
      .sort((a, b) => b.p - a.p || a.i - b.i)
      .map((r) => r.o);
  }, [texto, opciones]);

  useEffect(() => { setActiva(0); }, [texto]);
  // La elegida siempre a la vista al moverse con las flechas
  useEffect(() => {
    listaRef.current?.querySelector(`[data-indice="${activa}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activa]);

  const cerrar = () => setAbierto(false);
  const elegir = (o: Opcion | undefined) => {
    if (!o) return;
    cerrar();
    o.ir();
  };

  const alTeclear = (e: React.KeyboardEvent) => {
    const n = resultados.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (n) setActiva((a) => (a + 1) % n); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) setActiva((a) => (a - 1 + n) % n); }
    else if (e.key === 'Enter') { e.preventDefault(); elegir(resultados[activa]); }
    // Esc cierra solo el buscador, no la hoja o el chat que haya debajo
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); cerrar(); }
  };

  return createPortal(
    <AnimatePresence>
      {abierto && (
        <motion.div key="buscador" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[500] flex items-start justify-center bg-black/60 backdrop-blur-xs px-3 pt-[10vh]" onClick={cerrar}>
          <motion.div initial={{ scale: 0.97, y: -8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: -8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()} onKeyDown={alTeclear}
            role="dialog" aria-modal="true" aria-label="Buscar opciones"
            className="w-full max-w-lg max-h-[75dvh] flex flex-col rounded-3xl bg-white dark:bg-neutral-900 text-slate-800 dark:text-neutral-100 shadow-2xl border border-slate-200 dark:border-neutral-800 overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 dark:border-neutral-800 shrink-0">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input ref={campoRef} value={texto} onChange={(e) => setTexto(e.target.value)}
                placeholder="¿Qué buscas? Informe, caja, horario…"
                role="combobox" aria-expanded="true" aria-controls="buscador-resultados"
                aria-activedescendant={resultados[activa] ? `buscador-${resultados[activa].id}` : undefined}
                autoComplete="off" spellCheck={false}
                className="flex-1 min-w-0 bg-transparent outline-none text-[0.9375rem] placeholder:text-slate-400" />
              <kbd className="hidden sm:inline-flex px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-neutral-700 text-[0.6875rem] font-semibold text-slate-400">Esc</kbd>
            </div>

            <div ref={listaRef} id="buscador-resultados" role="listbox" aria-label="Opciones" className="flex-1 overflow-y-auto hide-scrollbar p-2">
              {resultados.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <p className="text-sm font-semibold">No encontré «{texto.trim()}»</p>
                  <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 mt-1">Prueba con otra palabra, o pregúntale a Lalan dónde está.</p>
                </div>
              ) : resultados.map((o, i) => {
                const Icono = o.icono;
                const elegida = i === activa;
                return (
                  <button key={o.id} id={`buscador-${o.id}`} type="button" role="option" aria-selected={elegida} data-indice={i}
                    data-medir={`Buscador: ${o.titulo}`}
                    onMouseMove={() => { if (!elegida) setActiva(i); }} onClick={() => elegir(o)}
                    className={`relative w-full px-2.5 py-2 rounded-xl flex items-center gap-3 text-left cursor-pointer ios-touch ${elegida ? '' : 'hover:bg-slate-50 dark:hover:bg-neutral-800/60'}`}>
                    {elegida && (
                      <motion.span layoutId="buscador-elegida" className="absolute inset-0 rounded-xl bg-[var(--primary)]/10"
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
                    )}
                    {o.id === 'lalan'
                      ? <span className="relative w-8 h-8 flex items-center justify-center shrink-0"><EsferaLalan modo="reposo" tamano={30} /></span>
                      : <span className={`relative w-8 h-8 rounded-xl ${o.color} text-white flex items-center justify-center shrink-0`}><Icono className="w-4 h-4" /></span>}
                    <span className="relative flex-1 min-w-0">
                      <span className="block text-[0.875rem] font-bold text-slate-900 dark:text-white truncate">{o.titulo}</span>
                      <span className="block text-[0.75rem] text-slate-500 dark:text-neutral-400 truncate">{o.donde}</span>
                    </span>
                    {elegida && <CornerDownLeft className="relative w-4 h-4 text-[var(--primary)] shrink-0 hidden sm:block" />}
                  </button>
                );
              })}
            </div>

            <div className="hidden sm:flex items-center gap-3 px-4 py-2 border-t border-slate-100 dark:border-neutral-800 text-[0.6875rem] text-slate-400 whitespace-nowrap shrink-0">
              <span>↑ ↓ moverte</span><span>Enter abrir</span><span>Esc cerrar</span>
              <span className="ml-auto">{ATAJO_BUSCADOR} desde cualquier pantalla</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
