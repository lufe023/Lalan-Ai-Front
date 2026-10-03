import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarRange, Loader2, RotateCcw, Search, X } from 'lucide-react';
import { api } from '../../services/api';
import { horaDe } from '../../utils/hora';

interface Pagina { items: any[]; hasMore: boolean; nextCursor: string | null; resumen: { cantidad: number; total: number; propinas: number } | null }

type Periodo = 'hoy' | 'ayer' | 'semana' | 'mes' | 'mesPasado' | 'todo' | 'rango';
const PERIODOS: { id: Periodo; texto: string }[] = [
  { id: 'hoy', texto: 'Hoy' },
  { id: 'ayer', texto: 'Ayer' },
  { id: 'semana', texto: 'Esta semana' },
  { id: 'mes', texto: 'Este mes' },
  { id: 'mesPasado', texto: 'Mes pasado' },
  { id: 'todo', texto: 'Todo' },
  { id: 'rango', texto: 'Elegir fechas' },
];
const POR_PAGINA = 30;
const ESPERA_BUSQUEDA_MS = 350;

const inicioDelDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sumarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const aInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const deInput = (s: string) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };

/** El rango en hora local del salón: [desde, hasta) */
function rangoDe(p: Periodo, desdeTxt: string, hastaTxt: string): { desde?: Date; hasta?: Date } {
  const hoy = inicioDelDia(new Date());
  switch (p) {
    case 'hoy': return { desde: hoy, hasta: sumarDias(hoy, 1) };
    case 'ayer': return { desde: sumarDias(hoy, -1), hasta: hoy };
    case 'semana': { const lunes = sumarDias(hoy, -((hoy.getDay() + 6) % 7)); return { desde: lunes, hasta: sumarDias(hoy, 1) }; }
    case 'mes': return { desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1), hasta: sumarDias(hoy, 1) };
    case 'mesPasado': return { desde: new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1), hasta: new Date(hoy.getFullYear(), hoy.getMonth(), 1) };
    case 'rango': return { desde: desdeTxt ? deInput(desdeTxt) : undefined, hasta: hastaTxt ? sumarDias(deInput(hastaTxt), 1) : undefined };
    default: return {};
  }
}

/** "Hoy", "Ayer" o "sábado 26 de septiembre" */
function tituloDelDia(d: Date): string {
  const hoy = inicioDelDia(new Date());
  const dia = inicioDelDia(d);
  const dif = Math.round((hoy.getTime() - dia.getTime()) / 86_400_000);
  if (dif === 0) return 'Hoy';
  if (dif === 1) return 'Ayer';
  return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', ...(d.getFullYear() !== hoy.getFullYear() ? { year: 'numeric' } : {}) });
}

/**
 * Los recibos cobrados: por páginas (se cargan solos al bajar), filtrados
 * por periodo o por fechas, y buscando por clienta o número de recibo en
 * el servidor, no solo en lo ya cargado. Agrupados por día.
 */
export const ListaRecibos: React.FC<{ plata: (n: any) => string; onReimprimir: (r: any) => void }> = ({ plata, onReimprimir }) => {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [desdeTxt, setDesdeTxt] = useState(aInput(sumarDias(new Date(), -7)));
  const [hastaTxt, setHastaTxt] = useState(aInput(new Date()));
  const [busca, setBusca] = useState('');
  const [texto, setTexto] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [resumen, setResumen] = useState<Pagina['resumen']>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const pedido = useRef(0);
  const fondo = useRef<HTMLDivElement>(null);

  // La búsqueda va al servidor, pero no con cada letra
  useEffect(() => { const t = setTimeout(() => setTexto(busca.trim()), ESPERA_BUSQUEDA_MS); return () => clearTimeout(t); }, [busca]);

  const consulta = useMemo(() => {
    const { desde, hasta } = rangoDe(periodo, desdeTxt, hastaTxt);
    const p = new URLSearchParams({ limit: String(POR_PAGINA) });
    if (desde) p.set('desde', desde.toISOString());
    if (hasta) p.set('hasta', hasta.toISOString());
    if (texto) p.set('q', texto);
    return p.toString();
  }, [periodo, desdeTxt, hastaTxt, texto]);

  const cargar = useCallback(async (desdeCursor: string | null) => {
    const n = ++pedido.current;
    setCargando(true); setError('');
    try {
      const r = await api.get<Pagina>(`/sales/receipts?${consulta}${desdeCursor ? `&cursor=${desdeCursor}` : ''}`);
      if (n !== pedido.current) return;   // llegó tarde: ya se pidió otra cosa
      setItems(prev => (desdeCursor ? [...prev, ...r.items] : r.items));
      if (r.resumen) setResumen(r.resumen);
      setCursor(r.nextCursor); setHayMas(r.hasMore);
    } catch (e) {
      if (n === pedido.current) setError((e as Error)?.message || 'No se pudieron cargar los recibos');
    } finally {
      if (n === pedido.current) setCargando(false);
    }
  }, [consulta]);

  // Cambió el filtro: se empieza de cero
  useEffect(() => { setItems([]); setResumen(null); setCursor(null); void cargar(null); }, [cargar]);

  // Al llegar abajo, la página siguiente
  useEffect(() => {
    const el = fondo.current;
    if (!el) return;
    const obs = new IntersectionObserver(e => { if (e[0].isIntersecting && hayMas && !cargando && cursor) void cargar(cursor); }, { rootMargin: '300px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hayMas, cargando, cursor, cargar]);

  const porDia = useMemo(() => {
    const grupos: { dia: string; titulo: string; filas: any[] }[] = [];
    items.forEach(r => {
      const f = new Date(r.closedAt ?? r.openedAt);
      const dia = aInput(f);
      let g = grupos[grupos.length - 1];
      if (!g || g.dia !== dia) { g = { dia, titulo: tituloDelDia(f), filas: [] }; grupos.push(g); }
      g.filas.push(r);
    });
    return grupos;
  }, [items]);

  const chip = (activo: boolean) => `px-3 py-1.5 rounded-full text-[0.75rem] font-bold whitespace-nowrap cursor-pointer transition ${activo ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 hover:border-slate-300'}`;
  const campoFecha = 'px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white dark:[color-scheme:dark]';

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por clienta o número de recibo…"
          aria-label="Buscar recibos"
          className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white"
        />
        {busca && (
          <button type="button" onClick={() => setBusca('')} aria-label="Borrar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer">
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-0.5" role="radiogroup" aria-label="Periodo">
        {PERIODOS.map(p => (
          <button key={p.id} type="button" role="radio" aria-checked={periodo === p.id} onClick={() => setPeriodo(p.id)} className={chip(periodo === p.id)} data-medir={`Recibos: ${p.texto}`}>
            {p.id === 'rango' && <CalendarRange className="w-3 h-3 inline -mt-0.5 mr-1" />}{p.texto}
          </button>
        ))}
      </div>
      {periodo === 'rango' && (
        <div className="flex flex-wrap items-center gap-2 text-[0.75rem] text-slate-500">
          <label className="flex items-center gap-1.5">Desde <input type="date" value={desdeTxt} max={hastaTxt} onChange={e => setDesdeTxt(e.target.value)} className={campoFecha} /></label>
          <label className="flex items-center gap-1.5">Hasta <input type="date" value={hastaTxt} min={desdeTxt} onChange={e => setHastaTxt(e.target.value)} className={campoFecha} /></label>
        </div>
      )}

      {resumen && (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-1 text-xs text-slate-500 dark:text-neutral-400">
          <span><b className="text-slate-900 dark:text-white text-sm tabular-nums">{resumen.cantidad}</b> {resumen.cantidad === 1 ? 'recibo' : 'recibos'}</span>
          <span>Cobrado <b className="text-slate-900 dark:text-white text-sm tabular-nums">{plata(resumen.total)}</b></span>
          {resumen.propinas > 0 && <span>Propinas <b className="text-slate-900 dark:text-white tabular-nums">{plata(resumen.propinas)}</b></span>}
        </div>
      )}

      <div className="p-2 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs">
        {error && <p className="py-6 text-center text-xs text-rose-600">{error}</p>}
        {!error && !items.length && !cargando && (
          <p className="py-8 text-center text-xs text-slate-400">
            {texto ? 'Ningún recibo con esa búsqueda en este periodo.' : 'No hay recibos cobrados en este periodo.'}
          </p>
        )}
        {porDia.map(g => (
          <section key={g.dia} aria-label={g.titulo}>
            <h4 className="sticky top-0 z-[1] px-2 pt-3 pb-1 text-[0.6875rem] font-bold uppercase tracking-wide text-slate-400 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm first-letter:uppercase">{g.titulo}</h4>
            <div className="divide-y divide-slate-100 dark:divide-neutral-800">
              {g.filas.map(r => (
                <div key={r.id} className="p-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 dark:text-neutral-100 truncate">{r.clientName ?? r.label ?? 'Mostrador'}</div>
                    <div className="text-[0.6875rem] text-slate-400">
                      <span className="font-mono">#{String(r.id).slice(-8).toUpperCase()}</span> · {horaDe(r.closedAt ?? r.openedAt)} · {r.items?.length ?? 0} {r.items?.length === 1 ? 'línea' : 'líneas'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums">{plata(r.total)}</span>
                    <button onClick={() => onReimprimir(r)} title="Reimprimir — sale marcado como COPIA" aria-label="Reimprimir recibo"
                      className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-neutral-700 hover:text-[var(--primary)] transition cursor-pointer">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
        <div ref={fondo} aria-hidden="true" />
        {cargando && <p className="py-4 flex items-center justify-center gap-2 text-xs text-slate-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando…</p>}
        {!cargando && !hayMas && items.length > POR_PAGINA && <p className="py-3 text-center text-[0.6875rem] text-slate-400">Son todos los recibos de este periodo.</p>}
      </div>
    </div>
  );
};
