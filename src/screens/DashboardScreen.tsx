import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  TrendingUp,
  Users,
  CalendarCheck,
  Bot,
  Sparkles,
  Clock,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  MessageSquareText,
  DollarSign,
  Flame,
  CheckCircle2,
  ChevronRight,
  PackageOpen,
  AlertTriangle,
  TrendingDown,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { IOSHeader } from '../components/ui/IOSHeader';
import { IOSSegmentedControl } from '../components/ui/IOSSegmentedControl';
import { PageContent } from '../components/ui/PageContent';

export const DashboardScreen: React.FC = () => {
  const { metricsPeriod, setMetricsPeriod, currentMetrics, navigateTo, navigateToCatalog, appointments } = useApp();
  const { currentUser } = useAuth();

  const periodOptions: { id: 'day' | 'week' | 'month'; label: string }[] = [
    { id: 'day', label: 'Hoy' },
    { id: 'week', label: 'Esta Semana' },
    { id: 'month', label: 'Este Mes' },
  ];

  // ── Inventario: alertas y márgenes ──────────────────────────────────
  const [stockAlerts, setStockAlerts] = useState<any[]>([]);
  const [serviceMargins, setServiceMargins] = useState<any[]>([]);

  useEffect(() => {
    api.get<any[]>('/inventory/alerts').then(setStockAlerts).catch(() => {});
    api.get<any[]>('/inventory/margins').then(setServiceMargins).catch(() => {});
  }, []);

  // ── Métricas locales calculadas desde appointments ───────────────────
  const aptDate = (a: typeof appointments[0]) =>
    new Date(a.completedAt ?? `${a.date}T${a.time}`);

  const filteredApts = useMemo(() => {
    const now = new Date();
    return appointments.filter(a => {
      if (a.status !== 'completed') return false;
      const d = aptDate(a);
      if (metricsPeriod === 'day') {
        return d.toDateString() === now.toDateString();
      } else if (metricsPeriod === 'week') {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return d >= weekStart && d <= weekEnd;
      } else {
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }
    });
  }, [appointments, metricsPeriod]);

  const localPeakHours = useMemo(() => {
    const hourCounts: Record<number, number> = {};
    filteredApts.forEach(a => {
      const h = aptDate(a).getHours();
      hourCounts[h] = (hourCounts[h] ?? 0) + 1;
    });
    const maxCount = Math.max(...Object.values(hourCounts), 1);
    return Array.from({ length: 13 }, (_, i) => {
      const h = 8 + i;
      const count = hourCounts[h] ?? 0;
      return { hour: `${h}:00`, busynessScore: Math.round((count / maxCount) * 100) };
    });
  }, [filteredApts]);

  const localTopServices = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    filteredApts.forEach(a => {
      if (!map.has(a.serviceName)) map.set(a.serviceName, { name: a.serviceName, count: 0, revenue: 0 });
      const cur = map.get(a.serviceName)!;
      cur.count++;
      cur.revenue += a.price;
    });
    const totalRevenue = filteredApts.reduce((s, a) => s + a.price, 0);
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)
      .map((s, i) => ({
        ...s,
        percentage: totalRevenue > 0 ? Math.round((s.revenue / totalRevenue) * 100) : 0,
        color: colors[i % colors.length],
      }));
  }, [filteredApts]);

  const localChannelDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    filteredApts.forEach(a => {
      const ch = (a as any).channel ?? 'whatsapp';
      map[ch] = (map[ch] ?? 0) + 1;
    });
    const total = filteredApts.length || 1;
    const channelColors: Record<string, string> = { whatsapp: '#25D366', instagram: '#E1306C', messenger: '#0084FF' };
    const channelNames: Record<string, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger' };
    return Object.entries(map)
      .map(([ch, count]) => ({
        name: channelNames[ch] ?? ch,
        percentage: Math.round((count / total) * 100),
        color: channelColors[ch] ?? '#64748b',
        count,
      }))
      .sort((a, b) => b.percentage - a.percentage);
  }, [filteredApts]);

  // Usar datos locales cuando la API devuelve arrays vacíos
  const peakHoursData    = currentMetrics.peakHours.length > 0         ? currentMetrics.peakHours         : localPeakHours;
  const topServicesData  = currentMetrics.topServices.length > 0        ? currentMetrics.topServices        : localTopServices;
  const channelDistData  = currentMetrics.channelDistribution.length > 0 ? currentMetrics.channelDistribution : localChannelDistribution;

  // Pico real de actividad
  const peakHour = peakHoursData.length > 0
    ? peakHoursData.reduce((a, b) => a.busynessScore >= b.busynessScore ? a : b)
    : null;
  const peakLabel = peakHour
    ? (() => {
        const h = parseInt(peakHour.hour.split(':')[0]);
        return h === 0 ? '12:00 am' : h < 12 ? `${h}:00 am` : h === 12 ? '12:00 pm' : `${h - 12}:00 pm`;
      })()
    : '—';

  // Helper for period title
  const getPeriodLabel = () => {
    switch (metricsPeriod) {
      case 'day':
        return 'vs. día anterior';
      case 'week':
        return 'vs. semana anterior';
      case 'month':
        return 'vs. mes anterior';
    }
  };

  return (
    <div id="dashboard-screen" className="flex-1 w-full h-full flex flex-col overflow-hidden">
      <IOSHeader
        title="Métricas"
        subtitle="Rendimiento y logística en tiempo real"
      />

      <PageContent className="space-y-4 lg:space-y-6">
        {/* Segmented Control for Period Selection */}
        <div className="pt-1">
          <IOSSegmentedControl
            id="metrics-period-selector"
            options={periodOptions}
            value={metricsPeriod}
            onChange={setMetricsPeriod}
            size="md"
          />
        </div>

        {/* Hero Revenue & Client Metrics Inset Group */}
        <div className="grid grid-cols-2 gap-3 lg:gap-4">
          {/* Card 1: Revenue */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col justify-between"
          >
            <span className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400">
              Ingresos
            </span>

            <div className="my-2.5">
              <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                ${currentMetrics.totalRevenue.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+{currentMetrics.revenueGrowthPercent}%</span>
                <span className="text-slate-400 font-normal text-[10px] ml-0.5">{getPeriodLabel()}</span>
              </div>
            </div>
            <button
              onClick={() => navigateTo('ganancias')}
              className="mt-1 text-[10px] font-semibold text-[var(--primary)] hover:opacity-70 transition text-left ios-touch cursor-pointer"
            >
              Ver informe →
            </button>
          </motion.div>

          {/* Card 2: Clients */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col justify-between"
          >
            <span className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400">
              Citas Atendidas
            </span>

            <div className="my-2.5">
              <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {currentMetrics.clientsCount}
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+{currentMetrics.clientsGrowthPercent}%</span>
                <span className="text-slate-400 font-normal text-[10px] ml-0.5">{getPeriodLabel()}</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* AI Conversion & Automation Insight */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => navigateTo('bots')}
          className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex items-center justify-between cursor-pointer ios-touch hover:border-slate-300 dark:hover:border-neutral-700 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Asistente IA Meta
                </h4>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  {currentMetrics.aiConversionRate}% éxito
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
                {currentMetrics.aiBookedAppointments} citas agendadas de forma 100% autónoma
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </motion.div>

        {/* Peak Hours Minimalist Chart Section */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[var(--primary)]" />
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Horas de Mayor Actividad
              </h3>
            </div>
            <span className="text-[11px] font-medium text-slate-400">
              Pico: {peakLabel}
            </span>
          </div>

          {/* Minimalist Bar Chart */}
          <div className="pt-2 pb-1 flex items-end justify-between gap-2.5 h-24 lg:h-36">
            {peakHoursData.length === 0 ? (
              <p className="text-[11px] text-slate-400 dark:text-neutral-500 w-full text-center py-4">Sin citas completadas en este período</p>
            ) : peakHoursData.map((item, idx) => {
              const isPeak = item.busynessScore >= 85;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div className="w-full bg-slate-100 dark:bg-neutral-800 rounded-t-lg overflow-hidden flex flex-col justify-end h-16">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${item.busynessScore}%` }}
                      transition={{ duration: 0.5, delay: idx * 0.05 }}
                      className={`w-full rounded-t-md ${
                        isPeak
                          ? 'bg-[var(--primary)]'
                          : 'bg-slate-300 dark:bg-neutral-600'
                      }`}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-neutral-400">
                    {item.hour.split(':')[0]}h
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Services Breakdown */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Servicios Más Populares
            </h3>
            <span className="text-[10px] text-slate-400">Participación</span>
          </div>

          <div className="space-y-3">
            {topServicesData.length === 0 ? (
              <p className="text-[11px] text-slate-400 dark:text-neutral-500 text-center py-4">Sin servicios en este período</p>
            ) : topServicesData.map((srv, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: srv.color }}
                    />
                    <span className="font-medium text-slate-800 dark:text-slate-200">{srv.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[11px]">{srv.count} citas</span>
                    <span className="font-bold text-slate-900 dark:text-white">${srv.revenue}</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${srv.percentage}%` }}
                    transition={{ duration: 0.6, delay: idx * 0.08 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: srv.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Inbound Channels Distribution */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Canales de Captación
            </span>
            <span className="text-[10px] text-slate-400">
              Meta Graph API
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {channelDistData.length === 0 ? (
              <p className="col-span-3 text-[11px] text-slate-400 dark:text-neutral-500 text-center py-4">Sin datos de canales en este período</p>
            ) : channelDistData.map((ch, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 flex flex-col items-center text-center"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full mb-1"
                  style={{ backgroundColor: ch.color }}
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {ch.percentage}%
                </span>
                <span className="text-[10px] text-slate-500 dark:text-neutral-400 truncate w-full">
                  {ch.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Alertas de Inventario ──────────────────────────────────────── */}
        {stockAlerts.length > 0 && (
          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-900/50 shadow-2xs">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Alertas de Inventario</span>
              <span className="ml-auto text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-semibold px-2 py-0.5 rounded-full">
                {stockAlerts.length} {stockAlerts.length === 1 ? 'alerta' : 'alertas'}
              </span>
            </div>
            <div className="space-y-2">
              {stockAlerts.map((alert, idx) => (
                <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30">
                  <PackageOpen className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-slate-700 dark:text-neutral-300">{alert.message}</p>
                    <p className="text-[10px] text-slate-400 dark:text-neutral-500 mt-0.5">
                      Stock: {alert.currentStock} {alert.unit} · Consumo proyectado: {alert.projectedConsumption.toFixed(2)} {alert.unit}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Rentabilidad por Servicio ───────────────────────────────────── */}
        {serviceMargins.length > 0 && (
          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-4 h-4 text-[var(--primary)]" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Rentabilidad por Servicio</span>
              <div className="ml-auto flex items-center gap-1 group relative">
                <span className="text-[10px] text-slate-400 cursor-default">Costo vs Precio</span>
                <span className="text-[10px] text-slate-400 cursor-help">ⓘ</span>
                <div className="absolute bottom-5 right-0 w-56 bg-slate-800 text-white text-[10px] rounded-lg p-2.5 hidden group-hover:block z-50 leading-relaxed shadow-xl">
                  <strong>Costo de Producción (COGS)</strong> es cuánto te cuesta hacer el servicio en productos: esmaltes, aceites, tintes, etc. La ganancia es lo que queda después de restarle eso al precio que cobras.
                </div>
              </div>
            </div>
            <div className="space-y-2.5">
              {serviceMargins.map((svc, idx) => {
                const isLoss = svc.marginPercent < 0;
                // Semáforo: rojo <20%, naranja 20-49%, verde 50%+
                const ratingColor = isLoss
                  ? '#ef4444'
                  : svc.marginPercent >= 50 ? '#10b981'
                  : svc.marginPercent >= 20 ? '#f59e0b'
                  : '#ef4444';
                const ratingLabel = isLoss ? 'Pérdida'
                  : svc.marginPercent >= 50 ? 'Excelente'
                  : svc.marginPercent >= 20 ? 'Ajustado'
                  : 'Bajo';
                const barBg = isLoss ? '#fee2e2' : svc.marginPercent >= 50 ? '#d1fae5' : svc.marginPercent >= 20 ? '#fef3c7' : '#fee2e2';
                const barWidth = isLoss ? 0 : Math.min(100, svc.marginPercent);
                // Tooltip texto
                const tooltipText = isLoss
                  ? `Por cada servicio de ${svc.serviceName} estás perdiendo $${Math.abs(svc.grossMargin).toFixed(2)} porque el costo de los productos ($${svc.totalCogs.toFixed(2)}) supera el precio que cobrás ($${svc.basePrice}).`
                  : svc.totalCogs === 0
                  ? `Aún no tiene receta o costo de productos configurado. Agregá los insumos en el Catálogo para ver la ganancia real.`
                  : `De cada $${svc.basePrice} que cobrás, $${svc.totalCogs.toFixed(2)} se van en productos y te quedan $${svc.grossMargin.toFixed(2)} de ganancia — el ${svc.marginPercent}% del precio.`;
                return (
                  <div key={idx} className="cursor-pointer group/row" onClick={() => navigateToCatalog({ serviceId: svc.serviceId, tab: 'recipe' })}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate flex-1 group-hover/row:underline group-hover/row:text-[var(--primary)]">{svc.serviceName}</span>
                      <div className="flex items-center gap-1.5 shrink-0 relative group/pct">
                        <span className="text-[10px] font-bold" style={{ color: ratingColor }}>{ratingLabel}</span>
                        <span className="text-xs font-extrabold cursor-help" style={{ color: ratingColor }}>
                          {isLoss ? `-${Math.abs(svc.marginPercent).toFixed(1)}%` : `${svc.marginPercent}%`}
                        </span>
                        {/* Tooltip del porcentaje */}
                        <div className="absolute bottom-5 right-0 w-60 bg-slate-800 text-white text-[10px] rounded-lg p-2.5 hidden group-hover/pct:block z-50 leading-relaxed shadow-xl">
                          {tooltipText}
                        </div>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: barBg }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${barWidth}%`, backgroundColor: ratingColor }}
                      />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[10px] text-slate-400">Precio: ${svc.basePrice}</span>
                      {isLoss ? (
                        <span className="text-[10px] font-semibold text-red-500">
                          ⚠ Costo (${svc.totalCogs.toFixed(2)}) supera el precio · Perdés ${Math.abs(svc.grossMargin).toFixed(2)} por servicio
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          Costo: ${svc.totalCogs.toFixed(2)} · Ganancia: ${svc.grossMargin.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {serviceMargins.some(s => s.totalCogs === 0) && (
              <p className="text-[10px] text-slate-400 dark:text-neutral-500 mt-3 text-center">
                * Servicios sin costo calculado: configurá la receta y el precio de compra de cada producto en el Catálogo.
              </p>
            )}
          </div>
        )}

      </PageContent>
    </div>
  );
};
