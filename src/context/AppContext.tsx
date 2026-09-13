import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Appointment, AppointmentStatus, BotChannelConfig, ChatMessage,
  Client, CommunicationChannel, Conversation, LoungeTrack,
  SalonBusinessSettings, SalonMetrics, SalonProduct, SalonService, SystemLog,
} from '../types';
import { INITIAL_SYSTEM_LOGS, INITIAL_SETTINGS } from '../data/mockData';
import { loungeAudio } from '../utils/loungeAudio';
import { api } from '../services/api';
import { alRecibir } from '../services/socket';
import {
  estadoMusica, soyElAnfitrion, ordenar, cuandoSepamos, useMusicaSala,
} from '../services/musica';
import { useAuth } from './AuthContext';

/** Moneda del salón. La base tiene rateToBase = 1 y es en la que vive la caja. */
export interface Currency {
  id: string;
  code: string;
  symbol: string;
  name: string;
  rateToBase: number;
  isBase: boolean;
  active: boolean;
  rateUpdatedAt?: string;
  denominations: { id: string; value: number; kind: string; active: boolean }[];
}

/** Una línea del ticket */
export interface SaleItem {
  id: string;
  kind: 'service' | 'product' | 'courtesy';
  serviceId?: string | null;
  productId?: string | null;
  label: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number | null;
  lineTotal: number;
  notes?: string | null;
}

/** El consumo de la cita: cortesías y ventas en el mismo documento */
export interface Sale {
  id: string;
  status: 'open' | 'paid' | 'void';
  clientId?: string | null;
  clientName?: string | null;
  appointmentId?: string | null;
  currencyCode: string;
  subtotal: number;
  discountTotal: number;
  total: number;
  paidTotal: number;
  tipTotal: number;
  items: SaleItem[];
  payments: { id: string; method: string; amount: number; tip: number; reference?: string | null }[];
  label?: string | null;
  priceListId?: string | null;
  priceList?: { id: string; name: string; isDefault: boolean } | null;
  openedAt: string;
  closedAt?: string | null;
}

/** Un gusto que no puedes satisfacer todavía */
export interface DemandItem {
  pide: string;
  tipo: string;
  clientas: { id: string; nombre: string; cuando: string; intensidad: number | null }[];
  producto: { id: string; name: string; sku: string; stock: number; minStock: number; basePrice: number } | null;
  estado: 'sin_producto' | 'agotado' | 'bajo' | 'ok';
  ingresoEnRiesgo: number;
  proximaCita: string | null;
}

/** Una fila de la bitácora del salón (tabla lounge_events) */
export interface LoungeEvent {
  id: string;
  kind: 'courtesy' | 'sale' | 'track_played' | 'ambience_set';
  label: string;
  clientId?: string | null;
  clientName?: string | null;
  refId?: string | null;
  quantity?: number | null;
  amount?: number | null;
  currencyCode?: string | null;
  metadata?: any;
  createdAt: string;
}


export type ScreenName = 'dashboard' | 'calendar' | 'clients' | 'catalog' | 'chats' | 'bots' | 'settings' | 'lounge' | 'price-lists' | 'ganancias' | 'caja' | 'citas-report' | 'sala';

// ═══════════════════════════════════════════════════════════════════
//  SALA Y TURNOS
// ═══════════════════════════════════════════════════════════════════

export interface SalonZone {
  id: string;
  name: string;
  /** Prefijo del código de turno: "G", "B" */
  prefix: string;
  color?: string | null;
  sortOrder: number;
  active: boolean;
  staff?: { id: string; name: string; role: string; avatar?: string | null }[];
}

export interface SalonStaff {
  id: string;
  name: string;
  /** La especialidad */
  role: string;
  avatar?: string | null;
  phone?: string | null;
  active: boolean;
  zoneId?: string | null;
  zone?: { id: string; name: string; prefix: string; color?: string | null } | null;
}

export type QueueStatus = 'waiting' | 'called' | 'serving' | 'done' | 'cancelled' | 'no_show';

export interface QueueTicket {
  id: string;
  /** "G15", ya armado */
  code: string;
  prefix: string;
  number: number;
  /** Solo el nombre de pila: lo recorta el backend */
  displayName: string;
  reason?: string | null;
  status: QueueStatus;
  zoneId?: string | null;
  zone?: { id: string; name: string; prefix: string; color?: string | null } | null;
  staffId?: string | null;
  staffName?: string | null;
  staff?: { id: string; name: string; role: string; avatar?: string | null } | null;
  appointmentId?: string | null;
  clientId?: string | null;
  createdAt: string;
  calledAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  notes?: string | null;
}

/** Una cita de hoy que todavía no ha llegado al local */
export interface PorLlegar {
  id: string;
  clientId?: string | null;
  clientName: string;
  serviceName: string;
  staffId?: string | null;
  staffName?: string | null;
  startsAt: string;
  status: string;
}

export interface SalaEnVivo {
  fecha: string;
  zonas: SalonZone[];
  atendiendo: QueueTicket[];
  llamando: QueueTicket[];
  esperando: QueueTicket[];
  terminados: QueueTicket[];
  porLlegar: PorLlegar[];
}

export interface ToastInfo {
  id: string; title: string; message: string;
  type?: 'success' | 'info' | 'warning'; icon?: string;
}

// ── Price Lists ────────────────────────────────────────────────────────────────
export type PriceRuleTarget = 'service' | 'product' | 'category';
export interface PriceListRule {
  id: string;
  target: PriceRuleTarget;
  contextKey: string;        // serviceId | productId | categorySlug
  modifierType: 'percent' | 'fixed';
  modifierValue: number;     // negative = discount, positive = surcharge
}
export interface PriceList {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  rules: PriceListRule[];
  clientCount: number;
}
// ──────────────────────────────────────────────────────────────────────────────

interface AppContextType {
  currentScreen: ScreenName;
  navigateTo: (screen: ScreenName) => void;
  navigateToCatalog: (opts: { serviceId?: string; productId?: string; tab?: 'config' | 'recipe' }) => void;
  screenHistory: ScreenName[];
  goBack: () => void;
  catalogDeepLink: { serviceId?: string; productId?: string; tab?: 'config' | 'recipe' } | null;
  clearCatalogDeepLink: () => void;
  clients: Client[];
  isLoadingClients: boolean;
  addClient: (client: Omit<Client, 'id' | 'registeredDate'>) => Promise<Client>;
  updateClient: (id: string, updated: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  services: SalonService[];
  addService: (service: Omit<SalonService, 'id'>) => Promise<void>;
  updateService: (id: string, updated: Partial<SalonService>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  toggleServiceAi: (id: string, aiAvailable: boolean) => Promise<void>;
  products: SalonProduct[];
  addProduct: (product: Omit<SalonProduct, 'id'>) => Promise<void>;
  updateProduct: (id: string, updated: Partial<SalonProduct>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  toggleProductAi: (id: string, aiAvailable: boolean) => Promise<void>;
  appointments: Appointment[];
  addAppointment: (appointment: Omit<Appointment, 'id' | 'createdAt'>) => Promise<void>;
  /** Devuelve la comanda que se abrió al atender/completar y su saldo */
  updateAppointmentStatus: (
    id: string, status: AppointmentStatus, completedAt?: string,
  ) => Promise<{ saleId: string | null; saldoPendiente: number | null }>;
  deleteAppointment: (id: string) => Promise<void>;
  conversations: Conversation[];
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  toggleChatAiStatus: (conversationId: string, enableAi: boolean) => Promise<void>;
  sendMessageToConversation: (conversationId: string, text: string, sender?: 'client' | 'agent' | 'bot') => Promise<void>;
  startChatWithClient: (client: Client) => void;
  botConfigs: BotChannelConfig[];
  toggleBotChannel: (channelId: CommunicationChannel, enabled: boolean) => Promise<void>;
  updateBotMessage: (channelId: CommunicationChannel, field: 'welcomeMessage' | 'offHoursMessage', text: string) => Promise<void>;
  settings: SalonBusinessSettings;
  updateSettings: (newSettings: Partial<SalonBusinessSettings>) => void;
  metricsPeriod: 'day' | 'week' | 'month';
  setMetricsPeriod: (p: 'day' | 'week' | 'month') => void;
  currentMetrics: SalonMetrics;
  isLoadingMetrics: boolean;
  systemLogs: SystemLog[];
  addSystemLog: (log: Omit<SystemLog, 'id' | 'timestamp'>) => void;
  toast: ToastInfo | null;
  showToast: (title: string, message: string, type?: 'success' | 'info' | 'warning') => void;
  dismissToast: () => void;
  showSplash: boolean;
  triggerSplash: () => void;
  closeSplash: () => void;
  isPhoneFrame: boolean;
  setIsPhoneFrame: (val: boolean) => void;
  loungeTracks: LoungeTrack[];
  currentTrackIndex: number;
  currentTrack: LoungeTrack;
  isPlayingLounge: boolean;
  activeLoungeClient: Client | null;
  /** Todas las clientas del salón; la primera es la del sillón */
  loungeClients: Client[];
  setLoungeClients: (list: Client[]) => void;
  toggleLoungeClient: (c: Client) => void;
  /** Consumo de la cita en curso — cortesías y ventas en el mismo ticket */
  activeSale: Sale | null;
  saleBusy: boolean;
  openSale: (opts?: { clientId?: string | null; appointmentId?: string | null }) => Promise<Sale | null>;
  addSaleItem: (dto: {
    kind: 'service' | 'product' | 'courtesy';
    productId?: string; serviceId?: string; label?: string;
    quantity?: number; unitPrice?: number;
  }) => Promise<void>;
  removeSaleItem: (itemId: string) => Promise<void>;
  setSaleItemQty: (itemId: string, quantity: number) => Promise<void>;
  toggleSaleItemCourtesy: (itemId: string) => Promise<void>;
  setSalePriceList: (priceListId: string | null) => Promise<void>;
  // Monedas y billetes
  currencies: Currency[];
  baseCurrency: Currency | null;
  loadCurrencies: () => Promise<void>;
  saveCurrency: (dto: Partial<Currency> & { id?: string }) => Promise<void>;
  deleteCurrency: (id: string) => Promise<void>;
  addDenomination: (currencyId: string, value: number, kind?: string) => Promise<void>;
  removeDenomination: (denomId: string) => Promise<void>;
  /** Todas las comandas abiertas del salón, para saltar entre cuentas */
  openFolios: Sale[];
  loadOpenFolios: () => Promise<void>;
  /** Abre (o recupera) la comanda de una cita concreta, con o sin ficha */
  abrirComandaDeCita: (apt: { id: string; clientId?: string | null; clientName?: string }) => Promise<Sale | null>;
  /** Le pone dueña a una cuenta de mostrador (null la devuelve a mostrador) */
  asignarClientaAFolio: (saleId: string, clientId: string | null) => Promise<boolean>;

  // ── Sala y turnos ──
  sala: SalaEnVivo | null;
  salaCargando: boolean;
  loadSala: () => Promise<void>;
  zonas: SalonZone[];
  loadZonas: () => Promise<void>;
  guardarZona: (dto: { id?: string; name: string; prefix: string; color?: string | null; sortOrder?: number; active?: boolean }) => Promise<boolean>;
  eliminarZona: (id: string) => Promise<void>;
  especialistas: SalonStaff[];
  loadEspecialistas: () => Promise<void>;
  guardarEspecialista: (dto: { id?: string; name: string; role?: string; zoneId?: string | null; active?: boolean }) => Promise<boolean>;
  eliminarEspecialista: (id: string) => Promise<void>;
  /** Da el turno: la persona llegó. Con appointmentId es una cita; sin él, walk-in */
  darTurno: (dto: { appointmentId?: string | null; clientId?: string | null; clientName?: string; zoneId?: string | null; staffId?: string | null; reason?: string | null }) => Promise<QueueTicket | null>;
  accionTurno: (id: string, accion: 'call' | 'serve' | 'finish' | 'cancel' | 'no-show', body?: any) => Promise<void>;
  /** Reasigna zona, especialista o servicio sin cambiarle el número */
  moverTurno: (id: string, dto: { zoneId?: string | null; staffId?: string | null; reason?: string | null }) => Promise<void>;
  /** Cierra una comanda: la anula si está vacía, si no solo la saca de la vista */
  cerrarFolio: (saleId: string) => Promise<void>;
  selectFolio: (saleId: string) => Promise<void>;
  newCounterFolio: (label?: string) => Promise<Sale | null>;
  moveSaleItem: (itemId: string, toSaleId: string) => Promise<void>;
  paySale: (dto: { method: string; amount: number; tip?: number; reference?: string; currency?: string }) => Promise<void>;
  closeSale: (permitirSinPagar?: boolean) => Promise<boolean>;
  /** Bitácora del salón: cortesías, ventas y canciones. Vive en el backend. */
  loungeEvents: LoungeEvent[];
  loungeEventsLoading: boolean;
  loungeEventsHasMore: boolean;
  loadLoungeEvents: (opts?: { clientId?: string; range?: 'today' | 'all'; append?: boolean }) => Promise<void>;
  recordLoungeEvent: (dto: Partial<LoungeEvent> & { kind: LoungeEvent['kind']; label: string }) => Promise<void>;
  playTrack: (indexOrId?: number | string) => void;
  togglePlayLounge: () => void;
  nextLoungeTrack: () => void;
  prevLoungeTrack: () => void;
  addTrackToLounge: (track: Omit<LoungeTrack, 'id'>) => Promise<void>;
  removeLoungeTrack: (id: string) => Promise<void>;
  setActiveLoungeClient: (client: Client | null) => void;
  serveHospitalityItem: (item: string, extra?: { refId?: string; amount?: number }) => void;
  playMusicForClient: (client: Client) => void;
  // Price Lists
  priceLists: PriceList[];
  isLoadingPriceLists: boolean;
  loadPriceLists: () => Promise<void>;
  createPriceList: (dto: { name: string; description?: string; isDefault?: boolean; rules: Omit<PriceListRule, 'id'>[] }) => Promise<PriceList>;
  updatePriceList: (id: string, dto: { name?: string; description?: string; isDefault?: boolean; rules?: Omit<PriceListRule, 'id'>[] }) => Promise<void>;
  deletePriceList: (id: string) => Promise<void>;
  assignPriceList: (priceListId: string, clientId: string) => Promise<void>;
  unassignPriceList: (clientId: string) => Promise<void>;
  // Ingredients
  loadIngredients: (serviceId: string) => Promise<ServiceIngredient[]>;
  saveIngredients: (serviceId: string, ingredients: Omit<ServiceIngredient, 'id' | 'product'>[]) => Promise<ServiceIngredient[]>;
  // ── YouTube global player (sobrevive al cambio de pantalla) ──
  youtubeEmbed: string | null;
  setYoutubeEmbed: (url: string | null) => void;
  /** Dónde se acopla el video. Gana 'lounge' (la vista grande) sobre 'dock'
   *  (el mini reproductor de la barra). Si no hay ninguno, flota. */
  youtubeAnchorEl: HTMLElement | null;
  /** Cuál zona tiene el video ahora mismo (para que la otra dibuje la miniatura
   *  en vez de un hueco negro vacío) */
  ytAnchorKey: 'lounge' | 'dock' | null;
  setYtLoungeAnchor: (el: HTMLElement | null) => void;
  setYtDockAnchor: (el: HTMLElement | null) => void;
  ytFullscreen: () => void;
  /** En el Reproductor: mostrar el video o la portada del disco */
  ytShowVideo: boolean;
  setYtShowVideo: (v: boolean) => void;
  /** Bloques por clienta y cómo repartirlos entre ellas */
  ytBlocks: YtClientBlock[];
  setYtBlocks: (b: YtClientBlock[]) => void;
  ytMixMode: YtMixMode;
  setYtMixMode: (m: YtMixMode) => void;
  // ── Listas de reproducción ──
  playlists: Playlist[];
  selectedPlaylistIds: string[];
  loadPlaylists: () => Promise<void>;
  togglePlaylistSelected: (id: string) => void;
  createPlaylist: (name: string, clientId?: string | null) => Promise<Playlist | null>;
  deletePlaylist: (id: string) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, track: YtTrack) => Promise<any>;
  addTracksToPlaylist: (playlistId: string, tracks: YtTrack[]) => Promise<any>;
  updatePlaylist: (playlistId: string, dto: { name?: string; pinned?: boolean }) => Promise<any>;
  reorderPlaylistTracks: (playlistId: string, videoIds: string[]) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, videoId: string) => Promise<void>;
  // Cola controlable vía IFrame Player API
  ytPlayerRef: React.MutableRefObject<any>;
  ytQueue: YtTrack[];
  /** Orden de reproducción: posiciones dentro de ytQueue. Al activar aleatorio
   *  se baraja una vez y la lista se redibuja en ese orden, así el salón ve
   *  qué canción viene después. */
  ytOrder: number[];
  ytIndex: number;
  ytPlaying: boolean;
  ytShuffle: boolean;
  ytRepeatMode: 'off' | 'all' | 'one';
  ytMuted: boolean;
  ytVolume: number;
  ytTime: number;
  ytDuration: number;
  ytReady: boolean;
  setYtQueue: (tracks: YtTrack[], opts?: { keepCurrent?: boolean }) => void;
  setYtPlaying: (v: boolean) => void;
  setYtReady: (v: boolean) => void;
  setYtTime: (v: number) => void;
  setYtDuration: (v: number) => void;
  ytPlayIndex: (i: number) => void;
  ytToggle: () => void;
  ytNext: () => void;
  ytPrev: () => void;
  /** La llama el player cuando una canción termina sola (respeta "repetir una") */
  ytOnEnded: () => void;
  ytSeek: (sec: number) => void;
  ytSetVolume: (v: number) => void;
  ytToggleMute: () => void;
  toggleYtShuffle: () => void;
  cycleYtRepeat: () => void;
}

/** Pista de YouTube resuelta por el backend */
export interface YtTrack {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string | null;
  durationSeconds: number | null;
  /** De quién es este gusto (en colas compartidas) */
  clientId?: string;
  clientName?: string;
}

/** Bloque de canciones de una fuente (clienta o lista), tal como llega del backend */
export interface YtClientBlock {
  kind?: 'client' | 'playlist';
  clientId: string;
  clientName: string;
  tracks: YtTrack[];
  preferences: string[];
  pinnedCount?: number;
  reason?: string;
}

/** Lista de reproducción guardada */
export interface Playlist {
  id: string;
  name: string;
  clientId: string | null;
  icon: string | null;
  color: string | null;
  pinned: boolean;
  tracks: {
    id: string; videoId: string; title: string;
    channel: string | null; thumbnail: string | null;
    durationSeconds: number | null; position: number;
  }[];
  client?: { id: string; name: string } | null;
}

/** Cómo se reparte la música cuando hay varias clientas en el salón */
export type YtMixMode = 'fair' | 'chair' | 'random';

/**
 * Mezcla los bloques por clienta en una sola cola.
 *
 * - fair   → ronda uno-a-uno: A1, B1, C1, A2, B2, C2…
 * - chair  → igual pero la primera clienta (la del sillón) va doble: A,A,B,C,A,A,B,C…
 * - random → todo en una bolsa y se baraja
 *
 * Vive aquí y no en el backend a propósito: cambiar de modo debe reordenar al
 * instante, sin otra llamada de red ni gastar cuota de YouTube.
 */
export function mixClientQueues(blocks: YtClientBlock[], mode: YtMixMode): YtTrack[] {
  const lanes = blocks
    .filter(b => b.tracks.length)
    .map(b => b.tracks.map(t => ({ ...t, clientId: b.clientId, clientName: b.clientName })));

  if (!lanes.length) return [];
  if (lanes.length === 1) return [...lanes[0]];

  if (mode === 'random') {
    const bag = lanes.flat();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }

  // Cuántas van seguidas de cada quien en cada vuelta
  const weight = (laneIndex: number) => (mode === 'chair' && laneIndex === 0 ? 2 : 1);

  const cursor = new Array(lanes.length).fill(0);
  const out: YtTrack[] = [];
  const total = lanes.reduce((n, l) => n + l.length, 0);

  while (out.length < total) {
    let movedThisRound = false;
    for (let i = 0; i < lanes.length; i++) {
      for (let k = 0; k < weight(i); k++) {
        if (cursor[i] < lanes[i].length) {
          out.push(lanes[i][cursor[i]++]);
          movedThisRound = true;
        }
      }
    }
    // Salvaguarda: si nadie avanzó, no hay más que repartir
    if (!movedThisRound) break;
  }
  return out;
}

export interface ServiceIngredient {
  id: string;
  productId: string;
  quantity: number;
  unit: string;
  notes?: string;
  product?: { id: string; name: string; category: string; categoryName: string; sku: string; stock: number };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function mapApiClient(c: any): Client {
  return {
    id: c.id, name: c.name, phone: c.phone, email: c.email,
    avatar: c.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=e2e8f0&color=475569`,
    preferredChannel: c.preferredChannel ?? 'whatsapp',
    tags: c.tags ?? [], beautyNotes: c.beautyNotes,
    medicalOrAllergyNotes: c.medicalOrAllergyNotes, hospitality: c.hospitalityPrefs,
    totalVisits: c.totalVisits ?? 0, totalSpent: Number(c.totalSpent ?? 0),
    lastVisitDate: c.lastVisitDate ? String(c.lastVisitDate).slice(0, 10) : undefined,
    registeredDate: c.registeredAt ? String(c.registeredAt).slice(0, 10) : new Date().toISOString().slice(0, 10),
    priceListId: c.priceListId,
  };
}
function mapApiService(s: any): SalonService {
  return {
    id: s.id, name: s.name, category: s.category, categoryName: s.categoryName,
    price: Number(s.basePrice), durationMinutes: s.durationMinutes,
    icon: s.icon ?? 'sparkles', color: s.color ?? '#6366f1',
    popular: s.popular ?? false, description: s.description,
    aiAvailable: s.aiAvailable ?? true, priceTiers: ((s.priceTiers as any[]) ?? []).filter((t: any) => t && typeof t === 'object' && !Array.isArray(t)),
  };
}
function mapApiProduct(p: any): SalonProduct {
  return {
    id: p.id, name: p.name, category: p.category, categoryName: p.categoryName,
    sku: p.sku, basePrice: Number(p.basePrice), stock: Number(p.stock ?? 0), unit: p.unit ?? 'unit',
    unitQty: p.unitQty != null ? Number(p.unitQty) : undefined, unitQtyUnit: p.unitQtyUnit ?? undefined,
      costPrice: p.costPrice != null ? Number(p.costPrice) : undefined,
      minStock: p.minStock != null ? Number(p.minStock) : undefined,
      alertThreshold: p.alertThreshold != null ? Number(p.alertThreshold) : undefined,
      hasLotTracking: p.hasLotTracking ?? false,
      lotStrategy: (p.lotStrategy as 'FEFO' | 'FIFO') ?? 'FEFO',
    image: p.image, description: p.description ?? '',
    aiAvailable: p.aiAvailable ?? true, priceTiers: ((p.priceTiers as any[]) ?? []).filter((t: any) => t && typeof t === 'object' && !Array.isArray(t)),
  };
}
function mapApiAppointment(a: any): Appointment {
  const startsAt = new Date(a.startsAt);
  return {
    id: a.id, clientId: a.clientId, clientName: a.clientName, clientPhone: a.clientPhone,
    serviceId: a.serviceId ?? '', serviceName: a.serviceName, serviceCategory: a.serviceCategory,
    date: startsAt.toISOString().slice(0, 10), time: startsAt.toTimeString().slice(0, 5),
    durationMinutes: a.durationMinutes, bufferMinutes: a.bufferMinutes,
    price: Number(a.price), selectedPriceTierName: a.selectedPriceTierName,
    depositPaid: Number(a.depositPaid ?? 0), staffName: a.staffName,
    status: a.status, channel: a.channel, notes: a.notes, createdAt: a.createdAt,
    startsAt: a.startsAt, completedAt: a.completedAt ?? undefined,
  };
}
function mapApiConversation(c: any): Conversation {
  return {
    id: c.id, clientId: c.clientId, clientName: c.clientName,
    clientHandle: c.clientHandle, clientPhone: c.clientPhone,
    clientAvatar: c.clientAvatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(c.clientName)}&background=e2e8f0&color=475569`,
    channel: c.channel, status: c.status, lastMessage: c.lastMessage ?? '',
    lastMessageTime: c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '',
    unreadCount: c.unreadCount ?? 0, serviceInterest: c.serviceInterest, confidenceScore: c.confidenceScore,
    messages: (c.messages ?? []).map((m: any): ChatMessage => ({
      id: m.id, sender: m.sender, text: m.text, timestamp: m.createdAt, isAiGenerated: m.isAiGenerated,
    })),
  };
}
function mapApiBotConfig(b: any): BotChannelConfig {
  return {
    id: b.channel as CommunicationChannel, name: b.name, enabled: b.enabled, model: b.model,
    webhookLatencyMs: b.webhookLatencyMs ?? 120, status: b.status ?? 'online',
    messagesProcessedToday: b.messagesProcessedToday ?? 0, appointmentsBookedToday: b.appointmentsBookedToday ?? 0,
    welcomeMessage: b.welcomeMessage ?? '', offHoursMessage: b.offHoursMessage ?? '',
  };
}
function mapApiTrack(t: any): LoungeTrack {
  return {
    id: t.id, title: t.title, artist: t.artist, album: t.album,
    durationSeconds: t.durationSeconds,
    coverUrl: t.coverUrl ?? `https://picsum.photos/seed/${t.id}/300/300`,
    vibe: t.vibe, source: t.source, externalUrl: t.externalUrl,
    youtubeId: t.youtubeId, spotifyUri: t.spotifyUri, dedicatedForClientName: t.dedicatedForClientName,
  };
}
function mapApiPriceList(pl: any): PriceList {
  return {
    id: pl.id,
    name: pl.name,
    description: pl.description,
    isDefault: pl.isDefault ?? false,
    rules: (pl.rules ?? []).map((r: any): PriceListRule => ({
      id: r.id, target: r.target, contextKey: r.contextKey,
      modifierType: r.modifierType, modifierValue: Number(r.modifierValue),
    })),
    clientCount: pl._count?.clients ?? pl.clientCount ?? 0,
  };
}

const EMPTY_METRICS: SalonMetrics = {
  period: 'month', totalRevenue: 0, revenueGrowthPercent: 0,
  clientsCount: 0, clientsGrowthPercent: 0, completedAppointments: 0,
  aiBookedAppointments: 0, aiConversionRate: 0,
  topServices: [], peakHours: [], busiestDays: [], channelDistribution: [],
};
const FALLBACK_TRACK: LoungeTrack = {
  id: 'fallback', title: 'Sin pistas', artist: 'Añade música al Lounge',
  durationSeconds: 0, coverUrl: 'https://picsum.photos/seed/lounge/300/300',
  vibe: 'ambient', source: 'salon_radio',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  const [currentScreen, setCurrentScreen] = useState<ScreenName>('dashboard');
  const [screenHistory, setScreenHistory] = useState<ScreenName[]>([]);
  const navigateTo = useCallback((screen: ScreenName) => {
    setScreenHistory(h => [...h, currentScreen]);
    setCurrentScreen(screen);
  }, [currentScreen]);
  const [catalogDeepLink, setCatalogDeepLink] = useState<{ serviceId?: string; productId?: string; tab?: 'config' | 'recipe' } | null>(null);
  const clearCatalogDeepLink = useCallback(() => setCatalogDeepLink(null), []);
  const navigateToCatalog = useCallback((opts: { serviceId?: string; productId?: string; tab?: 'config' | 'recipe' }) => {
    setCatalogDeepLink(opts);
    setScreenHistory(h => [...h, currentScreen]);
    setCurrentScreen('catalog');
  }, [currentScreen]);
  const goBack = useCallback(() => {
    setScreenHistory(h => {
      const prev = h[h.length - 1];
      if (prev) setCurrentScreen(prev);
      return h.slice(0, -1);
    });
  }, []);

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
  const [settings, setSettings] = useState<SalonBusinessSettings>(INITIAL_SETTINGS);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>(INITIAL_SYSTEM_LOGS);
  const [metricsPeriod, setMetricsPeriod] = useState<'day' | 'week' | 'month'>('month');
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [isLoadingPriceLists, setIsLoadingPriceLists] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    const load = async () => {
      setIsLoadingClients(true);
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
        if (tracks.status === 'fulfilled' && (tracks.value as any[]).length > 0)
          setLoungeTracks((tracks.value as any[]).map(mapApiTrack));
      } catch (e) { console.error('Failed to load app data', e); }
      finally { setIsLoadingClients(false); }
    };
    load();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setIsLoadingMetrics(true);
    api.get<any>(`/metrics?period=${metricsPeriod}`)
      .then(d => setCurrentMetrics({ ...EMPTY_METRICS, ...d }))
      .catch(() => {})
      .finally(() => setIsLoadingMetrics(false));
  }, [isAuthenticated, metricsPeriod]);

  const addClient = useCallback(async (data: Omit<Client, 'id' | 'registeredDate'>): Promise<Client> => {
    const res = await api.post<any>('/clients', {
      name: data.name, phone: data.phone,
      email: data.email || undefined,
      avatar: data.avatar,
      preferredChannel: data.preferredChannel, tags: data.tags,
      beautyNotes: data.beautyNotes || undefined,
      medicalOrAllergyNotes: data.medicalOrAllergyNotes || undefined,
      hospitalityPrefs: data.hospitality,
    });
    const client = mapApiClient(res);
    setClients(c => [client, ...c]);
    return client;
  }, []);
  const updateClient = useCallback(async (id: string, updated: Partial<Client>) => {
    const payload: Record<string, any> = {};
    if (updated.name !== undefined)                   payload.name = updated.name;
    if (updated.phone !== undefined)                  payload.phone = updated.phone;
    if (updated.email !== undefined)                  payload.email = updated.email || undefined;
    if (updated.avatar !== undefined)                 payload.avatar = updated.avatar;
    if (updated.preferredChannel !== undefined)       payload.preferredChannel = updated.preferredChannel;
    if (updated.tags !== undefined)                   payload.tags = updated.tags;
    if (updated.beautyNotes !== undefined)            payload.beautyNotes = updated.beautyNotes || undefined;
    if (updated.medicalOrAllergyNotes !== undefined)  payload.medicalOrAllergyNotes = updated.medicalOrAllergyNotes || undefined;
    if (updated.hospitality !== undefined)            payload.hospitalityPrefs = updated.hospitality;
    const res = await api.patch<any>(`/clients/${id}`, payload);
    setClients(c => c.map(x => x.id === id ? mapApiClient(res) : x));
  }, []);
  const deleteClient = useCallback(async (id: string) => {
    await api.delete(`/clients/${id}`);
    setClients(c => c.filter(x => x.id !== id));
  }, []);

  const addService = useCallback(async (data: Omit<SalonService, 'id'>) => {
    const res = await api.post<any>('/services', {
      name: data.name, category: data.category, categoryName: data.categoryName,
      basePrice: data.price, durationMinutes: data.durationMinutes,
      icon: data.icon, color: data.color, popular: data.popular,
      description: data.description, aiAvailable: data.aiAvailable, priceTiers: data.priceTiers,
    });
    setServices(s => [...s, mapApiService(res)]);
  }, []);
  const updateService = useCallback(async (id: string, updated: Partial<SalonService>) => {
    const payload: Record<string, any> = {};
    if (updated.name !== undefined)            payload.name = updated.name;
    if (updated.category !== undefined)        payload.category = updated.category;
    if (updated.categoryName !== undefined)    payload.categoryName = updated.categoryName;
    if (updated.price !== undefined)           payload.basePrice = updated.price; // map frontend→backend
    if (updated.durationMinutes !== undefined) payload.durationMinutes = updated.durationMinutes;
    if (updated.icon !== undefined)            payload.icon = updated.icon;
    if (updated.color !== undefined)           payload.color = updated.color;
    if (updated.popular !== undefined)         payload.popular = updated.popular;
    if (updated.description !== undefined)     payload.description = updated.description || undefined;
    if (updated.aiAvailable !== undefined)     payload.aiAvailable = updated.aiAvailable;
    if (updated.priceTiers !== undefined)      payload.priceTiers = updated.priceTiers;
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

  const addProduct = useCallback(async (data: Omit<SalonProduct, 'id'>) => {
    const res = await api.post<any>('/products', {
      name: data.name, category: data.category, categoryName: data.categoryName,
      sku: data.sku, basePrice: data.basePrice, stock: data.stock ?? 0,
      unit: data.unit ?? 'unit',
      unitQty: data.unitQty ?? undefined,
      unitQtyUnit: data.unitQtyUnit ?? undefined,
      costPrice: data.costPrice ?? undefined,
      minStock: data.minStock ?? undefined,
      alertThreshold: data.alertThreshold ?? undefined,
      hasLotTracking: data.hasLotTracking ?? undefined,
      lotStrategy: data.lotStrategy ?? undefined,
      image: data.image || undefined, description: data.description || undefined,
      aiAvailable: data.aiAvailable, priceTiers: data.priceTiers ?? [],
    });
    setProducts(p => [...p, mapApiProduct(res)]);
  }, []);
  const updateProduct = useCallback(async (id: string, updated: Partial<SalonProduct>) => {
    const payload: Record<string, any> = {};
    if (updated.name !== undefined)         payload.name = updated.name;
    if (updated.category !== undefined)     payload.category = updated.category;
    if (updated.categoryName !== undefined) payload.categoryName = updated.categoryName;
    if (updated.sku !== undefined)          payload.sku = updated.sku;
    if (updated.basePrice !== undefined)    payload.basePrice = updated.basePrice;
    if (updated.stock !== undefined)        payload.stock = updated.stock;
    if (updated.image !== undefined)        payload.image = updated.image || undefined;
    if (updated.description !== undefined)  payload.description = updated.description || undefined;
    if (updated.aiAvailable !== undefined)    payload.aiAvailable = updated.aiAvailable;
    if (updated.priceTiers !== undefined)     payload.priceTiers = updated.priceTiers;
    if (updated.unit !== undefined)           payload.unit = updated.unit;
    if (updated.unitQty !== undefined)        payload.unitQty = updated.unitQty;
    if (updated.unitQtyUnit !== undefined)    payload.unitQtyUnit = updated.unitQtyUnit;
    if (updated.costPrice !== undefined)      payload.costPrice = updated.costPrice;
    if (updated.minStock !== undefined)       payload.minStock = updated.minStock;
    if (updated.alertThreshold !== undefined) payload.alertThreshold = updated.alertThreshold;
    if (updated.hasLotTracking !== undefined) payload.hasLotTracking = updated.hasLotTracking;
    if (updated.lotStrategy !== undefined)    payload.lotStrategy = updated.lotStrategy;
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

  const addAppointment = useCallback(async (data: Omit<Appointment, 'id' | 'createdAt'>) => {
    const res = await api.post<any>('/appointments', {
      locationId: data.locationId || undefined,
      clientId: data.clientId || undefined,
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      serviceId: data.serviceId || undefined,
      serviceName: data.serviceName,
      serviceCategory: data.serviceCategory,
      staffId: data.staffId || undefined,
      staffName: data.staffName,
      startsAt: data.startsAt ?? `${(data as any).date}T${(data as any).time}:00`,
      durationMinutes: data.durationMinutes,
      price: data.price,
      currencyCode: (data as any).currencyCode || undefined,
      selectedPriceTierName: data.selectedPriceTierName || undefined,
      depositPaid: data.depositPaid ?? 0,
      channel: data.channel,
      notes: data.notes || undefined,
    });
    setAppointments(a => [...a, mapApiAppointment(res)]);
  }, []);
  // Puente hacia loadOpenFolios, que se define bastante más abajo (necesita
  // el estado de ventas). Con el ref no hay que reordenar medio contexto.
  const loadOpenFoliosRef = useRef<(() => Promise<void>) | null>(null);

  /**
   * Devuelve el saldo que quedó pendiente, porque al marcar ATENDIENDO (y
   * también al COMPLETAR, que se puede hacer sin pasar por atendiendo) el
   * backend le abre la comanda a la clienta con el servicio adentro. Quien
   * llame decide si avisa; aquí solo se refresca el contador de comandas
   * abiertas para que el aviso rojo de Caja salga al instante.
   */
  const updateAppointmentStatus = useCallback(async (
    id: string, status: AppointmentStatus, completedAt?: string,
  ): Promise<{ saleId: string | null; saldoPendiente: number | null }> => {
    const body: Record<string, string> = { status };
    if (completedAt) body.completedAt = completedAt;
    const res = await api.patch<any>(`/appointments/${id}/status`, body);
    setAppointments(a => a.map(x => x.id === id ? { ...x, status, ...(completedAt ? { completedAt } : {}) } : x));
    if (status === 'attending' || status === 'completed') void loadOpenFoliosRef.current?.();
    return { saleId: res?.saleId ?? null, saldoPendiente: res?.saldoPendiente ?? null };
  }, []);
  const deleteAppointment = useCallback(async (id: string) => {
    await api.delete(`/appointments/${id}`);
    setAppointments(a => a.filter(x => x.id !== id));
  }, []);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const toggleChatAiStatus = useCallback(async (conversationId: string, enableAi: boolean) => {
    await api.patch(`/conversations/${conversationId}/ai`, { enableAi });
    setConversations(c => c.map(x => x.id === conversationId
      ? { ...x, status: enableAi ? 'ai_active' as const : 'manual_control' as const } : x));
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
    const temp: Conversation = {
      id: `temp_${Date.now()}`, clientId: client.id, clientName: client.name,
      clientAvatar: client.avatar, clientPhone: client.phone,
      channel: client.preferredChannel, status: 'ai_active',
      lastMessage: '', lastMessageTime: '', unreadCount: 0, messages: [],
    };
    setConversations(c => [temp, ...c]);
    setActiveConversationId(temp.id);
    navigateTo('chats');
  }, [conversations, navigateTo]);

  const toggleBotChannel = useCallback(async (channelId: CommunicationChannel, enabled: boolean) => {
    await api.patch(`/bots/${channelId}`, { enabled });
    setBotConfigs(b => b.map(x => x.id === channelId ? { ...x, enabled } : x));
  }, []);
  const updateBotMessage = useCallback(async (channelId: CommunicationChannel, field: 'welcomeMessage' | 'offHoursMessage', text: string) => {
    await api.patch(`/bots/${channelId}`, { [field]: text });
    setBotConfigs(b => b.map(x => x.id === channelId ? { ...x, [field]: text } : x));
  }, []);

  const updateSettings = useCallback((newSettings: Partial<SalonBusinessSettings>) => {
    setSettings(s => ({ ...s, ...newSettings }));
  }, []);

  const addSystemLog = useCallback((log: Omit<SystemLog, 'id' | 'timestamp'>) => {
    const entry: SystemLog = { ...log, id: `log_${Date.now()}`, timestamp: new Date().toISOString() };
    setSystemLogs(l => [entry, ...l.slice(0, 199)]);
  }, []);

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

  const [showSplash, setShowSplash] = useState(() => {
    try { return localStorage.getItem('skipSplash') !== 'true'; } catch { return true; }
  });
  useEffect(() => {
    if (!showSplash) return; // already hidden (skip mode)
    const t = setTimeout(() => setShowSplash(false), 2200);
    return () => clearTimeout(t);
  }, [showSplash]);
  const triggerSplash = () => setShowSplash(true);
  const closeSplash = () => setShowSplash(false);
  const [isPhoneFrame, setIsPhoneFrame] = useState(false);

  // ── YouTube global player state ──────────────────────────────
  // Vive aquí (no en LoungePlayerScreen) para que el iframe no se
  // desmonte al navegar a otra pantalla.
  const [youtubeEmbed, setYoutubeEmbed] = useState<string | null>(null);

  // Registro de anclajes por prioridad. Cada zona que puede alojar el video se
  // registra con su clave; el player usa la de mayor prioridad disponible.
  const [ytAnchors, setYtAnchors] = useState<{ lounge: HTMLElement | null; dock: HTMLElement | null }>({
    lounge: null, dock: null,
  });
  const setYtLoungeAnchor = useCallback((el: HTMLElement | null) => {
    setYtAnchors(a => (a.lounge === el ? a : { ...a, lounge: el }));
  }, []);
  const setYtDockAnchor = useCallback((el: HTMLElement | null) => {
    setYtAnchors(a => (a.dock === el ? a : { ...a, dock: el }));
  }, []);
  const ytAnchorKey: 'lounge' | 'dock' | null =
    ytAnchors.lounge ? 'lounge' : ytAnchors.dock ? 'dock' : null;
  const youtubeAnchorEl = ytAnchors.lounge ?? ytAnchors.dock ?? null;


  // Portada vs video en la tarjeta del Reproductor
  const [ytShowVideo, setYtShowVideo] = useState(true);

  // Cola compartida: bloques por fuente + cómo repartirlos
  const [ytBlocks, setYtBlocks] = useState<YtClientBlock[]>([]);
  const [ytMixMode, setYtMixMode] = useState<YtMixMode>('fair');

  // ── Listas de reproducción ────────────────────────────────────────
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>([]);

  const loadPlaylists = useCallback(async () => {
    try {
      const data = await api.get<Playlist[]>('/playlists');
      setPlaylists(data ?? []);
    } catch { /* la función es opcional; no rompemos el Lounge */ }
  }, []);

  const togglePlaylistSelected = useCallback((id: string) => {
    setSelectedPlaylistIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  }, []);

  const createPlaylist = useCallback(async (
    name: string,
    clientId?: string | null,
  ): Promise<Playlist | null> => {
    try {
      const pl = await api.post<Playlist>('/playlists', { name, clientId: clientId ?? null });
      setPlaylists(prev => [...prev, pl]);
      return pl;
    } catch { return null; }
  }, []);

  const deletePlaylist = useCallback(async (id: string) => {
    try {
      await api.delete(`/playlists/${id}`);
      setPlaylists(prev => prev.filter(p => p.id !== id));
      setSelectedPlaylistIds(prev => prev.filter(x => x !== id));
    } catch { /* noop */ }
  }, []);

  /** Guarda una canción en una lista (la que suena, normalmente) */
  const addTrackToPlaylist = useCallback(async (playlistId: string, track: YtTrack) => {
    try {
      const res = await api.post<{ duplicated: boolean; playlist: Playlist }>(
        `/playlists/${playlistId}/tracks`,
        {
          videoId: track.videoId,
          title: track.title,
          channel: track.channel,
          thumbnail: track.thumbnail,
          durationSeconds: track.durationSeconds,
        },
      );
      if (res?.playlist) {
        setPlaylists(prev => prev.map(p => (p.id === res.playlist.id ? res.playlist : p)));
      }
      return res;
    } catch { return null; }
  }, []);

  /** Guarda varias canciones de golpe (las marcadas en la cola) */
  const addTracksToPlaylist = useCallback(async (playlistId: string, tracks: YtTrack[]) => {
    try {
      const res = await api.post<{ added: number; skipped: number; playlist: Playlist }>(
        `/playlists/${playlistId}/tracks/bulk`,
        {
          tracks: tracks.map(t => ({
            videoId: t.videoId,
            title: t.title,
            channel: t.channel,
            thumbnail: t.thumbnail,
            durationSeconds: t.durationSeconds,
          })),
        },
      );
      if (res?.playlist) {
        setPlaylists(prev => prev.map(p => (p.id === res.playlist.id ? res.playlist : p)));
      }
      return res;
    } catch { return null; }
  }, []);

  /** Renombrar la lista (o cambiar si es fija) */
  const updatePlaylist = useCallback(async (
    playlistId: string,
    dto: { name?: string; pinned?: boolean },
  ) => {
    try {
      const pl = await api.patch<Playlist>(`/playlists/${playlistId}`, dto);
      if (pl?.id) setPlaylists(prev => prev.map(p => (p.id === pl.id ? pl : p)));
      return pl;
    } catch { return null; }
  }, []);

  /** Guardar el nuevo orden de las canciones */
  const reorderPlaylistTracks = useCallback(async (playlistId: string, videoIds: string[]) => {
    // Optimista: movemos en pantalla al instante y luego confirmamos
    setPlaylists(prev => prev.map(p => {
      if (p.id !== playlistId) return p;
      const byId = new Map(p.tracks.map(t => [t.videoId, t]));
      const tracks = videoIds.map(v => byId.get(v)).filter(Boolean) as Playlist['tracks'];
      return { ...p, tracks };
    }));
    try {
      const pl = await api.patch<Playlist>(`/playlists/${playlistId}/tracks/order`, { videoIds });
      if (pl?.id) setPlaylists(prev => prev.map(p => (p.id === pl.id ? pl : p)));
    } catch { /* si falla, la próxima carga trae el orden real */ }
  }, []);

  const removeTrackFromPlaylist = useCallback(async (playlistId: string, videoId: string) => {
    try {
      const res = await api.delete<{ playlist: Playlist }>(`/playlists/${playlistId}/tracks/${videoId}`);
      if (res?.playlist) {
        setPlaylists(prev => prev.map(p => (p.id === res.playlist.id ? res.playlist : p)));
      }
    } catch { /* noop */ }
  }, []);

  // Instancia del YT.Player, creada por <GlobalYouTubePlayer />
  const ytPlayerRef = useRef<any>(null);

  /** Pantalla completa nativa sobre el propio iframe del player */
  const ytFullscreen = useCallback(() => {
    try {
      const iframe: any = ytPlayerRef.current?.getIframe?.();
      if (!iframe) return;
      (iframe.requestFullscreen ?? iframe.webkitRequestFullscreen)?.call(iframe);
    } catch { /* el navegador puede negarlo; no es crítico */ }
  }, []);
  const [ytQueue, setYtQueueState] = useState<YtTrack[]>([]);
  const [ytOrder, setYtOrder] = useState<number[]>([]);
  const [ytIndex, setYtIndex] = useState(0);
  const [ytPlaying, setYtPlaying] = useState(false);
  const [ytShuffle, setYtShuffle] = useState(false);
  // 'all' por defecto: el salón suena todo el día sin intervención
  const [ytRepeatMode, setYtRepeatMode] = useState<'off' | 'all' | 'one'>('all');
  const [ytMuted, setYtMuted] = useState(false);
  const [ytVolume, setYtVolumeState] = useState(80);
  const [ytTime, setYtTime] = useState(0);
  const [ytDuration, setYtDuration] = useState(0);
  const [ytReady, setYtReady] = useState(false);

  /** Baraja dejando `first` en la cabeza, para no cortar lo que ya suena */
  const shuffledOrder = useCallback((first: number, n: number) => {
    const rest = Array.from({ length: n }, (_, i) => i).filter(i => i !== first);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    return n ? [first, ...rest] : [];
  }, []);

  // Espejo de la cola para poder compararla sin recrear el callback
  const ytQueueRef = useRef<YtTrack[]>([]);
  useEffect(() => { ytQueueRef.current = ytQueue; }, [ytQueue]);

  /**
   * Carga una cola nueva. Si es exactamente la misma que ya suena, NO toca
   * nada: al volver al Lounge la pantalla vuelve a pedir la cola de la clienta
   * y sin esta guarda reiniciaba el índice a 0, cortando la canción en curso
   * para empezar otra vez por la primera.
   */
  const ytIndexRef = useRef(0);
  useEffect(() => { ytIndexRef.current = ytIndex; }, [ytIndex]);

  // Espejo del aleatorio: setYtQueue no puede depender de ytShuffle sin
  // recrearse en cada toggle (y el efecto que rearma la cola lo tiene como
  // dependencia, así que volvería a mezclar solo por encender el aleatorio).
  const ytShuffleRef = useRef(false);
  useEffect(() => { ytShuffleRef.current = ytShuffle; }, [ytShuffle]);

  const setYtQueue = useCallback((tracks: YtTrack[], opts?: { keepCurrent?: boolean }) => {
    const prev = ytQueueRef.current;
    const same =
      prev.length === tracks.length &&
      prev.every((t, i) => t.videoId === tracks[i]?.videoId);
    if (same) return;

    // Al cambiar el modo de mezcla la cola se reordena, pero lo que suena
    // ahora no debe cortarse: lo buscamos en la lista nueva y seguimos ahí.
    let nextIndex = 0;
    if (opts?.keepCurrent) {
      const playing = prev[ytIndexRef.current]?.videoId;
      const found = playing ? tracks.findIndex(t => t.videoId === playing) : -1;
      if (found >= 0) nextIndex = found;
    }

    ytQueueRef.current = tracks;
    setYtQueueState(tracks);
    // Reordenar la cola (cambiar el modo de mezcla, entrar otra clienta) NO
    // debe apagar el aleatorio: antes se ponía en false y la lista se
    // reorganizaba de golpe, sin animación y con el botón apagándose solo.
    // Si estaba encendido, se baraja la cola nueva dejando en cabeza lo que
    // ya suena.
    setYtOrder(
      ytShuffleRef.current && tracks.length > 1
        ? shuffledOrder(nextIndex, tracks.length)
        : tracks.map((_, i) => i),
    );
    setYtIndex(nextIndex);
  }, [shuffledOrder]);

  /**
   * ¿La música la está poniendo OTRO aparato?
   *
   * Si la respuesta es sí, los controles de esta pantalla dejan de tocar el
   * reproductor local y pasan a mandarle la orden al que suena. Se decide
   * aquí, en un solo sitio, y no en cada botón del Lounge: repartirlo por la
   * pantalla garantizaba que alguno se quedara controlando el silencio de
   * este aparato —que es justo lo que pasaba al tocar una canción de la
   * lista: adelante y atrás viajaban, y el clic en la lista no—.
   */
  const mandoRemoto = () => {
    const s = estadoMusica();
    return !!s.anfitrion && !soyElAnfitrion();
  };

  /**
   * Nada de música antes de saber si hay un televisor sonando.
   *
   * Al abrir la app tarda medio segundo en llegar la respuesta del servidor,
   * y ese es justo el medio segundo en el que alguien pulsa play: sonaba en
   * el teléfono y un instante después se callaba y la lista volvía a empezar
   * en el televisor. `cuandoSepamos` retiene la acción hasta que la respuesta
   * llega —un parpadeo— y entonces la manda adonde toca.
   */
  const conMando = (accion: () => void) => cuandoSepamos(accion);

  /**
   * Seguir a la canción que suena en el salón.
   *
   * Cuando el altavoz es otro aparato, ESTE reproductor está pausado y su
   * índice se queda donde estaba: el reproductor grande, la lista y el mini
   * reproductor seguían enseñando la primera canción mientras el televisor
   * iba por la quinta. No es solo feo — es información falsa sobre lo que
   * está oyendo la clienta.
   *
   * Se busca por videoId y no por índice: la cola del salón y la de este
   * teléfono pueden estar barajadas distinto, y el identificador del vídeo
   * es lo único que significa lo mismo en los dos sitios.
   */
  const musicaDelSalon = useMusicaSala();
  const videoRemoto = musicaDelSalon.sala.pista?.videoId ?? null;
  useEffect(() => {
    if (!musicaDelSalon.hayAnfitrion || musicaDelSalon.soyAnfitrion) return;
    if (!videoRemoto) return;
    const i = ytQueue.findIndex((t: any) => t.videoId === videoRemoto);
    if (i >= 0 && i !== ytIndexRef.current) setYtIndex(i);
  }, [videoRemoto, musicaDelSalon.hayAnfitrion, musicaDelSalon.soyAnfitrion, ytQueue]);

  const ytPlayIndex = useCallback((i: number) => {
    conMando(() => {
      if (mandoRemoto()) { ordenar('pista', i); return; }
      setYtIndex(i);
    });
  }, []);

  const ytToggle = useCallback(() => {
    conMando(() => {
      if (mandoRemoto()) {
        ordenar(estadoMusica().sonando ? 'pause' : 'play');
        return;
      }
      const p = ytPlayerRef.current;
      if (!p) return;
      try {
        if (ytPlaying) p.pauseVideo();
        else p.playVideo();
      } catch { /* el player aún no está listo */ }
    });
  }, [ytPlaying]);

  /** Avanza siguiendo ytOrder. Al terminar la vuelta, si hay aleatorio,
   *  se baraja de nuevo para que la próxima pasada tenga otro orden. */
  const ytNext = useCallback(() => {
    if (mandoRemoto()) { ordenar('next'); return; }
    const n = ytQueue.length;
    if (!n) return;
    const order = ytOrder.length === n ? ytOrder : Array.from({ length: n }, (_, i) => i);
    const pos = order.indexOf(ytIndex);
    const nextPos = pos + 1;

    if (nextPos < order.length) { setYtIndex(order[nextPos]); return; }

    if (ytRepeatMode === 'off') return; // fin de la cola, se queda quieto
    if (ytShuffle && n > 1) {
      const reshuffled = shuffledOrder(order[0], n);
      setYtOrder(reshuffled);
      setYtIndex(reshuffled[0]);
    } else {
      setYtIndex(order[0]);
    }
  }, [ytQueue.length, ytOrder, ytIndex, ytRepeatMode, ytShuffle, shuffledOrder]);

  /** Fin natural de una canción: 'one' la repite, el resto avanza */
  const ytOnEnded = useCallback(() => {
    if (ytRepeatMode === 'one') {
      try {
        ytPlayerRef.current?.seekTo(0, true);
        ytPlayerRef.current?.playVideo();
      } catch { /* noop */ }
      return;
    }
    ytNext();
  }, [ytRepeatMode, ytNext]);

  const ytPrev = useCallback(() => {
    if (mandoRemoto()) { ordenar('prev'); return; }
    const n = ytQueue.length;
    if (!n) return;
    // Igual que Spotify: si ya avanzó bastante, reinicia la canción
    const p = ytPlayerRef.current;
    try {
      if (p?.getCurrentTime && p.getCurrentTime() > 3) { p.seekTo(0, true); return; }
    } catch { /* noop */ }

    const order = ytOrder.length === n ? ytOrder : Array.from({ length: n }, (_, i) => i);
    const pos = order.indexOf(ytIndex);
    const prevPos = pos - 1;
    if (prevPos >= 0) { setYtIndex(order[prevPos]); return; }
    if (ytRepeatMode !== 'off') setYtIndex(order[order.length - 1]);
  }, [ytQueue.length, ytOrder, ytIndex, ytRepeatMode]);

  const ytSeek = useCallback((sec: number) => {
    if (mandoRemoto()) { ordenar('seek', sec); return; }
    try { ytPlayerRef.current?.seekTo(sec, true); } catch { /* noop */ }
    setYtTime(sec);
  }, []);

  const ytSetVolume = useCallback((v: number) => {
    if (mandoRemoto()) { ordenar('volumen', v); return; }
    setYtVolumeState(v);
    try {
      ytPlayerRef.current?.setVolume(v);
      if (v > 0) { ytPlayerRef.current?.unMute?.(); setYtMuted(false); }
    } catch { /* noop */ }
  }, []);

  const ytToggleMute = useCallback(() => {
    setYtMuted(m => {
      try {
        if (m) ytPlayerRef.current?.unMute?.();
        else ytPlayerRef.current?.mute?.();
      } catch { /* noop */ }
      return !m;
    });
  }, []);

  /** Al activarlo baraja de una vez y redibuja la lista; al apagarlo la
   *  devuelve al orden natural. En ambos casos lo que suena no se corta. */
  /**
   * Rearma la cola cada vez que cambian los bloques o el modo de mezcla.
   * `keepCurrent` evita que reordenar corte la canción que está sonando.
   */
  useEffect(() => {
    // OJO: sin el caso vacío, quitar la última clienta o lista dejaba la cola
    // anterior sonando para siempre — no había forma de "apagar" la música.
    setYtQueue(ytBlocks.length ? mixClientQueues(ytBlocks, ytMixMode) : [], { keepCurrent: true });
  }, [ytBlocks, ytMixMode, setYtQueue]);

  const toggleYtShuffle = useCallback(() => {
    const n = ytQueue.length;
    setYtShuffle(s => {
      const on = !s;
      setYtOrder(on
        ? shuffledOrder(ytIndex, n)
        : Array.from({ length: n }, (_, i) => i));
      return on;
    });
  }, [ytQueue.length, ytIndex, shuffledOrder]);

  // off → toda la lista → una sola → off
  const cycleYtRepeat = useCallback(() => {
    setYtRepeatMode(m => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'));
  }, []);

  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlayingLounge, setIsPlayingLounge] = useState(false);
  // Varias clientas pueden compartir el salón: la primera es la del sillón.
  const [loungeClients, setLoungeClients] = useState<Client[]>([]);
  const activeLoungeClient = loungeClients[0] ?? null;
  const setActiveLoungeClient = useCallback((c: Client | null) => {
    setLoungeClients(c ? [c] : []);
  }, []);
  const toggleLoungeClient = useCallback((c: Client) => {
    setLoungeClients(prev =>
      prev.some(x => x.id === c.id) ? prev.filter(x => x.id !== c.id) : [...prev, c],
    );
  }, []);
  // ── Bitácora del salón ───────────────────────────────────────────────
  // Antes esto era un useState que se perdía al recargar. Ahora vive en
  // lounge_events y sobrevive a la recarga, al cambio de dispositivo y al
  // cierre del día.
  const [loungeEvents, setLoungeEvents] = useState<LoungeEvent[]>([]);
  const [loungeEventsLoading, setLoungeEventsLoading] = useState(false);
  const [loungeEventsHasMore, setLoungeEventsHasMore] = useState(false);
  const loungeCursorRef = useRef<string | null>(null);
  const currentTrack = loungeTracks[currentTrackIndex] ?? FALLBACK_TRACK;

  const playTrack = useCallback((indexOrId?: number | string) => {
    if (indexOrId === undefined) { setIsPlayingLounge(true); loungeAudio.play(); return; }
    if (typeof indexOrId === 'number') setCurrentTrackIndex(indexOrId);
    else { const i = loungeTracks.findIndex(t => t.id === indexOrId); if (i >= 0) setCurrentTrackIndex(i); }
    setIsPlayingLounge(true); loungeAudio.play();
  }, [loungeTracks]);
  const togglePlayLounge = useCallback(() => {
    setIsPlayingLounge(p => {
      try {
        if (p) loungeAudio.pause();
        else loungeAudio.play();
      } catch (e) {
        console.error('Lounge audio error:', e);
      }
      return !p;
    });
  }, []);
  const nextLoungeTrack = useCallback(() => setCurrentTrackIndex(i => (i + 1) % loungeTracks.length), [loungeTracks.length]);
  const prevLoungeTrack = useCallback(() => setCurrentTrackIndex(i => (i - 1 + loungeTracks.length) % loungeTracks.length), [loungeTracks.length]);

  const addTrackToLounge = useCallback(async (track: Omit<LoungeTrack, 'id'>) => {
    const res = await api.post<any>('/lounge/tracks', track);
    setLoungeTracks(t => [...t.filter(x => x.id !== 'fallback'), mapApiTrack(res)]);
  }, []);
  const removeLoungeTrack = useCallback(async (id: string) => {
    await api.delete(`/lounge/tracks/${id}`);
    setLoungeTracks(t => { const next = t.filter(x => x.id !== id); return next.length > 0 ? next : [FALLBACK_TRACK]; });
  }, []);
  const loadLoungeEvents = useCallback(async (opts?: {
    clientId?: string; range?: 'today' | 'all'; append?: boolean;
  }) => {
    const append = opts?.append === true;
    setLoungeEventsLoading(true);
    try {
      const params = new URLSearchParams();
      if (opts?.clientId) params.set('clientId', opts.clientId);
      if (opts?.range) params.set('range', opts.range);
      params.set('limit', '50');
      // Solo paginamos hacia atrás en el histórico; "hoy" cabe en una página
      if (append && loungeCursorRef.current && opts?.range !== 'today') {
        params.set('before', loungeCursorRef.current);
      }
      const res = await api.get<{ items: LoungeEvent[]; hasMore: boolean; nextCursor: string | null }>(
        `/lounge/events?${params.toString()}`,
      );
      const items = res?.items ?? [];
      loungeCursorRef.current = res?.nextCursor ?? null;
      setLoungeEventsHasMore(!!res?.hasMore);
      setLoungeEvents(prev => (append ? [...prev, ...items] : items));
    } catch {
      if (!append) { setLoungeEvents([]); setLoungeEventsHasMore(false); }
    } finally {
      setLoungeEventsLoading(false);
    }
  }, []);

  const recordLoungeEvent = useCallback(async (
    dto: Partial<LoungeEvent> & { kind: LoungeEvent['kind']; label: string },
  ) => {
    // Optimista: la fila aparece de inmediato aunque la red tarde
    const provisional: LoungeEvent = {
      id: `tmp_${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...dto,
    } as LoungeEvent;
    setLoungeEvents(h => [provisional, ...h]);
    try {
      const guardado = await api.post<LoungeEvent>('/lounge/events', dto);
      if (guardado?.id) {
        setLoungeEvents(h => h.map(e => (e.id === provisional.id ? guardado : e)));
      }
    } catch {
      // Si no se pudo guardar, quitamos la fila fantasma en vez de mentir
      setLoungeEvents(h => h.filter(e => e.id !== provisional.id));
    }
  }, []);

// ── Consumo de la cita (POS) ─────────────────────────────────────────
  // Un solo ticket por clienta: el manicure, el café de cortesía y el trago
  // de whisky van a la misma cuenta. La cortesía es una línea en 0, no otra
  // tabla — así "servir" y "vender" son el mismo gesto con distinto precio.
  const [activeSale, setActiveSale] = useState<Sale | null>(null);
  const [saleBusy, setSaleBusy] = useState(false);

  const openSale = useCallback(async (opts?: {
    clientId?: string | null; appointmentId?: string | null;
  }): Promise<Sale | null> => {
    setSaleBusy(true);
    try {
      // El backend es idempotente: si ya había un ticket abierto lo devuelve
      const venta = await api.post<Sale>('/sales/open', {
        clientId: opts?.clientId ?? null,
        appointmentId: opts?.appointmentId ?? null,
      });
      setActiveSale(venta);
      return venta;
    } catch {
      showToast('No se pudo abrir el consumo', 'Revisa la conexión.', 'warning');
      return null;
    } finally {
      setSaleBusy(false);
    }
  }, []);

  const addSaleItem = useCallback(async (dto: {
    kind: 'service' | 'product' | 'courtesy';
    productId?: string; serviceId?: string; label?: string;
    quantity?: number; unitPrice?: number;
  }) => {
    let venta = activeSale;
    if (!venta) {
      venta = await openSale({ clientId: activeLoungeClient?.id ?? null });
      if (!venta) return;
    }
    setSaleBusy(true);
    try {
      const actualizada = await api.post<Sale>(`/sales/${venta.id}/items`, dto);
      setActiveSale(actualizada);
    } catch (e: any) {
      showToast('No se pudo agregar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally {
      setSaleBusy(false);
    }
  }, [activeSale, activeLoungeClient, openSale]);

  const removeSaleItem = useCallback(async (itemId: string) => {
    if (!activeSale) return;
    setSaleBusy(true);
    try {
      setActiveSale(await api.delete<Sale>(`/sales/${activeSale.id}/items/${itemId}`));
    } catch {
      showToast('No se pudo quitar la línea', 'Inténtalo de nuevo.', 'warning');
    } finally {
      setSaleBusy(false);
    }
  }, [activeSale]);

  const setSaleItemQty = useCallback(async (itemId: string, quantity: number) => {
    if (!activeSale) return;
    // Optimista: el contador responde al toque, no al viaje al servidor
    setActiveSale(v => v && ({
      ...v,
      items: quantity > 0
        ? v.items.map(i => i.id === itemId
            ? { ...i, quantity, lineTotal: Number(i.unitPrice) * quantity }
            : i)
        : v.items.filter(i => i.id !== itemId),
    }));
    try {
      setActiveSale(await api.patch<Sale>(`/sales/${activeSale.id}/items/${itemId}`, { quantity }));
    } catch {
      showToast('No se pudo cambiar la cantidad', 'Inténtalo de nuevo.', 'warning');
    }
  }, [activeSale]);

  const toggleSaleItemCourtesy = useCallback(async (itemId: string) => {
    if (!activeSale) return;
    setSaleBusy(true);
    try {
      setActiveSale(await api.post<Sale>(`/sales/${activeSale.id}/items/${itemId}/courtesy`, {}));
    } catch {
      showToast('No se pudo cambiar la línea', 'Inténtalo de nuevo.', 'warning');
    } finally {
      setSaleBusy(false);
    }
  }, [activeSale]);

  const setSalePriceList = useCallback(async (priceListId: string | null) => {
    if (!activeSale) return;
    setSaleBusy(true);
    try {
      // El backend revalora las líneas: el descuento se ve al instante
      setActiveSale(await api.patch<Sale>(`/sales/${activeSale.id}/pricelist`, { priceListId }));
    } catch {
      showToast('No se pudo cambiar la lista', 'Inténtalo de nuevo.', 'warning');
    } finally {
      setSaleBusy(false);
    }
  }, [activeSale]);

// ── Folios abiertos (modelo hotel) ───────────────────────────────────
  // Varias cuentas vivas a la vez: la clienta con cita, la amiga que vino a
  // acompañarla y se tomó dos tragos, y el mostrador para quien pasa a
  // comprar sin cita.
  // ── Monedas y denominaciones ─────────────────────────────────────────
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const baseCurrency = currencies.find(c => c.isBase) ?? null;

  const loadCurrencies = useCallback(async () => {
    try { setCurrencies(await api.get<Currency[]>('/currencies') ?? []); }
    catch { setCurrencies([]); }
  }, []);

  const saveCurrency = useCallback(async (dto: Partial<Currency> & { id?: string }) => {
    try {
      if (dto.id) await api.patch(`/currencies/${dto.id}`, dto);
      else await api.post('/currencies', dto);
      await loadCurrencies();
    } catch (e: any) {
      showToast('No se pudo guardar la moneda', e?.message ?? 'Revisa los datos.', 'warning');
    }
  }, [loadCurrencies]);

  const deleteCurrency = useCallback(async (id: string) => {
    try { await api.delete(`/currencies/${id}`); await loadCurrencies(); }
    catch (e: any) { showToast('No se pudo quitar', e?.message ?? '', 'warning'); }
  }, [loadCurrencies]);

  const addDenomination = useCallback(async (currencyId: string, value: number, kind = 'bill') => {
    try { await api.post(`/currencies/${currencyId}/denominations`, { value, kind }); await loadCurrencies(); }
    catch { showToast('No se pudo agregar', 'Revisa el valor.', 'warning'); }
  }, [loadCurrencies]);

  const removeDenomination = useCallback(async (denomId: string) => {
    try { await api.delete(`/currencies/denominations/${denomId}`); await loadCurrencies(); }
    catch { showToast('No se pudo quitar', 'Inténtalo de nuevo.', 'warning'); }
  }, [loadCurrencies]);

  const [openFolios, setOpenFolios] = useState<Sale[]>([]);

  const loadOpenFolios = useCallback(async () => {
    try {
      setOpenFolios(await api.get<Sale[]>('/sales/folios/open') ?? []);
    } catch { setOpenFolios([]); }
  }, []);
  useEffect(() => { loadOpenFoliosRef.current = loadOpenFolios; }, [loadOpenFolios]);

  // El contador rojo tiene que estar vivo desde que se abre el sistema, no
  // solo cuando alguien entra a Caja: si no, nadie se entera de la comanda
  // olvidada hasta que ya se fue la clienta.
  useEffect(() => { void loadOpenFolios(); }, [loadOpenFolios]);

  // El aviso en vivo cierra el último agujero del contador rojo: una comanda
  // abierta o cobrada desde OTRO dispositivo ya no espera a que alguien toque
  // algo en este para aparecer.
  useEffect(() => alRecibir('ventas:cambio', () => { void loadOpenFolios(); }), [loadOpenFolios]);

  // Y tiene que seguir siendo cierto: cada vez que la comanda activa cambia
  // de importe —se sirvió algo, se quitó, se abonó— la lista se recarga. Sin
  // esto el número del menú se quedaba con el saldo de hace cinco minutos.
  useEffect(() => {
    if (!activeSale?.id) return;
    void loadOpenFolios();
  }, [activeSale?.id, activeSale?.total, activeSale?.paidTotal, loadOpenFolios]);

  const selectFolio = useCallback(async (saleId: string) => {
    setSaleBusy(true);
    try {
      setActiveSale(await api.get<Sale>(`/sales/${saleId}`));
    } catch {
      showToast('No se pudo abrir la comanda', 'Inténtalo de nuevo.', 'warning');
    } finally { setSaleBusy(false); }
  }, []);

  /**
   * Red de seguridad: si una cita quedó en atención sin comanda —porque se
   * marcó antes de que existiera esta función, o porque algo falló— desde la
   * propia cita se puede abrir. Es idempotente: si ya existe, devuelve esa.
   */

  // ═══════════════════════════════════════════════════════════════════
  //  SALA Y TURNOS
  // ═══════════════════════════════════════════════════════════════════

  const [sala, setSala] = useState<SalaEnVivo | null>(null);
  const [salaCargando, setSalaCargando] = useState(false);
  const [zonas, setZonas] = useState<SalonZone[]>([]);
  const [especialistas, setEspecialistas] = useState<SalonStaff[]>([]);

  /**
   * `silencioso` a propósito: la pantalla de sala se refresca sola cada pocos
   * segundos y no puede parpadear un "Cargando…" en cada vuelta. Solo la
   * primera carga muestra el estado.
   */
  const salaCargadaRef = useRef(false);
  const loadSala = useCallback(async () => {
    // Con un ref y no leyendo `sala`: dentro de un useCallback sin
    // dependencias, `sala` se queda congelada en null para siempre y el
    // "Cargando…" saldría en cada vuelta del refresco.
    if (!salaCargadaRef.current) setSalaCargando(true);
    try {
      setSala(await api.get<SalaEnVivo>('/salon/sala'));
      salaCargadaRef.current = true;
    } catch {
      /* la sala es una vista: si falla una vuelta, se reintenta a la
         siguiente sin molestar con un toast cada 8 segundos */
    } finally { setSalaCargando(false); }
  }, []);

  const loadZonas = useCallback(async () => {
    try { setZonas(await api.get<SalonZone[]>('/salon/zones?todas=true') ?? []); }
    catch { setZonas([]); }
  }, []);

  const loadEspecialistas = useCallback(async () => {
    try { setEspecialistas(await api.get<SalonStaff[]>('/salon/staff?todos=true') ?? []); }
    catch { setEspecialistas([]); }
  }, []);

  const guardarZona = useCallback(async (dto: any): Promise<boolean> => {
    try {
      if (dto.id) await api.patch(`/salon/zones/${dto.id}`, dto);
      else await api.post('/salon/zones', dto);
      await loadZonas();
      return true;
    } catch (e: any) {
      showToast('No se pudo guardar la zona', e?.message ?? 'Inténtalo de nuevo.', 'warning');
      return false;
    }
  }, [loadZonas]);

  const eliminarZona = useCallback(async (id: string) => {
    try {
      const r = await api.delete<any>(`/salon/zones/${id}`);
      await loadZonas();
      if (r?.desactivada) {
        showToast(
          'Zona desactivada',
          `Tiene ${r.turnos} turno${r.turnos === 1 ? '' : 's'} en el histórico, así que no se borra: deja de usarse y ya.`,
          'info',
        );
      }
    } catch (e: any) {
      showToast('No se pudo quitar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    }
  }, [loadZonas]);

  const guardarEspecialista = useCallback(async (dto: any): Promise<boolean> => {
    try {
      if (dto.id) await api.patch(`/salon/staff/${dto.id}`, dto);
      else await api.post('/salon/staff', dto);
      await loadEspecialistas();
      return true;
    } catch (e: any) {
      showToast('No se pudo guardar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
      return false;
    }
  }, [loadEspecialistas]);

  const eliminarEspecialista = useCallback(async (id: string) => {
    try {
      const r = await api.delete<any>(`/salon/staff/${id}`);
      await loadEspecialistas();
      if (r?.desactivada) {
        showToast(
          'Especialista desactivada',
          'Tiene citas o turnos en el histórico. Se desactiva para no dejar esos registros sin autor.',
          'info',
        );
      }
    } catch (e: any) {
      showToast('No se pudo quitar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    }
  }, [loadEspecialistas]);

  const darTurno = useCallback(async (dto: any): Promise<QueueTicket | null> => {
    try {
      const t = await api.post<QueueTicket>('/salon/tickets', dto);
      await loadSala();
      showToast('Turno ' + t.code, `${t.displayName}${t.zone ? ` · ${t.zone.name}` : ''}`, 'success');
      return t;
    } catch (e: any) {
      showToast('No se pudo dar el turno', e?.message ?? 'Inténtalo de nuevo.', 'warning');
      return null;
    }
  }, [loadSala]);

  const accionTurno = useCallback(async (
    id: string, accion: 'call' | 'serve' | 'finish' | 'cancel' | 'no-show', body?: any,
  ) => {
    try {
      await api.post(`/salon/tickets/${id}/${accion}`, body ?? {});
      await loadSala();
    } catch (e: any) {
      showToast('No se pudo actualizar el turno', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    }
  }, [loadSala]);

  const moverTurno = useCallback(async (id: string, dto: any) => {
    try {
      await api.patch(`/salon/tickets/${id}`, dto);
      await loadSala();
    } catch (e: any) {
      showToast('No se pudo mover', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    }
  }, [loadSala]);

  const abrirComandaDeCita = useCallback(async (
    apt: { id: string; clientId?: string | null; clientName?: string },
  ): Promise<Sale | null> => {
    setSaleBusy(true);
    try {
      const venta = await api.post<Sale>('/sales/open', {
        clientId: apt.clientId ?? null,
        appointmentId: apt.id,
        ...(apt.clientId ? {} : { label: apt.clientName || 'Sin ficha' }),
      });
      setActiveSale(venta);
      await loadOpenFolios();
      return venta;
    } catch (e: any) {
      showToast('No se pudo abrir la comanda', e?.message ?? 'Inténtalo de nuevo.', 'warning');
      return null;
    } finally { setSaleBusy(false); }
  }, [loadOpenFolios]);

  const asignarClientaAFolio = useCallback(async (
    saleId: string, clientId: string | null,
  ): Promise<boolean> => {
    setSaleBusy(true);
    try {
      const venta = await api.patch<Sale>(`/sales/${saleId}/client`, { clientId });
      setActiveSale(venta);
      await loadOpenFolios();
      showToast(
        clientId ? 'Cuenta asignada' : 'Cuenta devuelta a mostrador',
        clientId ? 'Se aplicó su lista de precios y entraron sus citas de hoy.' : '',
        'success',
      );
      return true;
    } catch (e: any) {
      showToast('No se pudo asignar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
      return false;
    } finally { setSaleBusy(false); }
  }, [loadOpenFolios]);

  /**
   * Cerrar una pestaña de comanda.
   *
   * Vacía se anula de verdad —no hay nada que perder y si no se queda ahí
   * colgada para siempre, que es justo lo que pasaba con las cuentas de
   * mostrador abiertas por error. Con líneas NO se borra: solo se deja de
   * mirar, y sigue en Comandas abiertas hasta que alguien la cobre.
   */
  const cerrarFolio = useCallback(async (saleId: string) => {
    const f = (await api.get<Sale>(`/sales/${saleId}`).catch(() => null));
    const vacia = !!f && !(f.items ?? []).length && !(f.payments ?? []).length;
    setSaleBusy(true);
    try {
      if (vacia) {
        await api.post(`/sales/${saleId}/void`, { motivo: 'Cuenta vacía, cerrada desde la caja' });
        showToast('Cuenta cerrada', 'Estaba vacía, así que se anuló.', 'success');
      } else {
        // Nada de "se quitó de la vista": la pestaña sale de openFolios, así
        // que seguiría ahí y el mensaje sería mentira. Se dice la verdad.
        showToast('No se puede cerrar', 'Tiene consumo. Cóbrala, o quita sus líneas y ciérrala.', 'warning');
      }
      if (vacia) setActiveSale(a => (a?.id === saleId ? null : a));
      await loadOpenFolios();
    } catch (e: any) {
      showToast('No se pudo cerrar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally { setSaleBusy(false); }
  }, [loadOpenFolios]);

  const newCounterFolio = useCallback(async (label?: string): Promise<Sale | null> => {
    setSaleBusy(true);
    try {
      // Sin clientId: cuenta de mostrador, sin ficha ni cita
      const venta = await api.post<Sale>('/sales/open', { label: label ?? 'Mostrador' });
      setActiveSale(venta);
      await loadOpenFolios();
      return venta;
    } catch {
      showToast('No se pudo abrir la cuenta', 'Inténtalo de nuevo.', 'warning');
      return null;
    } finally { setSaleBusy(false); }
  }, [loadOpenFolios]);

  const moveSaleItem = useCallback(async (itemId: string, toSaleId: string) => {
    if (!activeSale) return;
    setSaleBusy(true);
    try {
      await api.post(`/sales/${activeSale.id}/items/${itemId}/move`, { toSaleId });
      // Las dos cuentas cambiaron: recargamos la activa y la lista
      setActiveSale(await api.get<Sale>(`/sales/${activeSale.id}`));
      await loadOpenFolios();
    } catch {
      showToast('No se pudo mover la línea', 'Inténtalo de nuevo.', 'warning');
    } finally { setSaleBusy(false); }
  }, [activeSale, loadOpenFolios]);

  const paySale = useCallback(async (dto: {
    method: string; amount: number; tip?: number; reference?: string; currency?: string;
  }) => {
    if (!activeSale) return;
    setSaleBusy(true);
    try {
      setActiveSale(await api.post<Sale>(`/sales/${activeSale.id}/payments`, dto));
    } catch (e: any) {
      showToast('No se pudo registrar el cobro', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally {
      setSaleBusy(false);
    }
  }, [activeSale]);

  const closeSale = useCallback(async (permitirSinPagar = false): Promise<boolean> => {
    if (!activeSale) return false;
    setSaleBusy(true);
    try {
      // Aquí el backend descuenta inventario: si falta stock, no cierra
      await api.post<Sale>(`/sales/${activeSale.id}/close`, { permitirSinPagar });
      setActiveSale(null);
      void loadOpenFolios();
      showToast('Comanda cobrada', 'Las recetas del servicio ya se descontaron.', 'success');
      void loadLoungeEvents({ range: 'today' });
      return true;
    } catch (e: any) {
      showToast('No se pudo cerrar', e?.message ?? 'Revisa el stock.', 'warning');
      return false;
    } finally {
      setSaleBusy(false);
    }
  }, [activeSale, loadLoungeEvents, loadOpenFolios]);

  // Al cambiar la clienta del sillón, traemos su ticket abierto si lo hay
  useEffect(() => {
    if (!activeLoungeClient) { setActiveSale(null); return; }
    let cancelado = false;
    api.get<Sale[]>(`/sales?status=open&clientId=${activeLoungeClient.id}&limit=1`)
      .then(v => { if (!cancelado) setActiveSale(v?.[0] ?? null); })
      .catch(() => { if (!cancelado) setActiveSale(null); });
    return () => { cancelado = true; };
  }, [activeLoungeClient?.id]);

  const serveHospitalityItem = useCallback((
    item: string,
    extra?: { refId?: string; amount?: number },
  ) => {
    void recordLoungeEvent({
      kind: extra?.amount ? 'sale' : 'courtesy',
      label: item,
      clientId: activeLoungeClient?.id ?? null,
      clientName: activeLoungeClient?.name ?? null,
      refId: extra?.refId ?? null,
      amount: extra?.amount ?? null,
    });
  }, [activeLoungeClient, recordLoungeEvent]);
  const playMusicForClient = useCallback((client: Client) => {
    setActiveLoungeClient(client);
    const pref = client.hospitality?.musicVibe;
    const idx = pref ? loungeTracks.findIndex(t => t.vibe.toLowerCase().includes(pref.toLowerCase())) : -1;
    playTrack(idx >= 0 ? idx : 0);
  }, [loungeTracks, playTrack]);

  // ── Price Lists CRUD ────────────────────────────────────────────────────────
  const loadPriceLists = useCallback(async () => {
    setIsLoadingPriceLists(true);
    try {
      const data = await api.get<any[]>('/price-lists');
      setPriceLists(data.map(mapApiPriceList));
    } catch (e) { console.error('Failed to load price lists', e); }
    finally { setIsLoadingPriceLists(false); }
  }, []);

  const createPriceList = useCallback(async (dto: { name: string; description?: string; isDefault?: boolean; rules: Omit<PriceListRule, 'id'>[] }): Promise<PriceList> => {
    const res = await api.post<any>('/price-lists', dto);
    const pl = mapApiPriceList(res);
    setPriceLists(p => [...p, pl]);
    return pl;
  }, []);

  const updatePriceList = useCallback(async (id: string, dto: { name?: string; description?: string; isDefault?: boolean; rules?: Omit<PriceListRule, 'id'>[] }) => {
    const res = await api.patch<any>(`/price-lists/${id}`, dto);
    setPriceLists(p => p.map(x => x.id === id ? mapApiPriceList(res) : x));
  }, []);

  const deletePriceList = useCallback(async (id: string) => {
    await api.delete(`/price-lists/${id}`);
    setPriceLists(p => p.filter(x => x.id !== id));
  }, []);

  const assignPriceList = useCallback(async (priceListId: string, clientId: string) => {
    await api.post(`/price-lists/${priceListId}/assign/${clientId}`, {});
    setClients(c => c.map(x => x.id === clientId ? { ...x, priceListId } : x));
  }, []);

  const unassignPriceList = useCallback(async (clientId: string) => {
    await api.delete(`/price-lists/unassign/${clientId}`);
    setClients(c => c.map(x => x.id === clientId ? { ...x, priceListId: undefined } : x));
  }, []);
  // ───────────────────────────────────────────────────────────────────────────

  const loadIngredients = useCallback(async (serviceId: string): Promise<ServiceIngredient[]> => {
    const data = await api.get<ServiceIngredient[]>(`/services/${serviceId}/ingredients`);
    return data;
  }, []);

  const saveIngredients = useCallback(async (
    serviceId: string,
    ingredients: Omit<ServiceIngredient, 'id' | 'product'>[],
  ): Promise<ServiceIngredient[]> => {
    const data = await api.put<ServiceIngredient[]>(`/services/${serviceId}/ingredients`, { ingredients });
    return data;
  }, []);

  return (
    <AppContext.Provider value={{
      currentScreen, navigateTo, navigateToCatalog, screenHistory, goBack, catalogDeepLink, clearCatalogDeepLink,
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
      toast, showToast, dismissToast,
      showSplash, triggerSplash, closeSplash, isPhoneFrame, setIsPhoneFrame,
      loungeTracks, currentTrackIndex, currentTrack, isPlayingLounge,
      activeLoungeClient, loungeClients, setLoungeClients, toggleLoungeClient,
      activeSale, saleBusy, openSale, addSaleItem, removeSaleItem,
      setSaleItemQty, toggleSaleItemCourtesy, setSalePriceList, paySale, closeSale,
      sala, salaCargando, loadSala,
      zonas, loadZonas, guardarZona, eliminarZona,
      especialistas, loadEspecialistas, guardarEspecialista, eliminarEspecialista,
      darTurno, accionTurno, moverTurno,
      openFolios, loadOpenFolios, abrirComandaDeCita, asignarClientaAFolio, cerrarFolio,
      selectFolio, newCounterFolio, moveSaleItem,
      currencies, baseCurrency, loadCurrencies, saveCurrency, deleteCurrency,
      addDenomination, removeDenomination,
      loungeEvents, loungeEventsLoading, loungeEventsHasMore,
      loadLoungeEvents, recordLoungeEvent,
      playTrack, togglePlayLounge, nextLoungeTrack, prevLoungeTrack,
      addTrackToLounge, removeLoungeTrack, setActiveLoungeClient,
      serveHospitalityItem, playMusicForClient,

      priceLists, isLoadingPriceLists, loadPriceLists,
      createPriceList, updatePriceList, deletePriceList,
      assignPriceList, unassignPriceList,
      loadIngredients, saveIngredients,
      youtubeEmbed, setYoutubeEmbed, youtubeAnchorEl,
      ytAnchorKey, setYtLoungeAnchor, setYtDockAnchor, ytFullscreen,
      ytShowVideo, setYtShowVideo,
      ytBlocks, setYtBlocks, ytMixMode, setYtMixMode,
      playlists, selectedPlaylistIds, loadPlaylists, togglePlaylistSelected,
      createPlaylist, deletePlaylist, addTrackToPlaylist, addTracksToPlaylist,
      updatePlaylist, reorderPlaylistTracks, removeTrackFromPlaylist,
      ytPlayerRef, ytQueue, ytOrder, ytIndex, ytPlaying, ytShuffle, ytRepeatMode,
      ytMuted, ytVolume, ytTime, ytDuration, ytReady,
      setYtQueue, setYtPlaying, setYtReady, setYtTime, setYtDuration,
      ytPlayIndex, ytToggle, ytNext, ytPrev, ytOnEnded, ytSeek, ytSetVolume,
      ytToggleMute, toggleYtShuffle, cycleYtRepeat,
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
