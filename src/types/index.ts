export type UserRole = 'admin' | 'assistant' | 'support';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  roleTitle: string;
  avatar: string;
  badgeColor: string;
  description: string;
  permissions: {
    canViewMetrics: boolean;
    canManageBots: boolean;
    canEditConfig: boolean;
    canManageCalendar: boolean;
    canManageChats: boolean;
    canAccessSystemLogs: boolean;
  };
}

export type ServiceCategory = 'nails' | 'hair' | 'massage' | 'pedi_spa' | 'facial';

export interface PriceTier {
  id: string;
  name: string; // e.g. 'Precio Estándar', 'Precio VIP Frecuente', 'Retoque / Mantenimiento', 'Largo / Extra Glam', 'Happy Hour Promoción'
  price: number;
  description?: string;
  isDefault?: boolean;
}

export interface SalonService {
  id: string;
  name: string;
  category: ServiceCategory;
  categoryName: string;
  price: number; // Base reference price
  durationMinutes: number;
  icon: string;
  color: string;
  popular?: boolean;
  description?: string;
  aiAvailable: boolean; // Accessible by the AI Chat Bot to offer
  priceTiers: PriceTier[]; // Multiple pricing table
}

export type ProductCategory = 'nailcare' | 'haircare' | 'skincare' | 'spa_body' | 'beverage' | 'snack';

export interface SalonProduct {
  id: string;
  name: string;
  category: ProductCategory;
  categoryName: string;
  sku: string;
  basePrice: number;
  stock: number;
  unit: string;        // ml | g | oz | L | unit
  unitQty?: number;    // contenido por unidad (ej: 15 ml por botella)
  unitQtyUnit?: string; // unidad del contenido (ml, g, oz, L)
  image?: string;
  description: string;
  aiAvailable: boolean; // Accessible by the AI Bot to recommend/sell
  priceTiers: PriceTier[]; // Multiple pricing table
  // ── Costeo e inventario inteligente ──────────────────────────────────
  costPrice?: number;       // costo de compra por unidad base
  minStock?: number;        // stock mínimo de seguridad
  alertThreshold?: number;  // umbral alerta predictiva
  hasLotTracking?: boolean; // control por lote/vencimiento
  lotStrategy?: 'FEFO' | 'FIFO'; // estrategia de deducción
}

export interface ClientHospitalityPreferences {
  favoriteDrinks: string[]; // e.g. ['Matcha Latte frío', 'Copa de Mimosa', 'Agua de Rosas']
  favoriteSnacks: string[]; // e.g. ['Macarons franceses', 'Frutos rojos']
  musicVibe: string; // e.g. 'Lofi Chillhop & Neo-Soul', 'Acoustic Pop', 'Bossa Nova'
  favoriteArtistsOrSongs: string[]; // e.g. ['Billie Eilish', 'Leon Bridges', 'Norah Jones']
  roomAroma?: string; // e.g. 'Lavanda & Vainilla', 'Eucalipto & Menta'
  temperaturePreference?: 'cálida' | 'fresca' | 'neutra';
  conversationLevel?: 'silenciosa_zen' | 'charla_amigable' | 'solo_consultas';
  notes?: string;
}

export interface LoungeTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  durationSeconds: number;
  coverUrl: string;
  vibe: string;
  source: 'youtube' | 'spotify' | 'salon_radio';
  externalUrl?: string;
  youtubeId?: string;
  spotifyUri?: string;
  dedicatedForClientName?: string;
}

export type ClientTag = 'vip' | 'frecuente' | 'nuevo' | 'alergico_sensible' | 'puntual' | 'requiere_anticipo';

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  avatar: string;
  preferredChannel: CommunicationChannel;
  tags: ClientTag[];
  beautyNotes?: string; // Preferencias de color, largo de uñas, estilo de rubio
  medicalOrAllergyNotes?: string; // Alergias a químicos, piel sensible
  hospitality?: ClientHospitalityPreferences; // Preferencias de bebidas, comida y música
  totalVisits: number;
  totalSpent: number;
  lastVisitDate?: string;
  registeredDate: string;
  priceListId?: string;  // lista de precios asignada (undefined = default)
}

export type AppointmentStatus = 'confirmed_by_ai' | 'attending' | 'completed' | 'cancelled' | 'pending';
export type CommunicationChannel = 'whatsapp' | 'instagram' | 'messenger';

export interface Appointment {
  id: string;
  clientId?: string;
  clientName: string;
  clientPhone: string;
  clientAvatar?: string;
  serviceId: string;
  serviceName: string;
  serviceCategory: ServiceCategory;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  durationMinutes: number;
  bufferMinutes?: number; // Descanso entre citas
  price: number;
  selectedPriceTierName?: string;
  depositPaid: number;
  staffName: string;
  status: AppointmentStatus;
  channel: CommunicationChannel;
  notes?: string;
  createdAt: string;
  startsAt?: string;       // ISO full datetime from backend
  completedAt?: string;    // actual service delivery time (may differ from startsAt)
}

export interface ChatMessage {
  id: string;
  sender: 'client' | 'bot' | 'agent';
  text: string;
  timestamp: string;
  isAiGenerated?: boolean;
  appointmentData?: Partial<Appointment>;
}

export type ChatStatus = 'ai_active' | 'manual_control' | 'needs_attention';

export interface Conversation {
  id: string;
  clientId?: string;
  clientName: string;
  clientHandle?: string;
  clientPhone?: string;
  clientAvatar: string;
  channel: CommunicationChannel;
  status: ChatStatus;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  serviceInterest?: string;
  messages: ChatMessage[];
  confidenceScore?: number; // AI confidence 0-100
}

export interface BotChannelConfig {
  id: CommunicationChannel;
  name: string;
  enabled: boolean;
  model: string;
  webhookLatencyMs: number;
  status: 'online' | 'degraded' | 'offline';
  messagesProcessedToday: number;
  appointmentsBookedToday: number;
  welcomeMessage: string;
  offHoursMessage: string;
}

export interface ColorPreset {
  id: string;
  name: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  secondaryLight: string;
  secondaryDark: string;
  previewClass: string;
}

export interface ThemePalettePreset {
  id: string;
  name: string;
  subtitle: string; // e.g. "Rosa pastel · Lavanda · Oro"
  icon: string; // e.g. "🌸"
  primary: string; // Color Primario
  accent: string; // Color Acento / Secundario
  tertiary: string; // Color Terciario / Fondo o Tono
  bgTint?: string;
  popular?: boolean;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface SalonBusinessSettings {
  salonName: string;
  tagline: string;
  phone: string;
  address: string;
  openingTime: string; // e.g. "09:00"
  closingTime: string; // e.g. "20:00"
  // Appointment timing & buffer parameters
  bufferTimeMinutes: number; // Tiempo de descanso / preparación entre cita y cita (ej. 5, 10, 15 min)
  defaultAppointmentDurationMinutes: number; // Tiempo que dura una cita estándar (ej. 60 min)
  gracePeriodMinutes: number; // Tiempo de tolerancia / gracia para esperar al cliente (ej. 15 min)
  cancellationNoticeHours: number; // Horas mínimas de aviso previo para cancelar
  maxAdvanceBookingDays: number; // Días máximos para agendar a futuro
  // Deposit & AI Booking rules
  requireDeposit: boolean;
  depositPercent: number; // e.g. 30%
  aiAutoBooking: boolean;
  aiStrictSlots: boolean;
  aiTone: 'friendly_luxury' | 'direct_professional' | 'chic_casual';
  instagramHandle: string;
  facebookPage: string;
}

export interface SalonMetrics {
  period: 'day' | 'week' | 'month';
  totalRevenue: number;
  revenueGrowthPercent: number;
  clientsCount: number;
  clientsGrowthPercent: number;
  completedAppointments: number;
  aiBookedAppointments: number;
  aiConversionRate: number;
  topServices: {
    category: ServiceCategory;
    name: string;
    count: number;
    revenue: number;
    percentage: number;
    color: string;
  }[];
  peakHours: {
    hour: string;
    busynessScore: number; // 0 - 100
    avgClients: number;
  }[];
  busiestDays: {
    day: string;
    shortDay: string;
    appointments: number;
    isWeekend?: boolean;
  }[];
  channelDistribution: {
    channel: CommunicationChannel;
    name: string;
    percentage: number;
    count: number;
    color: string;
  }[];
}

export interface SystemLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  service: 'Meta_Webhook' | 'WhatsApp_Graph_API' | 'Instagram_Graph_API' | 'AI_Scheduler' | 'Auth_Engine';
  message: string;
  payload?: any;
}
