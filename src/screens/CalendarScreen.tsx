import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ItemAnimado, ListaAnimada, RESORTE } from '../components/ui/movimiento';
import { FotoClienta } from '../components/ui/FotoClienta';
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
  UserCheck,
} from 'lucide-react';
import { useDinero } from '../hooks/useDinero';
import { useApp } from '../context/AppContext';
import { useBusquedaDeClientas } from '../hooks/useBusquedaDeClientas';
import { useAuth } from '../context/AuthContext';
import { Appointment, AppointmentStatus, CommunicationChannel, ServiceCategory } from '../types';
import { IOSHeader } from '../components/ui/IOSHeader';
import { IOSModal } from '../components/ui/IOSModal';
import { PageContent } from '../components/ui/PageContent';
import { CascadingRibbonCalendar, CalendarGranularity } from '../components/ui/CascadingRibbonCalendar';
import { hora12 } from '../utils/hora';
import { SelectorHora } from '../components/ui/SelectorHora';
import { CitasPendientes, citasPendientes } from '../components/agenda/CitasPendientes';
import { CambiarEspecialista } from '../components/agenda/CambiarEspecialista';
import { useAusencias } from '../hooks/useAusencias';
import { semanaCompleta } from '../components/ajustes/HorarioSemanal';
import { cabeEn, estadoDelDia, ratos, turnosParaAgendar } from '../utils/turnos';

/** Cuántas clientas se sugieren mientras se escribe su nombre */
const CLIENTAS_SUGERIDAS = 6;

export const CalendarScreen: React.FC = () => {
  const { dinero } = useDinero();
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
    categoriasDe,
    categoriaPorClave,
    especialistas,
    loadEspecialistas,
  } = useApp();
  useEffect(() => { void loadEspecialistas(); }, [loadEspecialistas]);
  // Quién no viene y quién no trabaja ese día (vacaciones, horario propio)
  const { ausencias, motivo: motivoAusencia } = useAusencias();
  const semanaSalon = useMemo(() => semanaCompleta(settings.horarioSemanal, settings.openingTime, settings.closingTime), [settings.horarioSemanal, settings.openingTime, settings.closingTime]);
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
  /** La cita a la que se le está cambiando la especialista */
  const [cambiandoDe, setCambiandoDe] = useState<Appointment | null>(null);
  /* Pendientes: la lista, y saltar al día de la cita elegida (el calendario se vuelve a montar en esa fecha) */
  const [verPendientes, setVerPendientes] = useState(false);
  const [irA, setIrA] = useState<{ fecha: Date; vez: number } | null>(null);
  const abrirPendiente = (a: Appointment) => {
    setVerPendientes(false);
    setIrA({ fecha: new Date(`${a.date}T12:00:00`), vez: Date.now() });
    setCurrentDateStr(a.date);
    setActiveAppointment(a);
  };
  const totalPendientes = useMemo(() => citasPendientes(appointments).total, [appointments]);
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
      // Se echó atrás al preguntarle si reprogramaba la llegada: nada cambió
      if (r?.cancelado) { setAccion(null); return; }
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
  /** Id de la especialista elegida; '' = por asignar (el salón decide luego) */
  const [newStaff, setNewStaff] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newChannel, setNewChannel] = useState<CommunicationChannel>('whatsapp');

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    const cl = clients.find(c => c.id === clientId);
    if (cl) { setNewClientName(cl.name); setNewClientPhone(cl.phone); setNewChannel(cl.preferredChannel); }
  };

  /* Escribir el nombre busca en TODO el directorio, no solo en lo que hay
     cargado: si la clienta ya existe, aparece en el desplegable de arriba
     mientras escribes. Sin esto, con el directorio paginado, una clienta
     antigua parecería nueva y acabarías con su ficha duplicada. */
  useBusquedaDeClientas(newClientName);

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

  // Los ratos en que se puede agendar ese día (salón, o la especialista elegida)
  const personaElegida = (especialistas ?? []).find(e => e.id === newStaff) ?? null;
  const turnosDelDia = turnosParaAgendar(personaElegida, currentDateStr, semanaSalon, ausencias);
  const duracionElegida = services.find(s => s.id === newServiceId)?.durationMinutes || settings.defaultAppointmentDurationMinutes || 60;
  const fueraDeHorario = !cabeEn(turnosDelDia, newTime, duracionElegida);
  const [errorAlAgendar, setErrorAlAgendar] = useState<string | null>(null);
  const [agendando, setAgendando] = useState(false);

  // Solo la dueña o la administración agendan fuera de horario (turno especial)
  const puedeForzarHorario = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  const handleCreateAppointment = async (e: React.FormEvent | React.MouseEvent, forzar = false) => {
    e.preventDefault();
    if (!newClientName || (fueraDeHorario && !forzar) || agendando) return;
    const selectedSrv = services.find(s => s.id === newServiceId) || services[0];
    const finalPrice = customPrice !== null ? customPrice : (selectedSrv.priceTiers?.[0]?.price ?? selectedSrv.price ?? 0);
    // El anticipo que dice Ajustes: si no se pide o es 0 %, no hay anticipo
    const deposit = settings.requireDeposit ? Math.round(finalPrice * ((settings.depositPercent || 0) / 100)) : 0;
    const fullServiceName = selectedTierName ? `${selectedSrv.name} (${selectedTierName})` : selectedSrv.name;
    setErrorAlAgendar(null);
    setAgendando(true);
    try {
    await addAppointment({
      ...(forzar ? { fueraDeHorario: true } : {}),
      // Si la eligieron de la lista, se enlaza por id y no por parecido de nombre
      clientId: selectedClientId || undefined,
      clientName: newClientName.trim(),
      // Vacío antes que inventado: un número falso ensucia el CRM y
      // manda WhatsApp a un desconocido
      clientPhone: newClientPhone.trim(),
      serviceId: selectedSrv.id,
      serviceName: fullServiceName,
      serviceCategory: selectedSrv.category,
      date: currentDateStr,
      time: newTime,
      durationMinutes: selectedSrv.durationMinutes || settings.defaultAppointmentDurationMinutes || 60,
      price: finalPrice,
      // El precio va en la moneda del servicio; el sistema lo convierte al cobrar
      currencyCode: selectedSrv.currencyCode,
      depositPaid: deposit,
      staffId: newStaff || undefined,
      staffName: (especialistas ?? []).find(e => e.id === newStaff)?.name ?? 'Por asignar',
      // La confirma quien la agenda; el backend la guarda a su nombre
      status: 'confirmed',
      channel: newChannel,
      notes: newNotes,
    });
    } catch (err: any) {
      // El servidor tiene la última palabra (horario, ausencias): se dice aquí mismo, sin cerrar
      setErrorAlAgendar(err?.message ?? 'No se pudo agendar. Inténtalo de nuevo.');
      return;
    } finally {
      setAgendando(false);
    }
    setNewClientName(''); setNewClientPhone(''); setSelectedClientId('');
    setSelectedTierName(''); setCustomPrice(null); setNewNotes('');
    setShowNewAptModal(false);
  };

  /**
   * El estado, y QUIÉN la agendó: la asistente o la persona del equipo. Las
   * estadísticas tienen que reflejar lo que pasó; antes todo salía como "IA".
   */
  const getStatusBadge = (status: AppointmentStatus, apt?: Appointment) => {
    const quien = apt?.bookedByAssistant
      ? (settings.aiAgentName || 'IA')
      : apt?.createdByName?.split(' ')[0] ?? null;
    switch (status) {
      case 'confirmed': return (
        <span className="px-2 py-0.5 rounded-full text-[0.6875rem] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
          <UserCheck className="w-3 h-3" />Confirmada{quien ? ` · ${quien}` : ''}
        </span>
      );
      case 'confirmed_by_ai': return (
        <span className="px-2 py-0.5 rounded-full text-[0.6875rem] font-extrabold bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center gap-1">
          <Bot className="w-3 h-3" />Confirmada · {settings.aiAgentName || 'IA'}
        </span>
      );
      case 'attending': return (
        <span className="px-2 py-0.5 rounded-full text-[0.6875rem] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3 animate-spin" />En Atención
        </span>
      );
      case 'completed': return (
        <span className="px-2 py-0.5 rounded-full text-[0.6875rem] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />Completada
        </span>
      );
      case 'pending': return (
        <span className="px-2 py-0.5 rounded-full text-[0.6875rem] font-extrabold bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />Pendiente
        </span>
      );
      case 'cancelled': return (
        <span className="px-2 py-0.5 rounded-full text-[0.6875rem] font-extrabold bg-rose-500/15 text-rose-600 dark:text-rose-400">Cancelada</span>
      );
    }
  };

  const getServiceCategoryIcon = (category: ServiceCategory) => (
    <span className="text-base leading-none">{categoriaPorClave('service', category)?.icon ?? '✨'}</span>
  );

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
          key={irA?.vez ?? 'calendario'}
          initialDate={irA?.fecha}
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
                {granularity === 'days' && (() => {
                  const noVienen = (especialistas ?? []).filter(e => e.active)
                    .map(e => ({ e, hoy: estadoDelDia(e, currentDateStr, semanaSalon, ausencias, motivoAusencia) }))
                    .filter(x => !x.hoy.trabaja || x.hoy.detalle?.startsWith('Sale'));
                  if (!noVienen.length || !semanaSalon.find(d => d.dia === new Date(`${currentDateStr}T12:00:00Z`).getUTCDay())?.abierto) return null;
                  return (
                    <div className="px-3 py-2 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200/70 dark:border-sky-900 text-[0.75rem] text-sky-900 dark:text-sky-200">
                      <span className="font-bold">Este día: </span>
                      {noVienen.map(x => `${x.e.name.split(' ')[0]} (${(x.hoy.detalle ?? '').toLowerCase()})`).join(' · ')}
                    </div>
                  );
                })()}
                {/* Category filter pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-0.5">
                  <button
                    type="button"
                    onClick={() => setVerPendientes(true)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ios-touch cursor-pointer flex items-center gap-1 ${
                      totalPendientes
                        ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                        : 'bg-white dark:bg-neutral-900 text-slate-500 border border-slate-200/80 dark:border-neutral-800'
                    }`}
                  >
                    ⏳ Pendientes{totalPendientes ? ` ${totalPendientes}` : ''}
                  </button>
                  {[
                    { id: 'all', label: 'Todos' },
                    // Las categorías del salón (las crea la dueña en Catálogo)
                    ...categoriasDe('service').map(c => ({ id: c.key, label: `${c.icon ?? ''} ${c.name}`.trim() })),
                  ].map(cat => (
                    <motion.button
                      key={cat.id}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => setSelectedCategory(cat.id as any)}
                      className={`relative px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ios-touch cursor-pointer ${
                        selectedCategory === cat.id
                          ? 'text-white dark:text-slate-900 font-bold'
                          : 'bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-400 border border-slate-200/80 dark:border-neutral-800'
                      }`}
                    >
                      {selectedCategory === cat.id && (
                        <motion.span layoutId="agenda-categoria" transition={RESORTE}
                          className="absolute inset-0 rounded-full bg-slate-900 dark:bg-white shadow-2xs" />
                      )}
                      <span className="relative">{cat.label}</span>
                    </motion.button>
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
                  /* Al cambiar de día o de vista las citas vuelven a entrar en cascada; al filtrar, se reacomodan */
                  <ListaAnimada className="space-y-2.5" clave={`${currentDateStr}-${granularity}`}>
                    {visible.map((apt, idx) => (
                      <ItemAnimado
                        key={apt.id}
                        indice={idx}
                        onClick={() => setActiveAppointment(apt)}
                        className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs hover:shadow-md hover:border-slate-300 dark:hover:border-neutral-700 transition-[border-color,box-shadow] cursor-pointer ios-touch flex items-start gap-3"
                      >
                        <div className="flex flex-col items-center justify-center min-w-[50px] pt-0.5">
                          <span className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight whitespace-nowrap">{hora12(apt.time)}</span>
                          {granularity !== 'days' && (
                            <span className="text-[0.6875rem] text-slate-400 font-medium">
                              {new Date(apt.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                          <span className="text-[0.6875rem] text-slate-400 font-medium">{apt.durationMinutes} min</span>
                        </div>
                        <div className="w-1 self-stretch rounded-full shrink-0 bg-[var(--primary)] opacity-70" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">{apt.clientName}</h4>
                            <div className="flex items-center gap-1 shrink-0">
                              {apt.fueraDeHorario && (
                                <span className="px-1.5 py-0.5 rounded-full text-[0.6875rem] font-extrabold bg-violet-500/15 text-violet-700 dark:text-violet-300" title="Se agendó fuera del horario, con autorización">
                                  Fuera de horario
                                </span>
                              )}
                              {getStatusBadge(apt.status, apt)}
                            </div>
                          </div>
                          <p className="text-[0.75rem] font-medium text-slate-600 dark:text-neutral-300 truncate mt-0.5 flex items-center gap-1">
                            {getServiceCategoryIcon(apt.serviceCategory)}
                            <span>{apt.serviceName}</span>
                          </p>
                          <div className="flex items-center justify-between text-[0.6875rem] text-slate-400 mt-1.5 pt-1 border-t border-slate-100 dark:border-neutral-800/60">
                            <span>{apt.staffName}</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{dinero(apt.price, apt.currencyCode)}</span>
                          </div>
                        </div>
                      </ItemAnimado>
                    ))}
                  </ListaAnimada>
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
        subtitle={activeAppointment ? `${activeAppointment.date} a las ${hora12(activeAppointment.time)}` : ''}
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
                className={`h-16 px-3 rounded-2xl border text-[0.75rem] font-bold flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
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
            <div className="max-w-2xl mx-auto space-y-5 pb-4">

              {/* ── Quién ───────────────────────────────────────────────── */}
              <div className={`p-4 rounded-3xl border ${acento.bg} ${acento.bd} flex items-center gap-4`}>
                <FotoClienta foto={activeAppointment.clientAvatar ?? clients.find(c => c.id === activeAppointment.clientId)?.avatar} nombre={activeAppointment.clientName} className="w-14 h-14 text-lg shadow-sm" />
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-base text-slate-900 dark:text-white truncate leading-tight">
                    {activeAppointment.clientName}
                  </h4>
                  <p className="text-slate-500 dark:text-neutral-400 text-[0.75rem] flex items-center gap-1.5 mt-0.5">
                    <Phone className="w-3 h-3 shrink-0" />
                    <span className="truncate">{activeAppointment.clientPhone}</span>
                    <span className="text-slate-300 dark:text-neutral-700">·</span>
                    <span className="uppercase font-semibold tracking-wide">{activeAppointment.channel}</span>
                  </p>
                </div>
                <div className="shrink-0">{getStatusBadge(activeAppointment.status, activeAppointment)}</div>
              </div>

              {/* ── Qué ─────────────────────────────────────────────────── */}
              <div className="rounded-3xl border border-slate-200/80 dark:border-neutral-800 overflow-hidden">
                <div className="px-4 py-3.5">
                  <span className="text-[0.6875rem] uppercase font-bold tracking-wider text-slate-400">Servicio</span>
                  <div className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                    {activeAppointment.serviceName}
                  </div>
                  <div className="text-[0.75rem] text-slate-500 dark:text-neutral-400 flex items-center gap-1.5 mt-1">
                    <Clock className="w-3 h-3 shrink-0" />
                    {activeAppointment.durationMinutes} min
                    <span className="text-slate-300 dark:text-neutral-700">·</span>
                    {activeAppointment.staffName}
                    {['pending', 'confirmed', 'confirmed_by_ai'].includes(activeAppointment.status)
                      && new Date(activeAppointment.startsAt ?? `${activeAppointment.date}T${activeAppointment.time}`).getTime() > Date.now() && (
                      <button type="button" onClick={() => setCambiandoDe(activeAppointment)}
                        className="ml-1 px-2 py-0.5 rounded-lg text-[0.6875rem] font-bold text-[var(--primary)] bg-[var(--primary)]/10 cursor-pointer">
                        Cambiar
                      </button>
                    )}
                  </div>
                  {activeAppointment.cambioRespuesta && (() => {
                    const de = activeAppointment.cambioEspecialistaDe?.split(' ')[0] ?? 'su especialista';
                    const r = activeAppointment.cambioRespuesta;
                    const [texto, color] = r === 'esperando' ? [`Le avisamos del cambio (antes con ${de}): esperando su respuesta`, 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300']
                      : r === 'acepta' ? [`Aceptó el cambio (antes con ${de})`, 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300']
                      : r === 'reagendo' ? [`Prefirió otro día (era con ${de})`, 'bg-sky-50 text-sky-800 dark:bg-sky-950/30 dark:text-sky-300']
                      : [`No quiso el cambio y canceló (era con ${de})`, 'bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300'];
                    return <div className={`mt-2 px-2.5 py-1.5 rounded-lg text-[0.75rem] font-semibold ${color}`}>{texto}</div>;
                  })()}
                </div>

                {/* Plata. Lo que faltaba: cuánto queda por cobrar, que es la
                    pregunta real cuando la clienta se está por ir. */}
                <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-neutral-800 border-t border-slate-100 dark:border-neutral-800 bg-slate-50/60 dark:bg-neutral-800/30">
                  <div className="px-4 py-3">
                    <span className="text-[0.6875rem] uppercase font-bold tracking-wider text-slate-400 block">Total</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{dinero(total, activeAppointment.currencyCode)}</span>
                  </div>
                  <div className="px-4 py-3">
                    <span className="text-[0.6875rem] uppercase font-bold tracking-wider text-slate-400 block">Anticipo</span>
                    <span className={`text-sm font-bold tabular-nums ${
                      anticipo > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                    }`}>{dinero(anticipo, activeAppointment.currencyCode)}</span>
                  </div>
                  <div className="px-4 py-3">
                    <span className="text-[0.6875rem] uppercase font-bold tracking-wider text-slate-400 block">Falta</span>
                    <span className={`text-sm font-bold tabular-nums ${
                      falta > 0 ? 'text-slate-900 dark:text-white' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {falta > 0 ? dinero(falta, activeAppointment.currencyCode) : 'Saldado'}
                    </span>
                  </div>
                </div>
              </div>

              {activeAppointment.notes && (
                <div className="px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-[0.75rem] leading-relaxed">
                  <span className="font-bold uppercase tracking-wider text-[0.6875rem] block mb-1 opacity-70">Notas</span>
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
                      <span className="text-[0.6875rem] uppercase font-bold tracking-wider text-slate-400 block">
                        Comanda
                      </span>
                      <span className={`text-xs font-bold ${
                        folio ? 'text-slate-800 dark:text-neutral-100' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {!folio
                          ? 'Sin comanda — el servicio no está en ninguna cuenta'
                          : saldo > 0
                          ? `Abierta · faltan ${dinero(saldo)}`
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
                        className="shrink-0 px-3 py-1.5 rounded-xl bg-[var(--primary)] text-white text-[0.75rem] font-bold hover:opacity-90 cursor-pointer transition"
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
                        className={`shrink-0 px-3 py-1.5 rounded-xl bg-rose-500 text-white text-[0.75rem] font-bold flex items-center gap-1.5 transition ${
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
                <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400 block mb-2 px-1">
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
                      <span className="text-[0.75rem] text-slate-500 dark:text-neutral-400">
                        ¿Borrar esta cita? No se puede deshacer.
                      </span>
                      <button
                        type="button"
                        onClick={() => setConfirmarBorrar(false)}
                        className="px-3 py-1.5 rounded-xl text-[0.75rem] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer transition"
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
                        className="px-3 py-1.5 rounded-xl bg-rose-500 text-white text-[0.75rem] font-bold flex items-center gap-1.5 hover:opacity-90 cursor-pointer transition disabled:opacity-50"
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
                      className={`px-3 py-1.5 rounded-xl text-[0.75rem] font-semibold text-slate-400 flex items-center gap-1.5 transition ${
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
        <form onSubmit={handleCreateAppointment} className="space-y-3 text-xs">
          {/* Clienta: se reconoce por la cara antes que por el nombre */}
          {(() => {
            const elegida = selectedClientId ? clients.find(c => c.id === selectedClientId) : undefined;
            if (elegida) return (
              <div>
                <label className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">Clienta</label>
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700">
                  <FotoClienta foto={elegida.avatar} nombre={elegida.name} className="w-11 h-11 text-sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[0.875rem] text-slate-900 dark:text-white truncate">{elegida.name}</div>
                    <div className="text-slate-500 dark:text-neutral-400 truncate">{elegida.phone || 'Sin teléfono'} · {elegida.totalVisits} {elegida.totalVisits === 1 ? 'visita' : 'visitas'}</div>
                  </div>
                  <button type="button" onClick={() => { setSelectedClientId(''); setNewClientName(''); setNewClientPhone(''); }}
                    className="shrink-0 font-bold text-[var(--primary)] cursor-pointer">Cambiar</button>
                </div>
              </div>
            );
            const texto = newClientName.trim().toLowerCase();
            const digitos = texto.replace(/\D/g, '');
            const parecidas = texto
              ? clients.filter(c => c.name.toLowerCase().includes(texto) || (digitos.length >= 3 && c.phone.replace(/\D/g, '').includes(digitos))).slice(0, CLIENTAS_SUGERIDAS)
              : [];
            return (
              <div>
                <label className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">Clienta *</label>
                <input type="text" required placeholder="Escribe su nombre o teléfono" value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
                {parecidas.length > 0 && (
                  <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {parecidas.map(c => (
                      <button key={c.id} type="button" onClick={() => handleSelectClient(c.id)}
                        className="flex items-center gap-2.5 p-2 rounded-xl text-left bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 hover:border-[var(--primary)] transition cursor-pointer">
                        <FotoClienta foto={c.avatar} nombre={c.name} className="w-10 h-10 text-sm" />
                        <span className="flex-1 min-w-0">
                          <span className="block font-semibold text-slate-900 dark:text-white truncate">{c.name}</span>
                          <span className="block text-slate-500 dark:text-neutral-400 truncate">{c.phone || 'Sin teléfono'} · {c.totalVisits} {c.totalVisits === 1 ? 'visita' : 'visitas'}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {texto && !parecidas.length && (
                  <p className="mt-1 text-[0.6875rem] text-slate-500 dark:text-neutral-400">No está en tus clientas: se le abre ficha nueva al guardar.</p>
                )}
              </div>
            );
          })()}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
              <input type="tel" placeholder="+52 55..." value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none" />
            </div>
            <div>
              <label className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">Hora</label>
              <SelectorHora value={newTime} onChange={v => { setNewTime(v); setErrorAlAgendar(null); }} />
            </div>
          </div>
          <div className={`px-3 py-2 rounded-xl text-[0.75rem] ${fueraDeHorario
            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
            : 'bg-slate-50 dark:bg-neutral-800/60 text-slate-500 dark:text-neutral-400'}`}>
            {!turnosDelDia.length
              ? (personaElegida ? `${personaElegida.name.split(' ')[0]} no trabaja este día. Elige a otra persona u otro día.` : 'El salón está cerrado este día. Elige otro día.')
              : <>
                  <span className="font-bold">{personaElegida ? `${personaElegida.name.split(' ')[0]} atiende` : 'Este día se atiende'}: </span>{ratos(turnosDelDia)}
                  {fueraDeHorario && <span className="block font-semibold mt-0.5">A esa hora la cita ({duracionElegida} min) queda fuera del horario.</span>}
                </>}
          </div>
          <div>
            <label className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">Servicio</label>
            <select value={newServiceId} onChange={e => handleServiceChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none">
              {services.map(s => <option key={s.id} value={s.id}>{s.name} ({dinero(s.price, s.currencyCode)} · {s.durationMinutes} min)</option>)}
            </select>
          </div>
          {(() => {
            const srv = services.find(s => s.id === newServiceId);
            if (srv?.priceTiers && srv.priceTiers.length > 1) return (
              <div className="p-2.5 rounded-xl bg-rose-50/60 dark:bg-neutral-800 border border-rose-200/60 dark:border-neutral-700 space-y-1.5">
                <label className="block text-[0.75rem] font-bold text-slate-800 dark:text-slate-200">Tarifas</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {srv.priceTiers.map((tier, i) => (
                    <button key={i} type="button" onClick={() => { setSelectedTierName(tier.name); setCustomPrice(tier.price); }}
                      className={`p-2 rounded-lg text-left border transition ios-touch cursor-pointer ${selectedTierName === tier.name || (!selectedTierName && i === 0) ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-300'}`}>
                      <div className="font-bold text-[0.75rem] truncate">{tier.name}</div>
                      <div className="text-[0.6875rem] opacity-90">{dinero(tier.price, srv.currencyCode)}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
            return null;
          })()}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">Especialista</label>
              <select value={newStaff} onChange={e => { setNewStaff(e.target.value); setErrorAlAgendar(null); }}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none">
                <option value="">Por asignar</option>
                {(especialistas ?? []).filter(e => e.active).map(e => {
                  const hoy = estadoDelDia(e, currentDateStr, semanaSalon, ausencias, motivoAusencia);
                  return (
                    <option key={e.id} value={e.id} disabled={!hoy.trabaja}>
                      {e.name}{e.role ? ` (${e.role})` : ''}{!hoy.trabaja ? ` — ${hoy.detalle}` : hoy.detalle?.startsWith('Sale') ? ` — ${hoy.detalle}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">Canal</label>
              <select value={newChannel} onChange={e => setNewChannel(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none">
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram DM</option>
                <option value="messenger">Facebook Messenger</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">Notas</label>
            <textarea rows={2} placeholder="Ej: Glitter, alergia a acrílico..." value={newNotes} onChange={e => setNewNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none" />
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/80 border border-slate-200/60 dark:border-neutral-700/60 flex items-center justify-between text-[0.75rem]">
            <span className="text-slate-500 dark:text-neutral-400">Anticipo ({settings.depositPercent || 30}%):</span>
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
              ${Math.round((() => { const srv = services.find(s => s.id === newServiceId); return customPrice !== null ? customPrice : (srv?.priceTiers?.[0]?.price ?? srv?.price ?? 0); })() * ((settings.depositPercent || 30) / 100))}
            </span>
          </div>
          {fueraDeHorario && puedeForzarHorario && (
            <button type="button" disabled={agendando || !newClientName} onClick={e => void handleCreateAppointment(e, true)}
              className="w-full py-2.5 rounded-xl border border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-xs font-bold ios-touch cursor-pointer disabled:opacity-40">
              Agendar igual como turno especial (fuera de horario)
            </button>
          )}
          {errorAlAgendar && (
            <p className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-[0.8125rem] font-semibold text-rose-700 dark:text-rose-300">{errorAlAgendar}</p>
          )}
          <button type="submit" disabled={fueraDeHorario || agendando}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[var(--primary)] to-rose-500 text-white font-bold text-sm shadow-md ios-touch cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
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
              <p className="text-[0.6875rem] text-slate-400 text-center mt-3">
                Si la dejas abierta va a seguir contando en el aviso rojo de Caja.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <CitasPendientes abierto={verPendientes} onCerrar={() => setVerPendientes(false)} citas={appointments} onAbrir={abrirPendiente} />
      {cambiandoDe && (
        <CambiarEspecialista
          cita={{
            id: cambiandoDe.id, clientName: cambiandoDe.clientName, clientPhone: cambiandoDe.clientPhone, serviceName: cambiandoDe.serviceName,
            startsAt: cambiandoDe.startsAt ?? `${cambiandoDe.date}T${cambiandoDe.time}`, staffName: cambiandoDe.staffName,
          }}
          onCerrar={() => setCambiandoDe(null)}
          onListo={({ cita }) => setActiveAppointment((a) => (a && a.id === cita.id
            ? { ...a, staffId: cita.staffId, staffName: cita.staffName, cambioEspecialistaDe: cita.cambioEspecialistaDe, cambioRespuesta: cita.cambioRespuesta }
            : a))}
        />
      )}
    </div>
  );
};
