import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Appointment, AppointmentStatus, BotChannelConfig, ChatMessage,
  Client, CommunicationChannel, Conversation, LoungeTrack,
  SalonBusinessSettings, SalonMetrics, SalonProduct, SalonService, SystemLog,
} from '../types';
import { INITIAL_SYSTEM_LOGS, INITIAL_SETTINGS } from '../data/mockData';
import { loungeAudio } from '../utils/loungeAudio';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

export type ScreenName = 'dashboard' | 'calendar' | 'clients' | 'catalog' | 'chats' | 'bots' | 'settings' | 'lounge' | 'price-lists';

// ── Price List types ──────────────────────────────────────────────────────────
export type PriceRuleTarget = 'service_category' | 'product_category' | 'specific_service' | 'specific_product';

export interface PriceListRule {
  id: string;
  target: PriceRuleTarget;
  serviceCategoryKey?: string;
  productCategoryKey?: string;
  serviceId?: string;
  productId?: string;
  fixedPrice?: number;
  discountPercent?: number;
  priceMultiplier?: number;
}

export interface PriceList {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  startDate?: string;
  endDate?: string;
  rules: PriceListRule[];
  /** Count of clients explicitly assigned to this list */
  clientCount?: number;
}

export interface ToastInfo {
  id: string; title: string; message: string;
  type?: 'success' | 'info' | 'warning'; icon?: string;
}

interface AppContextType {
  currentScreen: ScreenName;
  navigateTo: (screen: ScreenName) => void;
  screenHistory: ScreenName[];
  goBack: () => void;
  // Clients
  clients: Client[];
  isLoadingClients: boolean;
  addClient: (client: Omit<Client, 'id' | 'registeredDate'>) => Promise<Client>;
  updateClient: (id: string, updated: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  // Services
  services: SalonService[];
  addService: (service: Omit<SalonService, 'id'>) => Promise<void>;
  updateService: (id: string, updated: Partial<SalonService>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  toggleServiceAi: (id: string, aiAvailable: boolean) => Promise<void>;
  // Products
  products: SalonProduct[];
  addProduct: (product: Omit<SalonProduct, 'id'>) => Promise<void>;
  updateProduct: (id: string, updated: Partial<SalonProduct>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  toggleProductAi: (id: string, aiAvailable: boolean) => Promise<void>;
  // Appointments
  appointments: Appointment[];
  addAppointment: (appointment: Omit<Appointment, 'id' | 'createdAt'>) => Promise<void>;
  updateAppointmentStatus: (id: string, status: AppointmentStatus) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  toggleChatAiStatus: (conversationId: string, enableAi: boolean) => Promise<void>;
  sendMessageToConversation: (conversationId: string, text: string, sender?: 'client' | 'agent' | 'bot') => Promise<void>;
  startChatWithClient: (client: Client) => void;
  // Bot Configs
  botConfigs: BotChannelConfig[];
  toggleBotChannel: (channelId: CommunicationChannel, enabled: boolean) => Promise<void>;
  updateBotMessage: (channelId: CommunicationChannel, field: 'welcomeMessage' | 'offHoursMessage', text: string) => Promise<void>;
  // Settings
  settings: SalonBusinessSettings;
  updateSettings: (newSettings: Partial<SalonBusinessSettings>) => void;
  // Metrics
  metricsPeriod: 'day' | 'week' | 'month';
  setMetricsPeriod: (p: 'day' | 'week' | 'month') => void;
  currentMetrics: SalonMetrics;
  isLoadingMetrics: boolean;
  // System logs
  systemLogs: SystemLog[];
  addSystemLog: (log: Omit<SystemLog, 'id' | 'timestamp'>) => void;
  // Price Lists
  priceLists: PriceList[];
  isLoadingPriceLists: boolean;
  loadPriceLists: () => Promise<void>;
  createPriceList: (dto: Omit<PriceList, 'id' | 'clientCount'>) => Promise<PriceList>;
  updatePriceList: (id: string, dto: Partial<Omit<PriceList, 'id' | 'clientCount'>>) => Promise<void>;
  deletePriceList: (id: string) => Promise<void>;
  assignPriceList: (priceListId: string, clientId: string) => Promise<void>;
  unassignPriceList: (clientId: string) => Promise<void>;
  // Toast
  toast: ToastInfo | null;
  showToast: (title: string, message: string, type?: 'success' | 'info' | 'warning') => void;
  dismissToast: () => void;
  // App control
  showSplash: boolean;
  triggerSplash: () => void;
  closeSplash: () => void;
  isPhoneFrame: boolean;
  setIsPhoneFrame: (val: boolean) => void;
  // Lounge
  loungeTracks: LoungeTrack[];
  currentTrackIndex: number;
  currentTrack: LoungeTrack;
  isPlayingLounge: boolean;
  activeLoungeClient: Client | null;
  servedHospitalityHistory: { id: string; clientName: string; item: string; time: string }[];
  playTrack: (indexOrId?: number | string) => void;
  togglePlayLounge: () => void;
  nextLoungeTrack: () => void;
  prevLoungeTrack: () => void;
  addTrackToLounge: (track: Omit<LoungeTrack, 'id'>) => Promise<void>;
  removeLoungeTrack: (id: string) => Promise<void>;
  setActiveLoungeClient: (client: Client | null) => void;
  serveHospitalityItem: (item: string) => void;
  playMusicForClient: (client: Client) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ─── Helpers to map API responses to frontend types ────────────────────────

function mapApiClient(c: any): Client {
  return {
    id: c.id, name: c.name, phone: c.phone, email: c.email,
    avatar: c.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=e2e8f0&color=475569`,
    preferredChannel: c.preferredChannel ?? 'whatsapp',
    tags: c.tags ?? [],
    beautyNotes: c.beautyNotes, medicalOrAllergyNotes: c.medicalOrAllergyNotes,
    hospitality: c.hospitalityPrefs,
    totalVisits: c.totalVisits ?? 0,
    totalSpent: Number(c.totalSpent ?? 0),
    lastVisitDate: c.lastVisitDate ? String(c.lastVisitDate).slice(0, 10) : undefined,
    registeredDate: c.registeredAt ? String(c.registeredAt).slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}

function mapApiService(s: any): SalonService {
  return {
    id: s.id, name: s.name, category: s.category, categoryName: s.categoryName,
    price: Number(s.basePrice), durationMinutes: s.durationMinutes,
    icon: s.icon ?? '✨', color: s.color ?? '#6366f1',
    popular: s.popular ?? false, description: s.description,
    aiAvailable: s.aiAvailable ?? true,
    priceTiers: (s.priceTiers as any[]) ?? [],
  };
}

function mapApiProduct(p: any): SalonProduct {
  return {
    id: p.id, name: p.name, category: p.category, categoryName: p.categoryName,
    sku: p.sku, basePrice: Number(p.basePrice), stock: p.stock ?? 0,
    image: p.image, description: p.description ?? '',
    aiAvailable: p.aiAvailable ?? true,
    priceTiers: (p.priceTiers as any[]) ?? [],
  };
}

function mapApiAppointment(a: any): Appointment {
  const startsAt = new Date(a.startsAt);
  return {
    id: a.id,
    clientId: a.clientId,
    clientName: a.clientName, clientPhone: a.clientPhone,
    serviceId: a.serviceId ?? '', serviceName: a.serviceName,
    serviceCategory: a.serviceCategory,
    date: startsAt.toISOString().slice(0, 10),
    time: startsAt.toTimeString().slice(0, 5),
    durationMinutes: a.durationMinutes,
    bufferMinutes: a.bufferMinutes,
    price: Number(a.price),
    selectedPriceTierName: a.selectedPriceTierName,
    depositPaid: Number(a.depositPaid ?? 0),
    staffName: a.staffName,
    status: a.status,
    channel: a.channel,
    notes: a.notes,
    createdAt: a.createdAt,
  };
}

function mapApiConversation(c: any): Conversation {
  return {
    id: c.id,
    clientId: c.clientId,
    clientName: c.clientName,
    clientHandle: c.clientHandle,
    clientPhone: c.clientPhone,
    clientAvatar: c.clientAvatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(c.clientName)}&background=e2e8f0&color=475569`,
    channel: c.channel,
    status: c.status,
    lastMessage: c.lastMessage ?? '',
    lastMessageTime: c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '',
    unreadCount: c.unreadCount ?? 0,
    serviceInterest: c.serviceInterest,
    confidenceScore: c.confidenceScore,
    messages: (c.messages ?? []).map((m: any): ChatMessage => ({
      id: m.id, sender: m.sender, text: m.text,
      timestamp: m.createdAt, isAiGenerated: m.isAiGenerated,
    })),
  };
}

function mapApiBotConfig(b: any): BotChannelConfig {
  return {
    id: b.channel as CommunicationChannel,
    name: b.name, enabled: b.enabled, model: b.model,
    webhookLatencyMs: b.webhookLatencyMs ?? 120,
    status: b.status ?? 'online',
    messagesProcessedToday: b.messagesProcessedToday ?? 0,
    appointmentsBookedToday: b.appointmentsBookedToday ?? 0,
    welcomeMessage: b.welcomeMessage ?? '',
    offHoursMessage: b.offHoursMessage ?? '',
  };
}

function mapApiPriceList(p: any): PriceList {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    isDefault: p.isDefault ?? false,
    startDate: p.startDate ? String(p.startDate).slice(0, 10) : undefined,
    endDate: p.endDate ? String(p.endDate).slice(0, 10) : undefined,
    clientCount: p._count?.clients ?? p.clientCount ?? 0,
    rules: (p.rules ?? []).map((r: any): PriceListRule => ({
      id: r.id,
      target: r.target,
      serviceCategoryKey: r.serviceCategoryKey ?? undefined,
      productCategoryKey: r.productCategoryKey ?? undefined,
      serviceId: r.serviceId ?? undefined,
      productId: r.productId ?? undefined,
      fixedPrice: r.fixedPrice != null ? Number(r.fixedPrice) : undefined,
      discountPercent: r.discountPercent != null ? Number(r.discountPercent) : undefined,
      priceMultiplier: r.priceMultiplier != null ? Number(r.priceMultiplier) : undefined,
    })),
  };
}

function mapApiTrack(t: any): LoungeTrack {
  return {
    id: t.id, title: t.title, artist: t.artist, album: t.album,
    durationSeconds: t.durationSeconds,
    coverUrl: t.coverUrl ?? `https://picsum.photos/seed/${t.id}/300/300`,
    vibe: t.vibe, source: t.source,
    externalUrl: t.externalUrl, youtubeId: t.youtubeId,
    spotifyUri: t.spotifyUri, dedicatedForClientName: t.dedicatedForClientName,
  };
}

const EMPTY_METRICS: SalonMetrics = {
  period: 'month', totalRevenue: 0, revenueGrowthPercent: 0,
  clientsCount: 0, clientsGrowthPercent: 0,
  completedAppointments: 0, aiBookedAppointments: 0, aiConversionRate: 0,
  topServices: [], peakHours: [], busiestDays: [], channelDistribution: [],
};

const FALLBACK_TRACK: LoungeTrack = {
  id: 'fallback', title: 'Sin pistas', artist: 'Añade música al Lounge',
  durationSeconds: 0, coverUrl: 'https://picsum.photos/seed/lounge/300/300',
  vibe: 'ambient', source: 'salon_radio',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  // ── Navigation ──────────────────────────────────────────────────
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('dashboard');
  const [screenHistory, setScreenHistory] = useState<ScreenName[]>([]);
  const navigateTo = useCallback((screen: ScreenName) => {
    setScreenHistory(h => [...h, currentScreen]);
    setCurrentScreen(screen);
  }, [currentScreen]);
  const goBack = useCallback(() => {
    setScreenHistory(h => {
      const prev = h[h.length - 1];
      if (prev) setCurrentScreen(prev);
      return h.slice(0, -1);
    });
  }, []);

  // ── Data state ──────────────────────────────────────────────────
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<SalonService[]>([]);
  const [products, setProducts] = useState<SalonProduct[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [botConfigs, setBotConfigs] = useState<BotChannelConfig[]>([]);
  const [loungeTracks, setLoungeTracks] = useState<LoungeTrack[]>([FALLBACK_TRACK]);
  const [currentMetrics, setCurrentMetrics] = useState<SalonMetrics>(EMPTY_METRICS);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [isLoadingPriceLists, setIsLoadingPriceLists] = useState(false);

  const [settings, setSettings] = useState<SalonBusinessSettings>(INITIAL_SETTINGS);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>(INITIAL_SYSTEM_LOGS);
  const [metricsPeriod, setMetricsPeriod] = useState<'day' | 'week' | 'month'>('month');

  // ── Load all data when authenticated ─────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    const load = async () => {
      try {
        const [cls, svcs, prods, apts, convs, bots, tracks] = await Promise.allSettled([
          api.get<any[]>('/clients'),
          api.get<any[]>('/services'),
          api.get<any[]>('/products'),
          api.get<any[]>('/appointments'),
          api.get<any[]>('/conversations'),
          api.get<any[]>('/bots'),
          api.get<any[]>('/lounge/tracks'),
        ]);
        if (cls.status === 'fulfilled') setClients(cls.value.map(mapApiClient));
        if (svcs.status === 'fulfilled') setServices(svcs.value.map(mapApiService));
        if (prods.status === 'fulfilled') setProducts(prods.value.map(mapApiProduct));
        if (apts.status === 'fulfilled') setAppointments(apts.value.map(mapApiAppointment));
        if (convs.status === 'fulfilled') setConversations(convs.value.map(mapApiConversation));
        if (bots.status === 'fulfilled') setBotConfigs(bots.value.map(mapApiBotConfig));
        if (tracks.status === 'fulfilled' && tracks.value.length > 0)
          setLoungeTracks(tracks.value.map(mapApiTrack));
      } catch (e) { console.error('Failed to load app data', e); }
    };
    load();
  }, [isAuthenticated]);

  // ── Metrics (refetch on period change) ───────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    setIsLoadingMetrics(true);
    api.get<any>(`/metrics?period=${metricsPeriod}`)
      .then(d => setCurrentMetrics({ ...EMPTY_METRICS, ...d }))
      .catch(() => {})
      .finally(() => setIsLoadingMetrics(false));
  }, [isAuthenticated, metricsPeriod]);

  // ── Clients ──────────────────────────────────────────────────────
  const addClient = useCallback(async (data: Omit<Client, 'id' | 'registeredDate'>): Promise<Client> => {
    const res = await api.post<any>('/clients', {
      name: data.name, phone: data.phone, email: data.email,
      avatar: data.avatar, preferredChannel: data.preferredChannel,
      tags: data.tags, beautyNotes: data.beautyNotes,
      medicalOrAllergyNotes: data.medicalOrAllergyNotes,
      hospitalityPrefs: data.hospitality,
    });
    const client = mapApiClient(res);
    setClients(c => [client, ...c]);
    return client;
  }, []);

  const updateClient = useCallback(async (id: string, updated: Partial<Client>) => {
    const payload: Record<string, any> = {};
    if (updated.name !== undefined) payload.name = updated.name;
    if (updated.phone !== undefined) payload.phone = updated.phone;
    if (updated.email !== undefined) payload.email = updated.email || undefined; // '' → undefined to pass @IsEmail
    if (updated.avatar !== undefined) payload.avatar = updated.avatar;
    if (updated.preferredChannel !== undefined) payload.preferredChannel = updated.preferredChannel;
    if (updated.tags !== undefined) payload.tags = updated.tags;
    if (updated.beautyNotes !== undefined) payload.beautyNotes = updated.beautyNotes || undefined;
    if (updated.medicalOrAllergyNotes !== undefined) payload.medicalOrAllergyNotes = updated.medicalOrAllergyNotes || undefined;
    if (updated.hospitality !== undefined) payload.hospitalityPrefs = updated.hospitality; // remap field name
    const res = await api.patch<any>(`/clients/${id}`, payload);
    setClients(c => c.map(x => x.id === id ? mapApiClient(res) : x));
  }, []);

  const deleteClient = useCallback(async (id: string) => {
    await api.delete(`/clients/${id}`);
    setClients(c => c.filter(x => x.id !== id));
  }, []);

  // ── Services ─────────────────────────────────────────────────────
  const addService = useCallback(async (data: Omit<SalonService, 'id'>) => {
    const res = await api.post<any>('/services', {
      name: data.name, category: data.category, categoryName: data.categoryName,
      basePrice: data.price, durationMinutes: data.durationMinutes,
      icon: data.icon, color: data.color, popular: data.popular,
      description: data.description, aiAvailable: data.aiAvailable,
      priceTiers: data.priceTiers,
    });
    setServices(s => [...s, mapApiService(res)]);
  }, []);

  const updateService = useCallback(async (id: string, updated: Partial<SalonService>) => {
    const payload: Record<string, any> = {};
    if (updated.name !== undefined) payload.name = updated.name;
    if (updated.category !== undefined) payload.category = updated.category;
    if (updated.categoryName !== undefined) payload.categoryName = updated.categoryName;
    if (updated.price !== undefined) payload.basePrice = updated.price; // remap price → basePrice
    if (updated.durationMinutes !== undefined) payload.durationMinutes = updated.durationMinutes;
    if (updated.icon !== undefined) payload.icon = updated.icon;
    if (updated.color !== undefined) payload.color = updated.color;
    if (updated.popular !== undefined) payload.popular = updated.popular;
    if (updated.description !== undefined) payload.description = updated.description;
    if (updated.aiAvailable !== undefined) payload.aiAvailable = updated.aiAvailable;
    if (updated.priceTiers !== undefined) payload.priceTiers = updated.priceTiers;
    const res = await api.patch<any>(`/services/${id}`, payload);
    setServices(s => s.map(x => x.id === id ? mapApiService(res) : x));
  }, []);

  const deleteService = useCallback(async (id: string) => {
    await api.delete(`/services/${id}`);
    setServices(s => s.filter(x => x.id !== id));
  }, []);

  const toggleServiceAi = useCallback(async (id: string, aiAvailable: boolean) => {
    await api.patch(`/services/${id}/ai`, { aiAvailable });
    setServices(s => s.map(x => x.id === id ? { ...x, aiAvailable } : x));
  }, []);

  // ── Products ─────────────────────────────────────────────────────
  const addProduct = useCallback(async (data: Omit<SalonProduct, 'id'>) => {
    const res = await api.post<any>('/products', {
      name: data.name, category: data.category, categoryName: data.categoryName,
      sku: data.sku, basePrice: data.basePrice, stock: data.stock,
      image: data.image, description: data.description,
      aiAvailable: data.aiAvailable, priceTiers: data.priceTiers,
    });
    setProducts(p => [...p, mapApiProduct(res)]);
  }, []);

  const updateProduct = useCallback(async (id: string, updated: Partial<SalonProduct>) => {
    const payload: Record<string, any> = {};
    if (updated.name !== undefined) payload.name = updated.name;
    if (updated.category !== undefined) payload.category = updated.category;
    if (updated.categoryName !== undefined) payload.categoryName = updated.categoryName;
    if (updated.sku !== undefined) payload.sku = updated.sku;
    if (updated.basePrice !== undefined) payload.basePrice = updated.basePrice;
    if (updated.stock !== undefined) payload.stock = updated.stock;
    if (updated.image !== undefined) payload.image = updated.image;
    if (updated.description !== undefined) payload.description = updated.description;
    if (updated.aiAvailable !== undefined) payload.aiAvailable = updated.aiAvailable;
    if (updated.priceTiers !== undefined) payload.priceTiers = updated.priceTiers;
    const res = await api.patch<any>(`/products/${id}`, payload);
    setProducts(p => p.map(x => x.id === id ? mapApiProduct(res) : x));
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    await api.delete(`/products/${id}`);
    setProducts(p => p.filter(x => x.id !== id));
  }, []);

  const toggleProductAi = useCallback(async (id: string, aiAvailable: boolean) => {
    await api.patch(`/products/${id}/ai`, { aiAvailable });
    setProducts(p => p.map(x => x.id === id ? { ...x, aiAvailable } : x));
  }, []);

  // ── Appointments ─────────────────────────────────────────────────
  const addAppointment = useCallback(async (data: Omit<Appointment, 'id' | 'createdAt'>) => {
    const res = await api.post<any>('/appointments', {
      ...data,
      startsAt: `${data.date}T${data.time}:00`,
      price: data.price,
      locationId: '', // filled server-side from JWT if needed
    });
    setAppointments(a => [...a, mapApiAppointment(res)]);
  }, []);

  const updateAppointmentStatus = useCallback(async (id: string, status: AppointmentStatus) => {
    await api.patch(`/appointments/${id}/status`, { status });
    setAppointments(a => a.map(x => x.id === id ? { ...x, status } : x));
  }, []);

  const deleteAppointment = useCallback(async (id: string) => {
    await api.delete(`/appointments/${id}`);
    setAppointments(a => a.filter(x => x.id !== id));
  }, []);

  // ── Conversations ─────────────────────────────────────────────────
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const toggleChatAiStatus = useCallback(async (conversationId: string, enableAi: boolean) => {
    await api.patch(`/conversations/${conversationId}/ai`, { enableAi });
    setConversations(c => c.map(x => x.id === conversationId
      ? { ...x, status: enableAi ? 'ai_active' : 'manual_control' } : x));
  }, []);

  const sendMessageToConversation = useCallback(async (conversationId: string, text: string, sender: 'client' | 'agent' | 'bot' = 'agent') => {
    const res = await api.post<any>(`/conversations/${conversationId}/messages`, { text, sender });
    const msg: ChatMessage = { id: res.id, sender, text, timestamp: res.createdAt, isAiGenerated: res.isAiGenerated };
    setConversations(c => c.map(x => x.id === conversationId
      ? { ...x, messages: [...x.messages, msg], lastMessage: text, lastMessageTime: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) }
      : x));
  }, []);

  const startChatWithClient = useCallback((client: Client) => {
    const existing = conversations.find(c => c.clientId === client.id);
    if (existing) { setActiveConversationId(existing.id); navigateTo('chats'); return; }
    // Optimistic local conversation (will sync on next load)
    const temp: Conversation = {
      id: `temp_${Date.now()}`, clientId: client.id,
      clientName: client.name, clientAvatar: client.avatar,
      clientPhone: client.phone, channel: client.preferredChannel,
      status: 'ai_active', lastMessage: '', lastMessageTime: '',
      unreadCount: 0, messages: [],
    };
    setConversations(c => [temp, ...c]);
    setActiveConversationId(temp.id);
    navigateTo('chats');
  }, [conversations, navigateTo]);

  // ── Bots ──────────────────────────────────────────────────────────
  const toggleBotChannel = useCallback(async (channelId: CommunicationChannel, enabled: boolean) => {
    await api.patch(`/bots/${channelId}`, { enabled });
    setBotConfigs(b => b.map(x => x.id === channelId ? { ...x, enabled } : x));
  }, []);

  const updateBotMessage = useCallback(async (channelId: CommunicationChannel, field: 'welcomeMessage' | 'offHoursMessage', text: string) => {
    await api.patch(`/bots/${channelId}`, { [field]: text });
    setBotConfigs(b => b.map(x => x.id === channelId ? { ...x, [field]: text } : x));
  }, []);

  // ── Price Lists ───────────────────────────────────────────────────
  const loadPriceLists = useCallback(async () => {
    setIsLoadingPriceLists(true);
    try {
      const res = await api.get<any[]>('/price-lists');
      setPriceLists(res.map(mapApiPriceList));
    } finally {
      setIsLoadingPriceLists(false);
    }
  }, []);

  const createPriceList = useCallback(async (dto: Omit<PriceList, 'id' | 'clientCount'>): Promise<PriceList> => {
    const res = await api.post<any>('/price-lists', dto);
    const pl = mapApiPriceList(res);
    setPriceLists(l => [pl, ...l]);
    return pl;
  }, []);

  const updatePriceList = useCallback(async (id: string, dto: Partial<Omit<PriceList, 'id' | 'clientCount'>>) => {
    const res = await api.patch<any>(`/price-lists/${id}`, dto);
    setPriceLists(l => l.map(x => x.id === id ? mapApiPriceList(res) : x));
  }, []);

  const deletePriceList = useCallback(async (id: string) => {
    await api.delete(`/price-lists/${id}`);
    setPriceLists(l => l.filter(x => x.id !== id));
  }, []);

  const assignPriceList = useCallback(async (priceListId: string, clientId: string) => {
    await api.post(`/price-lists/${priceListId}/assign/${clientId}`, {});
    // Update clientCount locally
    setPriceLists(l => l.map(x => ({
      ...x,
      clientCount: x.id === priceListId ? (x.clientCount ?? 0) + 1 : x.clientCount,
    })));
    // Also update the client's priceListId in local state
    setClients(c => c.map(x => x.id === clientId ? { ...x, priceListId } : x));
  }, []);

  const unassignPriceList = useCallback(async (clientId: string) => {
    await api.delete(`/price-lists/unassign/${clientId}`);
    const client = clients.find(c => c.id === clientId);
    if (client) {
      // Decrement count on whichever list this client was on
      setClients(c => c.map(x => x.id === clientId ? { ...x, priceListId: undefined } : x));
    }
  }, [clients]);

  // ── Settings (local for now) ──────────────────────────────────────
  const updateSettings = useCallback((newSettings: Partial<SalonBusinessSettings>) => {
    setSettings(s => ({ ...s, ...newSettings }));
  }, []);

  // ── System logs ───────────────────────────────────────────────────
  const addSystemLog = useCallback((log: Omit<SystemLog, 'id' | 'timestamp'>) => {
    const entry: SystemLog = { ...log, id: `log_${Date.now()}`, timestamp: new Date().toISOString() };
    setSystemLogs(l => [entry, ...l.slice(0, 199)]);
  }, []);

  // ── Toast ─────────────────────────────────────────────────────────
  const [toast, setToast] = useState<ToastInfo | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((title: string, message: string, type: ToastInfo['type'] = 'info') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: `toast_${Date.now()}`, title, message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3800);
  }, []);
  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  // ── Splash ────────────────────────────────────────────────────────
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => { const t = setTimeout(() => setShowSplash(false), 2200); return () => clearTimeout(t); }, []);
  const triggerSplash = () => setShowSplash(true);
  const closeSplash = () => setShowSplash(false);
  const [isPhoneFrame, setIsPhoneFrame] = useState(false);

  // ── Lounge ────────────────────────────────────────────────────────
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlayingLounge, setIsPlayingLounge] = useState(false);
  const [activeLoungeClient, setActiveLoungeClient] = useState<Client | null>(null);
  const [servedHospitalityHistory, setServedHospitalityHistory] = useState<{ id: string; clientName: string; item: string; time: string }[]>([]);

  const currentTrack = loungeTracks[currentTrackIndex] ?? FALLBACK_TRACK;

  const playTrack = useCallback((indexOrId?: number | string) => {
    if (indexOrId === undefined) { setIsPlayingLounge(true); loungeAudio.play(); return; }
    if (typeof indexOrId === 'number') { setCurrentTrackIndex(indexOrId); }
    else { const i = loungeTracks.findIndex(t => t.id === indexOrId); if (i >= 0) setCurrentTrackIndex(i); }
    setIsPlayingLounge(true); loungeAudio.play();
  }, [loungeTracks]);

  const togglePlayLounge = useCallback(() => {
    setIsPlayingLounge(p => { if (p) loungeAudio.pause(); else loungeAudio.play(); return !p; });
  }, []);
  const nextLoungeTrack = useCallback(() => {
    setCurrentTrackIndex(i => (i + 1) % loungeTracks.length);
  }, [loungeTracks.length]);
  const prevLoungeTrack = useCallback(() => {
    setCurrentTrackIndex(i => (i - 1 + loungeTracks.length) % loungeTracks.length);
  }, [loungeTracks.length]);

  const addTrackToLounge = useCallback(async (track: Omit<LoungeTrack, 'id'>) => {
    const res = await api.post<any>('/lounge/tracks', track);
    setLoungeTracks(t => [...t.filter(x => x.id !== 'fallback'), mapApiTrack(res)]);
  }, []);

  const removeLoungeTrack = useCallback(async (id: string) => {
    await api.delete(`/lounge/tracks/${id}`);
    setLoungeTracks(t => {
      const next = t.filter(x => x.id !== id);
      return next.length > 0 ? next : [FALLBACK_TRACK];
    });
  }, []);

  const serveHospitalityItem = useCallback((item: string) => {
    const clientName = activeLoungeClient?.name ?? 'Clienta';
    setServedHospitalityHistory(h => [
      { id: `h_${Date.now()}`, clientName, item, time: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) },
      ...h.slice(0, 19),
    ]);
  }, [activeLoungeClient]);

  const playMusicForClient = useCallback((client: Client) => {
    setActiveLoungeClient(client);
    const pref = client.hospitality?.musicVibe;
    const idx = pref ? loungeTracks.findIndex(t => t.vibe.toLowerCase().includes(pref.toLowerCase())) : -1;
    playTrack(idx >= 0 ? idx : 0);
  }, [loungeTracks, playTrack]);

  return (
    <AppContext.Provider value={{
      currentScreen, navigateTo, screenHistory, goBack,
      clients, isLoadingClients, addClient, updateClient, deleteClient,
      services, addService, updateService, deleteService, toggleServiceAi,
      products, addProduct, updateProduct, deleteProduct, toggleProductAi,
      appointments, addAppointment, updateAppointmentStatus, deleteAppointment,
      conversations, activeConversationId, setActiveConversationId,
      toggleChatAiStatus, sendMessageToConversation, startChatWithClient,
      botConfigs, toggleBotChannel, updateBotMessage,
      settings, updateSettings,
      metricsPeriod, setMetricsPeriod, currentMetrics, isLoadingMetrics,
      systemLogs, addSystemLog,
      priceLists, isLoadingPriceLists, loadPriceLists,
      createPriceList, updatePriceList, deletePriceList,
      assignPriceList, unassignPriceList,
      toast, showToast, dismissToast,
      showSplash, triggerSplash, closeSplash,
      isPhoneFrame, setIsPhoneFrame,
      loungeTracks, currentTrackIndex, currentTrack, isPlayingLounge,
      activeLoungeClient, servedHospitalityHistory,
      playTrack, togglePlayLounge, nextLoungeTrack, prevLoungeTrack,
      addTrackToLounge, removeLoungeTrack, setActiveLoungeClient,
      serveHospitalityItem, playMusicForClient,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within an AppProvider');
  return ctx;
};
