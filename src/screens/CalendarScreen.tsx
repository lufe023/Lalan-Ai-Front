import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Phone,
  Plus,
  Bot,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Filter,
  DollarSign,
  Scissors,
  Flame,
  Flower2,
  Footprints,
  HeartHandshake,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Appointment, AppointmentStatus, CommunicationChannel, ServiceCategory } from '../types';
import { IOSHeader } from '../components/ui/IOSHeader';
import { IOSModal } from '../components/ui/IOSModal';
import { IOSSegmentedControl } from '../components/ui/IOSSegmentedControl';

export const CalendarScreen: React.FC = () => {
  const {
    appointments,
    addAppointment,
    updateAppointmentStatus,
    deleteAppointment,
    services,
    clients,
    settings,
  } = useApp();
  const { currentUser } = useAuth();

  const [selectedDateOffset, setSelectedDateOffset] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | 'all'>('all');
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  const [showNewAptModal, setShowNewAptModal] = useState<boolean>(false);

  // New Appointment Form State
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

  // Handle service selection and default price tier
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

  // Days list for horizontal iOS date selector
  const daysList = [
    { offset: 0, label: 'Hoy', dayNum: new Date().getDate(), weekday: 'Hoy' },
    {
      offset: 1,
      label: 'Mañana',
      dayNum: new Date(Date.now() + 86400000).getDate(),
      weekday: new Date(Date.now() + 86400000).toLocaleDateString('es-ES', { weekday: 'short' }),
    },
    {
      offset: 2,
      label: '+2d',
      dayNum: new Date(Date.now() + 86400000 * 2).getDate(),
      weekday: new Date(Date.now() + 86400000 * 2).toLocaleDateString('es-ES', { weekday: 'short' }),
    },
    {
      offset: 3,
      label: '+3d',
      dayNum: new Date(Date.now() + 86400000 * 3).getDate(),
      weekday: new Date(Date.now() + 86400000 * 3).toLocaleDateString('es-ES', { weekday: 'short' }),
    },
    {
      offset: 4,
      label: '+4d',
      dayNum: new Date(Date.now() + 86400000 * 4).getDate(),
      weekday: new Date(Date.now() + 86400000 * 4).toLocaleDateString('es-ES', { weekday: 'short' }),
    },
  ];

  // Helper date target string
  const targetDateObj = new Date(Date.now() + selectedDateOffset * 86400000);
  const targetDateStr = targetDateObj.toISOString().split('T')[0];

  // Filtered Appointments
  const filteredAppointments = appointments.filter(apt => {
    const matchesDate = apt.date === targetDateStr;
    const matchesCat = selectedCategory === 'all' || apt.serviceCategory === selectedCategory;
    return matchesDate && matchesCat;
  });

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

  const getServiceCategoryIcon = (category: ServiceCategory) => {
    switch (category) {
      case 'nails':
        return <Sparkles className="w-4 h-4 text-rose-500" />;
      case 'hair':
        return <Scissors className="w-4 h-4 text-purple-500" />;
      case 'massage':
        return <HeartHandshake className="w-4 h-4 text-emerald-500" />;
      case 'pedi_spa':
        return <Footprints className="w-4 h-4 text-sky-500" />;
    }
  };

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName) return;

    const selectedSrv = services.find(s => s.id === newServiceId) || services[0];
    const finalPrice = customPrice || selectedSrv.price;
    const deposit = Math.round(finalPrice * ((settings.depositPercent || 30) / 100));

    const fullServiceName = selectedTierName
      ? `${selectedSrv.name} (${selectedTierName})`
      : selectedSrv.name;

    addAppointment({
      clientName: newClientName,
      clientPhone: newClientPhone || '+52 55 0000 0000',
      clientAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      serviceId: selectedSrv.id,
      serviceName: fullServiceName,
      serviceCategory: selectedSrv.category,
      date: targetDateStr,
      time: newTime,
      durationMinutes: selectedSrv.durationMinutes || settings.defaultAppointmentDurationMinutes || 60,
      price: finalPrice,
      depositPaid: deposit,
      staffName: newStaff,
      status: 'confirmed_by_ai',
      channel: newChannel,
      notes: newNotes,
    });

    setNewClientName('');
    setNewClientPhone('');
    setSelectedClientId('');
    setSelectedTierName('');
    setNewNotes('');
    setShowNewAptModal(false);
  };

  return (
    <div id="calendar-screen" className="flex-1 w-full h-full flex flex-col overflow-hidden">
      <IOSHeader
        title="Agenda"
        subtitle={`${filteredAppointments.length} citas ${selectedDateOffset === 0 ? 'hoy' : ''}`}
        rightAction={
          <button
            onClick={() => setShowNewAptModal(true)}
            className="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-sm ios-touch cursor-pointer hover:opacity-90 transition"
            title="Nueva Cita"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto hide-scrollbar px-4 pb-8 space-y-3.5">
        {/* Horizontal iOS Date Picker */}
        <div className="flex items-center justify-between gap-1.5 p-1 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs">
          {daysList.map(day => {
            const isSelected = selectedDateOffset === day.offset;
            return (
              <button
                key={day.offset}
                onClick={() => setSelectedDateOffset(day.offset)}
                className={`flex-1 py-2 rounded-xl flex flex-col items-center justify-center transition ios-touch cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--primary)] text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
                }`}
              >
                <span className="text-[10px] uppercase font-semibold opacity-85">{day.weekday}</span>
                <span className="text-sm font-extrabold mt-0.5">{day.dayNum}</span>
              </button>
            );
          })}
        </div>

        {/* Filter Pills by Beauty Salon Category */}
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
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ios-touch cursor-pointer ${
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

        {/* Appointments List / Timeline */}
        {filteredAppointments.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center text-center p-6 bg-white dark:bg-neutral-900 rounded-3xl border border-slate-200/80 dark:border-neutral-800 shadow-2xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-neutral-800 flex items-center justify-center text-[var(--primary)] mb-3">
              <CalendarIcon className="w-6 h-6 stroke-[1.75]" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Sin citas agendadas
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              No hay citas programadas para este día o filtro.
            </p>
            <button
              onClick={() => setShowNewAptModal(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-xs font-bold shadow-xs hover:opacity-90 transition ios-touch cursor-pointer"
            >
              + Agendar Cita
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredAppointments.map((apt, idx) => (
              <motion.div
                key={apt.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                onClick={() => setActiveAppointment(apt)}
                className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs hover:border-slate-300 dark:hover:border-neutral-700 transition cursor-pointer ios-touch flex items-start justify-between gap-3"
              >
                {/* Left Time Column */}
                <div className="flex flex-col items-center justify-center min-w-[50px] pt-0.5">
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {apt.time}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {apt.durationMinutes} min
                  </span>
                </div>

                {/* Vertical Indicator */}
                <div
                  className="w-1 self-stretch rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      apt.serviceCategory === 'nails'
                        ? '#e11d48'
                        : apt.serviceCategory === 'hair'
                        ? '#9333ea'
                        : apt.serviceCategory === 'massage'
                        ? '#059669'
                        : '#0284c7',
                  }}
                />

                {/* Center Client & Service Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {apt.clientName}
                    </h4>
                    {getStatusBadge(apt.status)}
                  </div>

                  <p className="text-[11px] font-medium text-slate-600 dark:text-neutral-300 truncate mt-0.5 flex items-center gap-1">
                    {getServiceCategoryIcon(apt.serviceCategory)}
                    <span>{apt.serviceName}</span>
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 pt-1 border-t border-slate-100 dark:border-neutral-800/60">
                    <span>{apt.staffName}</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      ${apt.price}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Appointment Detail Modal */}
      <IOSModal
        isOpen={!!activeAppointment}
        onClose={() => setActiveAppointment(null)}
        title="Detalles de la Cita"
        subtitle={activeAppointment ? `${activeAppointment.date} a las ${activeAppointment.time}` : ''}
      >
        {activeAppointment && (
          <div className="space-y-4 text-xs select-none">
            {/* Client Card */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/70 border border-slate-200/60 dark:border-neutral-700/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={activeAppointment.clientAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                  alt={activeAppointment.clientName}
                  className="w-10 h-10 rounded-full object-cover border border-white/50"
                />
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {activeAppointment.clientName}
                  </h4>
                  <p className="text-slate-500 dark:text-neutral-400 text-[11px] flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {activeAppointment.clientPhone}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Canal</span>
                <span className="font-bold text-[var(--primary)] uppercase">
                  {activeAppointment.channel}
                </span>
              </div>
            </div>

            {/* Service & Price Info */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/70 border border-slate-200/60 dark:border-neutral-700/60">
                <span className="text-[10px] uppercase font-bold text-slate-400">Servicio</span>
                <div className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                  {activeAppointment.serviceName}
                </div>
                <span className="text-[10px] text-slate-500">
                  {activeAppointment.durationMinutes} min con {activeAppointment.staffName}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/70 border border-slate-200/60 dark:border-neutral-700/60">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total / Anticipo</span>
                <div className="font-bold text-slate-800 dark:text-slate-100 mt-0.5 text-sm">
                  ${activeAppointment.price}
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  ✓ Pagó anticipo: ${activeAppointment.depositPaid}
                </span>
              </div>
            </div>

            {/* Notes */}
            {activeAppointment.notes && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-[11px]">
                <span className="font-bold block mb-0.5">Notas del cliente / Bot:</span>
                {activeAppointment.notes}
              </div>
            )}

            {/* Change Status Actions */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Actualizar Estado de Cita
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    updateAppointmentStatus(activeAppointment.id, 'attending');
                    setActiveAppointment({ ...activeAppointment, status: 'attending' });
                  }}
                  className="py-2.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30 ios-touch cursor-pointer hover:bg-amber-500/25"
                >
                  💆‍♀️ En Atención
                </button>
                <button
                  onClick={() => {
                    updateAppointmentStatus(activeAppointment.id, 'completed');
                    setActiveAppointment({ ...activeAppointment, status: 'completed' });
                  }}
                  className="py-2.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30 ios-touch cursor-pointer hover:bg-emerald-500/25"
                >
                  ✓ Completar Cita
                </button>
                <button
                  onClick={() => {
                    updateAppointmentStatus(activeAppointment.id, 'cancelled');
                    setActiveAppointment({ ...activeAppointment, status: 'cancelled' });
                  }}
                  className="py-2.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/30 ios-touch cursor-pointer hover:bg-rose-500/25"
                >
                  ✕ Cancelar Cita
                </button>
                <button
                  onClick={() => {
                    deleteAppointment(activeAppointment.id);
                    setActiveAppointment(null);
                  }}
                  className="py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 font-bold border border-slate-200 dark:border-neutral-700 ios-touch cursor-pointer hover:text-rose-500"
                >
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </IOSModal>

      {/* New Appointment Modal */}
      <IOSModal
        isOpen={showNewAptModal}
        onClose={() => setShowNewAptModal(false)}
        title="Nueva Cita en Salón"
        subtitle={`Agendando para el ${targetDateStr}`}
      >
        <form onSubmit={handleCreateAppointment} className="space-y-3 text-xs select-none">
          {/* Quick Select Existing Client or New */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Seleccionar de Clientes CRM (Opcional)
              </label>
              <span className="text-[10px] text-slate-400">Autocompletar</span>
            </div>
            <select
              value={selectedClientId}
              onChange={e => handleSelectClient(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="">-- Escribir nueva clienta o seleccionar --</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone}) - {c.visitsCount} visitas
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nombre de la Clienta *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Camila Restrepo"
              value={newClientName}
              onChange={e => {
                setNewClientName(e.target.value);
                if (selectedClientId) setSelectedClientId('');
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Teléfono / WhatsApp
              </label>
              <input
                type="tel"
                placeholder="+52 55..."
                value={newClientPhone}
                onChange={e => setNewClientPhone(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Hora de Cita
              </label>
              <select
                value={newTime}
                onChange={e => setNewTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none"
              >
                {['09:00', '10:00', '11:00', '12:00', '13:30', '15:00', '16:30', '18:00', '19:00'].map(
                  t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          {/* Service & Price Tiers */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Servicio de Belleza
            </label>
            <select
              value={newServiceId}
              onChange={e => handleServiceChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none"
            >
              {services.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} (${s.price} - {s.durationMinutes} min)
                </option>
              ))}
            </select>
          </div>

          {/* If service has multiple price tiers */}
          {(() => {
            const currentSrv = services.find(s => s.id === newServiceId);
            if (currentSrv && currentSrv.priceTiers && currentSrv.priceTiers.length > 1) {
              return (
                <div className="p-2.5 rounded-xl bg-rose-50/60 dark:bg-neutral-800 border border-rose-200/60 dark:border-neutral-700 space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-800 dark:text-slate-200">
                    Tabla de Precios / Tarifa Disponible
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {currentSrv.priceTiers.map((tier, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedTierName(tier.name);
                          setCustomPrice(tier.price);
                        }}
                        className={`p-2 rounded-lg text-left border transition ios-touch cursor-pointer ${
                          selectedTierName === tier.name || (!selectedTierName && idx === 0)
                            ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs'
                            : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="font-bold text-[11px] truncate">{tier.name}</div>
                        <div className="text-[10px] opacity-90">${tier.price}</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          })()}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Especialista / Estilista
              </label>
              <select
                value={newStaff}
                onChange={e => setNewStaff(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="Camila Ríos (Uñas)">Camila Ríos (Uñas)</option>
                <option value="Elena Soto (Spa Pies)">Elena Soto (Spa Pies)</option>
                <option value="Carlos M. (Peinados)">Carlos M. (Peinados)</option>
                <option value="Ana Lucía (Masajes)">Ana Lucía (Masajes)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Canal de Origen
              </label>
              <select
                value={newChannel}
                onChange={e => setNewChannel(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram DM</option>
                <option value="messenger">Facebook Messenger</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Notas adicionales o diseño requerido
            </label>
            <textarea
              rows={2}
              placeholder="Ej: Desea diseño con glitter o tiene tensión muscular..."
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          {/* Deposit & Buffer summary */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/80 border border-slate-200/60 dark:border-neutral-700/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-neutral-400">
              Anticipo requerido ({settings.depositPercent || 30}%):
            </span>
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
              ${Math.round((customPrice || services.find(s => s.id === newServiceId)?.price || 0) * ((settings.depositPercent || 30) / 100))}
            </span>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[var(--primary)] to-rose-500 text-white font-bold text-sm shadow-md ios-touch cursor-pointer"
          >
            Guardar Cita en Agenda
          </button>
        </form>
      </IOSModal>
    </div>
  );
};
