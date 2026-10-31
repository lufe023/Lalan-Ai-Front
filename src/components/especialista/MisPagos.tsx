import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Loader2, Lock, Receipt } from 'lucide-react';
import { BarraEscalon } from '../especialistas/PagosEspecialistas';
import { Corte, LineaRecibo, MiCorte, NOMBRE_LINEA, moverPeriodo, pagos, rango } from '../../services/pagosEspecialistas';

const TARJETA = 'p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3';

const formato = (moneda: string) => (n: number | null | undefined) => {
  const v = Number(n ?? 0);
  try {
    return `${v < 0 ? '−' : ''}${new Intl.NumberFormat('es-DO', { style: 'currency', currency: moneda || 'USD', minimumFractionDigits: 2 }).format(Math.abs(v))}`;
  } catch { return `${v < 0 ? '−' : ''}${moneda} ${Math.abs(v).toFixed(2)}`; }
};

const Lineas: React.FC<{ lineas: LineaRecibo[]; plata: (n: number) => string }> = ({ lineas, plata }) => (
  <div className="rounded-xl bg-slate-50 dark:bg-neutral-800/60 divide-y divide-slate-100 dark:divide-neutral-800">
    {lineas.filter(l => l.tipo !== 'aporte_salon').map((l, i) => (
      <div key={i} className="px-3 py-2 flex items-center gap-2 text-[0.8125rem]">
        <div className="flex-1 min-w-0">
          <p className="text-slate-700 dark:text-neutral-200 truncate"><span className="text-slate-400">{NOMBRE_LINEA[l.tipo]} · </span>{l.concepto}</p>
          {l.porcentaje != null && l.base != null && l.tipo.startsWith('comision') && (
            <p className="text-[0.75rem] text-slate-400">{l.porcentaje} % de {plata(l.base)}</p>
          )}
        </div>
        <span className={`shrink-0 font-semibold tabular-nums ${l.monto < 0 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>{plata(l.monto)}</span>
      </div>
    ))}
    {lineas.length === 0 && <p className="px-3 py-3 text-[0.8125rem] text-slate-400">Todavía no hay nada en este periodo.</p>}
  </div>
);

/**
 * Lo que ve la especialista de sus pagos: su corte en curso línea por línea,
 * en cuál escalón va, y sus cortes pasados con lo que ya se le pagó.
 */
export const MisPagos: React.FC = () => {
  const [fecha, setFecha] = useState<string | undefined>(undefined);
  const [datos, setDatos] = useState<MiCorte | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasado, setPasado] = useState<Corte | null>(null);
  const [abriendo, setAbriendo] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try { setDatos(await pagos.mios(fecha)); setError(null); }
    catch (e) { setError((e as Error)?.message || 'No se pudieron cargar tus pagos.'); }
  }, [fecha]);
  useEffect(() => { void cargar(); }, [cargar]);

  const verPasado = async (id: string) => {
    if (pasado?.id === id) { setPasado(null); return; }
    setAbriendo(id);
    try { setPasado(await pagos.miCorte(id)); } catch { /* sigue cerrado */ } finally { setAbriendo(null); }
  };

  if (error) {
    return <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[0.8125rem] flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}</div>;
  }
  if (!datos) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" /></div>;
  if (!datos.sedes.length) {
    return <div className={TARJETA}><p className="text-[0.875rem] text-slate-500 dark:text-neutral-400">La administración todavía no ha dicho cómo se te paga. Cuando lo haga, aquí verás tu corte.</p></div>;
  }

  return (
    <div className="space-y-3">
      {datos.sedes.map(b => {
        const plata = formato(b.currencyCode);
        const cerrado = b.cerrado;
        return (
          <div key={b.sede.id} className="space-y-3">
            <div className={TARJETA}>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[0.75rem] text-slate-400">{datos.sedes.length > 1 ? `${b.sede.nombre} · ` : ''}{b.acuerdo?.etiqueta}</p>
                  <p className="text-[0.9375rem] font-bold text-slate-900 dark:text-white">Periodo {rango(b.desde, b.hasta)}</p>
                </div>
                <button type="button" aria-label="Periodo anterior" onClick={() => b.desde && b.hasta && setFecha(moverPeriodo(b.desde, b.hasta, -1))} className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-neutral-800 flex items-center justify-center cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
                <button type="button" aria-label="Periodo siguiente" onClick={() => b.desde && b.hasta && setFecha(moverPeriodo(b.desde, b.hasta, 1))} className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-neutral-800 flex items-center justify-center cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
              </div>
              {fecha && <button type="button" onClick={() => setFecha(undefined)} className="text-[0.8125rem] font-semibold text-[var(--primary)] cursor-pointer">Volver a hoy</button>}

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-[var(--primary)]/10">
                  <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">{cerrado ? (cerrado.estado === 'pagado' ? 'Te pagaron' : 'Te toca') : 'Llevas'}</p>
                  <p className="text-[1.25rem] font-extrabold tabular-nums text-slate-900 dark:text-white">{plata(cerrado ? cerrado.neto : b.neto)}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/60">
                  <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">Servicios</p>
                  <p className="text-[1.25rem] font-extrabold tabular-nums text-slate-900 dark:text-white">{b.servicios ?? 0}</p>
                </div>
              </div>
              <p className="flex items-center gap-1.5 text-[0.75rem] text-slate-500 dark:text-neutral-400">
                {cerrado?.estado === 'pagado' ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Pagado</>
                  : cerrado ? <><Lock className="w-3.5 h-3.5" /> Corte cerrado, falta que te paguen</>
                    : <><Receipt className="w-3.5 h-3.5" /> En curso: cambia con cada servicio que cobras</>}
              </p>
              {b.escalon && <BarraEscalon escalon={b.escalon} plata={plata} />}
              {(b.avisos ?? []).filter(a => !a.includes('negativo')).map(a => (
                <p key={a} className="flex items-start gap-1.5 p-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-[0.75rem] text-amber-800 dark:text-amber-200"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {a}</p>
              ))}
              <Lineas lineas={b.lineas ?? []} plata={plata} />
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-[0.6875rem] text-slate-400">Ganado</p><p className="text-[0.8125rem] font-bold tabular-nums">{plata(b.bruto)}</p></div>
                <div><p className="text-[0.6875rem] text-slate-400">Propinas</p><p className="text-[0.8125rem] font-bold tabular-nums">{plata(b.propinas)}</p></div>
                <div><p className="text-[0.6875rem] text-slate-400">Descuentos</p><p className="text-[0.8125rem] font-bold tabular-nums text-rose-500">{plata(-(b.descuentos ?? 0))}</p></div>
              </div>
            </div>

            {b.cortes.length > 0 && (
              <div className={TARJETA}>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Cortes anteriores</p>
                <div className="space-y-1.5">
                  {b.cortes.map(c => (
                    <div key={c.id}>
                      <button type="button" onClick={() => void verPasado(c.id)} aria-expanded={pasado?.id === c.id} className="w-full flex items-center gap-2 py-1.5 text-left cursor-pointer">
                        <span className="flex-1 min-w-0 text-[0.8125rem] text-slate-700 dark:text-neutral-200">{rango(c.desde.slice(0, 10), c.hasta.slice(0, 10))}</span>
                        <span className={`text-[0.6875rem] font-bold uppercase ${c.estado === 'pagado' ? 'text-emerald-600' : 'text-sky-600'}`}>{c.estado === 'pagado' ? 'Pagado' : 'Por pagar'}</span>
                        <span className="w-24 text-right text-[0.8125rem] font-bold tabular-nums">{plata(c.neto)}</span>
                        {abriendo === c.id ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <ChevronDown className={`w-4 h-4 text-slate-400 transition ${pasado?.id === c.id ? 'rotate-180' : ''}`} />}
                      </button>
                      {pasado?.id === c.id && <Lineas lineas={pasado.lineas ?? []} plata={plata} />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
