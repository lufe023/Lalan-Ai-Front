import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar as CalendarIcon,
  Clock,
  Phone,
  Plus,
  Bot,
  CheckCircle2,
  Sparkles,
  Scissors,
  Footprints,
  HeartHandshake,
  Trash2,
  X,
  Loader2,
  Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Appointment, AppointmentStatus, CommunicationChannel, ServiceCategory } from '../types';
import { IOSHeader } from '../components/ui/IOSHeader';
import { IOSModal } from '../components/ui/IOSModal';
import { PageContent } from '../components/ui/PageContent';
import { CascadingRibbonCalendar, CalendarGranularity } from '../components/ui/CascadingRibbonCalendar';

export const CalendarScreen: React.FC = () => {
  const {
    appointments,
    addAppointment,
    updateAppointmentStatus,
    deleteAppointment,
    services,
    clients,
    settings,
    // Para mandar a cobrar la comanda que quedó abierta al atender
    selectFolio,
    navigateTo,
    showToast,
    openFolios,
    loadOpenFolios,
    abrirComandaDeCita,
  } = useApp();
  const { currentUser } = useAuth();

  // ── Calendar range info (driven by CascadingRibbonCalendar) ─────────────
  const [currentDateStr, setCurrentDateStr] = useState<string>(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
  });
  const [calendarGranularity, setCalendarGranularity] = useState<CalendarGranularity>('days');

  // ── UI State ─────────────────────────────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | 'all'>('all');
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  const [showNewAptModal, setShowNewAptModal] = useState<boolean>(false);
  const [completionDialog, setCompletionDialog] = useState<{
    appointment: Appointment;
    type: 'past' | 'future';
  } | null>(null);

  /**
   * Aviso de cobro pendiente.
   *
   * Al marcar atendiendo (o completar, que se puede hacer sin pasar por
   * atendiendo) el backend abre la comanda con el servicio adentro. Si queda
   * saldo, aquí se pregunta qué hacer: en el bullicio del salón es justo
   * donde se olvida cobrar, y dejarlo callado era el agujero.
   */
  const [cobroPendiente, setCobroPendiente] = useState<{
    appointment: Appointment;
    saleId: string;
    saldo: number;
  } | null>(null);

  /**
   * Qué acción se está ejecutando y en qué fase. Es lo único que había que
   * mostrar: antes se pulsaba un botón, salía la llamada al servidor y en
   * pantalla no cambiaba absolutamente nada — el modal seguía abierto igual,
   * sin spinner, sin estado nuevo visible, sin cerrarse. Parecía roto.
   */
  const [accion, setAccion] = useState<{
    clave: AppointmentStatus | 'delete' | 'folio';
    fase: 'cargando' | 'listo';
  } | null>(null);

  // Borrar una cita no se deshace: el botón pide confirmación en el sitio
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  // Si no, al abrir la siguiente cita el botón seguiría en "¿seguro?"
  useEffect(() => {
    setConfirmarBorrar(false);
    setAccion(null);
    // Al abrir una cita se refresca la lista de comandas: si no, la tira de
    // abajo podría decir "sin comanda" con una recién abierta desde Caja.
    if (activeAppointment?.id) void loadOpenFolios?.();
  }, [activeAppointment?.id]);

  const AVISO: Record<string, { titulo: string; detalle: string }> = {
    attending: { titulo: 'En atención', detalle: 'Se abrió la comanda con el servicio adentro.' },
    completed: { titulo: 'Cita completada', detalle: 'Ya cuenta en el informe de citas.' },
    cancelled: { titulo: 'Cita cancelada', detalle: 'No cuenta para las métricas del día.' },
  };

  /**
   * Único punto por donde pasan TODOS los cambios de estado: los cuatro
   * botones de completar y el de en-atención. Si alguno se saltara esto, esa
   * ruta volvería a perder el aviso y la confirmación visual.
   */
  const marcarEstado = useCallback(async (
    apt: Appointment, status: AppointmentStatus, completedAt?: string,
  ) => {
    setAccion({ clave: status, fase: 'cargando' });
    try {
      const r = await updateAppointmentStatus(apt.id, status, completedAt);
      setActiveAppointment(a =>
        a && a.id === apt.id ? { ...a, status, ...(completedAt ? { completedAt } : {}) } : a);

      // Si quedó saldo, el aviso de cobro toma el relevo y este modal estorba
      if (r?.saleId && (r.saldoPendiente ?? 0) > 0) {
        setAccion(null);
        setActiveAppointment(null);
        setCobroPendiente({ appointment: apt, saleId: r.saleId, saldo: r.saldoPendiente as number });
        return;
      }

      // Palomita un instante —para que se vea que pasó algo— y cierra
      setAccion({ clave: status, fase: 'listo' });
      const a = AVISO[status];
      if (a) showToast?.(a.titulo, a.detalle, 'success');
      window.setTimeout(() => { setAccion(null); setActiveAppointment(null); }, 650);
    } catch (e: any) {
      setAccion(null);
      showToast?.('No se pudo actualizar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    }
  }, [updateAppointmentStatus, showToast]);

  // ── New Appointment Form ─────────────────────────────────────────────────
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newServiceId, setNewServiceId] = useState(services[0]?.id || '');
  const [selectedTierName, setSelectedTierName] = useState<string>('');
  const [customPrice, setCustomPrice] = useState<number | null>(null);
  const [newTime, setNewTime] = useState('11:00');
  const [newStaff, setNewStaff] = useState('Camila Ríos');
  const [newNotes, setNewNotes] = useState('');
  const [newChannel, setNewChannel] = useState<CommunicationChannel>('whatsapp');

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    const cl = clients.find(c => c.id === clientId);
    if (cl) { setNewClientName(cl.name); setNewClientPhone(cl.phone); setNewChannel(cl.preferredChannel); }
  };

  const handleServiceChange = (serviceId: string) => {
    setNewServiceId(serviceId);
    const srv = services.find(s => s.id === serviceId);
    if (srv?.priceTiers?.length) { setSelectedTierName(srv.priceTiers[0].name); setCustomPrice(srv.priceTiers[0].price); }
    else if (srv) { setCustomPrice(srv.price); setSelectedTierName(''); }
  };

  const getAppointmentTiming = (apt: Appointment): 'past' | 'today' | 'future' => {
    const today = new Date().toISOString().slice(0, 10);
    if (apt.date < today) return 'past';
    if (apt.date === today) return 'today';
    return 'future';
  };

  const handleCompleteAppointment = (apt: Appointment) => {
    const timing = getAppointmentTiming(apt);
    if (timing === 'today') {
      const completedAt = new Date().toISOString();
      void marcarEstado(apt, 'completed', completedAt);
    } else {
      setCompletionDialog({ appointment: apt, type: timing === 'past' ? 'past' : 'future' });
    }
  };

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName) return;
    const selectedSrv = services.find(s => s.id === newServiceId) || services[0];
    const finalPrice = customPrice !== null ? customPrice : (selectedSrv.priceTiers?.[0]?.price ?? selectedSrv.price ?? 0);
    const deposit = Math.round(finalPrice * ((settings.depositPercent || 30) / 100));
    const fullServiceName = selectedTierName ? `${selectedSrv.name} (${selectedTierName})` : selectedSrv.name;
    addAppointment({
      clientName: newClientName,
      clientPhone: newClientPhone || '+52 55 0000 0000',
      clientAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      serviceId: selectedSrv.id,
      serviceName: fullServiceName,
      serviceCategory: selectedSrv.category,
      date: currentDateStr,
      time: newTime,
      durationMinutes: selectedSrv.durationMinutes || settings.defaultAppointmentDurationMinutes || 60,
      price: finalPrice,
      depositPaid: deposit,
      staffName: newStaff,
      status: 'confirmed_by_ai',
      channel: newChannel,
      notes: newNotes,
    });
    setNewClientName(''); setNewClientPhone(''); setSelectedClientId('');
    setSelectedTierName(''); setCustomPrice(null); setNewNotes('');
    setShowNewAptModal(false);
  };

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case 'confirmed_by_ai': return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center gap-1">
          <Bot className="w-3 h-3" />IA Confirmada
        </span>
      );
      case 'attending': return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3 animate-spin" />En Atención
        </span>
      );
      case 'completed': return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />Completada
        </span>
      );
      case 'pending': return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />Pendiente
        </span>
      );
      case 'cancelled': return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/15 text-rose-600 dark:text-rose-400">Cancelada</span>
      );
    }
  };

  const getServiceCategoryIcon = (category: ServiceCategory) => {
    switch (category) {
      case 'nails': return <Sparkles className="w-4 h-4 text-rose-500" />;
      case 'hair': return <Scissors className="w-4 h-4 text-purple-500" />;
      case 'massage': return <HeartHandshake className="w-4 h-4 text-emerald-500" />;
      case 'pedi_spa': return <Footprints className="w-4 h-4 text-sky-500" />;
    }
  };

  // Map appointments to CalendarEventBase shape (id + date are already there)
  const calendarEvents = useMemo(() =>
    appointments.map(a => ({ ...a, date: a.date })),
    [appointments]
  );

  return (
    <div id="calendar-screen" className="flex-1 w-full h-full flex flex-col overflow-hidden">
      <IOSHeader
        title="Agenda"
        subtitle={`${appointments.length} citas en total`}
        rightAction={
          <button
            onClick={() => setShowNewAptModal(true)}
            className="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-sm ios-touch cursor-pointer hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        }
      />

      <PageContent className="space-y-3">
        <CascadingRibbonCalendar
          events={calendarEvents}
          initialGranularity="days"
          onSelectDate={(_, dateStr) => setCurrentDateStr(dateStr)}
          onGranularityChange={setCalendarGranularity}
          onRangeChange={({ dateStr }) => setCurrentDateStr(dateStr)}
        >
          {({ filteredEvents, granularity }) => {
            // Apply category filter on top of the calendar's date filter
            const visible = filteredEvents.filter(apt =>
              selectedCategory === 'all' || apt.serviceCategory === selectedCategory
            ) as Appointment[];

            return (
              <div className="space-y-3 mt-1">
                {/* Category filter pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-0.5">
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'nails', label: '💅 Uñas' },
                    { id: 'hair', label: '💇‍♀️ Peinados' },
                    { id: 'massage', label: '💆‍♀️ Masajes' },
                    { id: 'pedi_spa', label: '🦶 Spa Pies' },
                  ].map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id as any)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ios-touch cursor-pointer ${
                        selectedCategory === cat.id
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-2xs'
                          : 'bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-400 border border-slate-200/80 dark:border-neutral-800'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Appointments list */}
                {visible.length === 0 ? (
                  <div className="py-12 flex flex-col items-center text-center p-6 bg-white dark:bg-neutral-900 rounded-3xl border border-slate-200/80 dark:border-neutral-800 shadow-2xs">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-neutral-800 flex items-center justify-center text-[var(--primary)] mb-3">
                      <CalendarIcon className="w-6 h-6 stroke-[1.75]" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Sin citas agendadas</h4>
                    <p className="text-xs text-slate-400 mt-1">No hay citas para este período o filtro.</p>
                    <button
                      onClick={() => setShowNewAptModal(true)}
                      className="mt-4 px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-xs font-bold shadow-xs hover:opacity-90 transition ios-touch cursor-pointer"
                    >
                      + Agendar Cita
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {visible.map((apt, idx) => (
                      <motion.div
                        key={apt.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        onClick={() => setActiveAppointment(apt)}
                        className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs hover:border-slate-300 dark:hover:border-neutral-700 transition cursor-pointer ios-touch flex items-start gap-3"
                      >
                        <div className="flex flex-col items-center justify-center min-w-[50px] pt-0.5">
                          <span className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">{apt.time}</span>
                          {granularity !== 'days' && (
                            <span className="text-[9px] text-slate-400 font-medium">
                              {new Date(apt.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-medium">{apt.durationMinutes} min</span>
                        </div>
                        <div className="w-1 self-stretch rounded-full shrink-0 bg-[var(--primary)] opacity-70" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">{apt.clientName}</h4>
                            {getStatusBadge(apt.status)}
                          </div>
                          <p className="text-[11px] font-medium text-slate-600 dark:text-neutral-300 truncate mt-0.5 flex items-center gap-1">
                            {getServiceCategoryIcon(apt.serviceCategory)}
                            <span>{apt.serviceName}</span>
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 pt-1 border-t border-slate-100 dark:border-neutral-800/60">
                            <span>{apt.staffName}</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">${apt.price}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            );
          }}
        </CascadingRibbonCalendar>
      </PageContent>

      {/* ── Appointment Detail Modal ──────────────────────────────────────── */}
      <IOSModal
        isOpen={!!activeAppointment}
        onClose={() => setActiveAppointment(null)}
        title="Detalles de la Cita"
        subtitle={activeAppointment ? `${activeAppointment.date} a las ${activeAppointment.time}` : ''}
      >
        {activeAppointment && (() => {
          const ocupado = accion !== null;
          const timing = getAppointmentTiming(activeAppointment);
          const total = Number(activeAppointment.price ?? 0);
          const anticipo = Number(activeAppointment.depositPaid ?? 0);
          const falta = Math.max(0, total - anticipo);

          /**
           * Acento por estado. Un solo color manda en toda la ficha —cabecera,
           * chip y botón actual— en vez de cuatro cajas grises iguales donde
           * nada destacaba.
           */
          const acento = ({
            attending: { txt: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', bd: 'border-amber-500/20', solido: 'bg-amber-500' },
            completed: { txt: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', bd: 'border-emerald-500/20', solido: 'bg-emerald-500' },
            cancelled: { txt: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10', bd: 'border-rose-500/20', solido: 'bg-rose-500' },
          } as any)[activeAppointment.status] ?? {
            txt: 'text-slate-500 dark:text-neutral-400',
            bg: 'bg-slate-500/5', bd: 'border-slate-200 dark:border-neutral-800', solido: 'bg-slate-500',
          };

          /**
           * Botón de estado.
           *
           * El estado actual ya NO lleva `ring` con offset: ese borde doble
           * quedaba duro y descolocado. Ahora se marca con el color de acento
           * relleno suave y un punto — se lee de un vistazo y no grita.
           */
          const Boton = ({ clave, tono, icono, children, onClick }: {
            clave: AppointmentStatus | 'delete';
            tono: 'amber' | 'emerald' | 'rose';
            icono: React.ReactNode;
            children: React.ReactNode;
            onClick: () => void;
          }) => {
            const esActual = clave === activeAppointment.status;
            const activa = accion?.clave === clave;
            const cargando = activa && accion?.fase === 'cargando';
            const listo = activa && accion?.fase === 'listo';
            const c = {
              amber:   { txt: 'text-amber-600 dark:text-amber-400', suave: 'bg-amber-500/10', hov: 'hover:bg-amber-500/10 hover:border-amber-500/30', solido: 'bg-amber-500' },
              emerald: { txt: 'text-emerald-600 dark:text-emerald-400', suave: 'bg-emerald-500/10', hov: 'hover:bg-emerald-500/10 hover:border-emerald-500/30', solido: 'bg-emerald-500' },
              rose:    { txt: 'text-rose-600 dark:text-rose-400', suave: 'bg-rose-500/10', hov: 'hover:bg-rose-500/10 hover:border-rose-500/30', solido: 'bg-rose-500' },
            }[tono];

            return (
              <button
                type="button"
                onClick={onClick}
                disabled={ocupado || esActual}
                className={`h-16 px-3 rounded-2xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
                  listo
                    ? `${c.solido} text-white border-transparent shadow-sm`
                    : esActual
                    ? `${c.suave} ${c.txt} border-transparent cursor-default`
                    : `bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-300 ${c.hov}`
                } ${
                  ocupado && !activa ? 'opacity-35 cursor-not-allowed'
                    : !esActual && !activa ? 'cursor-pointer active:scale-[0.97]' : ''
                }`}
              >
                {cargando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="opacity-80">Guardando…</span>
                  </>
                ) : listo ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Listo</span>
                  </>
                ) : (
                  <>
                    <span className={esActual ? c.txt : 'text-slate-400'}>{icono}</span>
                    <span className="flex items-center gap-1">
                      {esActual && <span className={`w-1.5 h-1.5 rounded-full ${c.solido}`} />}
                      {children}
                    </span>
                  </>
                )}
              </button>
            );
          };

          return (
            /* Ancho contenido: en escritorio la hoja ocupa toda la pantalla y
               los datos quedaban estirados de borde a borde, ilegibles. */
            <div className="max-w-2xl mx-auto space-y-5 select-none pb-4">

              {/* ── Quién ───────────────────────────────────────────────── */}
              <div className={`p-4 rounded-3xl border ${acento.bg} ${acento.bd} flex items-center gap-4`}>
                <img
                  src={activeAppointment.clientAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                  alt={activeAppointment.clientName}
                  className="w-14 h-14 rounded-2xl object-cover shadow-sm shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-base text-slate-900 dark:text-white truncate leading-tight">
                    {activeAppointment.clientName}
                  </h4>
                  <p className="text-slate-500 dark:text-neutral-400 text-[11px] flex items-center gap-1.5 mt-0.5">
                    <Phone className="w-3 h-3 shrink-0" />
                    <span className="truncate">{activeAppointment.clientPhone}</span>
                    <span className="text-slate-300 dark:text-neutral-700">·</span>
                    <span className="uppercase font-semibold tracking-wide">{activeAppointment.channel}</span>
                  </p>
                </div>
                <div className="shrink-0">{getStatusBadge(activeAppointment.status)}</div>
              </div>

              {/* ── Qué ─────────────────────────────────────────────────── */}
              <div className="rounded-3xl border border-slate-200/80 dark:border-neutral-800 overflow-hidden">
                <div className="px-4 py-3.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Servicio</span>
                  <div className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                    {activeAppointment.serviceName}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-neutral-400 flex items-center gap-1.5 mt-1">
                    <Clock className="w-3 h-3 shrink-0" />
                    {activeAppointment.durationMinutes} min
                    <span className="text-slate-300 dark:text-neutral-700">·</span>
                    {activeAppointment.staffName}
                  </div>
                </div>

                {/* Plata. Lo que faltaba: cuánto queda por cobrar, que es la
                    pregunta real cuando la clienta se está por ir. */}
                <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-neutral-800 border-t border-slate-100 dark:border-neutral-800 bg-slate-50/60 dark:bg-neutral-800/30">
                  <div className="px-4 py-3">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Total</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">${total}</span>
                  </div>
                  <div className="px-4 py-3">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Anticipo</span>
                    <span className={`text-sm font-bold tabular-nums ${
                      anticipo > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                    }`}>${anticipo}</span>
                  </div>
                  <div className="px-4 py-3">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Falta</span>
                    <span className={`text-sm font-bold tabular-nums ${
                      falta > 0 ? 'text-slate-900 dark:text-white' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {falta > 0 ? `$${falta}` : 'Saldado'}
                    </span>
                  </div>
                </div>
              </div>

              {activeAppointment.notes && (
                <div className="px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-[11px] leading-relaxed">
                  <span className="font-bold uppercase tracking-wider text-[10px] block mb-1 opacity-70">Notas</span>
                  {activeAppointment.notes}
                </div>
              )}

              {/* ── La comanda ──────────────────────────────────────────
                  Hasta ahora la cita no decía nada de su comanda: se marcaba
                  atendida, el folio no se abría (por ejemplo si la clienta no
                  tiene ficha) y no había forma de enterarse ni de arreglarlo
                  desde aquí. */}
              {(activeAppointment.status === 'attending' || activeAppointment.status === 'completed') && (() => {
                const folio = (openFolios ?? []).find((f: any) =>
                  (activeAppointment.clientId && f.clientId === activeAppointment.clientId) ||
                  (f.items ?? []).some((i: any) => i.appointmentId === activeAppointment.id),
                ) as any;
                const saldo = folio ? Number(folio.total ?? 0) - Number(folio.paidTotal ?? 0) : 0;

                return (
                  <div className={`px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 ${
                    folio
                      ? 'bg-slate-50 dark:bg-neutral-800/40 border-slate-200/80 dark:border-neutral-800'
                      : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200/70 dark:border-rose-900/40'
                  }`}>
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                        Comanda
                      </span>
                      <span className={`text-xs font-bold ${
                        folio ? 'text-slate-800 dark:text-neutral-100' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {!folio
                          ? 'Sin comanda — el servicio no está en ninguna cuenta'
                          : saldo > 0
                          ? `Abierta · faltan $${saldo.toFixed(2)}`
                          : 'Abierta · sin saldo'}
                      </span>
                    </div>
                    {folio ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveAppointment(null);
                          void selectFolio(folio.id);
                          navigateTo('caja');
                        }}
                        className="shrink-0 px-3 py-1.5 rounded-xl bg-[var(--primary)] text-white text-[11px] font-bold hover:opacity-90 cursor-pointer transition"
                      >
                        Ir a cobrar
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={async () => {
                          setAccion({ clave: 'folio', fase: 'cargando' });
                          const v = await abrirComandaDeCita(activeAppointment);
                          setAccion(null);
                          if (v) showToast?.('Comanda abierta', 'El servicio ya está en la cuenta.', 'success');
                        }}
                        className={`shrink-0 px-3 py-1.5 rounded-xl bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1.5 transition ${
                          ocupado ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 cursor-pointer'
                        }`}
                      >
                        {accion?.clave === 'folio'
                          ? <><Loader2 className="w-3 h-3 animate-spin" />Abriendo…</>
                          : 'Abrir comanda'}
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* ── Acciones ────────────────────────────────────────────── */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2 px-1">
                  Actualizar estado
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <Boton clave="attending" tono="amber" icono={<Sparkles className="w-4 h-4" />}
                    onClick={() => { void marcarEstado(activeAppointment, 'attending'); }}>
                    En atención
                  </Boton>
                  <Boton clave="completed" tono="emerald" icono={<CheckCircle2 className="w-4 h-4" />}
                    onClick={() => handleCompleteAppointment(activeAppointment)}>
                    {timing === 'past' ? 'Completar' : timing === 'future' ? 'Anticipado' : 'Atendida'}
                  </Boton>
                  <Boton clave="cancelled" tono="rose" icono={<X className="w-4 h-4" />}
                    onClick={() => { void marcarEstado(activeAppointment, 'cancelled'); }}>
                    Cancelar
                  </Boton>
                </div>

                {/* Eliminar no es un estado más: se va abajo, en gris y en
                    pequeño, para que no compita con las tres de arriba. */}
                <div className="flex justify-end pt-3 mt-3 border-t border-slate-100 dark:border-neutral-800/80">
                  {confirmarBorrar ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 dark:text-neutral-400">
                        ¿Borrar esta cita? No se puede deshacer.
                      </span>
                      <button
                        type="button"
                        onClick={() => setConfirmarBorrar(false)}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer transition"
                      >
                        No
                      </button>
                      <button
                        type="button"
                        disabled={accion !== null}
                        onClick={async () => {
                          setAccion({ clave: 'delete', fase: 'cargando' });
                          try {
                            await deleteAppointment(activeAppointment.id);
                            showToast?.('Cita eliminada', 'Ya no aparece en la agenda.', 'success');
                            setActiveAppointment(null);
                          } catch (e: any) {
                            showToast?.('No se pudo eliminar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
                          } finally {
                            setAccion(null);
                            setConfirmarBorrar(false);
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1.5 hover:opacity-90 cursor-pointer transition disabled:opacity-50"
                      >
                        {accion?.clave === 'delete'
                          ? <><Loader2 className="w-3 h-3 animate-spin" />Borrando…</>
                          : <><Trash2 className="w-3 h-3" />Sí, borrar</>}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmarBorrar(true)}
                      disabled={ocupado}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 transition ${
                        ocupado ? 'opacity-35 cursor-not-allowed'
                          : 'cursor-pointer hover:text-rose-500 hover:bg-rose-500/10'
                      }`}
                    >
                      <Trash2 className="w-3 h-3" /> Eliminar cita
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </IOSModal>

      {/* ── New Appointment Modal ─────────────────────────────────────────── */}
      <IOSModal
        isOpen={showNewAptModal}
        onClose={() => { setShowNewAptModal(false); setCustomPrice(null); setSelectedTierName(''); }}
        title="Nueva Cita en Salón"
        subtitle={`Agendando para el ${currentDateStr}`}
      >
        <form onSubmit={handleCreateAppointment} className="space-y-3 text-xs select-none">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Cliente del CRM (opcional)</label>
            <select value={selectedClientId} onChange={e => handleSelectClient(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none">
              <option value="">-- Nueva clienta --</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone}) - {c.totalVisits} visitas</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre *</label>
            <input type="text" required placeholder="Ej: Camila Restrepo" value={newClientName}
              onChange={e => { setNewClientName(e.target.value); if (selectedClientId) setSelectedClientId(''); }}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
              <input type="tel" placeholder="+52 55..." value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Hora</label>
              <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Servicio</label>
            <select value={newServiceId} onChange={e => handleServiceChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none">
              {services.map(s => <option key={s.id} value={s.id}>{s.name} (${s.price} - {s.durationMinutes} min)</option>)}
            </select>
          </div>
          {(() => {
            const srv = services.find(s => s.id === newServiceId);
            if (srv?.priceTiers && srv.priceTiers.length > 1) return (
              <div className="p-2.5 rounded-xl bg-rose-50/60 dark:bg-neutral-800 border border-rose-200/60 dark:border-neutral-700 space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-800 dark:text-slate-200">Tarifas</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {srv.priceTiers.map((tier, i) => (
                    <button key={i} type="button" onClick={() => { setSelectedTierName(tier.name); setCustomPrice(tier.price); }}
                      className={`p-2 rounded-lg text-left border transition ios-touch cursor-pointer ${selectedTierName === tier.name || (!selectedTierName && i === 0) ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-300'}`}>
                      <div className="font-bold text-[11px] truncate">{tier.name}</div>
                      <div className="text-[10px] opacity-90">${tier.price}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
            return null;
          })()}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Especialista</label>
              <select value={newStaff} onChange={e => setNewStaff(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none">
                <option value="Camila Ríos (Uñas)">Camila Ríos (Uñas)</option>
                <option value="Elena Soto (Spa Pies)">Elena Soto (Spa Pies)</option>
                <option value="Carlos M. (Peinados)">Carlos M. (Peinados)</option>
                <option value="Ana Lucía (Masajes)">Ana Lucía (Masajes)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Canal</label>
              <select value={newChannel} onChange={e => setNewChannel(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none">
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram DM</option>
                <option value="messenger">Facebook Messenger</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Notas</label>
            <textarea rows={2} placeholder="Ej: Glitter, alergia a acrílico..." value={newNotes} onChange={e => setNewNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none" />
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/80 border border-slate-200/60 dark:border-neutral-700/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-neutral-400">Anticipo ({settings.depositPercent || 30}%):</span>
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
              ${Math.round((() => { const srv = services.find(s => s.id === newServiceId); return customPrice !== null ? customPrice : (srv?.priceTiers?.[0]?.price ?? srv?.price ?? 0); })() * ((settings.depositPercent || 30) / 100))}
            </span>
          </div>
          <button type="submit" className="w-full py-3 rounded-xl bg-gradient-to-r from-[var(--primary)] to-rose-500 text-white font-bold text-sm shadow-md ios-touch cursor-pointer">
            Guardar Cita en Agenda
          </button>
        </form>
      </IOSModal>

      {/* ── Smart Completion Dialog ───────────────────────────────────────── */}
      <AnimatePresence>
        {completionDialog && (
          <motion.div className="absolute inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm px-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              initial={{ scale: 0.92, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 20, opacity: 0 }} transition={{ type: 'spring', damping: 22, stiffness: 300 }}>
              {completionDialog.type === 'past' ? (
                <>
                  <div className="text-2xl mb-3 text-center">📋</div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-neutral-100 text-center mb-1">¿Cuándo fue atendida?</h3>
                  <p className="text-sm text-slate-500 dark:text-neutral-400 text-center mb-5">
                    Cita de <span className="font-semibold text-slate-700 dark:text-neutral-200">{completionDialog.appointment.clientName}</span> programada para el {new Date(completionDialog.appointment.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}.
                  </p>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => {
                      const apt = completionDialog.appointment;
                      const completedAt = apt.startsAt ?? `${apt.date}T${apt.time}:00`;
                      void marcarEstado(apt, 'completed', completedAt);
                      setCompletionDialog(null);
                    }} className="w-full py-3 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-500/30 ios-touch cursor-pointer hover:bg-emerald-500/25 text-sm">
                      ✓ Sí, fue atendida en esa fecha
                    </button>
                    <button onClick={() => {
                      const apt = completionDialog.appointment;
                      const completedAt = new Date().toISOString();
                      void marcarEstado(apt, 'completed', completedAt);
                      setCompletionDialog(null);
                    }} className="w-full py-3 rounded-xl bg-sky-500/15 text-sky-700 dark:text-sky-400 font-bold border border-sky-500/30 ios-touch cursor-pointer hover:bg-sky-500/25 text-sm">
                      📅 Completar hoy ({new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })})
                    </button>
                    <button onClick={() => setCompletionDialog(null)} className="w-full py-2.5 rounded-xl text-slate-500 dark:text-neutral-400 text-sm font-medium ios-touch cursor-pointer hover:bg-slate-100 dark:hover:bg-neutral-800">Cancelar</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl mb-3 text-center">⚠️</div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-neutral-100 text-center mb-1">Cita futura</h3>
                  <p className="text-sm text-slate-500 dark:text-neutral-400 text-center mb-5">
                    Cita de <span className="font-semibold text-slate-700 dark:text-neutral-200">{completionDialog.appointment.clientName}</span> programada para el {new Date(completionDialog.appointment.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}. ¿Completar hoy de todas formas?
                  </p>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => {
                      const apt = completionDialog.appointment;
                      const completedAt = new Date().toISOString();
                      void marcarEstado(apt, 'completed', completedAt);
                      setCompletionDialog(null);
                    }} className="w-full py-3 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/30 ios-touch cursor-pointer hover:bg-amber-500/25 text-sm">
                      ✓ Completar hoy de todas formas
                    </button>
                    <button onClick={() => setCompletionDialog(null)} className="w-full py-2.5 rounded-xl text-slate-500 dark:text-neutral-400 text-sm font-medium ios-touch cursor-pointer hover:bg-slate-100 dark:hover:bg-neutral-800">Cancelar</button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cobro pendiente ────────────────────────────────────────────────
          Sale cuando al atender/completar queda saldo. El botón grande manda
          derecho a cobrar esa misma comanda; "dejar abierta" es legítimo
          (la clienta sigue en el sillón), y para eso está el contador rojo
          de Caja, que no la deja irse sin que alguien la vea. */}
      <AnimatePresence>
        {cobroPendiente && (
          <motion.div className="absolute inset-0 z-[320] flex items-center justify-center bg-black/50 backdrop-blur-sm px-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              initial={{ scale: 0.92, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 20, opacity: 0 }} transition={{ type: 'spring', damping: 22, stiffness: 300 }}>
              <div className="text-2xl mb-3 text-center">🧾</div>
              <h3 className="text-base font-bold text-slate-800 dark:text-neutral-100 text-center mb-1">
                Queda por cobrar
              </h3>
              <p className="text-sm text-slate-500 dark:text-neutral-400 text-center mb-1">
                La comanda de{' '}
                <span className="font-semibold text-slate-700 dark:text-neutral-200">
                  {cobroPendiente.appointment.clientName}
                </span>{' '}
                quedó abierta con {cobroPendiente.appointment.serviceName}.
              </p>
              <div className="text-center mb-5">
                <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {cobroPendiente.saldo.toFixed(2)}
                </span>
                <span className="text-xs text-slate-400 ml-1">pendiente</span>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    const id = cobroPendiente.saleId;
                    setCobroPendiente(null);
                    setActiveAppointment(null);
                    void selectFolio(id);
                    navigateTo('caja');
                  }}
                  className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-bold ios-touch cursor-pointer hover:opacity-90 text-sm"
                >
                  💵 Cobrar ahora
                </button>
                <button
                  onClick={() => setCobroPendiente(null)}
                  className="w-full py-2.5 rounded-xl text-slate-500 dark:text-neutral-400 text-sm font-medium ios-touch cursor-pointer hover:bg-slate-100 dark:hover:bg-neutral-800"
                >
                  Dejar la comanda abierta
                </button>
              </div>
              <p className="text-[10px] text-slate-400 text-center mt-3">
                Si la dejas abierta va a seguir contando en el aviso rojo de Caja.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
