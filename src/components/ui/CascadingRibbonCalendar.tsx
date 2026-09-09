import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarRange,
  Clock,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ChevronRight as BreadcrumbArrow,
} from 'lucide-react';

export type CalendarGranularity = 'years' | 'months' | 'weeks' | 'days';

export interface MonthWeek {
  index: number;
  weekNumInMonth: number;
  label: string;
  startDate: Date;
  endDate: Date;
  rangeLabel: string;
  isCurrentWeek: boolean;
}

export interface CalendarEventBase {
  id: string;
  date: string; // 'YYYY-MM-DD'
  [key: string]: any;
}

export interface CascadingRibbonCalendarProps<T extends CalendarEventBase = CalendarEventBase> {
  events?: T[];
  initialDate?: Date;
  initialGranularity?: CalendarGranularity;
  onSelectDate?: (date: Date, dateStr: string) => void;
  onGranularityChange?: (granularity: CalendarGranularity) => void;
  onRangeChange?: (info: {
    granularity: CalendarGranularity;
    year: number;
    monthIndex: number;
    week?: MonthWeek;
    date: Date;
    dateStr: string;
  }) => void;
  children?: (props: {
    granularity: CalendarGranularity;
    selectedDate: Date;
    selectedDateStr: string;
    currentYear: number;
    currentMonthIndex: number;
    activeWeek?: MonthWeek;
    filteredEvents: T[];
  }) => React.ReactNode;
}

export const CascadingRibbonCalendar = <T extends CalendarEventBase>({
  events = [],
  initialDate,
  initialGranularity = 'days',
  onSelectDate,
  onGranularityChange,
  onRangeChange,
  children,
}: CascadingRibbonCalendarProps<T>) => {
  const today = useMemo(() => new Date(), []);
  const scrollRibbonRef = useRef<HTMLDivElement>(null);

  const [currentYear, setCurrentYear] = useState<number>(() => (initialDate || today).getFullYear());
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(() => (initialDate || today).getMonth());
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<Date>(() => initialDate || today);
  const [granularity, setGranularity] = useState<CalendarGranularity>(initialGranularity);

  const selectedDateStr = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [selectedDate]);

  const monthNames = useMemo(
    () => ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
    []
  );

  const yearsList = useMemo(() => {
    const base = today.getFullYear();
    return [base - 2, base - 1, base, base + 1, base + 2];
  }, [today]);

  const monthsList = useMemo(() =>
    monthNames.map((name, idx) => ({
      index: idx,
      name,
      shortName: name.slice(0, 3).toUpperCase(),
      isCurrent: today.getFullYear() === currentYear && today.getMonth() === idx,
    })),
    [currentYear, today, monthNames]
  );

  const weeksForCurrentMonth = useMemo<MonthWeek[]>(() => {
    const totalDaysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
    const weeks: MonthWeek[] = [];
    let currentDayNum = 1;
    let weekIdx = 0;

    while (currentDayNum <= totalDaysInMonth) {
      const wStartDate = new Date(currentYear, currentMonthIndex, currentDayNum);
      const dayOfWeek = wStartDate.getDay();
      const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      const endDayNum = Math.min(totalDaysInMonth, currentDayNum + daysUntilSunday);
      const wEndDate = new Date(currentYear, currentMonthIndex, endDayNum);

      const isCurrent =
        today.getFullYear() === currentYear &&
        today.getMonth() === currentMonthIndex &&
        today.getDate() >= currentDayNum &&
        today.getDate() <= endDayNum;

      const mShort = wStartDate.toLocaleDateString('es-ES', { month: 'short' });
      weeks.push({
        index: weekIdx,
        weekNumInMonth: weekIdx + 1,
        label: isCurrent ? 'ESTA SEM' : `SEM ${weekIdx + 1}`,
        startDate: wStartDate,
        endDate: wEndDate,
        rangeLabel: `${currentDayNum} – ${endDayNum} ${mShort}`,
        isCurrentWeek: isCurrent,
      });
      currentDayNum = endDayNum + 1;
      weekIdx++;
    }
    return weeks;
  }, [currentYear, currentMonthIndex, today]);

  const activeWeekObj = weeksForCurrentMonth[selectedWeekIndex] || weeksForCurrentMonth[0];

  useEffect(() => {
    if (selectedWeekIndex >= weeksForCurrentMonth.length) setSelectedWeekIndex(0);
  }, [weeksForCurrentMonth, selectedWeekIndex]);

  const daysForCurrentMonth = useMemo(() => {
    const totalDays = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
    return Array.from({ length: totalDays }, (_, i) => {
      const d = i + 1;
      const dObj = new Date(currentYear, currentMonthIndex, d);
      const y = dObj.getFullYear();
      const mo = String(dObj.getMonth() + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dStr = `${y}-${mo}-${dd}`;
      const weekday = dObj.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase();
      const isToday =
        today.getFullYear() === currentYear &&
        today.getMonth() === currentMonthIndex &&
        today.getDate() === d;
      const wkIdx = weeksForCurrentMonth.findIndex(w => d >= w.startDate.getDate() && d <= w.endDate.getDate());
      const safeWkIdx = wkIdx !== -1 ? wkIdx : 0;
      return {
        dayNum: d,
        date: dObj,
        dateStr: dStr,
        weekday: isToday ? 'HOY' : weekday,
        isToday,
        weekIndex: safeWkIdx,
        isInSelectedWeek: safeWkIdx === selectedWeekIndex,
      };
    });
  }, [currentYear, currentMonthIndex, today, weeksForCurrentMonth, selectedWeekIndex]);

  const eventCountByDate = useMemo(() => {
    const map: Record<string, number> = {};
    events.forEach(e => { map[e.date] = (map[e.date] || 0) + 1; });
    return map;
  }, [events]);

  // Auto-scroll selected item into center
  useEffect(() => {
    if (!scrollRibbonRef.current) return;
    if (granularity === 'days') {
      const el =
        (scrollRibbonRef.current.querySelector('[data-selected-day="true"]') as HTMLElement) ||
        (scrollRibbonRef.current.querySelector('[data-in-active-week="true"]') as HTMLElement);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    } else {
      const el = scrollRibbonRef.current.querySelector('[data-selected="true"]') as HTMLElement;
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [granularity, selectedDateStr, selectedWeekIndex, currentMonthIndex, currentYear]);

  const scrollRibbon = (direction: 'left' | 'right') => {
    scrollRibbonRef.current?.scrollBy({ left: direction === 'left' ? -240 : 240, behavior: 'smooth' });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (scrollRibbonRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      scrollRibbonRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonthIndex(now.getMonth());
    setSelectedDate(now);
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    let dayNum = 1; let wIdx = 0;
    while (dayNum <= totalDays) {
      const wStart = new Date(now.getFullYear(), now.getMonth(), dayNum);
      const dow = wStart.getDay();
      const end = Math.min(totalDays, dayNum + (dow === 0 ? 0 : 7 - dow));
      if (now.getDate() >= dayNum && now.getDate() <= end) { setSelectedWeekIndex(wIdx); break; }
      dayNum = end + 1; wIdx++;
    }
    setGranularity('days');
    onGranularityChange?.('days');
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    onSelectDate?.(now, `${y}-${m}-${d}`);
  };

  const handleSelectYear = (yr: number) => {
    setCurrentYear(yr);
    setGranularity('months');
    onGranularityChange?.('months');
  };

  const handleSelectMonth = (monthIdx: number) => {
    setCurrentMonthIndex(monthIdx);
    let targetWeekIdx = 0;
    if (today.getFullYear() === currentYear && today.getMonth() === monthIdx) {
      const idx = weeksForCurrentMonth.findIndex(w => w.isCurrentWeek);
      if (idx !== -1) targetWeekIdx = idx;
    }
    setSelectedWeekIndex(targetWeekIdx);
    setGranularity('weeks');
    onGranularityChange?.('weeks');
  };

  const handleSelectWeek = (wkIdx: number) => {
    setSelectedWeekIndex(wkIdx);
    const chosenWeek = weeksForCurrentMonth[wkIdx];
    if (chosenWeek) {
      const inWeek = today >= chosenWeek.startDate && today <= chosenWeek.endDate &&
        today.getFullYear() === currentYear && today.getMonth() === currentMonthIndex;
      setSelectedDate(inWeek ? today : chosenWeek.startDate);
    }
    setGranularity('days');
    onGranularityChange?.('days');
  };

  const handleSelectDay = (day: { date: Date; dateStr: string; weekIndex: number }) => {
    setSelectedDate(day.date);
    setSelectedWeekIndex(day.weekIndex);
    onSelectDate?.(day.date, day.dateStr);
  };

  useEffect(() => {
    onRangeChange?.({ granularity, year: currentYear, monthIndex: currentMonthIndex, week: activeWeekObj, date: selectedDate, dateStr: selectedDateStr });
  }, [granularity, currentYear, currentMonthIndex, activeWeekObj, selectedDate, selectedDateStr, onRangeChange]);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const eDate = new Date(`${e.date}T00:00:00`);
      if (granularity === 'days') return e.date === selectedDateStr;
      if (granularity === 'weeks') return activeWeekObj ? eDate >= activeWeekObj.startDate && eDate <= activeWeekObj.endDate : false;
      if (granularity === 'months') return eDate.getFullYear() === currentYear && eDate.getMonth() === currentMonthIndex;
      return eDate.getFullYear() === currentYear;
    });
  }, [events, granularity, selectedDateStr, activeWeekObj, currentYear, currentMonthIndex]);

  const ACT = 'bg-[var(--primary)] text-white shadow-xs font-bold scale-[1.02]';
  const IDLE = 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800';
  const BADGE_ACT = 'bg-white/20 text-white';
  const BADGE_IDL = 'bg-[var(--primary)]/10 text-[var(--primary)]';

  return (
    <div className="w-full space-y-2 select-none">

      {/* Breadcrumb + Hoy button */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1 text-xs py-1 px-2.5 rounded-2xl bg-slate-100 dark:bg-neutral-800/90 border border-slate-200/80 dark:border-neutral-700/60 shadow-2xs min-w-0 overflow-x-auto hide-scrollbar">
          {[
            { level: 'years' as CalendarGranularity, label: String(currentYear) },
            { level: 'months' as CalendarGranularity, label: monthNames[currentMonthIndex] },
            { level: 'weeks' as CalendarGranularity, label: activeWeekObj?.label || `Sem ${selectedWeekIndex + 1}` },
            { level: 'days' as CalendarGranularity, label: selectedDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }) },
          ].map((crumb, i, arr) => (
            <React.Fragment key={crumb.level}>
              <button
                type="button"
                onClick={() => { setGranularity(crumb.level); onGranularityChange?.(crumb.level); }}
                className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                  granularity === crumb.level ? 'bg-[var(--primary)] text-white shadow-xs' : 'text-slate-600 dark:text-neutral-300 hover:text-[var(--primary)]'
                }`}
              >
                {crumb.label}
              </button>
              {i < arr.length - 1 && <BreadcrumbArrow className="w-3 h-3 text-slate-400 shrink-0" />}
            </React.Fragment>
          ))}
        </div>
        <button
          type="button"
          onClick={handleJumpToToday}
          className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 text-xs font-extrabold text-[var(--primary)] shadow-2xs hover:bg-slate-50 dark:hover:bg-neutral-800 transition cursor-pointer shrink-0"
        >
          Hoy
        </button>
      </div>

      {/* Granularity tabs */}
      <div className="grid grid-cols-4 w-full p-1 rounded-2xl bg-slate-100 dark:bg-neutral-800/90 border border-slate-200/80 dark:border-neutral-700/60 shadow-2xs">
        {([
          { id: 'days', label: 'Días', Icon: CalendarIcon },
          { id: 'weeks', label: 'Semanas', Icon: CalendarRange },
          { id: 'months', label: 'Meses', Icon: CalendarDays },
          { id: 'years', label: 'Años', Icon: Clock },
        ] as const).map(({ id, label, Icon }) => {
          const isActive = granularity === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => { setGranularity(id); onGranularityChange?.(id); }}
              className={`py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer ${
                isActive ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-xs font-bold' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[var(--primary)]' : 'opacity-60'}`} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Scrollable ribbon */}
      <div className="relative">
        <button
          type="button"
          onClick={() => scrollRibbon('left')}
          className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 shadow-md flex items-center justify-center text-slate-500 hover:scale-110 transition cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => scrollRibbon('right')}
          className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 shadow-md flex items-center justify-center text-slate-500 hover:scale-110 transition cursor-pointer"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <div
          ref={scrollRibbonRef}
          onWheel={handleWheel}
          className="p-1 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs overflow-x-auto hide-scrollbar scroll-smooth flex items-center gap-1.5"
        >
          {/* AÑOS */}
          {granularity === 'years' && yearsList.map(yr => {
            const isSel = currentYear === yr;
            const count = events.filter(e => new Date(`${e.date}T00:00:00`).getFullYear() === yr).length;
            return (
              <button key={yr} type="button" data-selected={isSel || undefined}
                onClick={() => handleSelectYear(yr)}
                className={`min-w-[88px] py-2 px-2 rounded-xl flex flex-col items-center justify-center transition shrink-0 cursor-pointer ${isSel ? ACT : IDLE}`}
              >
                <span className="text-[9px] uppercase font-semibold opacity-80">{yr === today.getFullYear() ? 'ACTUAL' : 'AÑO'}</span>
                <span className="text-sm font-extrabold mt-0.5">{yr}</span>
                <span className={`text-[9px] px-1.5 rounded-full font-bold mt-1 ${isSel ? BADGE_ACT : BADGE_IDL}`}>{count} citas</span>
                <span className="text-[8px] opacity-60 mt-0.5 flex items-center gap-0.5">Ver Meses <ArrowRight className="w-2 h-2" /></span>
              </button>
            );
          })}

          {/* MESES */}
          {granularity === 'months' && monthsList.map(mo => {
            const isSel = currentMonthIndex === mo.index;
            const count = events.filter(e => {
              const d = new Date(`${e.date}T00:00:00`);
              return d.getFullYear() === currentYear && d.getMonth() === mo.index;
            }).length;
            return (
              <button key={mo.index} type="button" data-selected={isSel || undefined}
                onClick={() => handleSelectMonth(mo.index)}
                className={`min-w-[78px] py-2 px-2 rounded-xl flex flex-col items-center justify-center transition shrink-0 cursor-pointer ${isSel ? ACT : mo.isCurrent ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200/60' : IDLE}`}
              >
                <span className="text-[9px] uppercase font-semibold opacity-80">{currentYear}</span>
                <span className="text-sm font-extrabold mt-0.5">{mo.shortName}</span>
                <span className={`text-[9px] px-1.5 rounded-full font-bold mt-1 ${isSel ? BADGE_ACT : BADGE_IDL}`}>{count} citas</span>
                <span className="text-[8px] opacity-60 mt-0.5 flex items-center gap-0.5">Semanas <ArrowRight className="w-2 h-2" /></span>
              </button>
            );
          })}

          {/* SEMANAS */}
          {granularity === 'weeks' && weeksForCurrentMonth.map((wk, idx) => {
            const isSel = selectedWeekIndex === idx;
            const count = events.filter(e => {
              const d = new Date(`${e.date}T00:00:00`);
              return d >= wk.startDate && d <= wk.endDate;
            }).length;
            return (
              <button key={wk.index} type="button" data-selected={isSel || undefined}
                onClick={() => handleSelectWeek(idx)}
                className={`min-w-[100px] py-2 px-2 rounded-xl flex flex-col items-center justify-center transition shrink-0 cursor-pointer ${isSel ? ACT : wk.isCurrentWeek ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200/60' : IDLE}`}
              >
                <span className="text-[9px] uppercase font-semibold opacity-80">{wk.label}</span>
                <span className="text-xs font-extrabold mt-0.5 whitespace-nowrap">{wk.rangeLabel}</span>
                <span className={`text-[9px] px-1.5 rounded-full font-bold mt-1 ${isSel ? BADGE_ACT : BADGE_IDL}`}>{count} citas</span>
                <span className="text-[8px] opacity-60 mt-0.5 flex items-center gap-0.5">Ver Días <ArrowRight className="w-2 h-2" /></span>
              </button>
            );
          })}

          {/* DÍAS */}
          {granularity === 'days' && daysForCurrentMonth.map(day => {
            const isSel = selectedDateStr === day.dateStr;
            const inWeek = day.isInSelectedWeek;
            const count = eventCountByDate[day.dateStr] || 0;
            return (
              <button key={day.dateStr} type="button"
                data-selected-day={isSel || undefined}
                data-in-active-week={inWeek || undefined}
                onClick={() => handleSelectDay(day)}
                className={`min-w-[58px] h-[56px] px-1 rounded-xl flex flex-col items-center justify-center transition shrink-0 cursor-pointer ${
                  isSel
                    ? `${ACT} ring-2 ring-[var(--primary)] ring-offset-1 dark:ring-offset-neutral-900`
                    : inWeek
                    ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-semibold border border-[var(--primary)]/25'
                    : IDLE
                }`}
              >
                <span className="text-[9px] uppercase font-semibold opacity-85 leading-none">{day.weekday}</span>
                <span className="text-sm font-extrabold mt-0.5 leading-none">{day.dayNum}</span>
                {count > 0 && (
                  <span className={`w-1.5 h-1.5 rounded-full mt-1 ${isSel ? 'bg-white' : 'bg-[var(--primary)]'}`} />
                )}
              </button>
            );
          })}

        </div>
      </div>

      {children?.({ granularity, selectedDate, selectedDateStr, currentYear, currentMonthIndex, activeWeek: activeWeekObj, filteredEvents })}
    </div>
  );
};
