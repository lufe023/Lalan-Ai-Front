import React from 'react';
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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { IOSHeader } from '../components/ui/IOSHeader';
import { IOSSegmentedControl } from '../components/ui/IOSSegmentedControl';

export const DashboardScreen: React.FC = () => {
  const { metricsPeriod, setMetricsPeriod, currentMetrics, navigateTo, appointments } = useApp();
  const { currentUser } = useAuth();

  const periodOptions: { id: 'day' | 'week' | 'month'; label: string }[] = [
    { id: 'day', label: 'Hoy' },
    { id: 'week', label: 'Esta Semana' },
    { id: 'month', label: 'Este Mes' },
  ];

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

      <div className="flex-1 overflow-y-auto hide-scrollbar px-4 pb-8 space-y-4">
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
        <div className="grid grid-cols-2 gap-3">
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
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                ${currentMetrics.totalRevenue.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+{currentMetrics.revenueGrowthPercent}%</span>
                <span className="text-slate-400 font-normal text-[10px] ml-0.5">{getPeriodLabel()}</span>
              </div>
            </div>
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
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
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
              Pico: 5:00 PM
            </span>
          </div>

          {/* Minimalist Bar Chart */}
          <div className="pt-2 pb-1 flex items-end justify-between gap-2.5 h-24">
            {currentMetrics.peakHours.map((item, idx) => {
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
            {currentMetrics.topServices.map((srv, idx) => (
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
            {currentMetrics.channelDistribution.map((ch, idx) => (
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
      </div>
    </div>
  );
};
