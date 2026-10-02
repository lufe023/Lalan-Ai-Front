/** super_admin: el dueño de la plataforma Lalan (ve la landing y el piloto; puede todo lo de un admin) */
export type UserRole = 'admin' | 'assistant' | 'support' | 'super_admin';

/** ¿Tiene que confirmar su correo? obligatoria = dueñas; opcional = equipo */
export type ConfirmacionCorreo = 'obligatoria' | 'opcional';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  roleTitle: string;
  avatar: string;
  badgeColor: string;
  description: string;
  /** Entró con una clave temporal: antes de usar la app, pone la suya */
  debeCambiarClave?: boolean;
  /** Sesión de soporte de Lalan dentro de este salón */
  soporte?: { negocio: string };
  /** Su correo (puede no tener: entra con usuario o teléfono) */
  correo?: string | null;
  usuario?: string | null;
  /** Si tiene que confirmar su correo al entrar */
  confirmarCorreo?: ConfirmacionCorreo | null;
  permissions: {
    canViewMetrics: boolean;
    canManageBots: boolean;
    canEditConfig: boolean;
    canManageCalendar: boolean;
    canManageChats: boolean;
    canAccessSystemLogs: boolean;
  };
}

/**
 * Clave de una categoría del salón (GET /categories). Ya no es una lista
 * fija: cada salón crea las suyas. Las iniciales conservan sus claves de
 * siempre ("nails", "hair"…), por eso los datos viejos siguen valiendo.
 */
export type ServiceCategory = string;

export type TipoCategoria = 'service' | 'product';
/** Cómo se ofrece en el Lounge lo de una categoría de productos */
export type PapelEnLounge = 'none' | 'drink' | 'food';

export interface CategoriaCatalogo {
  id: string;
  kind: TipoCategoria;
  key: string;
  name: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  sortOrder: number;
  active: boolean;
  loungeRole: PapelEnLounge;
  discountPercent: number;
  papelEnLounge: { codigo: PapelEnLounge; id: number; descripcion: string };
  /** Servicios o productos activos dentro */
  usos: number;
}

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
  /** Moneda del precio (puede no ser la del salón: se convierte al cobrar e informar) */
  currencyCode?: string;
  durationMinutes: number;
  icon: string;
  color: string;
  popular?: boolean;
  description?: string;
  aiAvailable: boolean; // Accessible by the AI Chat Bot to offer
  priceTiers: PriceTier[]; // Multiple pricing table
}

/** Clave de una categoría de productos del salón (ver ServiceCategory) */
export type ProductCategory = string;

export interface LineaDeReceta {
  id?: string;
  ingredientId: string;
  nombre?: string;
  quantity: number;
  unit: string;
  notes?: string | null;
  unidadDelInsumo?: string;
  contenidoDelInsumo?: number | null;
}

export interface SalonProduct {
  id: string;
  name: string;
  category: ProductCategory;
  categoryName: string;
  sku: string;
  basePrice: number;
  /** Moneda del precio (puede no ser la del salón: se convierte al cobrar e informar) */
  currencyCode?: string;
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
  /** Se prepara al momento: sin existencias propias, al servirlo salen sus ingredientes */
  preparedToOrder?: boolean;
  /** Insumo: solo entra en recetas; no se vende suelto ni lo ofrece Lalan */
  supplyOnly?: boolean;
  /** Preparados: su receta (una porción) */
  receta?: LineaDeReceta[];
  /** Preparados: lo que cuesta una porción según sus insumos */
  costoReceta?: number | null;
  costoRecetaCompleto?: boolean | null;
  /** Preparados: porciones que alcanzan con lo que hay */
  porcionesPosibles?: number | null;
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

/** confirmed = la confirmó una persona del salón; confirmed_by_ai = la asistente */
export type AppointmentStatus = 'confirmed' | 'confirmed_by_ai' | 'attending' | 'completed' | 'cancelled' | 'pending';
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
  /** Moneda del precio de la cita (la de su servicio) */
  currencyCode?: string;
  selectedPriceTierName?: string;
  depositPaid: number;
  staffName: string;
  /** La especialista enlazada (si se eligió de la plantilla) */
  staffId?: string | null;
  status: AppointmentStatus;
  channel: CommunicationChannel;
  notes?: string;
  createdAt: string;
  startsAt?: string;       // ISO full datetime from backend
  completedAt?: string;    // actual service delivery time (may differ from startsAt)
  /** Cuándo llegó de verdad */
  arrivedAt?: string;
  /** La agendó la asistente por chat */
  bookedByAssistant?: boolean;
  /** Turno especial: se agendó fuera del horario, con autorización de la dueña */
  fueraDeHorario?: boolean;
  /** Quién del equipo la agendó desde la app */
  createdByName?: string | null;
  /** La hora que tenía agendada, si llegó en otro momento y la cita se movió a la hora real */
  originalStartsAt?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'client' | 'bot' | 'agent' | 'system';
  text: string;
  /** ISO: cómo se muestra lo decide la pantalla */
  timestamp: string;
  isAiGenerated?: boolean;
  /** Respuesta que la asistente PROPUSO a una persona; no se le envió a la clienta */
  isSuggestion?: boolean;
  /** Cómo va el envío a Meta de lo que salió del salón */
  deliveryStatus?: 'pendiente' | 'enviado' | 'entregado' | 'leido' | 'fallido' | null;
  /** Por qué no salió, dicho para una persona */
  failureReason?: string | null;
  appointmentData?: Partial<Appointment>;
  /** texto, imagen, video, nota_voz, documento, sticker… (catálogo TipoContenido) */
  tipo?: string;
  /** La foto, video o documento que vino con el mensaje */
  adjunto?: AdjuntoDeMensaje | null;
  /** El emoji con que la clienta reaccionó a este mensaje */
  reaccion?: string | null;
  /** La clienta lo borró. El equipo solo ve el aviso; el super admin, también el contenido */
  eliminado?: boolean;
  /** De dónde llegó: anuncio, enlace o historia */
  origen?: { tipo: string; id?: string; url?: string; titulo?: string } | null;
}

export interface AdjuntoDeMensaje {
  /** Ya está guardado en el servidor y se puede mostrar */
  tieneArchivo: boolean;
  mime?: string | null;
  nombre?: string | null;
  /** Lo que vio la IA en la foto */
  descripcion?: string | null;
  transcripcion?: string | null;
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
  /** ISO del último mensaje, para ordenar y para decir "hace 5 min" */
  lastMessageAt?: string;
  /** Hasta cuándo se le puede escribir (24 h desde su último mensaje, regla de Meta) */
  windowExpiresAt?: string | null;
  /** La dueña autorizó que Lalan le agende fuera del horario, hasta esta hora */
  fueraDeHorarioHasta?: string | null;
  fueraDeHorarioPor?: string | null;
  /** En pausa por posible spam hasta esta hora: Lalan no contesta, no se guardan archivos */
  silenciadaHasta?: string | null;
  /** Bloqueada por el salón: no se guarda nada de lo que mande */
  bloqueada?: boolean;
  bloqueadaPor?: string | null;
}

export interface ActividadDelCanal {
  respondidos: number;
  sugerencias: number;
  citas: number;
  enAtencion: number;
  ultimaRespuesta: string | null;
}

/** Un evento de la actividad reciente de los chats (Ajustes › Actividad) */
export interface EventoActividad {
  id: string;
  en: string;
  tipo: 'entrada' | 'respuesta' | 'persona' | 'aviso' | 'cita';
  canal: { id: number; codigo: CommunicationChannel; descripcion: string };
  cliente: string;
  texto: string;
  citaInicio?: string;
  conversacionId: string | null;
}

export interface BotChannelConfig {
  id: CommunicationChannel;
  name: string;
  enabled: boolean;
  /** Lo que de verdad pasó hoy en el canal, contado por el backend */
  actividad: ActividadDelCanal;
  welcomeMessage: string;
  offHoursMessage: string;
  /** La cuenta de Meta conectada: phone_number_id, cuenta de IG o página */
  channelIdentifier: string;
  /** 'boton_meta' (lo conectó el cliente con el botón) o 'manual' (desde Plataforma) */
  conexion: string | null;
  conectadoEn: string | null;
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

/** Un turno del día. Horas "HH:mm" locales */
export interface TramoHorario {
  desde: string;
  hasta: string;
}

/** Un día del horario semanal (0 = domingo). Varios turnos = cierra y vuelve a abrir */
export interface DiaDeHorario {
  dia: number;
  abierto: boolean;
  tramos: TramoHorario[];
}

/** Un día (o unas horas) en que una especialista no viene */
export interface AusenciaEspecialista {
  id: string;
  staffId: string;
  /** Fechas locales "2026-10-10", ambas incluidas */
  desde: string;
  hasta: string;
  horaDesde: string | null;
  horaHasta: string | null;
  /** Clave del catálogo de motivos (GET /salon/ausencias/motivos) */
  motivo: string;
  nota?: string | null;
  staff?: { id: string; name: string };
}

export interface MotivoAusencia {
  id: string;
  descripcion: string;
  emoji: string;
}

export interface SalonBusinessSettings {
  salonName: string;
  tagline: string;
  phone: string;
  address: string;
  openingTime: string; // e.g. "09:00"
  closingTime: string; // e.g. "20:00"
  /** Cada día con su horario (cerrar un jueves, media jornada el sábado…) */
  horarioSemanal: DiaDeHorario[];
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
  /** Cómo se presenta la asistente con las clientas */
  aiAgentName: string;
  /** Con la asistente pausada, ¿sigue proponiendo respuestas a la humana? */
  aiSuggestWhenPaused: boolean;
  /** Instrucciones propias; null = las de base del sistema */
  aiPrompt: string | null;
  /** Instrucciones para TODAS las sedes del salón (las de la sede mandan sobre estas) */
  aiPromptSalon: string | null;
  /** Aviso por WhatsApp a la dueña cuando un chat pide a una persona o una cita queda sin especialista */
  alertsEnabled: boolean;
  alertPhone: string | null;
  alertContactName: string | null;
  /** Recordatorios de cita a la clienta por WhatsApp (si el plan los incluye) */
  remindersEnabled: boolean;
  /** Uno el día antes, a la hora de la cita */
  reminderDayBefore: boolean;
  /** Otro unas horas antes (0 = no) */
  reminderHoursBefore: number;
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
