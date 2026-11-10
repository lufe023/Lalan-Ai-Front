import React, { useEffect, useState } from 'react';
import { CalendarCheck, ChevronRight, ClipboardList, MessageCircle, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EtiquetaSede } from '../ui/CopiarASede';
import { ABRIR_CLIENTA } from '../../services/saberProductos';
import { ABRIR_PLAN, fechaCorta, planesApi, type AtencionPlanes, type TipoPaso } from '../../services/planesSeguimiento';

const ICONO: Record<TipoPaso, React.ReactNode> = {
  cita: <CalendarCheck className="w-3.5 h-3.5" />,
  mensaje: <MessageCircle className="w-3.5 h-3.5" />,
  tarea: <ClipboardList className="w-3.5 h-3.5" />,
};

/**
 * Mi semana: las clientas en plan de seguimiento que necesitan algo.
 * Lo que avisaron (con sus palabras), quién se atrasó y qué toca esta
 * semana. Cada fila abre su ficha con el plan desplegado.
 */
export const PlanesDeLaSemana: React.FC<{ sede: string }> = ({ sede }) => {
  const { navigateTo } = useApp();
  const [d, setD] = useState<AtencionPlanes | null>(null);
  useEffect(() => { planesApi.atencion(sede || undefined).then(setD).catch(() => setD(null)); }, [sede]);

  if (!d || (!d.conAviso.length && !d.atrasados.length && !d.estaSemana.length)) return null;
  const abrir = (clientId: string) => {
    try { sessionStorage.setItem(ABRIR_PLAN, clientId); sessionStorage.setItem(ABRIR_CLIENTA, clientId); } catch { /* nada */ }
    navigateTo('clients');
  };
  const avisados = new Set(d.conAviso.map((p) => p.id));
  const atrasados = d.atrasados.filter((p) => !avisados.has(p.id));

  return (
    <div className="p-4 rounded-3xl border border-violet-200 dark:border-violet-900/60 bg-violet-50/60 dark:bg-violet-950/20 space-y-3">
      <div className="flex items-center gap-2">
        <span>🌿</span>
        <span className="flex-1 font-bold text-[0.8125rem] text-violet-900 dark:text-violet-200">Planes de seguimiento</span>
        <span className="text-[0.75rem] text-slate-500">{d.activos} {d.activos === 1 ? 'activo' : 'activos'}</span>
      </div>

      {d.conAviso.map((p) => (
        <button key={`a${p.id}`} type="button" onClick={() => abrir(p.cliente.id)}
          className="w-full text-left rounded-2xl bg-white dark:bg-neutral-900 border border-rose-200 dark:border-rose-900/60 p-3 cursor-pointer">
          <div className="flex items-center gap-1.5 text-[0.8125rem]">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="font-semibold text-slate-900 dark:text-white">{p.cliente.nombre}</span>
            <EtiquetaSede locationId={p.sede.id} />
            <span className="flex-1 text-[0.75rem] text-slate-500 truncate">· {p.nombre}</span>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
          {p.alertas.slice(0, 2).map((a) => (
            <p key={a.id} className="mt-1 text-[0.8125rem] text-rose-800 dark:text-rose-300 italic">«{a.nota}» <span className="not-italic text-[0.6875rem] text-slate-500">{fechaCorta(a.fecha)}</span></p>
          ))}
        </button>
      ))}

      {atrasados.map((p) => (
        <button key={`t${p.id}`} type="button" onClick={() => abrir(p.cliente.id)}
          className="w-full text-left flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8125rem] cursor-pointer">
          <span className="font-semibold text-slate-900 dark:text-white">{p.cliente.nombre}</span>
          <EtiquetaSede locationId={p.sede.id} />
          <span className="text-amber-700 dark:text-amber-400 font-semibold">
            se atrasó: {p.atrasados.map((x) => `${x.titulo} (${fechaCorta(x.fecha)})`).join(', ')}
          </span>
          <span className="text-[0.75rem] font-bold text-[var(--primary)] inline-flex items-center">Agendar <ChevronRight className="w-3 h-3" /></span>
        </button>
      ))}

      {d.estaSemana.length > 0 && (
        <div className="space-y-1">
          <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">Esta semana</p>
          {d.estaSemana.map((s) => (
            <button key={`${s.planId}:${s.indice}`} type="button" onClick={() => abrir(s.cliente.id)}
              className="w-full text-left flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8125rem] cursor-pointer">
              <span className="text-slate-500 w-14 shrink-0">{fechaCorta(s.fecha)}</span>
              <span className="text-violet-700 dark:text-violet-300">{ICONO[s.tipo]}</span>
              <span className="font-semibold text-slate-900 dark:text-white">{s.cliente.nombre}</span>
              <span className="text-slate-600 dark:text-neutral-300">{s.titulo}</span>
              {s.hecho ? <span className="text-[0.75rem] text-emerald-600 font-semibold">hecho</span>
                : s.agendada ? <span className="text-[0.75rem] text-emerald-600 font-semibold">ya tiene cita</span>
                  : s.tipo === 'cita' ? <span className="text-[0.75rem] text-amber-600 font-semibold">sin cita</span> : null}
              <EtiquetaSede locationId={s.sede.id} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
