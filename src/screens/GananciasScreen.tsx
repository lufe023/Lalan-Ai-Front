import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Info, Scissors, BarChart3, Download, Users, User, Package, Store } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { IOSHeader } from '../components/ui/IOSHeader';
import { PageContent } from '../components/ui/PageContent';
import * as XLSX from 'xlsx';
import { CascadingRibbonCalendar, CalendarGranularity, MonthWeek } from '../components/ui/CascadingRibbonCalendar';

type RevenueMode = 'bruto' | 'neto';

export const GananciasScreen: React.FC = () => {
  const { appointments, products, loadIngredients, goBack, navigateTo } = useApp();
  const [mode, setMode] = useState<RevenueMode>('bruto');
  const [serviceCosts, setServiceCosts] = useState<Record<string, number>>({});
  const [loadingCosts, setLoadingCosts] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // chartGranularity drives chart buckets; may differ from calGranularity when drilling weeks→days
  const [chartGranularity, setChartGranularity] = useState<CalendarGranularity>('days');
  const [calGranularity, setCalGranularity] = useState<CalendarGranularity>('days');
  // Track when granularity drill-down just happened so next onRangeChange knows the context
  const drillDownOccurred = useRef(false);
  /**
   * Día elegido a mano (un chip o el botón "Hoy").
   *
   * "Hoy" dispara onGranularityChange('days'), que se confundía con un
   * drill-down de semana a día: pedías hoy y salía la semana completa.
   */
  const diaElegido = useRef(false);

  const [rangeStart, setRangeStart] = useState<Date>(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });
  const [rangeEnd, setRangeEnd] = useState<Date>(() => {
    const d = new Date(); d.setHours(23, 59, 59, 999); return d;
  });

  /**
   * El informe viene del backend y se calcula sobre las VENTAS cerradas.
   *
   * Antes esta pantalla sumaba el precio agendado de las citas completadas:
   * ignoraba productos, bebidas, ventas de mostrador, descuentos y
   * cortesías. Por eso Caja decía 154 y esta pantalla decía 90.
   */
  const [informe, setInforme] = useState<any>(null);
  const [cargandoInforme, setCargandoInforme] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCargandoInforme(true);
    api.get<any>(`/sales/report/profit?desde=${rangeStart.toISOString()}&hasta=${rangeEnd.toISOString()}`)
      .then(r => { if (!cancelado) setInforme(r); })
      .catch(() => { if (!cancelado) setInforme(null); })
      .finally(() => { if (!cancelado) setCargandoInforme(false); });
    return () => { cancelado = true; };
  }, [rangeStart, rangeEnd]);

  /**
   * Días con recaudo, para los puntitos del calendario.
   *
   * Antes el calendario marcaba los días con CITAS. Pero el dinero se cuenta
   * por día de COBRO: un servicio del martes que se cobra el viernes es
   * recaudo del viernes. El punto tiene que estar donde está la plata.
   */
  const [diasConRecaudo, setDiasConRecaudo] = useState<any[]>([]);

  useEffect(() => {
    // Ventana amplia: el calendario deja navegar años hacia atrás
    const desde = new Date(new Date().getFullYear() - 1, 0, 1).toISOString();
    const hasta = new Date(new Date().getFullYear() + 1, 0, 1).toISOString();
    api.get<any[]>(`/sales/report/days?desde=${desde}&hasta=${hasta}`)
      .then(d => setDiasConRecaudo(d ?? []))
      .catch(() => setDiasConRecaudo([]));
  }, []);

  /**
   * El calendario cuenta un evento por punto, así que expandimos cada día a
   * tantas entradas como ventas tuvo: así los días de más recaudo se ven
   * más marcados, igual que antes con las citas.
   */
  const eventosCalendario = useMemo(
    () => diasConRecaudo.flatMap(d =>
      Array.from({ length: Math.max(1, Number(d.count) || 1) }, () => ({ date: d.date })),
    ),
    [diasConRecaudo],
  );

  /** Las ventas del período, con su hora, para poder agruparlas en el gráfico */
  const ventas = useMemo(
    () => (informe?.detalle ?? []).map((v: any) => ({
      ...v, fecha: new Date(v.closedAt),
    })),
    [informe],
  );

  const completedAppointments = useMemo(() =>
    appointments.filter(a => a.status === 'completed'),
  [appointments]);

  const aptDate = (a: typeof appointments[0]) =>
    new Date(a.completedAt ?? `${a.date}T${a.time}`);

  const filteredAppointments = useMemo(() =>
    completedAppointments.filter(a => {
      const d = aptDate(a);
      return d >= rangeStart && d <= rangeEnd;
    }),
  [completedAppointments, rangeStart, rangeEnd]);

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

  const { bruto, neto, costoTotal, count } = useMemo(() => ({
    bruto: Number(informe?.bruto ?? 0),
    costoTotal: Number(informe?.costo ?? 0),
    neto: Math.max(0, Number(informe?.neto ?? 0)),
    count: Number(informe?.ventas ?? 0),
  }), [informe]);

  const totalRevenue = mode === 'bruto' ? bruto : neto;
  const margin = bruto > 0 ? Math.round((neto / bruto) * 100) : 0;

  const apptBruto = (v: any) => Number(v.bruto ?? 0);
  const apptNeto = (v: any) => Math.max(0, Number(v.bruto ?? 0) - Number(v.costo ?? 0));

  const chartData = useMemo(() => {
    if (chartGranularity === 'days') {
      // Hourly: 8h–20h
      const hr12 = (h: number) => h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h-12}pm`;
      const b = Array.from({ length: 24 }, (_, i) => ({ label: hr12(i), bruto: 0, neto: 0 }));
      ventas.forEach((a: any) => {
        const h = a.fecha.getHours();
        if (h >= 0 && h < 24) { b[h].bruto += apptBruto(a); b[h].neto += apptNeto(a); }
      });
      return b.map(d => ({ ...d, value: mode === 'bruto' ? d.bruto : d.neto }));
    }

    if (chartGranularity === 'weeks') {
      // Daily: exact days in the selected week range (partial weeks at month edges have < 7 days)
      const msPerDay = 24 * 60 * 60 * 1000;
      const numDays = Math.max(1, Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / msPerDay) + 1);
      const b = Array.from({ length: numDays }, (_, i) => {
        const d = new Date(rangeStart);
        d.setDate(rangeStart.getDate() + i);
        return {
          label: d.toLocaleDateString('es-MX', { weekday: 'short' }),
          subLabel: d.getDate(),
          date: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
          bruto: 0, neto: 0,
        };
      });
      ventas.forEach((a: any) => {
        const d = a.fecha;
        const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const idx = b.findIndex(x => x.date === key);
        if (idx >= 0) { b[idx].bruto += apptBruto(a); b[idx].neto += apptNeto(a); }
      });
      return b.map(d => ({ ...d, value: mode === 'bruto' ? d.bruto : d.neto }));
    }

    if (chartGranularity === 'months') {
      // Weekly buckets within the selected month
      const buckets: Array<{ label: string; start: number; end: number; bruto: number; neto: number }> = [];
      let cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
      const monthEnd = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + 1, 0, 23, 59, 59, 999);
      let w = 1;
      while (cur <= monthEnd) {
        const wEnd = new Date(cur);
        wEnd.setDate(wEnd.getDate() + 6);
        if (wEnd > monthEnd) wEnd.setTime(monthEnd.getTime());
        buckets.push({ label: `S${w}`, start: cur.getTime(), end: wEnd.getTime(), bruto: 0, neto: 0 });
        cur = new Date(cur);
        cur.setDate(cur.getDate() + 7);
        w++;
      }
      ventas.forEach((a: any) => {
        const t = a.fecha.getTime();
        const idx = buckets.findIndex(x => t >= x.start && t <= x.end);
        if (idx >= 0) { buckets[idx].bruto += apptBruto(a); buckets[idx].neto += apptNeto(a); }
      });
      return buckets.map(d => ({ ...d, value: mode === 'bruto' ? d.bruto : d.neto }));
    }

    // years: monthly breakdown
    const year = rangeStart.getFullYear();
    const b = Array.from({ length: 12 }, (_, i) => ({
      label: new Date(year, i, 1).toLocaleDateString('es-MX', { month: 'short' }),
      month: i, bruto: 0, neto: 0,
    }));
    ventas.forEach((a: any) => {
      const d = a.fecha;
      if (d.getFullYear() === year) {
        b[d.getMonth()].bruto += apptBruto(a);
        b[d.getMonth()].neto += apptNeto(a);
      }
    });
    return b.map(d => ({ ...d, value: mode === 'bruto' ? d.bruto : d.neto }));
  }, [ventas, chartGranularity, mode, rangeStart, rangeEnd]);

  /** Mapea lo que devuelve el backend a la forma que ya consumía la UI */
  const aFilas = (lista: any[] = []) =>
    lista.map(e => ({
      name: e.nombre,
      count: Number(e.unidades ?? 0),
      bruto: Number(e.bruto ?? 0),
      cost: Number(e.costo ?? 0),
      neto: Number(e.neto ?? 0),
      margen: Number(e.margen ?? 0),
      esMostrador: !!e.esMostrador,
    }));

  const breakdown = useMemo(() => aFilas(informe?.porServicio), [informe]);
  const productBreakdown = useMemo(() => aFilas(informe?.porProducto), [informe]);
  const staffBreakdown = useMemo(() => aFilas(informe?.porEspecialista), [informe]);

  const clientBreakdown = useMemo(
    () => aFilas(informe?.porCliente).map(c => ({
      ...c,
      services: [] as string[],
      preferredHour: null as string | null,
    })),
    [informe],
  );

  const maxVal = Math.max(...chartData.map(d => d.value), 1);
  const W = 300, H = 26;
  const barW = W / chartData.length - 2;

  const handleRangeChange = useCallback(({
    granularity: g, year, monthIndex, week, date,
  }: {
    granularity: CalendarGranularity;
    year: number;
    monthIndex: number;
    week?: MonthWeek;
    date: Date;
    dateStr: string;
  }) => {
    const fromDrillDown = drillDownOccurred.current;
    drillDownOccurred.current = false;

    let start: Date, end: Date;
    let newChart: CalendarGranularity = g;

    if (g === 'days') {
      // Un día elegido a mano manda sobre cualquier drill-down
      const eligioDia = diaElegido.current;
      diaElegido.current = false;

      if (!eligioDia && fromDrillDown && week) {
        // Drilled weeks → days by clicking a week chip: show full week daily chart
        start = new Date(week.startDate); start.setHours(0, 0, 0, 0);
        end = new Date(week.endDate); end.setHours(23, 59, 59, 999);
        newChart = 'weeks';
      } else {
        // Clicked a day chip while already at days level
        start = new Date(date); start.setHours(0, 0, 0, 0);
        end = new Date(date); end.setHours(23, 59, 59, 999);
        newChart = 'days';
      }
    } else if (g === 'weeks' && week) {
      start = new Date(week.startDate); start.setHours(0, 0, 0, 0);
      end = new Date(week.endDate); end.setHours(23, 59, 59, 999);
      newChart = 'weeks';
    } else if (g === 'months') {
      start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
      end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
      newChart = 'months';
    } else {
      start = new Date(year, 0, 1, 0, 0, 0, 0);
      end = new Date(year, 11, 31, 23, 59, 59, 999);
      newChart = 'years';
    }

    setRangeStart(start);
    setRangeEnd(end);
    setChartGranularity(newChart);
    setHoveredIdx(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Helpers de formato
    const fmtTime = (d: Date) => {
      const h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      if (h === 0) return `12:${m} am`;
      if (h < 12) return `${h}:${m} am`;
      if (h === 12) return `12:${m} pm`;
      return `${h - 12}:${m} pm`;
    };
    const fmtDate = (d: Date) =>
      d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const fmtDay = (d: Date) =>
      d.toLocaleDateString('es-MX', { weekday: 'long' });
    const periodoLabel = chartGranularity === 'days' ? 'Día'
      : chartGranularity === 'weeks' ? 'Semana'
      : chartGranularity === 'months' ? 'Mes' : 'Año';

    // Sheet 1: Resumen general
    const resumenData = [
      ['INFORME DE GANANCIAS'],
      [],
      ['Período',            periodoLabel],
      ['Desde',              fmtDate(rangeStart)],
      ['Hasta',              fmtDate(rangeEnd)],
      [],
      ['Citas completadas',  count],
      ['Ingresos brutos',    bruto],
      ['Costo de insumos',   costoTotal],
      ['Ganancias netas',    neto],
      ['Margen de ganancia', `${margin}%`],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(resumenData);
    ws1['!cols'] = [{ wch: 24 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

    // Sheet 2: Por servicio (con totales)
    const svcHeader = ['Servicio', 'Citas', 'Ingreso bruto ($)', 'Costo insumos ($)', 'Ganancia neta ($)', 'Margen (%)'];
    const svcRows = breakdown.map(s => {
      const n = Math.max(0, s.bruto - s.cost);
      const m = s.bruto > 0 ? Math.round((n / s.bruto) * 100) : 0;
      return [s.name, s.count, s.bruto, s.cost, n, m];
    });
    const ws2 = XLSX.utils.aoa_to_sheet([svcHeader, ...svcRows, [], ['TOTAL', count, bruto, costoTotal, neto, margin]]);
    ws2['!cols'] = [{ wch: 30 }, { wch: 8 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Por servicio');

    // Sheet 3: Detalle completo de cada cita (ordenado por fecha y hora)
    const detHeader = ['Fecha', 'Día', 'Hora', 'Especialista', 'Cliente', 'Servicio', 'Ingreso bruto ($)', 'Costo insumos ($)', 'Ganancia neta ($)'];
    const sorted = [...filteredAppointments].sort((a, b) => aptDate(a).getTime() - aptDate(b).getTime());
    const detRows = sorted.map(a => {
      const d = aptDate(a);
      const cost = a.serviceId ? (serviceCosts[a.serviceId] ?? 0) : 0;
      const aNeto = Math.max(0, a.price - cost);
      return [fmtDate(d), fmtDay(d), fmtTime(d), a.staffName || '', a.clientName || '', a.serviceName, a.price, cost, aNeto];
    });
    const ws3 = XLSX.utils.aoa_to_sheet([detHeader, ...detRows, [], ['', '', '', '', '', 'TOTAL', bruto, costoTotal, neto]]);
    ws3['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 22 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Detalle de citas');

    // Sheet 4: Por especialista
    const staffHeader = ['Especialista', 'Citas', 'Ingreso bruto ($)', 'Costo insumos ($)', 'Ganancia neta ($)', 'Margen (%)'];
    const staffRows = staffBreakdown.map(s => {
      const sNeto = Math.max(0, s.bruto - s.cost);
      const sMargin = s.bruto > 0 ? Math.round((sNeto / s.bruto) * 100) : 0;
      return [s.name, s.count, s.bruto, s.cost, sNeto, sMargin];
    });
    const ws4 = XLSX.utils.aoa_to_sheet([staffHeader, ...staffRows, [], ['TOTAL', count, bruto, costoTotal, neto, margin]]);
    ws4['!cols'] = [{ wch: 26 }, { wch: 8 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'Por especialista');

    // Sheet 5: Por cliente
    const clientHeader = ['Cliente', 'Visitas', 'Total gastado ($)', 'Servicios usados', 'Hora preferida'];
    const clientRows = clientBreakdown.map(c => [c.name, c.count, c.bruto, c.services.join(', '), c.preferredHour ?? '']);
    const totalClientBruto = clientBreakdown.reduce((s, c) => s + c.bruto, 0);
    const ws5 = XLSX.utils.aoa_to_sheet([clientHeader, ...clientRows, [], ['TOTAL', count, totalClientBruto, '', '']]);
    ws5['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 18 }, { wch: 40 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws5, 'Por cliente');

    const from = rangeStart.toISOString().slice(0, 10);
    const to   = rangeEnd.toISOString().slice(0, 10);
    XLSX.writeFile(wb, `ganancias_${from}_al_${to}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-neutral-950">
      <IOSHeader title="Informe de Ganancias" onBack={goBack} />
      <PageContent>

        {/* Los dos informes cuentan cosas distintas y conviene poder saltar */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-neutral-800 mb-3">
          <span className="flex-1 py-2 rounded-xl text-xs font-bold text-center bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-2xs">
            Ganancias
          </span>
          <button
            onClick={() => navigateTo('citas-report')}
            className="flex-1 py-2 rounded-xl text-xs font-bold text-center text-slate-500 dark:text-neutral-400 hover:text-slate-700 transition"
          >
            Citas
          </button>
        </div>

        {/* Cascading ribbon calendar as period filter */}
        <CascadingRibbonCalendar
          events={eventosCalendario}
          initialGranularity="days"
          onGranularityChange={g => {
            drillDownOccurred.current = true;
            setCalGranularity(g);
            setHoveredIdx(null);
          }}
          onSelectDate={() => { diaElegido.current = true; }}
          onRangeChange={handleRangeChange}
        />

        {/* Mode toggle + export */}
        <div className="flex items-center justify-between mt-3 mb-4 bg-white dark:bg-neutral-900 rounded-2xl p-3 border border-slate-200 dark:border-neutral-800">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">Modo de vista</p>
            <p className="text-[10px] text-slate-400 dark:text-neutral-500 mt-0.5">
              {mode === 'bruto' ? 'Antes de descontar insumos' : 'Después de descontar insumos'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 dark:bg-neutral-800 rounded-xl p-0.5 gap-0.5">
              {(['bruto', 'neto'] as RevenueMode[]).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ios-touch cursor-pointer capitalize ${mode === m ? 'bg-white dark:bg-neutral-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-400 dark:text-neutral-500'}`}>
                  {m}
                </button>
              ))}
            </div>
            <button
              onClick={exportToExcel}
              title="Exportar a Excel"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-[11px] font-bold transition cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Excel
            </button>
          </div>
        </div>

        {/* Hero metric — key only on mode/granularity so date clicks don't restart the animation */}
        <motion.div key={`${chartGranularity}-${mode}`}
          initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
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
                {count} {count === 1 ? 'venta cobrada' : 'ventas cobradas'}
                {Number(informe?.cortesias ?? 0) > 0 && ` · ${informe.cortesias} cortesías`}
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
            <div className="mt-3">
              <svg viewBox={`0 -24 ${W} ${H + 52}`} className="w-full" onMouseLeave={() => setHoveredIdx(null)}>
                {chartData.map((d, i) => {
                  const sub = (d as any).subLabel as number | undefined;
                  const bh = Math.max((d.value / maxVal) * H, d.value > 0 ? 2 : 0);
                  const x = i * (W / chartData.length) + 1;
                  const isHov = hoveredIdx === i;
                  const fs = chartData.length > 10 ? 5.5 : 6.5;
                  // For 24-bar day view, only show every 3rd label to avoid overlap (unless hovered)
                  const showLabel = chartData.length < 16 || i % 3 === 0 || isHov;
                  return (
                    <g key={i} onMouseEnter={() => setHoveredIdx(i)} style={{ cursor: d.value > 0 ? 'pointer' : 'default' }}>
                      <rect x={x} y={0} width={barW} height={H} fill="transparent" />
                      <rect x={x} y={H - bh} width={barW} height={bh} rx={2}
                        fill={mode === 'bruto' ? 'var(--primary)' : '#10b981'}
                        opacity={d.value > 0 ? (isHov ? 1 : 0.78) : 0.08} />
                      {showLabel && (
                        <text x={x + barW / 2} y={H + 10} textAnchor="middle" fontSize={fs}
                          style={{ fill: isHov ? '#64748b' : '#94a3b8', fontWeight: isHov ? 600 : 400 }}>
                          {d.label}
                        </text>
                      )}
                      {sub !== undefined && (
                        <text x={x + barW / 2} y={H + 19} textAnchor="middle" fontSize={fs - 0.5}
                          style={{ fill: isHov ? '#475569' : '#cbd5e1', fontWeight: 500 }}>
                          {sub}
                        </text>
                      )}
                    </g>
                  );
                })}
                {/* Tooltip */}
                {hoveredIdx !== null && hoveredIdx < chartData.length && chartData[hoveredIdx].value > 0 && (() => {
                  const d = chartData[hoveredIdx];
                  const sub = (d as any).subLabel as number | undefined;
                  const x = hoveredIdx * (W / chartData.length) + 1;
                  const cx = x + barW / 2;
                  const bh = Math.max((d.value / maxVal) * H, 2);
                  const fmt = (v: number) => `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  const header = sub !== undefined ? `${d.label} ${sub}` : d.label;
                  const lines = mode === 'neto'
                    ? [header, `${fmt((d as any).neto)} neto`, `${fmt((d as any).bruto)} bruto`]
                    : [header, `${fmt((d as any).bruto)}`];
                  const tw = 64, lh = 8, pad = 5;
                  const th = lines.length * lh + pad;
                  const tx = Math.max(1, Math.min(cx - tw / 2, W - tw - 1));
                  const idealTy = H - bh - 5;
                  const ty = Math.max(-22 + th, idealTy);
                  return (
                    <g pointerEvents="none">
                      <rect x={tx} y={ty - th} width={tw} height={th} rx={3} fill="#0f172a" opacity={0.9} />
                      {lines.map((line, li) => (
                        <text key={li} x={tx + tw / 2} y={ty - th + pad + li * lh}
                          textAnchor="middle" fontSize={6} style={{
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
            <div className="mt-3 py-3 text-center text-[11px] text-slate-400 dark:text-neutral-500">
              Sin ventas cobradas en este período
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
                      <span className="text-[10px] text-slate-400 ml-1">({svc.count} {svc.count === 1 ? 'vez' : 'veces'})</span>
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

        {/* Por producto — lo que antes no existía en este informe */}
        {productBreakdown.length > 0 && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 overflow-hidden mb-6">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-neutral-800">
              <Package className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">Por producto</span>
            </div>
            {productBreakdown.map((p, idx) => {
              const pNeto = Math.max(0, p.bruto - p.cost);
              const display = mode === 'bruto' ? p.bruto : pNeto;
              const pct = totalRevenue > 0 ? (display / totalRevenue) * 100 : 0;
              return (
                <div key={idx} className="px-4 py-3 border-b border-slate-50 dark:border-neutral-800/50 last:border-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{p.name}</span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        ${display.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-1">
                        ({p.count} {p.count === 1 ? 'unidad' : 'unidades'})
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(pct, 100)}%`, background: mode === 'bruto' ? '#f59e0b' : '#10b981' }} />
                  </div>
                  {mode === 'neto' && p.cost > 0 && (
                    <p className="text-[10px] text-slate-400 dark:text-neutral-500 mt-1">
                      Costo: -${p.cost.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Margen {p.margen}%
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Cortesías: no facturan, pero sí cuestan */}
        {Number(informe?.cortesias ?? 0) > 0 && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
                  Cortesías
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {informe.cortesias} servidas · lo que te cuesta ser amable
                </p>
              </div>
              <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
                −${Number(informe.cortesiasCosto ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        {/* Por especialista */}
        {staffBreakdown.length > 0 && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 overflow-hidden mb-4">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-neutral-800">
              <Users className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">Por especialista</span>
            </div>
            {staffBreakdown.map((staff, idx) => {
              const staffNeto = Math.max(0, staff.bruto - staff.cost);
              const display = mode === 'bruto' ? staff.bruto : staffNeto;
              const pct = totalRevenue > 0 ? (display / totalRevenue) * 100 : 0;
              const isTop = idx === 0 && staffBreakdown.length > 1;
              return (
                <div key={idx} className="px-4 py-3 border-b border-slate-50 dark:border-neutral-800/50 last:border-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-violet-600 dark:text-violet-400">
                          {staff.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{staff.name}</span>
                      {isTop && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex-shrink-0">★ Top</span>}
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">${display.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-[10px] text-slate-400 ml-1">({staff.count} {staff.count === 1 ? 'servicio' : 'servicios'})</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(pct, 100)}%`, background: '#8b5cf6' }} />
                  </div>
                  {mode === 'neto' && staff.cost > 0 && (
                    <p className="text-[10px] text-slate-400 dark:text-neutral-500 mt-1">
                      Insumos: -${staff.cost.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Bruto: ${staff.bruto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Por cliente */}
        {clientBreakdown.length > 0 && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 overflow-hidden mb-6">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-neutral-800">
              <User className="w-4 h-4 text-sky-500" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">Por cliente</span>
            </div>
            {clientBreakdown.slice(0, 8).map((client, idx) => {
              const pct = totalRevenue > 0 ? (client.bruto / totalRevenue) * 100 : 0;
              const isTopSpender = idx === 0;
              const isMostRecurring = clientBreakdown.length > 1 && client.count === Math.max(...clientBreakdown.map(c => c.count)) && client.count > 1;
              return (
                <div key={idx} className="px-4 py-3 border-b border-slate-50 dark:border-neutral-800/50 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-sky-600 dark:text-sky-400">
                          {client.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{client.name}</span>
                          {isTopSpender && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex-shrink-0">💰 Top gasto</span>}
                          {isMostRecurring && !isTopSpender && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 flex-shrink-0">🔁 Más recurrente</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-slate-400">{client.count} {client.count === 1 ? 'visita' : 'visitas'}</span>
                          {client.preferredHour && <span className="text-[10px] text-slate-400">· prefiere {client.preferredHour}</span>}
                          {client.services.length > 0 && (
                            <span className="text-[10px] text-slate-400 truncate max-w-[140px]">· {client.services.slice(0, 2).join(', ')}{client.services.length > 2 ? ` +${client.services.length - 2}` : ''}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">${client.bruto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  <div className="h-1 bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden mt-1.5">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(pct, 100)}%`, background: '#0ea5e9' }} />
                  </div>
                </div>
              );
            })}
            {clientBreakdown.length > 8 && (
              <div className="px-4 py-2.5 text-center text-[10px] text-slate-400 dark:text-neutral-500 border-t border-slate-50 dark:border-neutral-800/50">
                +{clientBreakdown.length - 8} clientes más · exporta a Excel para ver todos
              </div>
            )}
          </div>
        )}

      </PageContent>
    </div>
  );
};
