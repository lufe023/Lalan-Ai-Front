import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../../services/api';

interface Dia { fecha: string; respondidos: number; sugerencias: number; citas: number; aPersona: number }
interface Historial { dias: number; porDia: Dia[]; totales: Omit<Dia, 'fecha'> }
interface Hoy { respondidos: number; sugerencias: number; citas: number; enAtencion: number }

const RANGOS = [{ dias: 1, nombre: 'Hoy' }, { dias: 7, nombre: '7 días' }, { dias: 30, nombre: '30 días' }, { dias: 90, nombre: '90 días' }];

/**
 * Lo que hizo la asistente en un canal: hoy (en vivo) o los últimos días,
 * con el día a día en barras. "Esperan a una persona" es siempre de ahora.
 */
export const ActividadCanal: React.FC<{ canal: string; hoy: Hoy; alVerChats: () => void; sede?: string | null }> = ({ canal, hoy, alVerChats, sede }) => {
  const [dias, setDias] = useState(1);
  const [h, setH] = useState<Historial | null>(null);
  const [cargando, setCargando] = useState(false);
  useEffect(() => {
    if (dias === 1) return;
    setCargando(true);
    api.get<Historial>(`/bots/${canal}/historial?dias=${dias}${sede ? `&sede=${encodeURIComponent(sede)}` : ''}`).then(setH).catch(() => setH(null)).finally(() => setCargando(false));
  }, [canal, dias, sede]);

  const t = dias === 1 ? hoy : h?.totales;
  const sufijo = dias === 1 ? 'hoy' : `en ${dias} días`;
  const tiles = [
    { titulo: `Respondidos ${sufijo}`, valor: t?.respondidos ?? 0, clase: 'text-slate-800 dark:text-slate-200' },
    { titulo: `Sugerencias ${sufijo}`, valor: t?.sugerencias ?? 0, clase: 'text-purple-600 dark:text-purple-400' },
    { titulo: `Citas agendadas ${sufijo}`, valor: t?.citas ?? 0, clase: 'text-[var(--primary)]' },
    dias === 1
      ? { titulo: 'Esperan a una persona', valor: hoy.enAtencion, clase: hoy.enAtencion ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200', accion: hoy.enAtencion ? alVerChats : undefined }
      : { titulo: `Pasados a una persona`, valor: h?.totales.aPersona ?? 0, clase: 'text-amber-600 dark:text-amber-400' },
  ];
  const max = Math.max(1, ...(h?.porDia ?? []).map((d) => d.respondidos + d.sugerencias));

  return (
    <div className="pt-2 border-t border-slate-100 dark:border-neutral-800/80 space-y-2">
      <div className="flex items-center gap-1">
        {RANGOS.map((r) => (
          <button key={r.dias} type="button" onClick={() => setDias(r.dias)} aria-pressed={dias === r.dias}
            className={`px-2.5 py-1 rounded-lg text-[0.6875rem] font-bold cursor-pointer ${dias === r.dias ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 bg-slate-100 dark:bg-neutral-800'}`}>
            {r.nombre}
          </button>
        ))}
        {cargando && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 ml-1" />}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tiles.map((x) => (
          <button key={x.titulo} type="button" onClick={(x as any).accion} disabled={!(x as any).accion}
            className="p-2 rounded-xl bg-slate-50 dark:bg-neutral-800/60 text-left disabled:cursor-default enabled:hover:bg-amber-50 enabled:cursor-pointer">
            <span className="text-[0.6875rem] uppercase font-bold text-slate-400 block">{x.titulo}</span>
            <span className={`text-sm font-extrabold tabular-nums ${x.clase}`}>{x.valor.toLocaleString('es-DO')}</span>
          </button>
        ))}
      </div>
      {dias > 1 && h && (
        <div className="flex items-end gap-px h-16" aria-label="Respuestas por día">
          {h.porDia.map((d) => {
            const total = d.respondidos + d.sugerencias;
            return (
              <div key={d.fecha} className="flex-1 h-full flex items-end" title={`${d.fecha}: ${d.respondidos} respondidos · ${d.sugerencias} sugerencias · ${d.citas} citas`}>
                <div className="w-full rounded-t bg-[var(--primary)]/70" style={{ height: `${Math.max(total ? 4 : 1, (total / max) * 100)}%`, opacity: total ? 1 : 0.25 }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
