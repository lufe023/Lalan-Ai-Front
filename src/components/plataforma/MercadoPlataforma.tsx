import React, { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, ShieldCheck, Store } from 'lucide-react';
import { IOSSegmentedControl } from '../ui/IOSSegmentedControl';
import { baseProductosApi, type FilaMercado, type Mercado } from '../../services/saberProductos';

const tarjeta = 'rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3';
const campo = 'w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-sm';
const miles = (n: number) => n.toLocaleString('es-DO');
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const nombrePais = (() => {
  let dn: Intl.DisplayNames | null = null;
  try { dn = new Intl.DisplayNames(['es'], { type: 'region' }); } catch { dn = null; }
  return (c: string) => { try { return dn?.of(c) ?? c; } catch { return c; } };
})();
const nombreMes = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString('es', { month: 'short', year: '2-digit' });

/** Un CSV que abre bien en Excel en español (punto y coma, BOM) */
function bajarCsv(nombre: string, filas: FilaMercado[], conMarca: boolean) {
  const cab = ['Producto', ...(conMarca ? ['Marca'] : []), 'Salones', 'Productos', 'Servicios que lo usan', 'Usos en citas', 'Costo promedio'];
  const celda = (x: string | number) => `"${String(x).replace(/"/g, '""')}"`;
  const lineas = filas.map((f) => [f.producto, ...(conMarca ? [f.marca ?? ''] : []), f.salones, f.productos, f.servicios, f.usos, f.costoPromedio.map((c) => `${c.valor} ${c.moneda}`).join(' / ')].map(celda).join(';'));
  const blob = new Blob(['﻿' + [cab.map(celda).join(';'), ...lineas].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}

const Tabla: React.FC<{ filas: FilaMercado[]; conMarca: boolean; ocultas: number; minimo: number }> = ({ filas, conMarca, ocultas, minimo }) => {
  const max = Math.max(...filas.map((f) => f.salones), 1);
  return (
    <div className="space-y-2">
      {filas.length === 0 && <p className="text-sm text-slate-500">Todavía no hay cifras que junten {minimo} salones o más.</p>}
      {filas.map((f) => (
        <div key={`${f.producto}|${f.marca ?? ''}`} className="rounded-xl bg-slate-50 dark:bg-neutral-800/60 p-2.5">
          <div className="flex flex-wrap justify-between gap-x-3 text-[0.8125rem]">
            <span className="font-semibold text-slate-800 dark:text-neutral-100">{conMarca ? <>{f.marca} <span className="font-normal text-slate-500">· {f.producto}</span></> : f.producto}</span>
            <span className="tabular-nums font-bold">{miles(f.salones)} salones</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-200/70 dark:bg-neutral-700 mt-1.5 overflow-hidden">
            <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${(f.salones / max) * 100}%` }} />
          </div>
          <div className="text-[0.75rem] text-slate-500 mt-1">
            {miles(f.servicios)} servicios lo usan · {miles(f.usos)} usos en citas
            {f.costoPromedio.length > 0 && <> · costo promedio {f.costoPromedio.map((c) => `${c.valor.toLocaleString('es-DO')} ${c.moneda}`).join(' / ')}</>}
          </div>
        </div>
      ))}
      {ocultas > 0 && <p className="text-[0.75rem] text-slate-500 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> {ocultas} fila{ocultas === 1 ? '' : 's'} no se muestra{ocultas === 1 ? '' : 'n'} porque junta{ocultas === 1 ? '' : 'n'} menos de {minimo} salones.</p>}
    </div>
  );
};

/**
 * Mercado: qué productos y marcas usan los salones, cuánto y dónde, para
 * vender informes a las marcas. Solo cifras agregadas de 5 salones o más; los
 * salones fuera de estadísticas no cuentan y las alergias nunca entran.
 */
export const MercadoPlataforma: React.FC = () => {
  const [f, setF] = useState({ desde: '', hasta: '', tipo: '', pais: '', ciudad: '' });
  const [datos, setDatos] = useState<Mercado | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [vista, setVista] = useState<'productos' | 'marcas'>('productos');

  useEffect(() => {
    setCargando(true); setError('');
    baseProductosApi.mercado(f).then(setDatos).catch((e) => setError(e?.message || 'No se pudo cargar')).finally(() => setCargando(false));
  }, [f]);

  const series = useMemo(() => [...new Set((datos?.tendencia ?? []).flatMap((t) => Object.keys(t.usos)))], [datos]);
  const maxMes = Math.max(1, ...(datos?.tendencia ?? []).map((t) => Object.values(t.usos).reduce((s, n) => s + n, 0)));
  const COLORES = ['#A58FE3', '#C46B7C', '#4C9F8F', '#E0A040', '#5B8DEF', '#9C6644', '#7A7A7A', '#D16BA5'];

  return (
    <section className="space-y-4 text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]">
      <header>
        <h3 className="text-base font-bold flex items-center gap-2"><Store className="w-4 h-4" /> Mercado</h3>
        <p className="text-xs text-slate-500 dark:text-neutral-400">Productos y marcas que usan los salones, para informes a marcas de belleza, spa y barbería. Solo cifras agregadas que juntan {datos?.minimoSalones ?? 5} salones o más; los salones que pidieron salir de las estadísticas no cuentan y las alergias nunca entran.</p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <label className="text-[0.75rem] font-bold">Desde<input type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} className={`${campo} mt-1`} /></label>
        <label className="text-[0.75rem] font-bold">Hasta<input type="date" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} className={`${campo} mt-1`} /></label>
        <label className="text-[0.75rem] font-bold">Tipo de negocio
          <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} className={`${campo} mt-1`}>
            <option value="">Todos</option>
            {datos?.opciones.tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </label>
        <label className="text-[0.75rem] font-bold">País
          <select value={f.pais} onChange={(e) => setF({ ...f, pais: e.target.value, ciudad: '' })} className={`${campo} mt-1`}>
            <option value="">Todos</option>
            {datos?.opciones.paises.map((p) => <option key={p} value={p}>{nombrePais(p)}</option>)}
          </select>
        </label>
        <label className="text-[0.75rem] font-bold">Ciudad
          <select value={f.ciudad} onChange={(e) => setF({ ...f, ciudad: e.target.value })} className={`${campo} mt-1`}>
            <option value="">Todas</option>
            {datos?.opciones.ciudades.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}
      {!datos ? <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div> : (
        <div className={`space-y-4 ${cargando ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { t: 'Salones que cuentan', v: miles(datos.cobertura.salones) },
              { t: 'Productos de salones', v: miles(datos.cobertura.productos) },
              { t: 'Vinculados a la base', v: `${miles(datos.cobertura.vinculados)} · ${pct(datos.cobertura.vinculados, datos.cobertura.productos)} %` },
              { t: 'Con marca', v: `${miles(datos.cobertura.conMarca)} · ${pct(datos.cobertura.conMarca, datos.cobertura.vinculados)} %` },
            ].map((x) => (
              <div key={x.t} className={tarjeta}>
                <div className="text-[0.6875rem] font-semibold text-slate-500">{x.t}</div>
                <div className="text-lg font-extrabold tabular-nums">{x.v}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <IOSSegmentedControl id="mercado-vista" size="sm" value={vista} onChange={(v) => setVista(v as 'productos' | 'marcas')}
              options={[{ id: 'productos', label: 'Productos' }, { id: 'marcas', label: 'Marcas' }]} />
            <button type="button" onClick={() => bajarCsv(`mercado-${vista}-${datos.desde}-${datos.hasta}.csv`, datos[vista].filas, vista === 'marcas')}
              disabled={!datos[vista].filas.length} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 text-[0.8125rem] font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer">
              <Download className="w-4 h-4" /> Bajar CSV
            </button>
          </div>
          <Tabla filas={datos[vista].filas} conMarca={vista === 'marcas'} ocultas={datos[vista].ocultas} minimo={datos.minimoSalones} />

          {datos.tendencia.length > 0 && series.length > 0 && (
            <div className={tarjeta}>
              <div className="text-[0.875rem] font-bold mb-1">Usos en citas por mes</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
                {series.map((s, i) => <span key={s} className="text-[0.6875rem] text-slate-600 dark:text-neutral-300 flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COLORES[i % COLORES.length] }} />{s}</span>)}
              </div>
              <div className="flex items-end gap-2 h-36">
                {datos.tendencia.map((t) => (
                  <div key={t.mes} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={series.map((s) => `${s}: ${t.usos[s] ?? 0}`).join('\n')}>
                    <div className="w-full flex flex-col-reverse rounded-t-md overflow-hidden" style={{ height: `${(Object.values(t.usos).reduce((s, n) => s + n, 0) / maxMes) * 100}%` }}>
                      {series.map((s, i) => <div key={s} style={{ flexGrow: t.usos[s] ?? 0, background: COLORES[i % COLORES.length] }} />)}
                    </div>
                    <span className="text-[0.625rem] text-slate-500 truncate">{nombreMes(t.mes)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
