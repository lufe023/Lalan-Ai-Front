import React, { useState, useEffect, useCallback } from 'react';
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
  Plus,
  X,
  Star,
  Settings,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
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

  // ── Preferences state ────────────────────────────────────────────
  // NOTE: el backend agrupa así → [{ category: {...}, items: [...] }]
  type PrefCategory = {
    category: { id: string; name: string; type: string; icon: string | null; color: string | null };
    items: { id: string; clientId: string; preferenceId: string; intensity: number | null; notes: string | null; source: string;
      preference: { id: string; value: string; category?: { id: string; name: string; type: string; icon: string | null; color: string | null } } }[];
  };
  type PrefCatalogItem = {
    id: string; value: string; categoryId: string;
    category: { id: string; name: string; type: string; icon: string | null; color: string | null };
  };

  const [clientPrefs, setClientPrefs] = useState<PrefCategory[]>([]);
  const [prefCatalog, setPrefCatalog] = useState<PrefCatalogItem[]>([]);
  const [prefCatalogLoaded, setPrefCatalogLoaded] = useState(false);
  const [showPrefPanel, setShowPrefPanel] = useState(false);
  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [addingPrefId, setAddingPrefId] = useState<string | null>(null);

  // ── Catalog Manager state ─────────────────────────────────────────
  type MgCategory = {
    id: string; name: string; type: string; icon: string | null; color: string | null;
    preferences: { id: string; value: string }[];
  };
  const [showCatalogMgr, setShowCatalogMgr] = useState(false);
  const [mgCategories, setMgCategories] = useState<MgCategory[]>([]);
  const [mgLoading, setMgLoading] = useState(false);
  const [mgExpandedCatId, setMgExpandedCatId] = useState<string | null>(null);
  const [mgDeletingId, setMgDeletingId] = useState<string | null>(null);
  const [mgCatForm, setMgCatForm] = useState({ name: '', type: 'other', icon: '', color: '#6366f1' });
  const [mgAddingCat, setMgAddingCat] = useState(false);
  const [mgPrefInputs, setMgPrefInputs] = useState<Record<string, string>>({});
  const [mgAddingPrefCatId, setMgAddingPrefCatId] = useState<string | null>(null);

  // ── Quick-add: crear preferencia y asignarla sin salir del panel ──
  const [quickValue, setQuickValue] = useState('');
  const [quickCatId, setQuickCatId] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickNewCatName, setQuickNewCatName] = useState('');
  const [quickNewCatType, setQuickNewCatType] = useState('other');

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

  // Load client preferences when a client is selected
  useEffect(() => {
    if (!selectedClient) { setClientPrefs([]); setShowPrefPanel(false); return; }
    let cancelled = false;
    const load = async () => {
      setLoadingPrefs(true);
      try {
        const data = await api.get<PrefCategory[]>(`/preferences/clients/${selectedClient.id}`);
        if (!cancelled) setClientPrefs(data);
      } catch { /* silent – feature is optional */ }
      finally { if (!cancelled) setLoadingPrefs(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedClient?.id]);

  // Load full catalog + categories once when the add panel is opened
  const handleOpenPrefPanel = useCallback(async () => {
    setShowPrefPanel(true);
    if (prefCatalogLoaded) return;
    try {
      const [values, cats] = await Promise.all([
        api.get<PrefCatalogItem[]>('/preferences'),
        api.get<MgCategory[]>('/preferences/categories'),
      ]);
      setPrefCatalog(values);
      setMgCategories(cats);
      if (cats.length) setQuickCatId(prev => prev || cats[0].id);
    } catch { /* silent */ }
    finally { setPrefCatalogLoaded(true); }
  }, [prefCatalogLoaded]);

  const handleAddPref = useCallback(async (clientId: string, preferenceId: string) => {
    setAddingPrefId(preferenceId);
    try {
      await api.post(`/preferences/clients/${clientId}`, { preferenceId });
      const data = await api.get<PrefCategory[]>(`/preferences/clients/${clientId}`);
      setClientPrefs(data);
    } catch { /* silent */ }
    finally { setAddingPrefId(null); }
  }, []);

  const handleRemovePref = useCallback(async (clientId: string, preferenceId: string) => {
    try {
      await api.delete(`/preferences/clients/${clientId}/${preferenceId}`);
      setClientPrefs(prev =>
        prev.map(cat => ({
          ...cat,
          items: cat.items.filter(i => i.preferenceId !== preferenceId),
        })).filter(cat => cat.items.length > 0)
      );
    } catch { /* silent */ }
  }, []);

  /**
   * Crea la preferencia (y la categoría si hace falta) y la asigna a la clienta
   * en un solo paso, sin salir del panel.
   */
  const handleQuickCreatePref = useCallback(async () => {
    const value = quickValue.trim();
    if (!value || !selectedClient) return;
    setQuickBusy(true);
    try {
      let categoryId = quickCatId;

      // Sin categoría elegida → crearla al vuelo
      if (!categoryId) {
        const created = await api.post<{ id: string }>('/preferences/categories', {
          name: quickNewCatName.trim() || 'General',
          type: quickNewCatType,
        });
        categoryId = created.id;
        setQuickCatId(created.id);
        setQuickNewCatName('');
      }

      const pref = await api.post<{ id: string }>('/preferences', { value, categoryId });
      await api.post(`/preferences/clients/${selectedClient.id}`, { preferenceId: pref.id });

      const [clientData, values, cats] = await Promise.all([
        api.get<PrefCategory[]>(`/preferences/clients/${selectedClient.id}`),
        api.get<PrefCatalogItem[]>('/preferences'),
        api.get<MgCategory[]>('/preferences/categories'),
      ]);
      setClientPrefs(clientData);
      setPrefCatalog(values);
      setMgCategories(cats);
      setQuickValue('');
    } catch { /* silent */ }
    finally { setQuickBusy(false); }
  }, [quickValue, quickCatId, quickNewCatName, quickNewCatType, selectedClient]);

  // ── Catalog Manager CRUD ─────────────────────────────────────────
  const loadCatalogMgr = useCallback(async () => {
    setMgLoading(true);
    try {
      const data = await api.get<MgCategory[]>('/preferences/categories');
      setMgCategories(data);
    } catch { /* silent */ }
    finally { setMgLoading(false); }
  }, []);

  const handleOpenCatalogMgr = useCallback(() => {
    setShowCatalogMgr(true);
    loadCatalogMgr();
  }, [loadCatalogMgr]);

  const invalidateCatalog = useCallback(() => {
    setPrefCatalog([]);
    setPrefCatalogLoaded(false);
  }, []);

  const handleMgCreateCat = useCallback(async () => {
    if (!mgCatForm.name.trim()) return;
    setMgAddingCat(true);
    try {
      await api.post('/preferences/categories', {
        name: mgCatForm.name.trim(),
        type: mgCatForm.type,
        ...(mgCatForm.icon.trim() ? { icon: mgCatForm.icon.trim() } : {}),
        ...(mgCatForm.color ? { color: mgCatForm.color } : {}),
      });
      setMgCatForm({ name: '', type: 'other', icon: '', color: '#6366f1' });
      await loadCatalogMgr();
      invalidateCatalog();
    } catch { /* silent */ }
    finally { setMgAddingCat(false); }
  }, [mgCatForm, loadCatalogMgr, invalidateCatalog]);

  const handleMgDeleteCat = useCallback(async (id: string) => {
    setMgDeletingId(id);
    try {
      await api.delete(`/preferences/categories/${id}`);
      setMgCategories(prev => prev.filter(c => c.id !== id));
      invalidateCatalog();
    } catch { /* silent */ }
    finally { setMgDeletingId(null); }
  }, [invalidateCatalog]);

  const handleMgAddPref = useCallback(async (categoryId: string) => {
    const value = (mgPrefInputs[categoryId] ?? '').trim();
    if (!value) return;
    setMgAddingPrefCatId(categoryId);
    try {
      await api.post('/preferences', { value, categoryId });
      setMgPrefInputs(prev => ({ ...prev, [categoryId]: '' }));
      await loadCatalogMgr();
      invalidateCatalog();
    } catch { /* silent */ }
    finally { setMgAddingPrefCatId(null); }
  }, [mgPrefInputs, loadCatalogMgr, invalidateCatalog]);

  const handleMgDeletePref = useCallback(async (prefId: string, categoryId: string) => {
    setMgDeletingId(prefId);
    try {
      await api.delete(`/preferences/${prefId}`);
      setMgCategories(prev => prev.map(c =>
        c.id === categoryId
          ? { ...c, preferences: c.preferences.filter(p => p.id !== prefId) }
          : c
      ));
      invalidateCatalog();
    } catch { /* silent */ }
    finally { setMgDeletingId(null); }
  }, [invalidateCatalog]);

  // Category type → icon/color helpers
  const prefTypeIcon = (type: string, icon: string | null) => {
    if (icon) return icon;
    const map: Record<string, string> = {
      music: '🎵', drink: '☕', food: '🍓', style: '✨', movie: '🎬', other: '⭐',
    };
    return map[type] ?? '⭐';
  };

  const prefTypeColor = (type: string) => {
    const map: Record<string, string> = {
      music: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25',
      drink: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
      food:  'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
      style: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25',
      movie: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25',
      other: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20',
    };
    return map[type] ?? map.other;
  };

  // Already-added preference ids for quick lookup
  const addedPrefIds = new Set(clientPrefs.flatMap(cat => cat.items.map(i => i.preferenceId)));

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
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenCatalogMgr}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 flex items-center justify-center shadow-sm ios-touch cursor-pointer hover:bg-slate-200 dark:hover:bg-neutral-700 transition"
              title="Gestionar catálogo de preferencias"
            >
              <Sparkles className="w-4 h-4 stroke-[2.5]" />
            </button>
            <button
              onClick={handleOpenAdd}
              className="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-sm ios-touch cursor-pointer hover:opacity-90 transition"
              title="Registrar Nueva Clienta"
            >
              <UserPlus className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
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

            {/* VIP Lounge & Preferences Card */}
            <div className="rounded-2xl border border-amber-500/30 dark:border-amber-500/20 overflow-hidden">
              {/* Header */}
              <div className="px-3.5 py-2.5 bg-gradient-to-r from-amber-500/10 via-[var(--primary)]/10 to-rose-500/10 flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Hospitalidad & Preferencias</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleOpenPrefPanel}
                    className="px-2 py-1 rounded-full bg-white/70 dark:bg-neutral-800/70 text-slate-600 dark:text-neutral-300 text-[10px] font-bold flex items-center gap-1 border border-slate-200/60 dark:border-neutral-700/60 hover:border-slate-300 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Añadir</span>
                  </button>
                  <button
                    onClick={() => { playMusicForClient(selectedClient); setSelectedClient(null); }}
                    className="px-2.5 py-1 rounded-full bg-[var(--primary)] text-white text-[10px] font-bold flex items-center gap-1 hover:scale-105 active:scale-95 transition shadow-xs cursor-pointer"
                    title="Abrir Lounge para esta clienta"
                  >
                    <Music className="w-3 h-3" />
                    <span>Lounge</span>
                  </button>
                </div>
              </div>

              {/* Preferences body */}
              <div className="p-3 bg-white/60 dark:bg-neutral-900/60 space-y-2.5">
                {loadingPrefs ? (
                  <p className="text-[11px] text-slate-400 italic text-center py-2">Cargando preferencias…</p>
                ) : clientPrefs.length === 0 ? (
                  <div className="text-center py-3">
                    <p className="text-[11px] text-slate-400 dark:text-neutral-500">Sin preferencias registradas aún.</p>
                    <button
                      onClick={handleOpenPrefPanel}
                      className="mt-2 text-[11px] font-bold text-[var(--primary)] flex items-center gap-1 mx-auto cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Registrar primera preferencia
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {clientPrefs.map(cat => (
                      <div key={cat.category.id}>
                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-neutral-500 flex items-center gap-1 mb-1">
                          <span>{prefTypeIcon(cat.category.type, cat.category.icon)}</span>
                          <span>{cat.category.name}</span>
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {cat.items.map(item => (
                            <div
                              key={item.id}
                              className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-semibold ${prefTypeColor(cat.category.type)}`}
                            >
                              <span>{item.preference.value}</span>
                              {item.intensity && (
                                <span className="flex gap-0.5 ml-0.5">
                                  {Array.from({ length: item.intensity }).map((_, i) => (
                                    <Star key={i} className="w-2 h-2 fill-current opacity-70" />
                                  ))}
                                </span>
                              )}
                              <button
                                onClick={() => handleRemovePref(selectedClient.id, item.preferenceId)}
                                className="ml-0.5 opacity-50 hover:opacity-100 transition cursor-pointer"
                                title="Quitar preferencia"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add-preferences inline panel */}
                {showPrefPanel && (
                  <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-neutral-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Catálogo de preferencias</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={handleOpenCatalogMgr}
                          className="text-slate-400 hover:text-[var(--primary)] cursor-pointer transition"
                          title="Gestionar catálogo"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setShowPrefPanel(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {/* ── Quick-add: escribir y crear en el momento ── */}
                    {prefCatalogLoaded && (
                      <div className="mb-2.5 space-y-1.5">
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={quickValue}
                            onChange={e => setQuickValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleQuickCreatePref(); } }}
                            placeholder="Buscar o escribir una preferencia nueva…"
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 text-[11px] border border-slate-200 dark:border-neutral-700 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] text-slate-900 dark:text-white"
                          />
                          <button
                            onClick={handleQuickCreatePref}
                            disabled={quickBusy || !quickValue.trim()}
                            className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-[11px] font-bold disabled:opacity-40 cursor-pointer transition active:scale-95 whitespace-nowrap"
                            title="Crear y añadir a esta clienta"
                          >
                            {quickBusy ? '…' : '+ Crear'}
                          </button>
                        </div>

                        <div className="flex gap-1.5">
                          <select
                            value={quickCatId}
                            onChange={e => setQuickCatId(e.target.value)}
                            className="flex-1 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 text-[11px] text-slate-700 dark:text-white border border-slate-200 dark:border-neutral-700 focus:outline-none"
                          >
                            {mgCategories.map(c => (
                              <option key={c.id} value={c.id}>
                                {(c.icon ?? prefTypeIcon(c.type, c.icon))} {c.name}
                              </option>
                            ))}
                            <option value="">➕ Nueva categoría…</option>
                          </select>
                        </div>

                        {/* Formulario inline solo si se eligió "nueva categoría" */}
                        {!quickCatId && (
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={quickNewCatName}
                              onChange={e => setQuickNewCatName(e.target.value)}
                              placeholder="Nombre de la categoría (ej: Música)"
                              className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 text-[11px] border border-slate-200 dark:border-neutral-700 focus:outline-none text-slate-900 dark:text-white"
                            />
                            <select
                              value={quickNewCatType}
                              onChange={e => setQuickNewCatType(e.target.value)}
                              className="px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 text-[11px] text-slate-700 dark:text-white border border-slate-200 dark:border-neutral-700 focus:outline-none"
                            >
                              {([['music','🎵'],['drink','☕'],['food','🍓'],['style','✨'],['movie','🎬'],['other','⭐']] as [string,string][]).map(([v,l]) => (
                                <option key={v} value={v}>{l}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}

                    {!prefCatalogLoaded ? (
                      <p className="text-[11px] text-slate-400 italic">Cargando catálogo…</p>
                    ) : prefCatalog.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">
                        Aún no hay opciones guardadas. Escribe arriba y presiona <b>Crear</b> para añadir la primera.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto hide-scrollbar">
                        {/* Group catalog by category */}
                        {Object.entries(
                          prefCatalog.reduce<Record<string, { cat: PrefCatalogItem['category']; items: PrefCatalogItem[] }>>((acc, p) => {
                            const key = p.category.id;
                            if (!acc[key]) acc[key] = { cat: p.category, items: [] };
                            acc[key].items.push(p);
                            return acc;
                          }, {})
                        ).map(([catId, { cat, items }]) => (
                          <div key={catId}>
                            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
                              <span>{prefTypeIcon(cat.type, cat.icon)}</span>
                              <span>{cat.name}</span>
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {items.map(p => {
                                const already = addedPrefIds.has(p.id);
                                return (
                                  <button
                                    key={p.id}
                                    disabled={already || addingPrefId === p.id}
                                    onClick={() => !already && handleAddPref(selectedClient.id, p.id)}
                                    className={`px-2 py-1 rounded-full border text-[11px] font-semibold transition cursor-pointer ${
                                      already
                                        ? 'opacity-40 cursor-not-allowed ' + prefTypeColor(cat.type)
                                        : addingPrefId === p.id
                                        ? 'opacity-60 ' + prefTypeColor(cat.type)
                                        : 'bg-slate-50 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 border-slate-200 dark:border-neutral-700 hover:border-[var(--primary)] hover:text-[var(--primary)]'
                                    }`}
                                  >
                                    {already ? '✓ ' : addingPrefId === p.id ? '…' : '+ '}
                                    {p.value}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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

      {/* ── Catalog Manager Modal ──────────────────────────────────── */}
      <IOSModal
        id="catalog-mgr-modal"
        isOpen={showCatalogMgr}
        onClose={() => setShowCatalogMgr(false)}
        title="Gestión de Catálogo"
        subtitle="Categorías y opciones de preferencias"
      >
        <div className="space-y-4 text-xs">

          {/* ── Nueva Categoría ─────────────────────────── */}
          <div className="rounded-xl border border-slate-200 dark:border-neutral-700 p-3 space-y-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-neutral-400 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Nueva Categoría
            </span>

            <input
              type="text"
              placeholder="Nombre (ej: Bebidas)"
              value={mgCatForm.name}
              onChange={e => setMgCatForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-2.5 py-2 rounded-lg bg-slate-100 dark:bg-neutral-800 text-[12px] text-slate-900 dark:text-white border border-slate-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={mgCatForm.type}
                onChange={e => setMgCatForm(f => ({ ...f, type: e.target.value }))}
                className="px-2 py-2 rounded-lg bg-slate-100 dark:bg-neutral-800 text-[12px] text-slate-700 dark:text-white border border-slate-200 dark:border-neutral-700 focus:outline-none"
              >
                {([['music','🎵 Música'],['drink','☕ Bebidas'],['food','🍓 Comida'],['style','✨ Estilo'],['movie','🎬 Películas'],['other','⭐ Otro']] as [string, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Emoji ícono"
                value={mgCatForm.icon}
                onChange={e => setMgCatForm(f => ({ ...f, icon: e.target.value }))}
                className="px-2.5 py-2 rounded-lg bg-slate-100 dark:bg-neutral-800 text-[14px] text-slate-900 dark:text-white border border-slate-200 dark:border-neutral-700 focus:outline-none text-center"
                maxLength={4}
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[11px] text-slate-500 dark:text-neutral-400 shrink-0">Color:</label>
              <div className="flex gap-1.5 flex-wrap">
                {['#6366f1','#f59e0b','#10b981','#f43f5e','#3b82f6','#8b5cf6','#64748b','#ec4899'].map(c => (
                  <button
                    key={c}
                    onClick={() => setMgCatForm(f => ({ ...f, color: c }))}
                    className={`w-5 h-5 rounded-full transition cursor-pointer ${mgCatForm.color === c ? 'ring-2 ring-offset-1 ring-slate-700 dark:ring-white scale-110' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handleMgCreateCat}
              disabled={mgAddingCat || !mgCatForm.name.trim()}
              className="w-full py-2 rounded-lg bg-[var(--primary)] text-white font-bold text-[12px] disabled:opacity-50 cursor-pointer transition active:scale-95"
            >
              {mgAddingCat ? 'Creando…' : '+ Crear Categoría'}
            </button>
          </div>

          {/* ── Lista de Categorías ─────────────────────── */}
          {mgLoading ? (
            <p className="text-[11px] text-slate-400 italic text-center py-4">Cargando categorías…</p>
          ) : mgCategories.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic text-center py-4">No hay categorías aún. Crea la primera arriba.</p>
          ) : (
            <div className="space-y-2">
              {mgCategories.map(cat => (
                <div key={cat.id} className="rounded-xl border border-slate-200 dark:border-neutral-700 overflow-hidden">
                  {/* Category row */}
                  <div
                    className="flex items-center justify-between px-3 py-2.5 bg-slate-50 dark:bg-neutral-800/60 cursor-pointer select-none"
                    onClick={() => setMgExpandedCatId(prev => prev === cat.id ? null : cat.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base leading-none">{cat.icon ?? prefTypeIcon(cat.type, cat.icon)}</span>
                      <div>
                        <span className="text-[12px] font-bold text-slate-800 dark:text-white">{cat.name}</span>
                        <span className="ml-1.5 text-[10px] text-slate-400">({cat.preferences.length})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${mgExpandedCatId === cat.id ? 'rotate-90' : ''}`} />
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (confirm(`¿Eliminar la categoría "${cat.name}" y todas sus opciones?`)) {
                            handleMgDeleteCat(cat.id);
                          }
                        }}
                        disabled={mgDeletingId === cat.id}
                        className="text-rose-400 hover:text-rose-600 cursor-pointer disabled:opacity-40 p-0.5 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded: options + add form */}
                  {mgExpandedCatId === cat.id && (
                    <div className="px-3 py-2.5 space-y-2 bg-white dark:bg-neutral-900">
                      {cat.preferences.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">Sin opciones aún. Añade la primera abajo.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {cat.preferences.map(pref => (
                            <span
                              key={pref.id}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-[11px] text-slate-700 dark:text-neutral-200 border border-slate-200 dark:border-neutral-700"
                            >
                              {pref.value}
                              <button
                                onClick={() => handleMgDeletePref(pref.id, cat.id)}
                                disabled={mgDeletingId === pref.id}
                                className="text-slate-400 hover:text-rose-500 cursor-pointer ml-0.5 disabled:opacity-40 transition"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Add preference input */}
                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Nueva opción (ej: Reggaeton)"
                          value={mgPrefInputs[cat.id] ?? ''}
                          onChange={e => setMgPrefInputs(prev => ({ ...prev, [cat.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') handleMgAddPref(cat.id); }}
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 text-[11px] border border-slate-200 dark:border-neutral-700 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] text-slate-900 dark:text-white"
                        />
                        <button
                          onClick={() => handleMgAddPref(cat.id)}
                          disabled={mgAddingPrefCatId === cat.id || !(mgPrefInputs[cat.id] ?? '').trim()}
                          className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-[11px] font-bold disabled:opacity-50 cursor-pointer transition active:scale-95"
                        >
                          {mgAddingPrefCatId === cat.id ? '…' : '+'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </IOSModal>
    </div>
  );
};
