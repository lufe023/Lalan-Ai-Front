import React, { useEffect, useState } from 'react';
import { ArrowRight, BarChart3, CalendarCheck2, Gauge, Loader2, PackageSearch, Receipt, Wallet } from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import type { ScreenName } from '../context/AppContext';
import { usePlan } from '../context/PlanContext';
import { useDinero } from '../hooks/useDinero';
import type { ClaveModulo } from '../types/plataforma';
import { IOSHeader } from '../components/ui/IOSHeader';
import { PageContent } from '../components/ui/PageContent';
import { InformesDeLalan } from '../components/informes/InformesDeLalan';

/** Los informes que ya viven en otras pantallas: aquí se reúnen, allá siguen igual */
const ACCESOS: { pantalla: ScreenName; titulo: string; texto: string; icono: React.FC<{ className?: string }>; modulo?: ClaveModulo }[] = [
  { pantalla: 'dashboard', titulo: 'Métricas', texto: 'Citas, clientas atendidas, dinero del periodo y lo que hizo Lalan.', icono: Gauge },
  { pantalla: 'ganancias', titulo: 'Ganancias', texto: 'Lo que entró, lo que costó cada servicio y lo que te quedó de verdad.', icono: Wallet, modulo: 'informes' },
  { pantalla: 'citas-report', titulo: 'Informe de citas', texto: 'Por día, hora, servicio y especialista; quién agenda y quién no llega.', icono: CalendarCheck2, modulo: 'informes' },
  { pantalla: 'caja', titulo: 'Caja y cierres', texto: 'Turnos de caja, cobros y cierres del día.', icono: Receipt, modulo: 'caja' },
];

type Estado = 'dormido' | 'lento' | 'sano' | 'rapido' | 'agotado';
interface FilaLenta {
  id: string; nombre: string; categoria: string; unidad: string; insumo: boolean; existencia: number; salioEnPeriodo: number;
  diasInventario: number | null; ultimaSalida: string | null; diasSinSalida: number; dineroParado: number; estado: Estado;
}
interface InformeLentos { periodoDias: number; resumen: { dormidos: number; lentos: number; dineroParado: number }; productos: FilaLenta[] }

const PERIODOS = [30, 60, 90];
const ESTADO: Record<Estado, { texto: string; clase: string }> = {
  dormido: { texto: 'Sin salir', clase: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  lento: { texto: 'Lento', clase: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  sano: { texto: 'Normal', clase: 'bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300' },
  rapido: { texto: 'Se vende rápido', clase: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  agotado: { texto: 'Agotado', clase: 'bg-slate-100 text-slate-400 dark:bg-neutral-800 dark:text-neutral-500' },
};
const UNIDAD: Record<string, string> = { unit: 'u.', ml: 'ml', g: 'g', oz: 'oz' };

/** Lo que tarda en venderse: dinero parado en el estante */
const ProductosLentos: React.FC = () => {
  const { dinero } = useDinero();
  const [dias, setDias] = useState(30);
  const [conInsumos, setConInsumos] = useState(false);
  const [datos, setDatos] = useState<InformeLentos | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setDatos(null); setError('');
    api.get<InformeLentos>(`/inventory/slow-movers?dias=${dias}`).then(setDatos).catch(e => setError(e?.message || 'No se pudo cargar'));
  }, [dias]);

  const filas = (datos?.productos ?? []).filter(f => conInsumos || !f.insumo);
  return (
    <section className="rounded-3xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-4" data-medir="Informes: productos lentos">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2"><PackageSearch className="w-4 h-4 text-[var(--primary)]" /> Lo que tarda en venderse</h3>
          <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 max-w-prose">
            Cuánto salió de cada producto (ventas y recetas) y cuántos días te dura lo que tienes a ese ritmo. Lo que no se mueve es dinero parado: ponlo en oferta, en un combo o deja de comprarlo.
          </p>
        </div>
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Periodo">
          {PERIODOS.map(p => (
            <button key={p} type="button" role="radio" aria-checked={dias === p} onClick={() => setDias(p)}
              className={`px-3 py-1 rounded-full text-[0.75rem] font-bold cursor-pointer ${dias === p ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300'}`}>
              {p} días
            </button>
          ))}
        </div>
      </header>

      {error && <p className="text-xs text-rose-600">{error}</p>}
      {!datos && !error && <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Calculando…</div>}
      {datos && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/40 p-3"><div className="text-[0.6875rem] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">Sin salir</div><div className="text-xl font-extrabold tabular-nums">{datos.resumen.dormidos}</div></div>
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-3"><div className="text-[0.6875rem] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">Lentos</div><div className="text-xl font-extrabold tabular-nums">{datos.resumen.lentos}</div></div>
            <div className="rounded-2xl bg-slate-50 dark:bg-neutral-800/60 p-3"><div className="text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">Dinero parado</div><div className="text-xl font-extrabold tabular-nums">{dinero(datos.resumen.dineroParado)}</div></div>
          </div>
          <label className="flex items-center gap-2 text-[0.75rem] text-slate-600 dark:text-neutral-300 cursor-pointer">
            <input type="checkbox" checked={conInsumos} onChange={e => setConInsumos(e.target.checked)} /> Incluir insumos (lo que se usa en los servicios)
          </label>
          {filas.length === 0 ? (
            <p className="text-xs text-slate-500">No hay productos para mostrar.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[0.6875rem] uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-3 font-bold">Producto</th><th className="py-2 pr-3 font-bold">Estado</th>
                    <th className="py-2 pr-3 font-bold text-right">Hay</th><th className="py-2 pr-3 font-bold text-right">Salió en {datos.periodoDias} días</th>
                    <th className="py-2 pr-3 font-bold text-right">Te dura</th><th className="py-2 pr-3 font-bold text-right">Última salida</th>
                    <th className="py-2 font-bold text-right">Dinero parado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                  {filas.map(f => (
                    <tr key={f.id}>
                      <td className="py-2 pr-3"><div className="font-semibold">{f.nombre}</div><div className="text-[0.6875rem] text-slate-400">{f.categoria}{f.insumo ? ' · insumo' : ''}</div></td>
                      <td className="py-2 pr-3"><span className={`px-2 py-0.5 rounded-full text-[0.6875rem] font-bold whitespace-nowrap ${ESTADO[f.estado].clase}`}>{ESTADO[f.estado].texto}</span></td>
                      <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">{f.existencia} {UNIDAD[f.unidad] ?? f.unidad}</td>
                      <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">{f.salioEnPeriodo} {UNIDAD[f.unidad] ?? f.unidad}</td>
                      <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">{f.diasInventario === null ? '—' : `${f.diasInventario} días`}</td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">{f.ultimaSalida ? `hace ${f.diasSinSalida} días` : 'nunca'}</td>
                      <td className="py-2 text-right tabular-nums whitespace-nowrap font-semibold">{f.dineroParado ? dinero(f.dineroParado) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[0.6875rem] text-slate-400">«Te dura» es lo que tienes dividido entre lo que sale al día. «Dinero parado» usa el costo de cada producto; si no tiene costo, sale en blanco.</p>
        </>
      )}
    </section>
  );
};

/** El centro de informes: todos en un solo lugar, sin quitar los accesos de siempre */
export const InformesScreen: React.FC = () => {
  const { navigateTo } = useApp();
  const { tieneModulo } = usePlan();
  const accesos = ACCESOS.filter(a => !a.modulo || tieneModulo(a.modulo));
  return (
    <div className="relative flex-1 w-full h-full flex flex-col overflow-hidden text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]">
      <IOSHeader title="Informes" subtitle="Todo lo que pasa en tu salón, en un solo lugar" />
      <PageContent className="space-y-5">
        <InformesDeLalan />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {accesos.map(a => (
            <button key={a.pantalla} type="button" onClick={() => navigateTo(a.pantalla)} data-medir={`Informes: ${a.titulo}`}
              className="text-left rounded-3xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 hover:border-[var(--primary)] transition cursor-pointer flex flex-col gap-2">
              <span className="w-9 h-9 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center"><a.icono className="w-5 h-5" /></span>
              <span className="text-sm font-bold">{a.titulo}</span>
              <span className="text-[0.75rem] text-slate-500 dark:text-neutral-400 flex-1">{a.texto}</span>
              <span className="text-[0.75rem] font-bold text-[var(--primary)] flex items-center gap-1">Abrir <ArrowRight className="w-3.5 h-3.5" /></span>
            </button>
          ))}
        </div>
        {tieneModulo('inventario')
          ? <ProductosLentos />
          : (
            <div className="rounded-3xl border border-dashed border-slate-300 dark:border-neutral-700 p-4 text-xs text-slate-500 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> El informe de lo que tarda en venderse viene con Inventario y recetas (Plan Salón y Plan Lounge).
            </div>
          )}
      </PageContent>
    </div>
  );
};
