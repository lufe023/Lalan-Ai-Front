import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Mail,
  Calendar,
  MessageSquare,
  Sparkles,
  AlertTriangle,
  Heart,
  Crown,
  Tag,
  Clock,
  DollarSign,
  ChevronRight,
  Filter,
  CheckCircle2,
  Trash2,
  Edit3,
  Music,
  Coffee,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Client, ClientTag, CommunicationChannel } from '../types';
import { IOSHeader } from '../components/ui/IOSHeader';
import { IOSModal } from '../components/ui/IOSModal';
import { PageContent } from '../components/ui/PageContent';

export const ClientsScreen: React.FC = () => {
  const {
    clients,
    addClient,
    updateClient,
    deleteClient,
    startChatWithClient,
    navigateTo,
    appointments,
    playMusicForClient,
  } = useApp();
  const { currentUser } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<{ name?: string; phone?: string }>({});
  const [formApiError, setFormApiError] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);

  // Form State for New / Edit Client
  const [formData, setFormData] = useState<{
    name: string;
    phone: string;
    email: string;
    avatar: string;
    preferredChannel: CommunicationChannel;
    tags: ClientTag[];
    beautyNotes: string;
    medicalOrAllergyNotes: string;
  }>({
    name: '',
    phone: '',
    email: '',
    avatar: '',
    preferredChannel: 'whatsapp',
    tags: ['nuevo'],
    beautyNotes: '',
    medicalOrAllergyNotes: '',
  });

  // Filter Clients
  const filteredClients = clients.filter(client => {
    const matchesSearch =
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone.includes(searchQuery) ||
      (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTag =
      selectedTagFilter === 'all' ||
      client.tags.includes(selectedTagFilter as ClientTag) ||
      (selectedTagFilter === 'whatsapp' && client.preferredChannel === 'whatsapp') ||
      (selectedTagFilter === 'instagram' && client.preferredChannel === 'instagram');

    return matchesSearch && matchesTag;
  });

  const availableTags: { id: ClientTag; label: string; icon: string; colorClass: string }[] = [
    { id: 'vip', label: 'VIP Glamour', icon: '👑', colorClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' },
    { id: 'frecuente', label: 'Frecuente', icon: '💖', colorClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30' },
    { id: 'nuevo', label: 'Nueva Clienta', icon: '✨', colorClass: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30' },
    { id: 'alergico_sensible', label: 'Piel Sensible / Alergias', icon: '⚠️', colorClass: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30' },
    { id: 'puntual', label: '100% Puntual', icon: '⏰', colorClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
    { id: 'requiere_anticipo', label: 'Requiere Anticipo 50%', icon: '💳', colorClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30' },
  ];

  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData({
      name: '',
      phone: '+52 55 ',
      email: '',
      avatar: '',
      preferredChannel: 'whatsapp',
      tags: ['nuevo'],
      beautyNotes: '',
      medicalOrAllergyNotes: '',
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (client: Client) => {
    setIsEditing(true);
    setFormData({
      name: client.name,
      phone: client.phone,
      email: client.email || '',
      avatar: client.avatar,
      preferredChannel: client.preferredChannel,
      tags: client.tags,
      beautyNotes: client.beautyNotes || '',
      medicalOrAllergyNotes: client.medicalOrAllergyNotes || '',
    });
    setShowAddModal(true);
  };

  const handleToggleTag = (tag: ClientTag) => {
    setFormData(prev => {
      const exists = prev.tags.includes(tag);
      return {
        ...prev,
        tags: exists ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag],
      };
    });
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    // Client-side validation
    const errors: { name?: string; phone?: string } = {};
    if (!formData.name.trim()) errors.name = 'El nombre es obligatorio.';
    if (!formData.phone.trim()) errors.phone = 'El teléfono es obligatorio.';
    else if (!/^[+\d][\d\s\-().]{5,}$/.test(formData.phone.trim())) errors.phone = 'Ingresa un teléfono válido.';
    if (Object.keys(errors).length) { setFormErrors(errors); return; }
    setFormErrors({});
    setFormApiError('');
    setIsSaving(true);
    try {
      if (isEditing && selectedClient) {
        await updateClient(selectedClient.id, {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim(),
          preferredChannel: formData.preferredChannel,
          tags: formData.tags,
          beautyNotes: formData.beautyNotes.trim(),
          medicalOrAllergyNotes: formData.medicalOrAllergyNotes.trim(),
        });
        setSelectedClient({
          ...selectedClient,
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim(),
          preferredChannel: formData.preferredChannel,
          tags: formData.tags,
          beautyNotes: formData.beautyNotes.trim(),
          medicalOrAllergyNotes: formData.medicalOrAllergyNotes.trim(),
        });
      } else {
        const created = await addClient({
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim(),
          avatar:
            formData.avatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name.trim())}&background=e2e8f0&color=475569`,
          preferredChannel: formData.preferredChannel,
          tags: formData.tags,
          beautyNotes: formData.beautyNotes.trim(),
          medicalOrAllergyNotes: formData.medicalOrAllergyNotes.trim(),
          totalVisits: 0,
          totalSpent: 0,
        });
        setSelectedClient(created);
        showToast('Clienta registrada', `${formData.name.trim()} ha sido añadida a tu CRM.`, 'success');
      }
      setShowAddModal(false);
    } catch (err: any) {
      setFormApiError(err?.message ?? 'Ocurrió un error. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const getTagBadge = (tag: ClientTag) => {
    const found = availableTags.find(t => t.id === tag);
    if (!found) return null;
    return (
      <span
        key={tag}
        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${found.colorClass}`}
      >
        <span>{found.icon}</span>
        <span>{found.label}</span>
      </span>
    );
  };

  const getChannelIcon = (ch: CommunicationChannel) => {
    switch (ch) {
      case 'whatsapp':
        return <span className="text-emerald-500 font-extrabold">WhatsApp</span>;
      case 'instagram':
        return <span className="text-pink-500 font-extrabold">Instagram</span>;
      case 'messenger':
        return <span className="text-blue-500 font-extrabold">Messenger</span>;
    }
  };

  // Get appointments for selected client
  const clientAppointments = selectedClient
    ? appointments.filter(a => a.clientId === selectedClient.id || a.clientName.toLowerCase() === selectedClient.name.toLowerCase())
    : [];

  return (
    <div id="clients-screen" className="flex-1 w-full h-full flex flex-col overflow-hidden">
      <IOSHeader
        title="Clientas"
        subtitle={`${clients.length} registradas en el directorio`}
        rightAction={
          <button
            onClick={handleOpenAdd}
            className="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-sm ios-touch cursor-pointer hover:opacity-90 transition"
            title="Registrar Nueva Clienta"
          >
            <UserPlus className="w-4 h-4 stroke-[2.5]" />
          </button>
        }
      />

      <PageContent className="space-y-3.5">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o correo..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-xs"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-0.5">
          {[
            { id: 'all', label: 'Todas' },
            { id: 'vip', label: '👑 VIP' },
            { id: 'frecuente', label: '💖 Frecuentes' },
            { id: 'nuevo', label: '✨ Nuevas' },
            { id: 'alergico_sensible', label: '⚠️ Sensibles / Alergias' },
            { id: 'whatsapp', label: '💬 WhatsApp' },
            { id: 'instagram', label: '📸 Instagram' },
          ].map(f => {
            const isSelected = selectedTagFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setSelectedTagFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ios-touch cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--primary)] text-white shadow-xs font-bold'
                    : 'bg-white dark:bg-neutral-900 text-slate-700 dark:text-neutral-300 border border-slate-200/80 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Clients List */}
        {filteredClients.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center p-6 bg-white dark:bg-neutral-900 rounded-2xl border border-dashed border-slate-300 dark:border-neutral-800">
            <Users className="w-10 h-10 text-slate-300 dark:text-neutral-700 mb-2" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No se encontraron clientas
            </h4>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 max-w-xs">
              No hay registros con ese criterio de búsqueda. Puedes registrar una nueva clienta ahora mismo.
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-4 px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-xs font-bold ios-touch cursor-pointer"
            >
              + Registrar Clienta
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredClients.map((client, idx) => (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => setSelectedClient(client)}
                className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs hover:border-slate-300 dark:hover:border-neutral-700 transition cursor-pointer ios-touch flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={client.avatar}
                      alt={client.name}
                      className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-neutral-700"
                    />
                    {client.tags.includes('vip') && (
                      <span className="absolute -top-1 -right-1 text-xs">👑</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {client.name}
                      </h4>
                      {client.tags.includes('alergico_sensible') && (
                        <span className="text-[10px] text-amber-500" title="Piel sensible o alergias">
                          ⚠️
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-neutral-400 truncate flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{client.phone}</span>
                      <span className="text-slate-300 dark:text-neutral-700">•</span>
                      <span>{getChannelIcon(client.preferredChannel)}</span>
                    </p>

                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {client.tags.slice(0, 2).map(tag => getTagBadge(tag))}
                      {client.tags.length > 2 && (
                        <span className="text-[9px] font-bold text-slate-400">
                          +{client.tags.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0 pl-2">
                  <span className="text-[11px] font-black text-slate-900 dark:text-white">
                    ${client.totalSpent}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {client.totalVisits} {client.totalVisits === 1 ? 'visita' : 'visitas'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-neutral-600 mt-1" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </PageContent>

      {/* Client Detail Sheet / Modal */}
      <IOSModal
        isOpen={!!selectedClient}
        onClose={() => setSelectedClient(null)}
        title="Ficha Integral de Clienta"
        subtitle={selectedClient ? `Registrada el ${selectedClient.registeredDate}` : ''}
      >
        {selectedClient && (
          <div className="space-y-4 text-xs select-none">
            {/* Header Profile Card */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-50 to-rose-50/40 dark:from-neutral-800/80 dark:to-neutral-900 border border-slate-200/80 dark:border-neutral-700/70 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={selectedClient.avatar}
                  alt={selectedClient.name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-white dark:border-neutral-700 shadow-sm"
                />
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                    {selectedClient.name}
                    {selectedClient.tags.includes('vip') && <span>👑</span>}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {selectedClient.phone}
                  </p>
                  {selectedClient.email && (
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-400" />
                      {selectedClient.email}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleOpenEdit(selectedClient)}
                className="p-1.5 rounded-xl bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 hover:text-[var(--primary)] ios-touch cursor-pointer"
                title="Editar Ficha"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>

            {/* Loyalty Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/60 dark:border-neutral-700/60 text-center">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Total Visitas</span>
                <span className="text-sm font-black text-slate-800 dark:text-white mt-0.5 block">
                  {selectedClient.totalVisits}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/60 dark:border-neutral-700/60 text-center">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Consumo Total</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                  ${selectedClient.totalSpent}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/60 dark:border-neutral-700/60 text-center">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Canal</span>
                <span className="text-[11px] font-bold text-slate-800 dark:text-white mt-0.5 block capitalize">
                  {selectedClient.preferredChannel}
                </span>
              </div>
            </div>

            {/* Tags Container */}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                Etiquetas & Perfil de Clienta
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedClient.tags.map(t => getTagBadge(t))}
              </div>
            </div>

            {/* Beauty & Styling Preferences */}
            {selectedClient.beautyNotes && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-slate-800 dark:text-rose-200">
                <div className="flex items-center gap-1.5 font-bold text-[11px] text-rose-700 dark:text-rose-300 mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Preferencias de Belleza & Estilismo:</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">{selectedClient.beautyNotes}</p>
              </div>
            )}

            {/* Medical / Allergies Alert */}
            {selectedClient.medicalOrAllergyNotes && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-slate-800 dark:text-amber-200">
                <div className="flex items-center gap-1.5 font-bold text-[11px] text-amber-700 dark:text-amber-300 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span>Alergias & Sensibilidades (Importante para Estilistas):</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">{selectedClient.medicalOrAllergyNotes}</p>
              </div>
            )}

            {/* VIP Lounge & Hospitality Preferences Card */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-[var(--primary)]/10 to-rose-500/10 border border-amber-500/30 dark:border-amber-500/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Hospitalidad VIP & Experiencia en Sillón</span>
                </div>
                <button
                  onClick={() => {
                    playMusicForClient(selectedClient);
                    setSelectedClient(null);
                  }}
                  className="px-2.5 py-1 rounded-full bg-[var(--primary)] text-white text-[10px] font-bold flex items-center gap-1 hover:scale-105 active:scale-95 transition shadow-xs cursor-pointer"
                  title="Abrir Lounge y activar ambiente musical para esta clienta"
                >
                  <Music className="w-3 h-3" />
                  <span>Activar Lounge</span>
                </button>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-start gap-1.5 text-slate-700 dark:text-neutral-300">
                  <Coffee className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-500 dark:text-neutral-400">Bebidas: </span>
                    <span className="font-bold text-slate-800 dark:text-neutral-200">
                      {selectedClient.hospitality?.favoriteDrinks?.join(', ') || 'Café espresso, té de menta'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-1.5 text-slate-700 dark:text-neutral-300">
                  <span className="text-xs shrink-0">🍓</span>
                  <div>
                    <span className="font-semibold text-slate-500 dark:text-neutral-400">Snacks: </span>
                    <span className="font-bold text-slate-800 dark:text-neutral-200">
                      {selectedClient.hospitality?.favoriteSnacks?.join(', ') || 'Macarons, galletas de avena'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-1.5 text-slate-700 dark:text-neutral-300">
                  <Music className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-500 dark:text-neutral-400">Ambiente & Música: </span>
                    <span className="font-bold text-slate-800 dark:text-neutral-200">
                      {selectedClient.hospitality?.musicVibe || 'Lofi Chill'}
                      {selectedClient.hospitality?.favoriteArtistsOrSongs && selectedClient.hospitality.favoriteArtistsOrSongs.length > 0 &&
                        ` (${selectedClient.hospitality.favoriteArtistsOrSongs.join(', ')})`
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => {
                  setSelectedClient(null);
                  startChatWithClient(selectedClient);
                }}
                className="py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold flex items-center justify-center gap-1.5 ios-touch cursor-pointer shadow-xs"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Abrir Chat Meta</span>
              </button>

              <button
                onClick={() => {
                  setSelectedClient(null);
                  navigateTo('calendar');
                }}
                className="py-2.5 rounded-xl bg-[var(--primary)] text-white font-bold flex items-center justify-center gap-1.5 ios-touch cursor-pointer shadow-xs"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Agendar Cita</span>
              </button>
            </div>

            {/* Appointment History for this Client */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-neutral-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">
                Historial de Citas ({clientAppointments.length})
              </span>
              {clientAppointments.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">No tiene citas agendadas recientes.</p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto hide-scrollbar">
                  {clientAppointments.map(apt => (
                    <div
                      key={apt.id}
                      className="p-2 rounded-xl bg-slate-50 dark:bg-neutral-800/50 border border-slate-200/60 dark:border-neutral-700/60 flex items-center justify-between text-[11px]"
                    >
                      <div>
                        <span className="font-bold text-slate-800 dark:text-white block">{apt.serviceName}</span>
                        <span className="text-[10px] text-slate-400">{apt.date} • {apt.time} ({apt.staffName})</span>
                      </div>
                      <span className="font-extrabold text-slate-700 dark:text-neutral-300">${apt.price}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Delete Client */}
            <div className="pt-2">
              <button
                onClick={() => {
                  if (confirm(`¿Eliminar a ${selectedClient.name} del directorio?`)) {
                    deleteClient(selectedClient.id);
                    setSelectedClient(null);
                  }
                }}
                className="w-full py-2 text-rose-500 hover:text-rose-600 font-semibold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Clienta del Directorio</span>
              </button>
            </div>
          </div>
        )}
      </IOSModal>

      {/* Add / Edit Client Modal */}
      <IOSModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={isEditing ? 'Editar Datos de Clienta' : 'Registrar Nueva Clienta'}
        subtitle="Lalan AI CRM & Ficha Personalizada"
      >
        <form onSubmit={handleSaveClient} noValidate className="space-y-3 text-xs select-none">

          {/* API error banner */}
          {formApiError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-400 text-[11px] font-medium">
              <span className="mt-0.5 shrink-0">⚠️</span>
              <span>{formApiError}</span>
            </div>
          )}

          {/* Nombre */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nombre Completo <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              placeholder="Ej: Luciana Gómez"
              value={formData.name}
              onChange={e => { setFormData({ ...formData, name: e.target.value }); setFormErrors(fe => ({ ...fe, name: '' })); }}
              className={`w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition ${
                formErrors.name ? 'border-rose-400 dark:border-rose-600 bg-rose-50 dark:bg-rose-950/20' : 'border-slate-200 dark:border-neutral-700'
              }`}
            />
            {formErrors.name && (
              <p className="mt-1 text-[10px] text-rose-500 font-semibold flex items-center gap-1">
                <span>●</span> {formErrors.name}
              </p>
            )}
          </div>

          {/* Teléfono + Canal */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Teléfono <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                inputMode="tel"
                placeholder="+58 414 000 0000"
                value={formData.phone}
                onChange={e => { setFormData({ ...formData, phone: e.target.value }); setFormErrors(fe => ({ ...fe, phone: '' })); }}
                className={`w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition ${
                  formErrors.phone ? 'border-rose-400 dark:border-rose-600 bg-rose-50 dark:bg-rose-950/20' : 'border-slate-200 dark:border-neutral-700'
                }`}
              />
              {formErrors.phone && (
                <p className="mt-1 text-[10px] text-rose-500 font-semibold flex items-center gap-1">
                  <span>●</span> {formErrors.phone}
                </p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Canal Preferido
              </label>
              <select
                value={formData.preferredChannel}
                onChange={e => setFormData({ ...formData, preferredChannel: e.target.value as any })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
                <option value="messenger">Messenger</option>
              </select>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Correo Electrónico
              <span className="ml-1 font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              type="email"
              inputMode="email"
              placeholder="cliente@ejemplo.com"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Perfil de Clienta
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {availableTags.map(tag => {
                const isSelected = formData.tags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleToggleTag(tag.id)}
                    className={`px-2 py-1.5 rounded-xl text-[11px] font-bold text-left border flex items-center gap-1.5 transition ios-touch cursor-pointer ${
                      isSelected
                        ? `${tag.colorClass} border-current ring-1 ring-current`
                        : 'bg-slate-50 dark:bg-neutral-800/40 text-slate-500 border-slate-200 dark:border-neutral-700 hover:border-slate-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span>{tag.icon}</span>
                    <span className="truncate">{tag.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Beauty Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Preferencias de Belleza
              <span className="ml-1 font-normal text-slate-400">(uñas, tonos, aromas)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Ej: Punta coffin, tono baby boomer, aromaterapia lavanda…"
              value={formData.beautyNotes}
              onChange={e => setFormData({ ...formData, beautyNotes: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition resize-none"
            />
          </div>

          {/* Medical Notes */}
          <div>
            <label className="block text-[11px] font-bold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
              <span>⚠️</span> Alergias o Cuidados Especiales
            </label>
            <textarea
              rows={2}
              placeholder="Ej: Alergia a acetona pura, piel reactiva a la parafina…"
              value={formData.medicalOrAllergyNotes}
              onChange={e => setFormData({ ...formData, medicalOrAllergyNotes: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition resize-none"
            />
          </div>

          {/* Hint line */}
          <p className="text-[10px] text-slate-400 dark:text-neutral-600 text-center">
            Los campos marcados con <span className="text-rose-500 font-bold">*</span> son obligatorios.
          </p>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[var(--primary)] to-rose-500 text-white font-bold text-sm shadow-md ios-touch cursor-pointer mt-1 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {isSaving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                {isEditing ? 'Guardando…' : 'Registrando…'}
              </>
            ) : (
              isEditing ? '✓ Guardar Cambios' : '✨ Registrar Clienta'
            )}
          </button>
        </form>
      </IOSModal>
    </div>
  );
};
