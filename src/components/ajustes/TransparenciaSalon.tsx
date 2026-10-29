import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight, History, LifeBuoy, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { useSedes } from '../../hooks/useSedes';
import { SelectorSede } from '../ui/SelectorSede';

export interface EntradaSoporte {
  id: string; desde: string; hasta: string | null; activa: boolean;
  quien: string; rol: string | null; motivo: string | null; cambiar: boolean;
}
interface Cambio {
  id: string; cuando: string; que: string; parte: string | null;
  quien: string; rol: string | null; soporte: boolean; sede: string | null; ids: Record<string, string>;
}

const hora = (iso: string) => new Date(iso).toLocaleString('es-DO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const tarjeta = 'p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3 text-slate-900 dark:text-neutral-100';

/** Cuando entró alguien de Lalan: quién, para qué, si podía cambiar y hasta cuándo */
export const SoporteEnTuSalon: React.FC = () => {
  const [lista, setLista] = useState<EntradaSoporte[] | null>(null);
  useEffect(() => { api.get<EntradaSoporte[]>('/bitacora/soporte').then(setLista).catch(() => setLista([])); }, []);

  return (
    <div className={tarjeta} id="soporte-en-tu-salon">
      <div className="flex items-center gap-1.5">
        <LifeBuoy className="w-4 h-4 text-amber-500" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Lalan en tu salón</h2>
      </div>
      <p className="text-[0.75rem] text-slate-400 leading-relaxed">
        Cada vez que alguien de Lalan entró a tu salón para ayudarte, en los últimos 90 días. Si entró a mirar, no pudo cambiar nada.
      </p>
      {!lista ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : !lista.length ? (
        <p className="text-[0.8125rem] text-slate-500">Nadie de Lalan ha entrado a tu salón.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-neutral-800">
          {lista.map((e) => (
            <li key={e.id} className="py-2.5 text-[0.8125rem]">
              <div className="flex flex-wrap items-center gap-1.5">
                <b>{e.quien}</b>
                {e.activa && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 text-[0.625rem] font-bold">Dentro ahora</span>}
                <span className={`px-1.5 py-0.5 rounded text-[0.625rem] font-bold ${e.cambiar ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'bg-slate-100 text-slate-500 dark:bg-neutral-800'}`}>
                  {e.cambiar ? 'Podía cambiar cosas' : 'Solo miró'}
                </span>
              </div>
              {e.motivo && <div className="text-slate-600 dark:text-neutral-300">«{e.motivo}»</div>}
              <div className="text-[0.75rem] text-slate-400">
                {hora(e.desde)}{e.hasta && !e.activa ? ` – ${new Date(e.hasta).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' })}` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Quién cambió qué: catálogo, precios, inventario, equipo, canales, ajustes */
export const CambiosDelSalon: React.FC = () => {
  const { navigateToCatalog } = useApp();
  const sedes = useSedes();
  const [sede, setSede] = useState('');
  const [lista, setLista] = useState<Cambio[] | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async (antes?: string) => {
    setCargando(true);
    try {
      const q = new URLSearchParams();
      if (sede) q.set('sede', sede);
      if (antes) q.set('antes', antes);
      const r = await api.get<Cambio[]>(`/bitacora?${q}`);
      setLista((l) => (antes ? [...(l ?? []), ...r] : r));
      setHayMas(r.length === 50);
    } catch { setLista((l) => l ?? []); }
    finally { setCargando(false); }
  }, [sede]);
  useEffect(() => { void cargar(); }, [cargar]);

  /** Lo que se puede abrir ahí mismo: el producto o el servicio que se tocó */
  const abrir = (c: Cambio) => {
    if (!c.ids.id) return null;
    if (c.parte === 'Productos') return () => navigateToCatalog({ productId: c.ids.id });
    if (c.parte === 'Servicios') return () => navigateToCatalog({ serviceId: c.ids.id });
    return null;
  };

  return (
    <div className={tarjeta}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <History className="w-4 h-4 text-[var(--primary)]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Lo que cambió en tu salón</h2>
        </div>
        <SelectorSede sedes={sedes} value={sede} todas onChange={setSede} />
      </div>
      <p className="text-[0.75rem] text-slate-400 leading-relaxed">
        Quién cambió el catálogo, los precios, el inventario, el equipo, los canales o los ajustes. Cobrar, agendar y chatear no salen aquí.
      </p>
      {!lista ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : !lista.length ? (
        <p className="text-[0.8125rem] text-slate-500">Todavía no hay cambios anotados.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-neutral-800">
          {lista.map((c) => {
            const ir = abrir(c);
            const cuerpo = (
              <>
                <span className="flex-1 min-w-0">
                  <span className="block text-slate-800 dark:text-neutral-100">{c.que}</span>
                  <span className="block text-[0.75rem] text-slate-400">
                    {c.quien}{c.soporte ? ' · de Lalan' : ''} · {hora(c.cuando)}
                  </span>
                </span>
                {ir && <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />}
              </>
            );
            return (
              <li key={c.id} className="py-2 text-[0.8125rem]">
                {ir
                  ? <button type="button" onClick={ir} className="w-full flex items-center gap-2 text-left cursor-pointer">{cuerpo}</button>
                  : <div className="flex items-center gap-2">{cuerpo}</div>}
              </li>
            );
          })}
        </ul>
      )}
      {hayMas && lista && (
        <button type="button" disabled={cargando} onClick={() => void cargar(lista[lista.length - 1].cuando)}
          className="text-[0.75rem] font-bold text-[var(--primary)] cursor-pointer disabled:opacity-50">
          {cargando ? 'Cargando…' : 'Ver más'}
        </button>
      )}
    </div>
  );
};
