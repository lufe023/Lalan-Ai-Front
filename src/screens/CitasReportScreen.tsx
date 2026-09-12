import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  CalendarClock, Clock, Users, Scissors, XCircle, Coffee, TrendingUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { IOSHeader } from '../components/ui/IOSHeader';
import { PageContent } from '../components/ui/PageContent';
import { CascadingRibbonCalendar, CalendarGranularity, MonthWeek } from '../components/ui/CascadingRibbonCalendar';

const hr12 = (h: number) =>
  h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;

/**
 * Informe de Citas — la operación del salón.
 *
 * Responde una pregunta distinta a la de Ganancias, y por eso vive aparte:
 * aquí se cuenta por día de CITA, no por día de cobro. Cuándo se llena el
 * salón, cuándo está vacío, quién carga con más trabajo, cuánto se cancela,
 * y cuánto cuesta de verdad atender a alguien una vez sumas lo que se le
 * sirvió mientras esperaba.
 */
export const CitasReportScreen: React.FC = () => {
  const { goBack, navigateTo, baseCurrency, loadCurrencies } = useApp();

  const [informe, setInforme] = useState<any>(null);
  const [cargando, setCargando] = useState(false);
  const [dias, setDias] = useState<any[]>([]);
  const drillDownOccurred = useRef(false);
  /**
   * El usuario eligió un DÍA concreto — tocando un chip o el botón "Hoy".
   *
   * Hace falta porque "Hoy" también dispara onGranularityChange('days'), y
   * sin esta señal se confundía con un drill-down de semana a día: pedías
   * hoy y te mostraba la semana entera.
   */
  const diaElegido = useRef(false);

  const [rangeStart, setRangeStart] = useState<Date>(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });
  const [rangeEnd, setRangeEnd] = useState<Date>(() => {
    const d = new Date(); d.setHours(23, 59, 59, 999); return d;
  });

  const sim = baseCurrency?.symbol ?? '';
  const plata = (n: any) => `${Number(n ?? 0).toFixed(2)}${sim ? ` ${sim}` : ''}`;

  useEffect(() => { void loadCurrencies?.(); }, []);

  useEffect(() => {
    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) return;
    let cancelado = false;
    setCargando(true);
    api.get<any>(`/reports/appointments?desde=${rangeStart.toISOString()}&hasta=${rangeEnd.toISOString()}`)
      .then(r => { if (!cancelado) setInforme(r); })
      .catch(() => { if (!cancelado) setInforme(null); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    const desde = new Date(new Date().getFullYear() - 1, 0, 1).toISOString();
    const hasta = new Date(new Date().getFullYear() + 1, 0, 1).toISOString();
    api.get<any[]>(`/reports/appointments/days?desde=${desde}&hasta=${hasta}`)
      .then(d => setDias(d ?? []))
      .catch(() => setDias([]));
  }, []);

  /** Aquí los puntitos SÍ van donde hay citas: es de lo que trata esta pantalla */
  const eventos = useMemo(
    () => dias.flatMap(d =>
      Array.from({ length: Math.max(1, Number(d.count) || 1) }, () => ({ date: d.date })),
    ),
    [dias],
  );

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
    const veniaDeDrill = drillDownOccurred.current;
    drillDownOccurred.current = false;

    // OJO: la semana viene como { startDate, endDate }, no { start, end }.
    // Leer los nombres equivocados producía Invalid Date y reventaba el
    // toISOString del fetch.
    let start: Date, end: Date;

    if (g === 'days') {
      // Un día elegido a mano manda sobre cualquier drill-down
      const eligioDia = diaElegido.current;
      diaElegido.current = false;

      if (!eligioDia && veniaDeDrill && week) {
        start = new Date(week.startDate); start.setHours(0, 0, 0, 0);
        end = new Date(week.endDate); end.setHours(23, 59, 59, 999);
      } else {
        start = new Date(date); start.setHours(0, 0, 0, 0);
        end = new Date(date); end.setHours(23, 59, 59, 999);
      }
    } else if (g === 'weeks' && week) {
      start = new Date(week.startDate); start.setHours(0, 0, 0, 0);
      end = new Date(week.endDate); end.setHours(23, 59, 59, 999);
    } else if (g === 'months') {
      start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
      end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    } else {
      start = new Date(year, 0, 1, 0, 0, 0, 0);
      end = new Date(year, 11, 31, 23, 59, 59, 999);
    }

    // Cinturón: una fecha inválida aquí tumbaba la pantalla entera
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

    setRangeStart(start);
    setRangeEnd(end);
  }, []);

  const maxHora = Math.max(1, ...(informe?.porHora ?? []).map((h: any) => h.citas));
  const maxDia = Math.max(1, ...(informe?.porDiaSemana ?? []).map((d: any) => d.citas));

  const Tarjeta: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <div className={`bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 ${className}`}>
      {children}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-neutral-950">
      <IOSHeader title="Informe de Citas" onBack={goBack} />
      <PageContent>
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-neutral-800 mb-3">
          <button
            onClick={() => navigateTo('ganancias')}
            className="flex-1 py-2 rounded-xl text-xs font-bold text-center text-slate-500 dark:text-neutral-400 hover:text-slate-700 transition"
          >
            Ganancias
          </button>
          <span className="flex-1 py-2 rounded-xl text-xs font-bold text-center bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-2xs">
            Citas
          </span>
        </div>

        <CascadingRibbonCalendar
          events={eventos}
          initialGranularity="days"
          onGranularityChange={() => { drillDownOccurred.current = true; }}
          onSelectDate={() => { diaElegido.current = true; }}
          onRangeChange={handleRangeChange}
        />

        {/* Resumen */}
        <Tarjeta className="p-4 mt-3 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                Citas en el período
              </p>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {informe?.total ?? 0}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-1">
                {informe?.horasAgendadas ?? 0} h agendadas ·{' '}
                {informe?.duracionPromedio ?? 0} min promedio
              </p>
            </div>
            {Number(informe?.tasaCancelacion ?? 0) > 0 && (
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                Number(informe.tasaCancelacion) > 15
                  ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                  : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
              }`}>
                <XCircle className="w-3 h-3" />
                {informe.tasaCancelacion}% cancelado
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-neutral-800 text-center">
            {[
              ['Atendidas', informe?.atendidas ?? 0],
              ['Completadas', informe?.completadas ?? 0],
              ['Canceladas', informe?.canceladas ?? 0],
            ].map(([l, v]) => (
              <div key={String(l)}>
                <div className="text-[10px] text-slate-400 font-medium">{String(l)}</div>
                <div className="text-sm font-bold text-slate-800 dark:text-neutral-200 tabular-nums">
                  {String(v)}
                </div>
              </div>
            ))}
          </div>

          {informe?.duracionRealPromedio != null && (
            <p className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-100 dark:border-neutral-800">
              Duración real promedio: <strong>{informe.duracionRealPromedio} min</strong> contra{' '}
              {informe.duracionPromedio} agendados
              {informe.duracionRealPromedio > informe.duracionPromedio
                ? ' — las citas se están alargando, considera ajustar la agenda.'
                : ' — la agenda está bien calibrada.'}
              {' '}({informe.citasConDuracionReal} medidas)
            </p>
          )}
        </Tarjeta>

        {/* Lo consumido durante las citas */}
        {Number(informe?.consumoExtra ?? 0) > 0 || Number(informe?.cortesiasServidas ?? 0) > 0 ? (
          <Tarjeta className="p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Coffee className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Consumo durante las citas
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Vendido aparte</div>
                <div className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {plata(informe.consumoExtra)}
                </div>
                <div className="text-[10px] text-slate-400">
                  {plata(informe.consumoPromedioPorCita)} por cita
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Cortesías</div>
                <div className="text-lg font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                  {informe.cortesiasServidas}
                </div>
                <div className="text-[10px] text-slate-400">
                  costaron {plata(informe.costoExtra)}
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
              Esto es lo que se le sirvió a las clientas mientras estaban en el
              salón, además de su servicio. Es lo que de verdad cuesta atender
              a alguien.
            </p>
          </Tarjeta>
        ) : null}

        {/* Ocupación por hora */}
        {!!informe?.porHora?.length && (
          <Tarjeta className="overflow-hidden mb-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--primary)]" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Ocupación por hora
                </span>
              </div>
              {!!informe.horasPico?.length && (
                <span className="text-[10px] text-slate-400">
                  Pico: {informe.horasPico.map(hr12).join(' · ')}
                </span>
              )}
            </div>
            <div className="p-4 flex items-end gap-1 h-32">
              {informe.porHora.map((h: any) => (
                <div key={h.hora} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                  <div
                    className="w-full rounded-t transition-all duration-500 bg-[var(--primary)]"
                    style={{ height: `${(h.citas / maxHora) * 100}%`, minHeight: 4 }}
                    title={`${h.citas} citas`}
                  />
                  <span className="text-[9px] text-slate-400 whitespace-nowrap">
                    {hr12(h.hora)}
                  </span>
                </div>
              ))}
            </div>
          </Tarjeta>
        )}

        {/* Por día de la semana */}
        {!!informe?.porDiaSemana?.some((d: any) => d.citas > 0) && (
          <Tarjeta className="overflow-hidden mb-4">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-neutral-800">
              <CalendarClock className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Qué días se llena
              </span>
            </div>
            <div className="p-4 space-y-2">
              {informe.porDiaSemana.map((d: any) => (
                <div key={d.dia} className="flex items-center gap-2">
                  <span className="w-8 text-[11px] font-semibold text-slate-500 capitalize">
                    {d.nombre}
                  </span>
                  <div className="flex-1 h-2 bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-500 transition-all duration-500"
                      style={{ width: `${(d.citas / maxDia) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-[11px] text-slate-400 tabular-nums">
                    {d.citas} · {(d.minutos / 60).toFixed(1)}h
                  </span>
                </div>
              ))}
            </div>
          </Tarjeta>
        )}

        {/* Carga por especialista */}
        {!!informe?.porEspecialista?.length && (
          <Tarjeta className="overflow-hidden mb-4">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-neutral-800">
              <Users className="w-4 h-4 text-sky-500" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Carga por especialista
              </span>
            </div>
            {informe.porEspecialista.map((e: any) => (
              <div key={e.id} className="px-4 py-3 border-b border-slate-50 dark:border-neutral-800/50 last:border-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {e.nombre}
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                    {e.horas}h
                    <span className="text-[10px] text-slate-400 font-normal ml-1">
                      ({e.citas} citas)
                    </span>
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        (e.minutos / Math.max(1, informe.minutosAgendados)) * 100, 100,
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {e.promedioMin} min por cita · facturó {plata(e.facturado)}
                  {e.canceladas > 0 && ` · ${e.canceladas} cancelada${e.canceladas === 1 ? '' : 's'}`}
                </p>
              </div>
            ))}
          </Tarjeta>
        )}

        {/* Por servicio */}
        {!!informe?.porServicio?.length && (
          <Tarjeta className="overflow-hidden mb-6">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-neutral-800">
              <Scissors className="w-4 h-4 text-[var(--primary)]" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Servicios más pedidos
              </span>
            </div>
            {informe.porServicio.map((s: any) => (
              <div key={s.id} className="px-4 py-3 border-b border-slate-50 dark:border-neutral-800/50 last:border-0 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {s.nombre}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {s.promedioMin} min · {s.horas}h en total
                    {s.canceladas > 0 && ` · ${s.canceladas} cancelada${s.canceladas === 1 ? '' : 's'}`}
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums shrink-0 ml-2">
                  {s.citas}
                </span>
              </div>
            ))}
          </Tarjeta>
        )}

        {!cargando && !informe?.total && (
          <Tarjeta className="p-8 text-center">
            <CalendarClock className="w-10 h-10 mx-auto text-slate-300 dark:text-neutral-600 mb-2" />
            <p className="text-xs text-slate-400">
              Sin citas en este período.
            </p>
          </Tarjeta>
        )}

        <div className="p-3 rounded-2xl bg-slate-100/60 dark:bg-neutral-900/60 mb-4">
          <p className="text-[10px] text-slate-400 leading-relaxed flex items-start gap-1.5">
            <TrendingUp className="w-3 h-3 mt-0.5 shrink-0" />
            Este informe cuenta por día de <strong>cita</strong>. El dinero se
            cuenta por día de <strong>cobro</strong> y vive en Ganancias — por eso
            los dos números no tienen por qué coincidir en un mismo día.
          </p>
        </div>
      </PageContent>
    </div>
  );
};
