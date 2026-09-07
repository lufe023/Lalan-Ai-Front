import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Info, Scissors, BarChart3 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { IOSHeader } from '../components/ui/IOSHeader';
import { PageContent } from '../components/ui/PageContent';

type Period = 'day' | 'week' | 'month';
type RevenueMode = 'bruto' | 'neto';

export const GananciasScreen: React.FC = () => {
  const { appointments, products, loadIngredients, goBack } = useApp();
  const [period, setPeriod] = useState<Period>('month');
  const [mode, setMode] = useState<RevenueMode>('bruto');
  const [serviceCosts, setServiceCosts] = useState<Record<string, number>>({});
  const [loadingCosts, setLoadingCosts] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const filteredAppointments = useMemo(() => {
    const start = new Date();
    if (period === 'day') start.setHours(0, 0, 0, 0);
    else if (period === 'week') start.setDate(start.getDate() - 7);
    else start.setMonth(start.getMonth() - 1);
    // Use completedAt when available (actual delivery time) so metrics reflect when service was rendered
    const aptDate = (a: typeof appointments[0]) => new Date(a.completedAt ?? `${a.date}T${a.time}`);
    return appointments.filter(a => a.status === 'completed' && aptDate(a) >= start);
  }, [appointments, period]);

  useEffect(() => {
    const ids = [...new Set(filteredAppointments.map(a => a.serviceId).filter(Boolean))] as string[];
    if (!ids.length) { setServiceCosts({}); return; }
    setLoadingCosts(true);
    Promise.all(
      ids.map(async sid => {
        try {
          const ings = await loadIngredients(sid);
          const cost = ings.reduce((sum, ing) => {
            const prod = products.find(p => p.id === ing.productId);
            // Si la unidad es 'unit', el ingrediente se mide en unidades completas → costo directo
            // Si es ml/g, se divide entre unitQty para obtener costo por unidad base
            const costPrice = prod?.costPrice ?? 0;
            const costPerUnit = ing.unit === 'unit'
              ? costPrice
              : costPrice / (prod?.unitQty || 1);
            return sum + Number(ing.quantity) * costPerUnit;
          }, 0);
          return [sid, cost] as [string, number];
        } catch { return [sid, 0] as [string, number]; }
      })
    ).then(res => { setServiceCosts(Object.fromEntries(res)); setLoadingCosts(false); });
  }, [filteredAppointments, products, loadIngredients]);

  const { bruto, neto, costoTotal, count } = useMemo(() => {
    const bruto = filteredAppointments.reduce((s, a) => s + a.price, 0);
    const costoTotal = filteredAppointments.reduce((s, a) => s + (a.serviceId ? (serviceCosts[a.serviceId] ?? 0) : 0), 0);
    const neto = Math.max(0, bruto - costoTotal);
    return { bruto, neto, costoTotal, count: filteredAppointments.length };
  }, [filteredAppointments, serviceCosts]);

  const totalRevenue = mode === 'bruto' ? bruto : neto;
  const margin = bruto > 0 ? Math.round((neto / bruto) * 100) : 0;

  const chartData = useMemo(() => {
    const aptDate = (a: typeof filteredAppointments[0]) => new Date(a.completedAt ?? `${a.date}T${a.time}`);
    const apptBruto = (a: typeof filteredAppointments[0]) => a.price;
    const apptNeto = (a: typeof filteredAppointments[0]) =>
      Math.max(0, a.price - (a.serviceId ? (serviceCosts[a.serviceId] ?? 0) : 0));

    if (period === 'day') {
      const b = Array.from({ length: 13 }, (_, i) => ({ label: `${i + 8}h`, bruto: 0, neto: 0 }));
      filteredAppointments.forEach(a => {
        const h = aptDate(a).getHours() - 8;
        if (h >= 0 && h < b.length) { b[h].bruto += apptBruto(a); b[h].neto += apptNeto(a); }
      });
      return b.map(d => ({ ...d, value: mode === 'bruto' ? d.bruto : d.neto }));
    }
    if (period === 'week') {
      const b = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0);
        return { label: d.toLocaleDateString('es-MX', { weekday: 'short' }), date: d.getTime(), bruto: 0, neto: 0 };
      });
      filteredAppointments.forEach(a => {
        const d = aptDate(a); d.setHours(0, 0, 0, 0);
        const idx = b.findIndex(x => x.date === d.getTime());
        if (idx >= 0) { b[idx].bruto += apptBruto(a); b[idx].neto += apptNeto(a); }
      });
      return b.map(d => ({ ...d, value: mode === 'bruto' ? d.bruto : d.neto }));
    }
    const now = Date.now();
    const b = Array.from({ length: 4 }, (_, i) => ({
      label: `Sem ${i + 1}`, start: now - (4 - i) * 7 * 86400000, end: now - (3 - i) * 7 * 86400000, bruto: 0, neto: 0,
    }));
    filteredAppointments.forEach(a => {
      const t = aptDate(a).getTime();
      const idx = b.findIndex(x => t >= x.start && t < x.end);
      if (idx >= 0) { b[idx].bruto += apptBruto(a); b[idx].neto += apptNeto(a); }
    });
    return b.map(d => ({ ...d, value: mode === 'bruto' ? d.bruto : d.neto }));
  }, [filteredAppointments, period, mode, serviceCosts]);

  const breakdown = useMemo(() => {
    const map = new Map<string, { name: string; count: number; bruto: number; cost: number }>();
    filteredAppointments.forEach(a => {
      const key = a.serviceId || a.serviceName;
      const cur = map.get(key) ?? { name: a.serviceName, count: 0, bruto: 0, cost: 0 };
      cur.count++; cur.bruto += a.price; cur.cost += a.serviceId ? (serviceCosts[a.serviceId] ?? 0) : 0;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.bruto - a.bruto);
  }, [filteredAppointments, serviceCosts]);

  const maxVal = Math.max(...chartData.map(d => d.value), 1);
  const W = 300, H = 80;
  const barW = W / chartData.length - 3;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-neutral-950">
      <IOSHeader
        title="Informe de Ganancias"
        onBack={goBack}
      />
      <PageContent>
        {/* Period selector */}
        <div className="flex gap-1.5 mb-4">
          {(['day', 'week', 'month'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition ios-touch cursor-pointer ${period === p ? 'bg-[var(--primary)] text-white shadow-xs' : 'bg-white dark:bg-neutral-900 text-slate-500 dark:text-neutral-400 border border-slate-200 dark:border-neutral-800'}`}>
              {p === 'day' ? 'Hoy' : p === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>

        {/* Mode toggle */}
        <div className="flex items-center justify-between mb-4 bg-white dark:bg-neutral-900 rounded-2xl p-3 border border-slate-200 dark:border-neutral-800">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">Modo de vista</p>
            <p className="text-[10px] text-slate-400 dark:text-neutral-500 mt-0.5">
              {mode === 'bruto' ? 'Antes de descontar insumos' : 'Después de descontar insumos'}
            </p>
          </div>
          <div className="flex bg-slate-100 dark:bg-neutral-800 rounded-xl p-0.5 gap-0.5">
            {(['bruto', 'neto'] as RevenueMode[]).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ios-touch cursor-pointer capitalize ${mode === m ? 'bg-white dark:bg-neutral-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-400 dark:text-neutral-500'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Hero metric */}
        <motion.div key={`${period}-${mode}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-neutral-900 rounded-2xl p-4 border border-slate-200 dark:border-neutral-800 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                {mode === 'bruto' ? 'Ingresos brutos' : 'Ganancias netas'}
              </p>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                ${totalRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-1">
                {count} {count === 1 ? 'cita completada' : 'citas completadas'}
              </p>
            </div>
            <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold ${
              mode === 'neto'
                ? margin >= 35 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : margin >= 15 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300'
            }`}>
              <TrendingUp className="w-3.5 h-3.5" />
              {mode === 'neto' ? `${margin}% margen` : 'Vista bruta'}
            </div>
          </div>

          {mode === 'neto' && (
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-neutral-800">
              <div className="text-center">
                <p className="text-[10px] text-slate-400 dark:text-neutral-500">Ingresos brutos</p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">${bruto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-400 dark:text-neutral-500">Costo de insumos</p>
                <p className="text-sm font-bold text-red-500 dark:text-red-400">-${costoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          )}

          {chartData.some(d => d.value > 0) ? (
            <div className="mt-4">
              <svg viewBox={`0 -40 ${W} ${H + 60}`} className="w-full" onMouseLeave={() => setHoveredIdx(null)}>
                {chartData.map((d, i) => {
                  const bh = Math.max((d.value / maxVal) * H, d.value > 0 ? 4 : 0);
                  const x = i * (W / chartData.length) + 1.5;
                  const isHov = hoveredIdx === i;
                  return (
                    <g key={i} onMouseEnter={() => setHoveredIdx(i)} style={{ cursor: d.value > 0 ? 'pointer' : 'default' }}>
                      {/* Transparent hit area for easier hover */}
                      <rect x={x} y={0} width={barW} height={H} fill="transparent" />
                      <rect x={x} y={H - bh} width={barW} height={bh} rx={3}
                        fill={mode === 'bruto' ? 'var(--primary)' : '#10b981'}
                        opacity={d.value > 0 ? (isHov ? 1 : 0.85) : 0.12} />
                      <text x={x + barW / 2} y={H + 14} textAnchor="middle" fontSize={7} style={{ fill: isHov ? '#64748b' : '#94a3b8', fontWeight: isHov ? 600 : 400 }}>
                        {d.label}
                      </text>
                    </g>
                  );
                })}
                {/* Tooltip */}
                {hoveredIdx !== null && chartData[hoveredIdx].value > 0 && (() => {
                  const d = chartData[hoveredIdx];
                  const x = hoveredIdx * (W / chartData.length) + 1.5;
                  const cx = x + barW / 2;
                  const bh = Math.max((d.value / maxVal) * H, 4);
                  const fmt = (v: number) => `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  const lines = mode === 'neto'
                    ? [d.label, `${fmt(d.neto)} netos`, `${fmt(d.bruto)} brutos`]
                    : [d.label, `${fmt(d.bruto)} brutos`];
                  const tw = 78, lh = 10, pad = 7;
                  const th = lines.length * lh + pad;
                  const tx = Math.max(1, Math.min(cx - tw / 2, W - tw - 1));
                  const idealTy = H - bh - 6;
                  const ty = Math.max(-38 + th, idealTy);
                  return (
                    <g pointerEvents="none">
                      <rect x={tx} y={ty - th} width={tw} height={th} rx={4} fill="#0f172a" opacity={0.88} />
                      {lines.map((line, li) => (
                        <text key={li} x={tx + tw / 2} y={ty - th + pad + li * lh}
                          textAnchor="middle" fontSize={7.5} style={{
                            fill: li === 0 ? '#94a3b8' : li === 1 ? (mode === 'neto' ? '#34d399' : '#818cf8') : '#64748b',
                            fontWeight: li === 1 ? 700 : 400,
                          }}>
                          {line}
                        </text>
                      ))}
                    </g>
                  );
                })()}
              </svg>
            </div>
          ) : (
            <div className="mt-4 py-4 text-center text-[11px] text-slate-400 dark:text-neutral-500">
              Sin citas completadas en este período
            </div>
          )}
        </motion.div>

        {mode === 'bruto' && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/70 dark:border-amber-800/40 mb-4">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
              El <strong>neto</strong> descuenta el costo de insumos configurados en Catálogo → Receta de cada servicio. Actívalo para ver tu ganancia real.
            </p>
          </div>
        )}

        {breakdown.length > 0 && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 overflow-hidden mb-6">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-neutral-800">
              <BarChart3 className="w-4 h-4 text-[var(--primary)]" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">Por servicio</span>
            </div>
            {breakdown.map((svc, idx) => {
              const svcNeto = Math.max(0, svc.bruto - svc.cost);
              const display = mode === 'bruto' ? svc.bruto : svcNeto;
              const pct = totalRevenue > 0 ? (display / totalRevenue) * 100 : 0;
              return (
                <div key={idx} className="px-4 py-3 border-b border-slate-50 dark:border-neutral-800/50 last:border-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Scissors className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{svc.name}</span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">${display.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-[10px] text-slate-400 ml-1">({svc.count} citas)</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(pct, 100)}%`, background: mode === 'bruto' ? 'var(--primary)' : '#10b981' }} />
                  </div>
                  {mode === 'neto' && svc.cost > 0 && (
                    <p className="text-[10px] text-slate-400 dark:text-neutral-500 mt-1">
                      Insumos: -${svc.cost.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Bruto: ${svc.bruto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PageContent>
    </div>
  );
};
