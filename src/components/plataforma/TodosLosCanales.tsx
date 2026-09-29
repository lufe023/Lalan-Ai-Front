import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, Search, X, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { horaDe } from '../../utils/hora';

type Estado = 'ok' | 'aviso' | 'caido' | 'sin_configurar';
interface Canal {
  id: string; negocioId: string; negocio: string; sede: string; canal: string; identificador: string | null; encendido: boolean;
  estado: Estado; detalle: string; nombreEnMeta: string | null; ultimoMensaje: string | null;
}
type Filtro = 'problema' | 'sin_conectar' | 'apagada' | 'todos';
const FILTROS: { id: Filtro; texto: string; cumple: (c: Canal) => boolean }[] = [
  { id: 'problema', texto: 'Con problema', cumple: c => c.estado === 'caido' || c.estado === 'aviso' },
  { id: 'sin_conectar', texto: 'Sin conectar', cumple: c => c.estado === 'sin_configurar' },
  { id: 'apagada', texto: 'Lalan apagada', cumple: c => !c.encendido },
  { id: 'todos', texto: 'Todos', cumple: () => true },
];
const NOMBRE: Record<string, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger' };
const ICONO: Record<Estado, { i: React.FC<{ className?: string }>; c: string }> = {
  ok: { i: CheckCircle2, c: 'text-emerald-600 dark:text-emerald-400' },
  aviso: { i: AlertTriangle, c: 'text-amber-600 dark:text-amber-400' },
  caido: { i: XCircle, c: 'text-rose-600 dark:text-rose-400' },
  sin_configurar: { i: CircleDashed, c: 'text-slate-400' },
};
const ORDEN: Record<Estado, number> = { caido: 0, aviso: 1, sin_configurar: 2, ok: 3 };

/** Todos los canales de todos los clientes: filtrar, buscar e ir a la ficha */
export const TodosLosCanales: React.FC<{ onAbrirNegocio?: (id: string) => void; onCerrar: () => void }> = ({ onAbrirNegocio, onCerrar }) => {
  const [datos, setDatos] = useState<{ revisadoEn: string | null; canales: Canal[] } | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('problema');
  const [busca, setBusca] = useState('');
  useEffect(() => { api.get<{ revisadoEn: string | null; canales: Canal[] }>('/plataforma/salud/canales').then(setDatos).catch(() => setDatos({ revisadoEn: null, canales: [] })); }, []);

  const cuenta = useMemo(() => Object.fromEntries(FILTROS.map(f => [f.id, (datos?.canales ?? []).filter(f.cumple).length])), [datos]);
  // Arranca en "Con problema"; si no hay ninguno, en "Todos"
  useEffect(() => { if (datos && !cuenta.problema) setFiltro('todos'); }, [datos]); // eslint-disable-line react-hooks/exhaustive-deps

  const lista = useMemo(() => {
    const f = FILTROS.find(x => x.id === filtro)!;
    const q = busca.trim().toLowerCase();
    return (datos?.canales ?? [])
      .filter(f.cumple)
      .filter(c => !q || `${c.negocio} ${c.sede} ${c.nombreEnMeta ?? ''} ${c.identificador ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado] || a.negocio.localeCompare(b.negocio));
  }, [datos, filtro, busca]);

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 space-y-3" aria-label="Todos los canales">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold">Canales de los clientes</h4>
          {datos?.revisadoEn && <p className="text-[10px] text-slate-400">Revisados {horaDe(datos.revisadoEn)} · toca un cliente para abrir su ficha</p>}
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar lista" className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer"><X className="w-4 h-4" /></button>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5 overflow-x-auto" role="radiogroup" aria-label="Filtro">
          {FILTROS.map(f => (
            <button key={f.id} type="button" role="radio" aria-checked={filtro === f.id} onClick={() => setFiltro(f.id)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap cursor-pointer ${filtro === f.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300'}`}>
              {f.texto} <span className="opacity-60">{cuenta[f.id] ?? 0}</span>
            </button>
          ))}
        </div>
        <label className="relative ml-auto">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente o número…" aria-label="Buscar cliente"
            className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs w-56" />
        </label>
      </div>
      {!datos ? <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
        : lista.length === 0 ? <p className="text-xs text-slate-500 py-3">Nada en este filtro.</p>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-[10px] uppercase tracking-wide text-slate-400">
                <th className="py-1.5 pr-3">Cliente</th><th className="py-1.5 pr-3">Canal</th><th className="py-1.5 pr-3">Estado</th><th className="py-1.5 text-right">Última clienta</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                {lista.map(c => {
                  const v = ICONO[c.estado];
                  return (
                    <tr key={c.id} onClick={() => onAbrirNegocio?.(c.negocioId)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800/50">
                      <td className="py-2 pr-3"><b>{c.negocio}</b><div className="text-[10px] text-slate-400">{c.sede}</div></td>
                      <td className="py-2 pr-3 whitespace-nowrap">{NOMBRE[c.canal] ?? c.canal}<div className="text-[10px] text-slate-400">{c.nombreEnMeta ?? c.identificador ?? '—'}</div></td>
                      <td className="py-2 pr-3"><span className={`inline-flex items-center gap-1 ${v.c}`}><v.i className="w-3.5 h-3.5 shrink-0" /></span> {c.detalle}{!c.encendido ? ' · Lalan apagada' : ''}</td>
                      <td className="py-2 text-right whitespace-nowrap text-slate-500">{c.ultimoMensaje ? `${new Date(c.ultimoMensaje).toLocaleDateString('es', { day: 'numeric', month: 'short' })}, ${horaDe(c.ultimoMensaje)}` : 'nunca'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </section>
  );
};
