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
  date: string; // Format: 'YYYY-MM-DD'
  [key: string]: any;
}

export interface CascadingRibbonCalendarProps<T extends CalendarEventBase = CalendarEventBase> {
  /** Array of events/appointments with at least `id` and `date` in 'YYYY-MM-DD' format */
  events?: T[];
  /** Optional initial date. Defaults to today */
  initialDate?: Date;
  /** Optional initial granularity view. Defaults to 'days' */
  initialGranularity?: CalendarGranularity;
  /** Primary accent color class (defaults to blue-600 or CSS var(--primary)) */
  accentColorClass?: string;
  /** Callback when the selected day changes */
  onSelectDate?: (date: Date, dateStr: string) => void;
  /** Callback when granularity changes */
  onGranularityChange?: (granularity: CalendarGranularity) => void;
  /** Callback when active range changes (useful to fetch data dynamically from API) */
  onRangeChange?: (info: {
    granularity: CalendarGranularity;
    year: number;
    monthIndex: number;
    week?: MonthWeek;
    date: Date;
    dateStr: string;
  }) => void;
  /** Custom render prop for the event list or container below the ribbon */
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

  // Active Hierarchy State: Año -> Mes -> Semana -> Día
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

  // Spanish Month Names
  const monthNames = useMemo(
    () => [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ],
    []
  );

  // Available Years List (e.g. 5 years window around current)
  const yearsList = useMemo(() => {
    const base = today.getFullYear();
    return [base - 2, base - 1, base, base + 1, base + 2];
  }, [today]);

  // Available Months List for currentYear
  const monthsList = useMemo(() => {
    return monthNames.map((name, idx) => ({
      index: idx,
      name,
      shortName: name.slice(0, 3).toUpperCase(),
      monthNum: String(idx + 1).padStart(2, '0'),
      isCurrent: today.getFullYear() === currentYear && today.getMonth() === idx,
    }));
  }, [currentYear, today, monthNames]);

  // Calculate weeks of currentYear & currentMonthIndex
  // STRICTLY BOUNDED to the month (no spilling into neighboring months)
  const weeksForCurrentMonth = useMemo<MonthWeek[]>(() => {
    const totalDaysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
    const weeks: MonthWeek[] = [];

    let currentDayNum = 1;
    let weekIdx = 0;

    while (currentDayNum <= totalDaysInMonth) {
      const wStartDate = new Date(currentYear, currentMonthIndex, currentDayNum);
      const dayOfWeek = wStartDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      
      // Calculate days until Sunday (end of week segment)
      const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      const endDayNum = Math.min(totalDaysInMonth, currentDayNum + daysUntilSunday);
      const wEndDate = new Date(currentYear, currentMonthIndex, endDayNum);

      const isCurrent =
        today.getFullYear() === currentYear &&
        today.getMonth() === currentMonthIndex &&
        today.getDate() >= currentDayNum &&
        today.getDate() <= endDayNum;

      const mShort = wStartDate.toLocaleDateString('es-ES', { month: 'short' });
      const rangeLabel = `${currentDayNum} - ${endDayNum} ${mShort}`;

      weeks.push({
        index: weekIdx,
        weekNumInMonth: weekIdx + 1,
        label: isCurrent ? 'ESTA SEM' : `SEM ${weekIdx + 1}`,
        startDate: wStartDate,
        endDate: wEndDate,
        rangeLabel,
        isCurrentWeek: isCurrent,
      });

      currentDayNum = endDayNum + 1;
      weekIdx++;
    }

    return weeks;
  }, [currentYear, currentMonthIndex, today]);

  // Active week object
  const activeWeekObj = weeksForCurrentMonth[selectedWeekIndex] || weeksForCurrentMonth[0];

  // Adjust week index if month has fewer weeks
  useEffect(() => {
    if (selectedWeekIndex >= weeksForCurrentMonth.length) {
      setSelectedWeekIndex(0);
    }
  }, [weeksForCurrentMonth, selectedWeekIndex]);

  // Days list for currentYear & currentMonthIndex (1 to 28..31)
  const daysForCurrentMonth = useMemo(() => {
    const totalDays = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
    const days: {
      dayNum: number;
      date: Date;
      dateStr: string;
      weekday: string;
      isToday: boolean;
      weekIndex: number;
      isInSelectedWeek: boolean;
    }[] = [];

    for (let d = 1; d <= totalDays; d++) {
      const dObj = new Date(currentYear, currentMonthIndex, d);
      const y = dObj.getFullYear();
      const m = String(dObj.getMonth() + 1).padStart(2, '0');
      const dayFormatted = String(d).padStart(2, '0');
      const dStr = `${y}-${m}-${dayFormatted}`;
      const weekday = dObj.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase();
      const isToday =
        today.getFullYear() === currentYear &&
        today.getMonth() === currentMonthIndex &&
        today.getDate() === d;

      // Find week index in weeksForCurrentMonth
      const wkIdx = weeksForCurrentMonth.findIndex(
        w => d >= w.startDate.getDate() && d <= w.endDate.getDate()
      );
      const safeWkIdx = wkIdx !== -1 ? wkIdx : 0;

      days.push({
        dayNum: d,
        date: dObj,
        dateStr: dStr,
        weekday: isToday ? 'HOY' : weekday,
        isToday,
        weekIndex: safeWkIdx,
        isInSelectedWeek: safeWkIdx === selectedWeekIndex,
      });
    }

    return days;
  }, [currentYear, currentMonthIndex, today, weeksForCurrentMonth, selectedWeekIndex]);

  // Count events mapped by date string
  const eventCountByDate = useMemo(() => {
    const map: Record<string, number> = {};
    events.forEach(e => {
      map[e.date] = (map[e.date] || 0) + 1;
    });
    return map;
  }, [events]);

  // Auto-scroll ribbon to active item whenever selection or granularity changes
  useEffect(() => {
    if (scrollRibbonRef.current) {
      if (granularity === 'days') {
        const selectedDayEl = scrollRibbonRef.current.querySelector('[data-selected-day="true"]') as HTMLElement;
        const weekFirstEl = scrollRibbonRef.current.querySelector('[data-in-active-week="true"]') as HTMLElement;
        const targetEl = selectedDayEl || weekFirstEl;
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      } else {
        const activeEl = scrollRibbonRef.current.querySelector('[data-selected="true"]') as HTMLElement;
        if (activeEl) {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    }
  }, [granularity, selectedDateStr, selectedWeekIndex, currentMonthIndex, currentYear]);

  // Horizontal scroll buttons
  const scrollRibbon = (direction: 'left' | 'right') => {
    if (scrollRibbonRef.current) {
      const scrollAmount = 240;
      scrollRibbonRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // Horizontal mouse-wheel support
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (scrollRibbonRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      scrollRibbonRef.current.scrollLeft += e.deltaY;
    }
  };

  // Jump to today
  const handleJumpToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonthIndex(now.getMonth());
    setSelectedDate(now);

    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    let currentDayNum = 1;
    let wIdx = 0;
    while (currentDayNum <= totalDays) {
      const wStart = new Date(now.getFullYear(), now.getMonth(), currentDayNum);
      const dayOfWeek = wStart.getDay();
      const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      const endDayNum = Math.min(totalDays, currentDayNum + daysUntilSunday);
      if (now.getDate() >= currentDayNum && now.getDate() <= endDayNum) {
        setSelectedWeekIndex(wIdx);
        break;
      }
      currentDayNum = endDayNum + 1;
      wIdx++;
    }

    setGranularity('days');
    onGranularityChange?.('days');
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    onSelectDate?.(now, `${y}-${m}-${d}`);
  };

  // ==========================================
  // DRILL-DOWN CASCADES
  // ==========================================

  // 1. Year click -> cascades to Months
  const handleSelectYear = (yr: number) => {
    setCurrentYear(yr);
    setGranularity('months');
    onGranularityChange?.('months');
  };

  // 2. Month click -> cascades to Weeks
  const handleSelectMonth = (monthIdx: number) => {
    setCurrentMonthIndex(monthIdx);
    let targetWeekIdx = 0;
    if (today.getFullYear() === currentYear && today.getMonth() === monthIdx) {
      const foundIdx = weeksForCurrentMonth.findIndex(w => w.isCurrentWeek);
      if (foundIdx !== -1) targetWeekIdx = foundIdx;
    }
    setSelectedWeekIndex(targetWeekIdx);
    setGranularity('weeks');
    onGranularityChange?.('weeks');
  };

  // 3. Week click -> cascades to Days (centered)
  const handleSelectWeek = (wkIdx: number) => {
    setSelectedWeekIndex(wkIdx);
    const chosenWeek = weeksForCurrentMonth[wkIdx];
    if (chosenWeek) {
      if (
        today.getFullYear() === currentYear &&
        today.getMonth() === currentMonthIndex &&
        today >= chosenWeek.startDate &&
        today <= chosenWeek.endDate
      ) {
        setSelectedDate(today);
      } else {
        setSelectedDate(chosenWeek.startDate);
      }
    }
    setGranularity('days');
    onGranularityChange?.('days');
  };

  // 4. Day click -> selects date and notifies listener
  const handleSelectDay = (day: { date: Date; dateStr: string; weekIndex: number }) => {
    setSelectedDate(day.date);
    setSelectedWeekIndex(day.weekIndex);
    onSelectDate?.(day.date, day.dateStr);
  };

  // Notify range changes whenever relevant states change
  useEffect(() => {
    onRangeChange?.({
      granularity,
      year: currentYear,
      monthIndex: currentMonthIndex,
      week: activeWeekObj,
      date: selectedDate,
      dateStr: selectedDateStr,
    });
  }, [granularity, currentYear, currentMonthIndex, activeWeekObj, selectedDate, selectedDateStr, onRangeChange]);

  // Filter events according to active granularity
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const eDate = new Date(`${e.date}T00:00:00`);
      if (granularity === 'days') {
        return e.date === selectedDateStr;
      } else if (granularity === 'weeks') {
        if (!activeWeekObj) return false;
        return eDate >= activeWeekObj.startDate && eDate <= activeWeekObj.endDate;
      } else if (granularity === 'months') {
        return eDate.getFullYear() === currentYear && eDate.getMonth() === currentMonthIndex;
      } else if (granularity === 'years') {
        return eDate.getFullYear() === currentYear;
      }
      return true;
    });
  }, [events, granularity, selectedDateStr, activeWeekObj, currentYear, currentMonthIndex]);

  return (
    <div className="w-full space-y-2.5 select-none">
      {/* 1. INTERACTIVE BREADCRUMB TRAIL (AÑO > MES > SEMANA > DÍA) */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto hide-scrollbar">
        <div className="flex items-center gap-1 text-xs py-1 px-2.5 rounded-2xl bg-slate-100 dark:bg-neutral-800/90 border border-slate-200/80 dark:border-neutral-700/60 shadow-2xs shrink-0 max-w-full">
          {/* Level 1: Año */}
          <button
            type="button"
            onClick={() => {
              setGranularity('years');
              onGranularityChange?.('years');
            }}
            className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${
              granularity === 'years'
                ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-neutral-300 hover:text-blue-600'
            }`}
          >
            {currentYear}
          </button>

          <BreadcrumbArrow className="w-3 h-3 text-slate-400 shrink-0" />

          {/* Level 2: Mes */}
          <button
            type="button"
            onClick={() => {
              setGranularity('months');
              onGranularityChange?.('months');
            }}
            className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${
              granularity === 'months'
                ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-neutral-300 hover:text-blue-600'
            }`}
          >
            {monthNames[currentMonthIndex]}
          </button>

          <BreadcrumbArrow className="w-3 h-3 text-slate-400 shrink-0" />

          {/* Level 3: Semana */}
          <button
            type="button"
            onClick={() => {
              setGranularity('weeks');
              onGranularityChange?.('weeks');
            }}
            className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
              granularity === 'weeks'
                ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-neutral-300 hover:text-blue-600'
            }`}
          >
            {activeWeekObj?.label || `Sem ${selectedWeekIndex + 1}`}
          </button>

          <BreadcrumbArrow className="w-3 h-3 text-slate-400 shrink-0" />

          {/* Level 4: Día */}
          <button
            type="button"
            onClick={() => {
              setGranularity('days');
              onGranularityChange?.('days');
            }}
            className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
              granularity === 'days'
                ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-neutral-300 hover:text-blue-600'
            }`}
          >
            {selectedDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}
          </button>
        </div>

        {/* Hoy Action Button */}
        <button
          type="button"
          onClick={handleJumpToToday}
          className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 text-xs font-extrabold text-blue-600 dark:text-blue-400 shadow-2xs hover:bg-slate-50 dark:hover:bg-neutral-800 transition cursor-pointer flex items-center gap-1 shrink-0"
        >
          <span>Hoy</span>
        </button>
      </div>

      {/* 2. GRANULARITY LEVEL SWITCHER [ Días | Semanas | Meses | Años ] */}
      <div className="grid grid-cols-4 w-full p-1 rounded-2xl bg-slate-100 dark:bg-neutral-800/90 border border-slate-200/80 dark:border-neutral-700/60 shadow-2xs">
        {(
          [
            { id: 'days', label: 'Días', icon: CalendarIcon },
            { id: 'weeks', label: 'Semanas', icon: CalendarRange },
            { id: 'months', label: 'Meses', icon: CalendarDays },
            { id: 'years', label: 'Años', icon: Clock },
          ] as const
        ).map(tab => {
          const isActive = granularity === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setGranularity(tab.id);
                onGranularityChange?.(tab.id);
              }}
              className={`py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'opacity-70'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. HORIZONTAL SCROLLABLE CARD RIBBON WITH DRILLDOWN */}
      <div className="relative group">
        {/* Left Scroll Chevron */}
        <button
          type="button"
          onClick={() => scrollRibbon('left')}
          className="absolute -left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/95 dark:bg-neutral-800/95 border border-slate-200 dark:border-neutral-700 shadow-md flex items-center justify-center text-slate-600 dark:text-neutral-300 hover:scale-110 transition cursor-pointer opacity-80 hover:opacity-100"
          title="Desplazar a la izquierda"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Right Scroll Chevron */}
        <button
          type="button"
          onClick={() => scrollRibbon('right')}
          className="absolute -right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/95 dark:bg-neutral-800/95 border border-slate-200 dark:border-neutral-700 shadow-md flex items-center justify-center text-slate-600 dark:text-neutral-300 hover:scale-110 transition cursor-pointer opacity-80 hover:opacity-100"
          title="Desplazar a la derecha"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Horizontal Strip */}
        <div
          ref={scrollRibbonRef}
          onWheel={handleWheel}
          className="p-1 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs overflow-x-auto hide-scrollbar scroll-smooth flex items-center gap-1.5 select-none"
        >
          {/* LEVEL: AÑOS */}
          {granularity === 'years' &&
            yearsList.map(yr => {
              const isSelected = currentYear === yr;
              const yearEventsCount = events.filter(e => {
                const d = new Date(`${e.date}T00:00:00`);
                return d.getFullYear() === yr;
              }).length;

              return (
                <button
                  key={yr}
                  type="button"
                  data-selected={isSelected}
                  onClick={() => handleSelectYear(yr)}
                  className={`min-w-[95px] sm:min-w-[110px] py-2 px-2 rounded-xl flex flex-col items-center justify-center transition shrink-0 cursor-pointer relative ${
                    isSelected
                      ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-xs font-bold scale-[1.02]'
                      : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span className="text-[10px] uppercase font-semibold opacity-85">
                    {yr === today.getFullYear() ? 'ACTUAL' : 'AÑO'}
                  </span>
                  <span className="text-sm font-extrabold mt-0.5">{yr}</span>

                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold mt-1 ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-blue-600/10 text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {yearEventsCount} eventos
                  </span>

                  <span className="text-[8px] opacity-70 mt-0.5 flex items-center gap-0.5">
                    Ver Meses <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </button>
              );
            })}

          {/* LEVEL: MESES */}
          {granularity === 'months' &&
            monthsList.map(mo => {
              const isSelected = currentMonthIndex === mo.index;
              const monthEventsCount = events.filter(e => {
                const d = new Date(`${e.date}T00:00:00`);
                return d.getFullYear() === currentYear && d.getMonth() === mo.index;
              }).length;

              return (
                <button
                  key={mo.index}
                  type="button"
                  data-selected={isSelected}
                  onClick={() => handleSelectMonth(mo.index)}
                  className={`min-w-[84px] sm:min-w-[95px] py-2 px-2 rounded-xl flex flex-col items-center justify-center transition shrink-0 cursor-pointer relative ${
                    isSelected
                      ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-xs font-bold scale-[1.02]'
                      : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span className="text-[10px] uppercase font-semibold opacity-85">
                    {currentYear}
                  </span>
                  <span className="text-sm font-extrabold mt-0.5">{mo.shortName}</span>

                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold mt-1 ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-blue-600/10 text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {monthEventsCount} eventos
                  </span>

                  <span className="text-[8px] opacity-70 mt-0.5 flex items-center gap-0.5">
                    Ver Semanas <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </button>
              );
            })}

          {/* LEVEL: SEMANAS */}
          {granularity === 'weeks' &&
            weeksForCurrentMonth.map((wk, idx) => {
              const isSelected = selectedWeekIndex === idx;
              const weekEventsCount = events.filter(e => {
                const d = new Date(`${e.date}T00:00:00`);
                return d >= wk.startDate && d <= wk.endDate;
              }).length;

              return (
                <button
                  key={wk.index}
                  type="button"
                  data-selected={isSelected}
                  onClick={() => handleSelectWeek(idx)}
                  className={`min-w-[105px] sm:min-w-[120px] py-2 px-2.5 rounded-xl flex flex-col items-center justify-center transition shrink-0 cursor-pointer relative ${
                    isSelected
                      ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-xs font-bold scale-[1.02]'
                      : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span className="text-[10px] uppercase font-semibold opacity-85">
                    {wk.label}
                  </span>
                  <span className="text-xs font-extrabold mt-0.5 whitespace-nowrap">
                    {wk.rangeLabel}
                  </span>

                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold mt-1 ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-blue-600/10 text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {weekEventsCount} eventos
                  </span>

                  <span className="text-[8px] opacity-70 mt-0.5 flex items-center gap-0.5">
                    Ver Días <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </button>
              );
            })}

          {/* LEVEL: DÍAS */}
          {granularity === 'days' &&
            daysForCurrentMonth.map(day => {
              const isSelectedDay = selectedDateStr === day.dateStr;
              const isInSelectedWeek = day.isInSelectedWeek;
              const count = eventCountByDate[day.dateStr] || 0;

              return (
                <button
                  key={day.dateStr}
                  type="button"
                  data-selected-day={isSelectedDay}
                  data-in-active-week={isInSelectedWeek}
                  onClick={() => handleSelectDay(day)}
                  className={`min-w-[62px] sm:min-w-[68px] py-2 px-1 rounded-xl flex flex-col items-center justify-center transition shrink-0 cursor-pointer relative ${
                    isSelectedDay
                      ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-xs font-bold scale-[1.04] ring-2 ring-blue-600 dark:ring-blue-400 ring-offset-1 dark:ring-offset-neutral-900'
                      : isInSelectedWeek
                      ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold border border-blue-600/30 hover:bg-blue-600/15'
                      : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {isInSelectedWeek && !isSelectedDay && (
                    <span className="text-[7.5px] uppercase font-black tracking-tighter opacity-80 -mt-1">
                      SEM {day.weekIndex + 1}
                    </span>
                  )}

                  <span className="text-[10px] uppercase font-semibold opacity-85">
                    {day.weekday}
                  </span>
                  <span className="text-sm font-extrabold mt-0.5">{day.dayNum}</span>

                  {count > 0 && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-1 ${
                        isSelectedDay ? 'bg-white' : 'bg-blue-600 dark:bg-blue-400'
                      }`}
                      title={`${count} eventos`}
                    />
                  )}
                </button>
              );
            })}
        </div>
      </div>

      {/* Render children prop if supplied (gives the consumer full UI control) */}
      {children &&
        children({
          granularity,
          selectedDate,
          selectedDateStr,
          currentYear,
          currentMonthIndex,
          activeWeek: activeWeekObj,
          filteredEvents,
        })}
    </div>
  );
};
