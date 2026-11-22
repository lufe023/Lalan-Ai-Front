import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarDays, ChevronDown, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import type { TuDia } from '../../services/pendientes';
import { CarrilHorizontal } from '../ui/CarrilHorizontal';

/** Un día anterior de la conversación con Lalan (lo manda GET /asistente) */
export interface DiaAnterior {
  dia: string;
  mensajes: number;
  resumen: string | null;
  citas: number | null;
}

interface DiaAbierto<M> {
  cargando: boolean;
  mensajes: M[];
  tuDia: TuDia | null;
  resumen: string | null;
}

interface Props<M> {
  hoy: string;
  dias: DiaAnterior[];
  /** Cómo se pinta un mensaje (el mismo de la conversación de hoy) */
  pintar: (m: M) => React.ReactNode;
  /** Dónde se desplaza la conversación, para llevar al día que abre */
  lista: React.RefObject<HTMLDivElement | null>;
  /** Separación entre mensajes de un día abierto */
  espacio?: string;
  /** Desde el buscador: abre ese día y lleva al mensaje (`vez` cambia en cada búsqueda) */
  irA?: { dia: string; mensaje?: string; vez: number } | null;
}

/** Días que se ven siempre, plegados, encima de hoy (los demás, con los botones) */
const DIAS_A_LA_VISTA = 1;
/** Días como botones para saltar */
const DIAS_EN_BOTONES = 7;

const aFecha = (dia: string) => {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a, m - 1, d, 12);
};
const diasEntre = (de: string, a: string) => Math.round((aFecha(a).getTime() - aFecha(de).getTime()) / 86_400_000);

/** «Ayer», «Mié 11», o «Mié 11 oct» si es de otro mes */
function corto(dia: string, hoy: string) {
  if (diasEntre(dia, hoy) === 1) return 'Ayer';
  const f = aFecha(dia);
  const otroMes = dia.slice(0, 7) !== hoy.slice(0, 7);
  const t = new Intl.DateTimeFormat('es-DO', { weekday: 'short', day: 'numeric', ...(otroMes ? { month: 'short' } : {}) }).format(f).replace(/\./g, '').replace(',', '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** «Ayer · miércoles 12 de noviembre» */
function largo(dia: string, hoy: string) {
  const f = aFecha(dia);
  const t = new Intl.DateTimeFormat('es-DO', { weekday: 'long', day: 'numeric', month: 'long', ...(dia.slice(0, 4) !== hoy.slice(0, 4) ? { year: 'numeric' } : {}) }).format(f).replace(',', '');
  return diasEntre(dia, hoy) === 1 ? `Ayer · ${t}` : t.charAt(0).toUpperCase() + t.slice(1);
}

const ayerDe = (hoy: string) => {
  const f = aFecha(hoy);
  f.setDate(f.getDate() - 1);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
};

/**
 * Los días anteriores con Lalan. Nada se borra: cada día queda con su «Tu día»
 * como estaba al abrirla y su conversación. Arriba, botones para saltar a un
 * día (o el calendario para cualquier otro); los últimos días se ven plegados
 * y se abren con un toque.
 */
export function DiasAnteriores<M extends { id: string }>({ hoy, dias, pintar, lista, espacio = 'space-y-5', irA }: Props<M>) {
  const [abiertos, setAbiertos] = useState<Record<string, DiaAbierto<M>>>({});
  const [llevarA, setLlevarA] = useState<{ dia: string; mensaje?: string } | null>(null);
  const calendario = useRef<HTMLInputElement>(null);

  // Al abrir uno desde los botones o el calendario, se lleva la vista a ese día
  useEffect(() => {
    if (!llevarA) return;
    const bloque = lista.current?.querySelector<HTMLElement>(`[data-dia="${llevarA.dia}"]`);
    if (!bloque) return;
    if (llevarA.mensaje) {
      // Espera a que el día termine de cargar para llevar al mensaje justo
      if (!abiertos[llevarA.dia] || abiertos[llevarA.dia].cargando) return;
      const m = bloque.querySelector<HTMLElement>(`[data-mensaje="${llevarA.mensaje}"]`);
      if (m) {
        setTimeout(() => { m.scrollIntoView({ behavior: 'smooth', block: 'center' }); resaltar(m); }, 280);
        setLlevarA(null);
        return;
      }
    }
    bloque.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setLlevarA(null);
  }, [llevarA, abiertos, lista]);

  // Lo que eligió en el buscador
  useEffect(() => {
    if (!irA || irA.dia >= hoy || !dias.length) return;
    if (!abiertos[irA.dia]) void cargar(irA.dia);
    setLlevarA({ dia: irA.dia, mensaje: irA.mensaje });
  }, [irA?.vez]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!dias.length) return null;

  const cargar = async (dia: string) => {
    setAbiertos((a) => ({ ...a, [dia]: { cargando: true, mensajes: a[dia]?.mensajes ?? [], tuDia: a[dia]?.tuDia ?? null, resumen: a[dia]?.resumen ?? null } }));
    try {
      const r = await api.get<{ mensajes: M[]; tuDia: TuDia | null; resumen: string | null }>(`/asistente/dias/${dia}`);
      setAbiertos((a) => ({ ...a, [dia]: { cargando: false, mensajes: r.mensajes, tuDia: r.tuDia, resumen: r.resumen } }));
    } catch {
      setAbiertos((a) => ({ ...a, [dia]: { cargando: false, mensajes: [], tuDia: null, resumen: null } }));
    }
  };

  const alternar = (dia: string) => {
    if (abiertos[dia]) {
      setAbiertos((a) => { const { [dia]: _, ...resto } = a; return resto; });
      return;
    }
    void cargar(dia);
  };

  /** Desde los botones o el calendario: lo abre (si no lo estaba) y lleva la vista allí */
  const irAlDia = (dia: string) => {
    if (!dia || dia >= hoy) return;
    if (!abiertos[dia]) void cargar(dia);
    setLlevarA({ dia });
  };

  const abrirCalendario = () => {
    const c = calendario.current;
    if (!c) return;
    try { (c as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { c.click(); }
  };

  // A la vista: los últimos días y los que abrió (del más viejo al más nuevo, como la charla)
  const porDia = new Map(dias.map((d) => [d.dia, d]));
  const visibles = new Set([...dias.slice(0, DIAS_A_LA_VISTA).map((d) => d.dia), ...Object.keys(abiertos)]);
  const bloques = [...visibles].sort().map((dia) => porDia.get(dia) ?? { dia, mensajes: 0, resumen: null, citas: null });
  const masViejo = dias[dias.length - 1].dia;

  return (
    <section aria-label="Días anteriores" className="space-y-3">
      {/* «Otro día» queda siempre a la vista; los días corren de lado (dedo, mouse, ruedita o flechas) */}
      <div className="flex items-center gap-2">
        <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400 shrink-0 pr-1">Ver un día</span>
        <div className="flex-1 min-w-0">
        <CarrilHorizontal etiqueta="Días anteriores" className="gap-2 py-0.5">
        {dias.slice(0, DIAS_EN_BOTONES).map((d) => (
          <button key={d.dia} type="button" onClick={() => irAlDia(d.dia)} aria-pressed={!!abiertos[d.dia]}
            className={`shrink-0 min-h-[36px] px-3.5 rounded-full border text-[0.8125rem] font-semibold whitespace-nowrap cursor-pointer shadow-sm transition-colors ${abiertos[d.dia]
              ? 'bg-[var(--primary)] text-white border-transparent'
              : 'bg-white/90 dark:bg-neutral-900/85 border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-neutral-200'}`}>
            {corto(d.dia, hoy)}
          </button>
        ))}
        </CarrilHorizontal>
        </div>
        <span className="relative shrink-0">
          <button type="button" onClick={abrirCalendario}
            className="min-h-[36px] px-3.5 rounded-full bg-white/90 dark:bg-neutral-900/85 border border-slate-200/80 dark:border-white/10 text-[0.8125rem] font-semibold text-slate-700 dark:text-neutral-200 whitespace-nowrap cursor-pointer shadow-sm inline-flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4" /> Otro día
          </button>
          <input ref={calendario} type="date" aria-label="Elegir un día" min={masViejo} max={ayerDe(hoy)}
            onChange={(e) => irAlDia(e.target.value)}
            className="absolute inset-0 opacity-0 pointer-events-none w-full" tabIndex={-1} />
        </span>
      </div>

      {bloques.map((d) => {
        const abierto = abiertos[d.dia];
        return (
          <div key={d.dia} data-dia={d.dia} className="scroll-mt-4">
            <button type="button" onClick={() => alternar(d.dia)} aria-expanded={!!abierto}
              className="w-full text-left rounded-2xl bg-white/60 dark:bg-neutral-900/60 border border-white/70 dark:border-white/5 px-4 py-2.5 cursor-pointer">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[0.8125rem] font-bold text-slate-700 dark:text-neutral-200">{largo(d.dia, hoy)}</p>
                  <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">
                    {[d.citas !== null ? `${d.citas} ${d.citas === 1 ? 'cita' : 'citas'}` : null, d.mensajes ? `${d.mensajes} ${d.mensajes === 1 ? 'mensaje' : 'mensajes'}` : 'Sin conversación'].filter(Boolean).join(' · ')}
                  </p>
                  {!abierto && d.resumen && <p className="text-[0.8125rem] text-slate-600 dark:text-neutral-300 mt-1 line-clamp-2">{d.resumen}</p>}
                </div>
                {abierto?.cargando ? <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" /> : <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} />}
              </div>
            </button>
            <AnimatePresence initial={false}>
              {abierto && !abierto.cargando && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}
                  className={`overflow-hidden pt-3 ${espacio}`}>
                  {abierto.tuDia && <TuDiaGuardado dia={abierto.tuDia} />}
                  {abierto.mensajes.length ? abierto.mensajes.map(pintar) : (
                    <p className="text-[0.8125rem] text-slate-500 dark:text-neutral-400 px-1">Ese día no hablamos.</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      <div className="flex items-center gap-3 pt-1" aria-hidden>
        <span className="h-px flex-1 bg-slate-300/50 dark:bg-white/10" />
        <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">Hoy</span>
        <span className="h-px flex-1 bg-slate-300/50 dark:bg-white/10" />
      </div>
    </section>
  );
}

/** «Tu día» como estaba al abrir a Lalan ese día (solo para ver) */
const TuDiaGuardado: React.FC<{ dia: TuDia }> = ({ dia }) => {
  const r = dia.resumen;
  return (
    <div className="rounded-3xl bg-white/80 dark:bg-neutral-900/75 border border-white/80 dark:border-white/5 shadow-sm px-4 py-3">
      <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400 first-letter:uppercase">Tu día{dia.sede ? ` · ${dia.sede.nombre}` : ''}</p>
      <p className="text-[0.875rem] leading-snug text-slate-700 dark:text-neutral-200 mt-0.5">
        {r.citas === 0 ? 'No tenías citas.' : <>Tenías <b>{r.citas} {r.citas === 1 ? 'cita' : 'citas'}</b>{r.porConfirmar ? <>, <b>{r.porConfirmar} por confirmar</b></> : ''}</>}
        {r.citas ? `, ${r.libres} ${r.libres === 1 ? 'hora libre' : 'horas libres'}` : ''}{r.citas ? '.' : ''}
        {r.pendientes ? ` ${r.pendientes === 1 ? '1 cosa pendiente' : `${r.pendientes} cosas pendientes`}.` : ''}
      </p>
      {!!dia.items.length && (
        <ul className="mt-2 space-y-1">
          {dia.items.slice(0, 8).map((i) => (
            <li key={`${i.tipo}:${i.id}`} className="text-[0.8125rem] text-slate-600 dark:text-neutral-300 leading-snug">
              <span className="font-semibold text-slate-800 dark:text-neutral-100">{i.titulo}</span>{i.detalle ? ` · ${i.detalle.replace(/^Hoy\s*/i, '')}` : ''}
            </li>
          ))}
          {dia.items.length > 8 && <li className="text-[0.75rem] text-slate-400">y {dia.items.length - 8} más</li>}
        </ul>
      )}
    </div>
  );
};

/** Un destello suave en el mensaje que buscó */
export function resaltar(el: HTMLElement) {
  el.animate?.(
    [{ boxShadow: '0 0 0 0 transparent' }, { boxShadow: '0 0 0 6px color-mix(in srgb, var(--primary) 35%, transparent)' }, { boxShadow: '0 0 0 0 transparent' }],
    { duration: 1600, easing: 'ease-in-out', delay: 250 },
  );
}
