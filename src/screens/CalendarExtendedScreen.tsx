import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarRange,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  Bot,
  CheckCircle2,
  Sparkles,
  User,
  Phone,
  ArrowRight,
  Layers,
  ChevronRight as BreadcrumbArrow,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Appointment, AppointmentStatus, CommunicationChannel, ServiceCategory } from '../types';
import { IOSHeader } from '../components/ui/IOSHeader';
import { IOSModal } from '../components/ui/IOSModal';

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

export const CalendarExtendedScreen: React.FC<{ onBackToClassic?: () => void }> = ({ onBackToClassic }) => {
  const {
    appointments,
    addAppointment,
    updateAppointmentStatus,
    services,
    clients,
    navigateTo,
  } = useApp();
  const { currentUser } = useAuth();

  // Active Hierarchy state: Año -> Mes -> Semana -> Día
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => today.toISOString().split('T')[0], [today]);

  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(today.getMonth()); // 0-11
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const selectedDateStr = useMemo(() => selectedDate.toISOString().split('T')[0], [selectedDate]);

  // Granularity mode: 'years' | 'months' | 'weeks' | 'days'
  const [granularity, setGranularity] = useState<CalendarGranularity>('days');

  // Category filter
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | 'all'>('all');

  // Modals
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  const [showNewAptModal, setShowNewAptModal] = useState<boolean>(false);

  // New appointment form state
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newServiceId, setNewServiceId] = useState(services[0]?.id || '');
  const [selectedTierName, setSelectedTierName] = useState<string>('');
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [newTime, setNewTime] = useState('11:00');
  const [newStaff, setNewStaff] = useState('Camila Ríos');
  const [newNotes, setNewNotes] = useState('');
  const [newChannel, setNewChannel] = useState<CommunicationChannel>('whatsapp');

  // Ref for horizontal scroll ribbon
  const scrollRibbonRef = useRef<HTMLDivElement>(null);

  // Month names in Spanish
  const monthNames = useMemo(
    () => [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ],
    []
  );

  // Years list for "years" mode
  const yearsList = useMemo(() => {
    const base = today.getFullYear();
    return [base - 2, base - 1, base, base + 1, base + 2];
  }, [today]);

  // Months list for "months" mode (strictly 12 months of currentYear)
  const monthsList = useMemo(() => {
    return monthNames.map((name, idx) => ({
      index: idx,
      name,
      shortName: name.slice(0, 3).toUpperCase(),
      monthNum: String(idx + 1).padStart(2, '0'),
      isCurrent: today.getFullYear() === currentYear && today.getMonth() === idx,
    }));
  }, [currentYear, today, monthNames]);

  // Calculate weeks of the currently selected month (Monday to Sunday)
  // Strictly bounded to the selected month: no scrolling outside of it!
  const weeksForCurrentMonth = useMemo<MonthWeek[]>(() => {
    const totalDaysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
    const weeks: MonthWeek[] = [];

    let currentDayNum = 1;
    let weekIndex = 0;

    while (currentDayNum <= totalDaysInMonth) {
      const wStartDate = new Date(currentYear, currentMonthIndex, currentDayNum);
      const dayOfWeek = wStartDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      
      // Calculate how many days until Sunday (inclusive)
      const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      const endDayNum = Math.min(totalDaysInMonth, currentDayNum + daysUntilSunday);
      const wEndDate = new Date(currentYear, currentMonthIndex, endDayNum);

      // Check if today falls in this week
      const isCurrent =
        today.getFullYear() === currentYear &&
        today.getMonth() === currentMonthIndex &&
        today.getDate() >= currentDayNum &&
        today.getDate() <= endDayNum;

      const mShort = wStartDate.toLocaleDateString('es-ES', { month: 'short' });
      const rangeLabel = `${currentDayNum} - ${endDayNum} ${mShort}`;

      weeks.push({
        index: weekIndex,
        weekNumInMonth: weekIndex + 1,
        label: isCurrent ? 'ESTA SEM' : `SEM ${weekIndex + 1}`,
        startDate: wStartDate,
        endDate: wEndDate,
        rangeLabel,
        isCurrentWeek: isCurrent,
      });

      currentDayNum = endDayNum + 1;
      weekIndex++;
    }

    return weeks;
  }, [currentYear, currentMonthIndex, today]);

  // Ensure selectedWeekIndex stays valid when month changes
  useEffect(() => {
    if (selectedWeekIndex >= weeksForCurrentMonth.length) {
      setSelectedWeekIndex(0);
    }
  }, [weeksForCurrentMonth, selectedWeekIndex]);

  // Selected week object
  const activeWeekObj = weeksForCurrentMonth[selectedWeekIndex] || weeksForCurrentMonth[0];

  // Days list for the selected month (1 to 28/29/30/31)
  // Includes all days of the month so user can scroll across the month,
  // but days of the chosen week are highlighted and centered!
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
      const dStr = dObj.toISOString().split('T')[0];
      const weekday = dObj.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase();
      const isToday =
        today.getFullYear() === currentYear &&
        today.getMonth() === currentMonthIndex &&
        today.getDate() === d;

      // Find which week of the month this day belongs to
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

  // Count appointments by date string
  const appointmentCountByDate = useMemo(() => {
    const map: Record<string, number> = {};
    appointments.forEach(a => {
      map[a.date] = (map[a.date] || 0) + 1;
    });
    return map;
  }, [appointments]);

  // Helper to auto-scroll ribbon to active target (or centered week)
  useEffect(() => {
    if (scrollRibbonRef.current) {
      if (granularity === 'days') {
        // Find selected day or first day of selected week
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

  // Scroll ribbon helper
  const scrollRibbon = (direction: 'left' | 'right') => {
    if (scrollRibbonRef.current) {
      const scrollAmount = 240;
      scrollRibbonRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (scrollRibbonRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      scrollRibbonRef.current.scrollLeft += e.deltaY;
    }
  };

  // Jump to Today
  const handleJumpToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonthIndex(now.getMonth());
    setSelectedDate(now);

    // Find week index of today
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
  };

  // =========================================================================
  // DRILLDOWN CASCADES:
  // Año -> Mes -> Semanas -> Días (con días de la semana centrados)
  // =========================================================================

  // 1. Click on Year -> Cascades to Meses of that year
  const handleSelectYear = (yr: number) => {
    setCurrentYear(yr);
    setGranularity('months');
  };

  // 2. Click on Month -> Cascades to Semanas of that month
  const handleSelectMonth = (monthIdx: number) => {
    setCurrentMonthIndex(monthIdx);
    // If selecting current month, default to week containing today; otherwise week 0
    let targetWeekIdx = 0;
    if (today.getFullYear() === currentYear && today.getMonth() === monthIdx) {
      const foundIdx = weeksForCurrentMonth.findIndex(w => w.isCurrentWeek);
      if (foundIdx !== -1) targetWeekIdx = foundIdx;
    }
    setSelectedWeekIndex(targetWeekIdx);
    setGranularity('weeks');
  };

  // 3. Click on Week -> Cascades to Días of that week/month
  const handleSelectWeek = (wkIdx: number) => {
    setSelectedWeekIndex(wkIdx);
    const chosenWeek = weeksForCurrentMonth[wkIdx];
    if (chosenWeek) {
      // If today falls in this week, select today, otherwise select startDate of this week
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
  };

  // 4. Click on Day -> Selects specific day and filters appointments
  const handleSelectDay = (day: { date: Date; weekIndex: number }) => {
    setSelectedDate(day.date);
    setSelectedWeekIndex(day.weekIndex);
  };

  // Filter appointments according to granularity and selection
  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      const matchesCategory = selectedCategory === 'all' || apt.serviceCategory === selectedCategory;
      if (!matchesCategory) return false;

      const aptDate = new Date(`${apt.date}T00:00:00`);

      if (granularity === 'days') {
        // Filter strictly to the selected day
        return apt.date === selectedDateStr;
      } else if (granularity === 'weeks') {
        // Filter strictly to the selected week of the month
        if (!activeWeekObj) return false;
        return aptDate >= activeWeekObj.startDate && aptDate <= activeWeekObj.endDate;
      } else if (granularity === 'months') {
        // Filter to the selected month of currentYear
        return aptDate.getFullYear() === currentYear && aptDate.getMonth() === currentMonthIndex;
      } else if (granularity === 'years') {
        // Filter to currentYear
        return aptDate.getFullYear() === currentYear;
      }
      return true;
    });
  }, [
    appointments,
    selectedCategory,
    granularity,
    selectedDateStr,
    activeWeekObj,
    currentYear,
    currentMonthIndex,
  ]);

  // Appointments grouped by day (for weeks, months, years)
  const appointmentsGroupedByDay = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    filteredAppointments.forEach(apt => {
      if (!map[apt.date]) map[apt.date] = [];
      map[apt.date].push(apt);
    });
    return map;
  }, [filteredAppointments]);

  // Total appointments count in active week
  const activeWeekTotalApts = useMemo(() => {
    if (!activeWeekObj) return 0;
    return appointments.filter(a => {
      const d = new Date(`${a.date}T00:00:00`);
      return d >= activeWeekObj.startDate && d <= activeWeekObj.endDate;
    }).length;
  }, [appointments, activeWeekObj]);

  // Handle client selection autofill
  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    if (clientId) {
      const cl = clients.find(c => c.id === clientId);
      if (cl) {
        setNewClientName(cl.name);
        setNewClientPhone(cl.phone);
        setNewChannel(cl.preferredChannel);
      }
    }
  };

  // Handle service change
  const handleServiceChange = (serviceId: string) => {
    setNewServiceId(serviceId);
    const srv = services.find(s => s.id === serviceId);
    if (srv && srv.priceTiers && srv.priceTiers.length > 0) {
      setSelectedTierName(srv.priceTiers[0].name);
      setCustomPrice(srv.priceTiers[0].price);
    } else if (srv) {
      setCustomPrice(srv.price);
      setSelectedTierName('');
    }
  };

  // Create new appointment submit
  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newServiceId) return;

    const srv = services.find(s => s.id === newServiceId);
    if (!srv) return;

    addAppointment({
      clientId: selectedClientId || undefined,
      clientName: newClientName,
      clientPhone: newClientPhone || '+52 55 0000 0000',
      serviceId: srv.id,
      serviceName: srv.name,
      serviceCategory: srv.category,
      date: selectedDateStr,
      time: newTime,
      durationMinutes: srv.durationMinutes,
      bufferMinutes: 10,
      price: customPrice || srv.price,
      selectedPriceTierName: selectedTierName || undefined,
      depositPaid: Math.round((customPrice || srv.price) * 0.3),
      staffName: newStaff,
      status: 'confirmed_by_ai',
      channel: newChannel,
      notes: newNotes,
    });

    setNewClientName('');
    setNewClientPhone('');
    setSelectedClientId('');
    setNewNotes('');
    setShowNewAptModal(false);
  };

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case 'confirmed_by_ai':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center gap-1">
            <Bot className="w-3 h-3" />
            IA Confirmada
          </span>
        );
      case 'attending':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 animate-spin" />
            En Atención
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Completada
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Pendiente
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/15 text-rose-600 dark:text-rose-400">
            Cancelada
          </span>
        );
    }
  };

  return (
    <div id="calendar-extended-screen" className="flex-1 w-full h-full flex flex-col overflow-hidden">
      {/* IOS Top Header */}
      <IOSHeader
        title="Agenda en Cascada"
        subtitle={
          granularity === 'days'
            ? `${selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })} • ${filteredAppointments.length} citas`
            : granularity === 'weeks'
            ? `${activeWeekObj?.label || 'Semana'} (${activeWeekObj?.rangeLabel || ''}) • ${filteredAppointments.length} citas`
            : granularity === 'months'
            ? `${monthNames[currentMonthIndex]} ${currentYear} • ${filteredAppointments.length} citas`
            : `Año ${currentYear} • ${filteredAppointments.length} citas`
        }
        rightAction={
          <div className="flex items-center gap-1.5">
            <button
              onClick={onBackToClassic || (() => navigateTo('calendar'))}
              className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-neutral-700 transition cursor-pointer"
              title="Volver a vista de 5 días"
            >
              5 Días
            </button>
            <button
              onClick={() => setShowNewAptModal(true)}
              className="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-sm ios-touch cursor-pointer hover:opacity-90 transition"
              title="Nueva Cita"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto hide-scrollbar px-4 pb-10 space-y-3">
        {/* =========================================================================
            1. INTERACTIVE BREADCRUMB TRAIL (AÑO > MES > SEMANA > DÍA)
            Allows the user to see the exact cascade depth and click any level to go back
        ========================================================================== */}
        <div className="flex items-center justify-between gap-1 pt-1 overflow-x-auto hide-scrollbar">
          <div className="flex items-center gap-1 text-xs py-1 px-2.5 rounded-2xl bg-slate-100 dark:bg-neutral-800/90 border border-slate-200/80 dark:border-neutral-700/60 shadow-2xs shrink-0 max-w-full">
            {/* Level 1: Año */}
            <button
              onClick={() => setGranularity('years')}
              className={`px-2 py-0.5 rounded-lg font-bold transition ios-touch cursor-pointer ${
                granularity === 'years'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-slate-600 dark:text-neutral-300 hover:text-[var(--primary)]'
              }`}
            >
              {currentYear}
            </button>

            <BreadcrumbArrow className="w-3 h-3 text-slate-400 shrink-0" />

            {/* Level 2: Mes */}
            <button
              onClick={() => setGranularity('months')}
              className={`px-2 py-0.5 rounded-lg font-bold transition ios-touch cursor-pointer ${
                granularity === 'months'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-slate-600 dark:text-neutral-300 hover:text-[var(--primary)]'
              }`}
            >
              {monthNames[currentMonthIndex]}
            </button>

            <BreadcrumbArrow className="w-3 h-3 text-slate-400 shrink-0" />

            {/* Level 3: Semana */}
            <button
              onClick={() => setGranularity('weeks')}
              className={`px-2 py-0.5 rounded-lg font-bold transition ios-touch cursor-pointer whitespace-nowrap ${
                granularity === 'weeks'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-slate-600 dark:text-neutral-300 hover:text-[var(--primary)]'
              }`}
            >
              {activeWeekObj?.label || `Sem ${selectedWeekIndex + 1}`}
            </button>

            <BreadcrumbArrow className="w-3 h-3 text-slate-400 shrink-0" />

            {/* Level 4: Día */}
            <button
              onClick={() => setGranularity('days')}
              className={`px-2 py-0.5 rounded-lg font-bold transition ios-touch cursor-pointer whitespace-nowrap ${
                granularity === 'days'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-slate-600 dark:text-neutral-300 hover:text-[var(--primary)]'
              }`}
            >
              {selectedDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}
            </button>
          </div>

          {/* Hoy Action Button */}
          <button
            onClick={handleJumpToToday}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 text-xs font-extrabold text-[var(--primary)] shadow-2xs hover:bg-slate-50 dark:hover:bg-neutral-800 transition ios-touch cursor-pointer flex items-center gap-1 shrink-0"
          >
            <span>Hoy</span>
          </button>
        </div>

        {/* =========================================================================
            2. GRANULARITY LEVEL SWITCHER (CHIPS ESTILO VUE / IOS PILLS)
            [ Días | Semanas | Meses | Años ]
        ========================================================================== */}
        <div className="flex items-center justify-between gap-2">
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
                  onClick={() => setGranularity(tab.id)}
                  className={`py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ios-touch cursor-pointer ${
                    isActive
                      ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[var(--primary)]' : 'opacity-70'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* =========================================================================
            3. HORIZONTAL SCROLLABLE RIBBON (CARD-BASED NAVIGATOR)
            Behaves according to the cascade:
            - AÑOS: Click cascades to MESES
            - MESES: Click cascades to SEMANAS of that month (No scrolling outside month!)
            - SEMANAS: Click cascades to DÍAS of that week (Centered in the month strip!)
            - DÍAS: Scrollable all month days, centered on the week, click filters day!
        ========================================================================== */}
        <div className="relative group">
          {/* Scroll Chevrons */}
          <button
            onClick={() => scrollRibbon('left')}
            className="absolute -left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/95 dark:bg-neutral-800/95 border border-slate-200 dark:border-neutral-700 shadow-md flex items-center justify-center text-slate-600 dark:text-neutral-300 hover:scale-110 transition ios-touch cursor-pointer opacity-80 hover:opacity-100"
            title="Desplazar a la izquierda"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={() => scrollRibbon('right')}
            className="absolute -right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/95 dark:bg-neutral-800/95 border border-slate-200 dark:border-neutral-700 shadow-md flex items-center justify-center text-slate-600 dark:text-neutral-300 hover:scale-110 transition ios-touch cursor-pointer opacity-80 hover:opacity-100"
            title="Desplazar a la derecha"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Card Strip Container */}
          <div
            ref={scrollRibbonRef}
            onWheel={handleWheel}
            className="p-1 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs overflow-x-auto hide-scrollbar scroll-smooth flex items-center gap-1.5 select-none"
          >
            {/* ---------------------------------------------------------------
                CASCADE LEVEL: AÑOS
                Clicking a year cascades into Meses of that year!
            ---------------------------------------------------------------- */}
            {granularity === 'years' &&
              yearsList.map(yr => {
                const isSelected = currentYear === yr;

                // Count appointments in this year
                const yearAptCount = appointments.filter(a => {
                  const d = new Date(`${a.date}T00:00:00`);
                  return d.getFullYear() === yr;
                }).length;

                return (
                  <button
                    key={yr}
                    data-selected={isSelected}
                    onClick={() => handleSelectYear(yr)}
                    className={`min-w-[95px] sm:min-w-[110px] py-2 px-2 rounded-xl flex flex-col items-center justify-center transition shrink-0 ios-touch cursor-pointer relative ${
                      isSelected
                        ? 'bg-[var(--primary)] text-white shadow-xs font-bold scale-[1.02]'
                        : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-semibold opacity-85">
                      {yr === today.getFullYear() ? 'ACTUAL' : 'AÑO'}
                    </span>
                    <span className="text-sm font-extrabold mt-0.5">{yr}</span>

                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold mt-1 ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-[var(--primary)]/10 text-[var(--primary)]'
                      }`}
                    >
                      {yearAptCount} citas
                    </span>

                    <span className="text-[8px] opacity-70 mt-0.5 flex items-center gap-0.5">
                      Ver Meses <ArrowRight className="w-2.5 h-2.5" />
                    </span>
                  </button>
                );
              })}

            {/* ---------------------------------------------------------------
                CASCADE LEVEL: MESES (Strictly 12 months of currentYear)
                Clicking a month cascades into Semanas of that month!
            ---------------------------------------------------------------- */}
            {granularity === 'months' &&
              monthsList.map(mo => {
                const isSelected = currentMonthIndex === mo.index;

                // Count appointments in this month
                const monthAptCount = appointments.filter(a => {
                  const d = new Date(`${a.date}T00:00:00`);
                  return d.getFullYear() === currentYear && d.getMonth() === mo.index;
                }).length;

                return (
                  <button
                    key={mo.index}
                    data-selected={isSelected}
                    onClick={() => handleSelectMonth(mo.index)}
                    className={`min-w-[84px] sm:min-w-[95px] py-2 px-2 rounded-xl flex flex-col items-center justify-center transition shrink-0 ios-touch cursor-pointer relative ${
                      isSelected
                        ? 'bg-[var(--primary)] text-white shadow-xs font-bold scale-[1.02]'
                        : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-semibold opacity-85">
                      {currentYear}
                    </span>
                    <span className="text-sm font-extrabold mt-0.5">{mo.shortName}</span>

                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold mt-1 ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-[var(--primary)]/10 text-[var(--primary)]'
                      }`}
                    >
                      {monthAptCount} citas
                    </span>

                    <span className="text-[8px] opacity-70 mt-0.5 flex items-center gap-0.5">
                      Ver Semanas <ArrowRight className="w-2.5 h-2.5" />
                    </span>
                  </button>
                );
              })}

            {/* ---------------------------------------------------------------
                CASCADE LEVEL: SEMANAS
                STRICTLY the weeks belonging to the selected month!
                User cannot / does not need to scroll outside this month.
                Clicking a week cascades to Días with those days centered!
            ---------------------------------------------------------------- */}
            {granularity === 'weeks' &&
              weeksForCurrentMonth.map((wk, idx) => {
                const isSelected = selectedWeekIndex === idx;

                // Count appointments in this specific week
                const weekAptCount = appointments.filter(a => {
                  const d = new Date(`${a.date}T00:00:00`);
                  return d >= wk.startDate && d <= wk.endDate;
                }).length;

                return (
                  <button
                    key={wk.index}
                    data-selected={isSelected}
                    onClick={() => handleSelectWeek(idx)}
                    className={`min-w-[105px] sm:min-w-[120px] py-2 px-2.5 rounded-xl flex flex-col items-center justify-center transition shrink-0 ios-touch cursor-pointer relative ${
                      isSelected
                        ? 'bg-[var(--primary)] text-white shadow-xs font-bold scale-[1.02]'
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
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-[var(--primary)]/10 text-[var(--primary)]'
                      }`}
                    >
                      {weekAptCount} citas
                    </span>

                    <span className="text-[8px] opacity-70 mt-0.5 flex items-center gap-0.5">
                      Ver Días <ArrowRight className="w-2.5 h-2.5" />
                    </span>
                  </button>
                );
              })}

            {/* ---------------------------------------------------------------
                CASCADE LEVEL: DÍAS
                Shows ALL days of the selected month (1 to 28..31).
                The days belonging to the selected week are highlighted and centered!
                Clicking any day filters the appointments strictly to that day.
            ---------------------------------------------------------------- */}
            {granularity === 'days' &&
              daysForCurrentMonth.map(day => {
                const isSelectedDay = selectedDateStr === day.dateStr;
                const isInSelectedWeek = day.isInSelectedWeek;
                const aptCount = appointmentCountByDate[day.dateStr] || 0;

                return (
                  <button
                    key={day.dateStr}
                    data-selected-day={isSelectedDay}
                    data-in-active-week={isInSelectedWeek}
                    onClick={() => handleSelectDay(day)}
                    className={`min-w-[62px] sm:min-w-[68px] py-2 px-1 rounded-xl flex flex-col items-center justify-center transition shrink-0 ios-touch cursor-pointer relative ${
                      isSelectedDay
                        ? 'bg-[var(--primary)] text-white shadow-xs font-bold scale-[1.04] ring-2 ring-[var(--primary)] ring-offset-1 dark:ring-offset-neutral-900'
                        : isInSelectedWeek
                        ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-semibold border border-[var(--primary)]/30 hover:bg-[var(--primary)]/15'
                        : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {/* Tiny indicator for belonging to the filtered week */}
                    {isInSelectedWeek && !isSelectedDay && (
                      <span className="text-[7.5px] uppercase font-black tracking-tighter opacity-80 -mt-1">
                        SEM {day.weekIndex + 1}
                      </span>
                    )}

                    <span className="text-[10px] uppercase font-semibold opacity-85">
                      {day.weekday}
                    </span>
                    <span className="text-sm font-extrabold mt-0.5">{day.dayNum}</span>

                    {/* Dot indicator if day has appointments */}
                    {aptCount > 0 && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full mt-1 ${
                          isSelectedDay ? 'bg-white' : 'bg-[var(--primary)]'
                        }`}
                        title={`${aptCount} citas`}
                      />
                    )}
                  </button>
                );
              })}
          </div>
        </div>

        {/* =========================================================================
            4. CONTEXT & FILTER BAR
            Displays current cascade status + service category chips
        ========================================================================== */}
        <div className="flex items-center justify-between gap-2 px-1 text-xs">
          <div className="flex items-center gap-1 text-slate-500 dark:text-neutral-400 text-[11px] font-medium truncate">
            {granularity === 'days' ? (
              <span>
                Citas de <strong className="text-slate-800 dark:text-white font-bold">{selectedDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
                {activeWeekObj && (
                  <span className="opacity-70 ml-1">
                    (Sem {selectedWeekIndex + 1}: {activeWeekObj.rangeLabel})
                  </span>
                )}
              </span>
            ) : granularity === 'weeks' ? (
              <span>
                Semana <strong className="text-slate-800 dark:text-white font-bold">{selectedWeekIndex + 1} de {monthNames[currentMonthIndex]}</strong> ({activeWeekObj?.rangeLabel})
              </span>
            ) : granularity === 'months' ? (
              <span>
                Mes de <strong className="text-slate-800 dark:text-white font-bold">{monthNames[currentMonthIndex]} {currentYear}</strong>
              </span>
            ) : (
              <span>
                Año <strong className="text-slate-800 dark:text-white font-bold">{currentYear}</strong>
              </span>
            )}
          </div>

          {granularity === 'days' && (
            <button
              onClick={() => setGranularity('weeks')}
              className="text-[11px] font-bold text-[var(--primary)] hover:underline whitespace-nowrap cursor-pointer"
            >
              Ver toda la semana ({activeWeekTotalApts})
            </button>
          )}
        </div>

        {/* Service Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-0.5">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'nails', label: '💅 Uñas' },
            { id: 'hair', label: '💇‍♀️ Peinados' },
            { id: 'massage', label: '💆‍♀️ Masajes' },
            { id: 'pedi_spa', label: '🦶 Spa Pies' },
          ].map(cat => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id as any)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ios-touch cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-2xs'
                    : 'bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-400 border border-slate-200/80 dark:border-neutral-800'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* =========================================================================
            5. APPOINTMENTS LIST ACCORDING TO CASCADED LEVEL
        ========================================================================== */}
        {filteredAppointments.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center p-6 bg-white dark:bg-neutral-900 rounded-3xl border border-slate-200/80 dark:border-neutral-800 shadow-2xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-neutral-800 flex items-center justify-center text-[var(--primary)] mb-3">
              <CalendarIcon className="w-6 h-6 stroke-[1.75]" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Sin citas agendadas
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              {granularity === 'days'
                ? `No hay citas para el ${selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}.`
                : granularity === 'weeks'
                ? `No hay citas en la ${activeWeekObj?.label || 'semana seleccionada'} (${activeWeekObj?.rangeLabel}).`
                : granularity === 'months'
                ? `No hay citas registradas en ${monthNames[currentMonthIndex]} ${currentYear}.`
                : `No hay citas registradas para el año ${currentYear}.`}
            </p>
            <button
              onClick={() => setShowNewAptModal(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-xs font-bold shadow-xs hover:opacity-90 transition ios-touch cursor-pointer"
            >
              + Agendar Cita
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* If in Weeks, Months, or Years mode: Group appointments by Day */}
            {granularity !== 'days' ? (
              (Object.entries(appointmentsGroupedByDay) as [string, Appointment[]][])
                .sort(([d1], [d2]) => d1.localeCompare(d2))
                .map(([dateKey, dayApts]) => {
                  const dateObj = new Date(`${dateKey}T00:00:00`);
                  const dateTitle = dateObj.toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                  });

                  return (
                    <div key={dateKey} className="space-y-2">
                      <div className="flex items-center justify-between px-1 pt-1.5">
                        <span className="text-xs font-extrabold uppercase text-slate-500 dark:text-neutral-400 tracking-wider flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                          {dateTitle} ({dayApts.length})
                        </span>
                        <button
                          onClick={() => {
                            setSelectedDate(dateObj);
                            // Also sync the week index
                            const wkIdx = weeksForCurrentMonth.findIndex(
                              w => dateObj >= w.startDate && dateObj <= w.endDate
                            );
                            if (wkIdx !== -1) setSelectedWeekIndex(wkIdx);
                            setGranularity('days');
                          }}
                          className="text-[11px] font-bold text-[var(--primary)] hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          Ver día <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                      {dayApts.map(apt => (
                        <div
                          key={apt.id}
                          onClick={() => setActiveAppointment(apt)}
                          className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs hover:border-[var(--primary)]/40 transition cursor-pointer flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-neutral-800 flex flex-col items-center justify-center shrink-0 border border-slate-200/60 dark:border-neutral-700/60">
                              <span className="text-[11px] font-black text-slate-800 dark:text-white leading-none">
                                {apt.time}
                              </span>
                              <span className="text-[9px] text-slate-400 font-semibold mt-0.5">
                                {apt.durationMinutes}m
                              </span>
                            </div>

                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {apt.clientName}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-neutral-400 truncate">
                                {apt.serviceName}
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                <span>{apt.staffName}</span>
                                <span>•</span>
                                <span className="font-bold text-slate-700 dark:text-neutral-200">
                                  ${apt.price}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 flex flex-col items-end gap-1.5">
                            {getStatusBadge(apt.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })
            ) : (
              /* Single Day Timeline */
              filteredAppointments.map(apt => (
                <div
                  key={apt.id}
                  onClick={() => setActiveAppointment(apt)}
                  className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs hover:border-[var(--primary)]/40 transition cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-neutral-800 flex flex-col items-center justify-center shrink-0 border border-slate-200/60 dark:border-neutral-700/60">
                      <span className="text-xs font-black text-slate-800 dark:text-white">
                        {apt.time}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {apt.durationMinutes}m
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {apt.clientName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-neutral-400 truncate">
                        {apt.serviceName}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-1">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> {apt.staffName}
                        </span>
                        <span>•</span>
                        <span className="font-bold text-slate-800 dark:text-neutral-200">
                          ${apt.price}
                        </span>
                        {apt.selectedPriceTierName && (
                          <span className="text-[10px] text-slate-400">
                            ({apt.selectedPriceTierName})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-2">
                    {getStatusBadge(apt.status)}
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {apt.channel}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          APPOINTMENT DETAIL MODAL
      ========================================================================== */}
      {activeAppointment && (
        <IOSModal
          isOpen={!!activeAppointment}
          onClose={() => setActiveAppointment(null)}
          title="Detalle de Cita"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {activeAppointment.clientName}
                </span>
                {getStatusBadge(activeAppointment.status)}
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-neutral-400">
                <Phone className="w-3.5 h-3.5" />
                <span>{activeAppointment.clientPhone}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Servicio</span>
                <p className="font-bold text-slate-800 dark:text-white mt-0.5">
                  {activeAppointment.serviceName}
                </p>
                {activeAppointment.selectedPriceTierName && (
                  <p className="text-[10px] text-[var(--primary)] font-semibold mt-0.5">
                    {activeAppointment.selectedPriceTierName}
                  </p>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Fecha y Hora</span>
                <p className="font-bold text-slate-800 dark:text-white mt-0.5">
                  {activeAppointment.date} • {activeAppointment.time}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Duración: {activeAppointment.durationMinutes} min
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total & Anticipo</span>
                <p className="font-extrabold text-slate-900 dark:text-white mt-0.5 text-sm">
                  ${activeAppointment.price}
                </p>
                <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                  Anticipo pagado: ${activeAppointment.depositPaid}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Especialista</span>
                <p className="font-bold text-slate-800 dark:text-white mt-0.5">
                  {activeAppointment.staffName}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 capitalize">
                  Vía: {activeAppointment.channel}
                </p>
              </div>
            </div>

            {activeAppointment.notes && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Notas</span>
                <p className="text-slate-600 dark:text-neutral-300 mt-0.5">
                  {activeAppointment.notes}
                </p>
              </div>
            )}

            {/* Quick Status Update Actions */}
            <div className="pt-2 border-t border-slate-200 dark:border-neutral-700 flex flex-col gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Cambiar Estado</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    updateAppointmentStatus(activeAppointment.id, 'attending');
                    setActiveAppointment(null);
                  }}
                  className="py-2 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold hover:bg-amber-500/25 transition cursor-pointer"
                >
                  En Atención
                </button>
                <button
                  onClick={() => {
                    updateAppointmentStatus(activeAppointment.id, 'completed');
                    setActiveAppointment(null);
                  }}
                  className="py-2 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold hover:bg-emerald-500/25 transition cursor-pointer"
                >
                  Completada
                </button>
                <button
                  onClick={() => {
                    updateAppointmentStatus(activeAppointment.id, 'cancelled');
                    setActiveAppointment(null);
                  }}
                  className="py-2 rounded-xl bg-rose-500/15 text-rose-700 dark:text-rose-400 font-bold hover:bg-rose-500/25 transition cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </IOSModal>
      )}

      {/* =========================================================================
          NEW APPOINTMENT MODAL
      ========================================================================== */}
      {showNewAptModal && (
        <IOSModal
          isOpen={showNewAptModal}
          onClose={() => setShowNewAptModal(false)}
          title="Agendar Nueva Cita"
        >
          <form onSubmit={handleCreateAppointment} className="space-y-3.5 text-xs">
            {/* Quick Client Picker */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase mb-1">
                Clienta (Seleccionar o Escribir)
              </label>
              <select
                value={selectedClientId}
                onChange={e => handleSelectClient(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs font-semibold focus:outline-none"
              >
                <option value="">-- Clienta Nueva --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nombre de la clienta"
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase mb-1">
                  Teléfono / WhatsApp
                </label>
                <input
                  type="text"
                  required
                  placeholder="+52 55 ..."
                  value={newClientPhone}
                  onChange={e => setNewClientPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs font-semibold focus:outline-none"
                />
              </div>
            </div>

            {/* Service & Price Tier */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase mb-1">
                Servicio
              </label>
              <select
                value={newServiceId}
                onChange={e => handleServiceChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs font-semibold focus:outline-none"
              >
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} - ${s.price} ({s.durationMinutes} min)
                  </option>
                ))}
              </select>
            </div>

            {/* Price Tier Selection if available */}
            {(() => {
              const srv = services.find(s => s.id === newServiceId);
              if (srv && srv.priceTiers && srv.priceTiers.length > 0) {
                return (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase mb-1">
                      Tabla de Precios Escalonados (Price Tiers)
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {srv.priceTiers.map(tier => {
                        const isTierActive = selectedTierName === tier.name;
                        return (
                          <button
                            type="button"
                            key={tier.id}
                            onClick={() => {
                              setSelectedTierName(tier.name);
                              setCustomPrice(tier.price);
                            }}
                            className={`p-2 rounded-xl text-left border transition cursor-pointer ${
                              isTierActive
                                ? 'bg-[var(--primary)]/15 border-[var(--primary)] text-[var(--primary)] font-bold'
                                : 'bg-slate-50 dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300'
                            }`}
                          >
                            <div className="text-[11px] truncate">{tier.name}</div>
                            <div className="text-xs font-extrabold mt-0.5">${tier.price}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Time & Specialist */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase mb-1">
                  Hora
                </label>
                <input
                  type="time"
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase mb-1">
                  Especialista
                </label>
                <select
                  value={newStaff}
                  onChange={e => setNewStaff(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs font-semibold focus:outline-none"
                >
                  <option value="Camila Ríos">Camila Ríos (Uñas)</option>
                  <option value="Carlos M.">Carlos M. (Color/Estilismo)</option>
                  <option value="Elena Soto">Elena Soto (Spa Pies)</option>
                  <option value="Ana Lucía">Ana Lucía (Masajes)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase mb-1">
                Fecha Seleccionada
              </label>
              <input
                type="date"
                value={selectedDateStr}
                onChange={e => {
                  const [y, m, d] = e.target.value.split('-').map(Number);
                  if (y && m && d) {
                    const chosen = new Date(y, m - 1, d);
                    setSelectedDate(chosen);
                    setCurrentYear(y);
                    setCurrentMonthIndex(m - 1);
                  }
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs font-semibold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase mb-1">
                Canal de Reserva
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'whatsapp', label: 'WhatsApp' },
                  { id: 'instagram', label: 'Instagram' },
                  { id: 'messenger', label: 'Messenger' },
                ].map(ch => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setNewChannel(ch.id as CommunicationChannel)}
                    className={`py-2 rounded-xl font-bold text-xs border transition cursor-pointer ${
                      newChannel === ch.id
                        ? 'bg-[var(--primary)]/15 border-[var(--primary)] text-[var(--primary)]'
                        : 'bg-slate-50 dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300'
                    }`}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase mb-1">
                Notas de la Cita
              </label>
              <textarea
                rows={2}
                placeholder="Detalles sobre diseño, requerimientos de la clienta..."
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs font-semibold focus:outline-none resize-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewAptModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 font-bold hover:bg-slate-200 dark:hover:bg-neutral-700 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[var(--primary)] text-white font-bold shadow-sm hover:opacity-90 transition cursor-pointer"
              >
                Crear Cita
              </button>
            </div>
          </form>
        </IOSModal>
      )}
    </div>
  );
};
