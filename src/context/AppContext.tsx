import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Appointment,
  AppointmentStatus,
  BotChannelConfig,
  ChatMessage,
  Client,
  CommunicationChannel,
  Conversation,
  LoungeTrack,
  SalonBusinessSettings,
  SalonMetrics,
  SalonProduct,
  SalonService,
  SystemLog,
} from '../types';
import {
  INITIAL_APPOINTMENTS,
  INITIAL_BOT_CONFIGS,
  INITIAL_CONVERSATIONS,
  INITIAL_CLIENTS,
  INITIAL_LOUNGE_TRACKS,
  INITIAL_METRICS_DATA,
  INITIAL_PRODUCTS,
  INITIAL_SERVICES,
  INITIAL_SETTINGS,
  INITIAL_SYSTEM_LOGS,
} from '../data/mockData';
import { loungeAudio } from '../utils/loungeAudio';

export type ScreenName = 'dashboard' | 'calendar' | 'clients' | 'catalog' | 'chats' | 'bots' | 'settings' | 'lounge';

export interface ToastInfo {
  id: string;
  title: string;
  message: string;
  type?: 'success' | 'info' | 'warning';
  icon?: string;
}

interface AppContextType {
  currentScreen: ScreenName;
  navigateTo: (screen: ScreenName) => void;
  // Screen history for iOS back navigation
  screenHistory: ScreenName[];
  goBack: () => void;
  // Clients CRM
  clients: Client[];
  addClient: (client: Omit<Client, 'id' | 'registeredDate'>) => Client;
  updateClient: (id: string, updated: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  // Services Catalog
  services: SalonService[];
  addService: (service: Omit<SalonService, 'id'>) => void;
  updateService: (id: string, updated: Partial<SalonService>) => void;
  deleteService: (id: string) => void;
  toggleServiceAi: (id: string, aiAvailable: boolean) => void;
  // Products Catalog
  products: SalonProduct[];
  addProduct: (product: Omit<SalonProduct, 'id'>) => void;
  updateProduct: (id: string, updated: Partial<SalonProduct>) => void;
  deleteProduct: (id: string) => void;
  toggleProductAi: (id: string, aiAvailable: boolean) => void;
  // Appointments
  appointments: Appointment[];
  addAppointment: (appointment: Omit<Appointment, 'id' | 'createdAt'>) => void;
  updateAppointmentStatus: (id: string, status: AppointmentStatus) => void;
  deleteAppointment: (id: string) => void;
  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  toggleChatAiStatus: (conversationId: string, enableAi: boolean) => void;
  sendMessageToConversation: (conversationId: string, text: string, sender?: 'client' | 'agent' | 'bot') => void;
  startChatWithClient: (client: Client) => void;
  // Bot Configs
  botConfigs: BotChannelConfig[];
  toggleBotChannel: (channelId: CommunicationChannel, enabled: boolean) => void;
  updateBotMessage: (channelId: CommunicationChannel, field: 'welcomeMessage' | 'offHoursMessage', text: string) => void;
  // Settings
  settings: SalonBusinessSettings;
  updateSettings: (newSettings: Partial<SalonBusinessSettings>) => void;
  // Metrics
  metricsPeriod: 'day' | 'week' | 'month';
  setMetricsPeriod: (p: 'day' | 'week' | 'month') => void;
  currentMetrics: SalonMetrics;
  // System logs
  systemLogs: SystemLog[];
  addSystemLog: (log: Omit<SystemLog, 'id' | 'timestamp'>) => void;
  // Toast notifications
  toast: ToastInfo | null;
  showToast: (title: string, message: string, type?: 'success' | 'info' | 'warning') => void;
  dismissToast: () => void;
  // App Restart / Splash preview
  showSplash: boolean;
  triggerSplash: () => void;
  closeSplash: () => void;
  // Frame Mode (iPhone Mock vs Fullscreen)
  isPhoneFrame: boolean;
  setIsPhoneFrame: (val: boolean) => void;
  // Salon Lounge & Music Player
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
  addTrackToLounge: (track: Omit<LoungeTrack, 'id'>) => void;
  removeLoungeTrack: (id: string) => void;
  setActiveLoungeClient: (client: Client | null) => void;
  serveHospitalityItem: (item: string) => void;
  playMusicForClient: (client: Client) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('dashboard');
  const [screenHistory, setScreenHistory] = useState<ScreenName[]>(['dashboard']);

  // Clients State with Persistence
  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem('aura_clients');
    return saved ? JSON.parse(saved) : INITIAL_CLIENTS;
  });

  // Services State with Persistence
  const [services, setServices] = useState<SalonService[]>(() => {
    const saved = localStorage.getItem('aura_services');
    return saved ? JSON.parse(saved) : INITIAL_SERVICES;
  });

  // Products State with Persistence
  const [products, setProducts] = useState<SalonProduct[]>(() => {
    const saved = localStorage.getItem('aura_products');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    const saved = localStorage.getItem('aura_appointments');
    return saved ? JSON.parse(saved) : INITIAL_APPOINTMENTS;
  });

  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem('aura_conversations');
    return saved ? JSON.parse(saved) : INITIAL_CONVERSATIONS;
  });

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const [botConfigs, setBotConfigs] = useState<BotChannelConfig[]>(() => {
    const saved = localStorage.getItem('aura_bot_configs');
    return saved ? JSON.parse(saved) : INITIAL_BOT_CONFIGS;
  });

  const [settings, setSettings] = useState<SalonBusinessSettings>(() => {
    const saved = localStorage.getItem('aura_settings');
    return saved ? JSON.parse(saved) : INITIAL_SETTINGS;
  });

  const [metricsPeriod, setMetricsPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>(INITIAL_SYSTEM_LOGS);
  const [toast, setToast] = useState<ToastInfo | null>(null);
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [isPhoneFrame, setIsPhoneFrame] = useState<boolean>(true);

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem('aura_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('aura_services', JSON.stringify(services));
  }, [services]);

  useEffect(() => {
    localStorage.setItem('aura_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('aura_appointments', JSON.stringify(appointments));
  }, [appointments]);

  useEffect(() => {
    localStorage.setItem('aura_conversations', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem('aura_bot_configs', JSON.stringify(botConfigs));
  }, [botConfigs]);

  useEffect(() => {
    localStorage.setItem('aura_settings', JSON.stringify(settings));
  }, [settings]);

  const showToast = (title: string, message: string, type: 'success' | 'info' | 'warning' = 'info') => {
    const id = Date.now().toString();
    setToast({ id, title, message, type });
    setTimeout(() => {
      setToast(prev => (prev?.id === id ? null : prev));
    }, 4000);
  };

  const dismissToast = () => setToast(null);

  const navigateTo = (screen: ScreenName) => {
    if (screen !== currentScreen) {
      setScreenHistory(prev => [...prev, screen]);
      setCurrentScreen(screen);
      setActiveConversationId(null);
    }
  };

  const goBack = () => {
    if (activeConversationId) {
      setActiveConversationId(null);
      return;
    }
    if (screenHistory.length > 1) {
      const nextHistory = [...screenHistory];
      nextHistory.pop();
      const previousScreen = nextHistory[nextHistory.length - 1];
      setScreenHistory(nextHistory);
      setCurrentScreen(previousScreen);
    }
  };

  // Client CRM Handlers
  const addClient = (newClientData: Omit<Client, 'id' | 'registeredDate'>): Client => {
    const newClient: Client = {
      ...newClientData,
      id: `cli_${Date.now()}`,
      registeredDate: new Date().toISOString().split('T')[0],
      avatar:
        newClientData.avatar ||
        `https://images.unsplash.com/photo-${1534528741775 + (clients.length % 5)}?w=150&auto=format&fit=crop&q=80`,
    };
    setClients(prev => [newClient, ...prev]);
    showToast('Clienta Registrada', `${newClient.name} fue guardada exitosamente en el directorio.`, 'success');
    return newClient;
  };

  const updateClient = (id: string, updated: Partial<Client>) => {
    setClients(prev => prev.map(c => (c.id === id ? { ...c, ...updated } : c)));
    showToast('Ficha Actualizada', 'Los datos y preferencias de la clienta se guardaron.', 'info');
  };

  const deleteClient = (id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
    showToast('Clienta Eliminada', 'La clienta fue eliminada del sistema.', 'warning');
  };

  const startChatWithClient = (client: Client) => {
    // Check if conversation already exists
    const existing = conversations.find(c => c.clientId === client.id || c.clientPhone === client.phone);
    if (existing) {
      setActiveConversationId(existing.id);
      navigateTo('chats');
    } else {
      const newConv: Conversation = {
        id: `conv_${Date.now()}`,
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        clientAvatar: client.avatar,
        channel: client.preferredChannel,
        status: 'ai_active',
        lastMessage: `Inició chat por ${client.preferredChannel.toUpperCase()}`,
        lastMessageTime: 'Ahora',
        unreadCount: 0,
        confidenceScore: 98,
        messages: [
          {
            id: `msg_${Date.now()}`,
            sender: 'bot',
            text: `¡Hola ${client.name}! 🌸 Bienvenida a Lalan AI. ¿En qué servicio de uñas, peinados o spa te consentimos hoy?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isAiGenerated: true,
          },
        ],
      };
      setConversations(prev => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      navigateTo('chats');
    }
  };

  // Services Catalog Handlers
  const addService = (newServiceData: Omit<SalonService, 'id'>) => {
    const newService: SalonService = {
      ...newServiceData,
      id: `srv_${Date.now()}`,
    };
    setServices(prev => [newService, ...prev]);
    showToast('Servicio Creado', `"${newService.name}" agregado al catálogo con su tabla de precios.`, 'success');
  };

  const updateService = (id: string, updated: Partial<SalonService>) => {
    setServices(prev => prev.map(s => (s.id === id ? { ...s, ...updated } : s)));
    showToast('Servicio Actualizado', 'El servicio y su tabla de precios se modificaron.', 'info');
  };

  const deleteService = (id: string) => {
    setServices(prev => prev.filter(s => s.id !== id));
    showToast('Servicio Eliminado', 'El servicio fue eliminado del catálogo.', 'warning');
  };

  const toggleServiceAi = (id: string, aiAvailable: boolean) => {
    setServices(prev => prev.map(s => (s.id === id ? { ...s, aiAvailable } : s)));
    showToast(
      aiAvailable ? '🤖 Bot IA Habilitado' : '🚫 Bot IA Pausado',
      `El Bot IA ${aiAvailable ? 'ahora ofrecerá' : 'no ofrecerá'} este servicio a los clientes en chats.`,
      'info'
    );
  };

  // Products Catalog Handlers
  const addProduct = (newProductData: Omit<SalonProduct, 'id'>) => {
    const newProduct: SalonProduct = {
      ...newProductData,
      id: `prod_${Date.now()}`,
    };
    setProducts(prev => [newProduct, ...prev]);
    showToast('Producto Registrado', `"${newProduct.name}" agregado al inventario de ventas.`, 'success');
  };

  const updateProduct = (id: string, updated: Partial<SalonProduct>) => {
    setProducts(prev => prev.map(p => (p.id === id ? { ...p, ...updated } : p)));
    showToast('Producto Actualizado', 'El producto y su tabla de precios fueron modificados.', 'info');
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    showToast('Producto Eliminado', 'El producto fue eliminado del inventario.', 'warning');
  };

  const toggleProductAi = (id: string, aiAvailable: boolean) => {
    setProducts(prev => prev.map(p => (p.id === id ? { ...p, aiAvailable } : p)));
    showToast(
      aiAvailable ? '🤖 Recomendación IA Activa' : '🚫 Recomendación IA Pausada',
      `El Bot IA ${aiAvailable ? 'ahora recomendará' : 'no recomendará'} este producto en chats.`,
      'info'
    );
  };

  // Appointments Handlers
  const addAppointment = (newApt: Omit<Appointment, 'id' | 'createdAt'>) => {
    const apt: Appointment = {
      ...newApt,
      id: `apt_${Date.now()}`,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      bufferMinutes: newApt.bufferMinutes ?? settings.bufferTimeMinutes,
    };
    setAppointments(prev => [apt, ...prev]);
    showToast('Cita Creada', `Cita para ${apt.clientName} agendada correctamente.`, 'success');
  };

  const updateAppointmentStatus = (id: string, status: AppointmentStatus) => {
    setAppointments(prev =>
      prev.map(apt => (apt.id === id ? { ...apt, status } : apt))
    );
    showToast('Estado Actualizado', `El estado de la cita se cambió a ${status}.`, 'info');
  };

  const deleteAppointment = (id: string) => {
    setAppointments(prev => prev.filter(apt => apt.id !== id));
    showToast('Cita Eliminada', 'La cita fue eliminada del calendario.', 'warning');
  };

  // Chat Handlers
  const toggleChatAiStatus = (conversationId: string, enableAi: boolean) => {
    setConversations(prev =>
      prev.map(conv => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            status: enableAi ? 'ai_active' : 'manual_control',
          };
        }
        return conv;
      })
    );
    showToast(
      enableAi ? '🤖 Bot IA Activado' : '👤 Control Manual Activado',
      enableAi
        ? 'El Bot de Meta responderá automáticamente las consultas.'
        : 'Has tomado control manual de esta conversación.',
      'info'
    );
  };

  const sendMessageToConversation = (
    conversationId: string,
    text: string,
    sender: 'client' | 'agent' | 'bot' = 'agent'
  ) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      sender,
      text,
      timestamp: timeStr,
      isAiGenerated: sender === 'bot',
    };

    setConversations(prev =>
      prev.map(conv => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            messages: [...conv.messages, newMsg],
            lastMessage: (sender === 'agent' ? 'Tú: ' : '') + text,
            lastMessageTime: 'Ahora',
          };
        }
        return conv;
      })
    );

    // If client sent a message and AI is active, simulate realistic smart salon bot reply
    if (sender === 'client') {
      const targetConv = conversations.find(c => c.id === conversationId);
      if (targetConv && targetConv.status === 'ai_active') {
        setTimeout(() => {
          simulateAiBotReply(conversationId, text);
        }, 1300);
      }
    }
  };

  const simulateAiBotReply = (conversationId: string, clientText: string) => {
    const lower = clientText.toLowerCase();
    const activeAiServices = services.filter(s => s.aiAvailable);
    const activeAiProducts = products.filter(p => p.aiAvailable);
    const buffer = settings.bufferTimeMinutes;
    const grace = settings.gracePeriodMinutes;

    let replyText = `¡Hola! 🌸 Con gusto podemos asesorarte o agendar tu cita. Contamos con ${grace} minutos de tolerancia de cortesía para tu tranquilidad. ¿Deseas consultar servicios o productos?`;

    if (lower.includes('uñas') || lower.includes('acrílicas') || lower.includes('kapping') || lower.includes('gel')) {
      const nailSrv = activeAiServices.find(s => s.category === 'nails') || activeAiServices[0];
      const tierPrices = nailSrv ? nailSrv.priceTiers.map(t => `${t.name}: $${t.price}`).slice(0, 3).join(', ') : '$32 - $45';
      replyText = `✨ Para Manicura & Uñas tenemos ${nailSrv ? nailSrv.name : 'Uñas Acrílicas'}. Tabla de precios: [${tierPrices}]. Tenemos turnos hoy a las 4:00 PM y mañana a las 10:00 AM (duración: ${nailSrv?.durationMinutes || 60}m + ${buffer}m de preparación). ¿Deseas apartar?`;
    } else if (lower.includes('peinado') || lower.includes('balayage') || lower.includes('color') || lower.includes('alisado')) {
      const hairSrv = activeAiServices.find(s => s.category === 'hair');
      replyText = `💇‍♀️ Nuestro ${hairSrv ? hairSrv.name : 'Balayage Supreme'} incluye diagnóstico capilar. Precios: ${hairSrv ? hairSrv.priceTiers.map(t => `${t.name}: $${t.price}`).join(' | ') : 'desde $40 a $110'}. ¿Te agendamos un turno con Carlos?`;
    } else if (lower.includes('masaje') || lower.includes('relajante') || lower.includes('espalda')) {
      const massageSrv = activeAiServices.find(s => s.category === 'massage');
      replyText = `💆‍♀️ ${massageSrv ? massageSrv.name : 'Masaje Relajante con Piedras Calientes'} ($55 / 60 min). Disponibilidad hoy a las 5:30 PM. ¿Te reservamos?`;
    } else if (lower.includes('pies') || lower.includes('pedicura') || lower.includes('jelly')) {
      const pediSrv = activeAiServices.find(s => s.category === 'pedi_spa');
      replyText = `🦶 ${pediSrv ? pediSrv.name : 'Jelly Spa Pedicure'} ($38). Incluye sales aromáticas y masaje podal. Turno disponible hoy a las 11:45 AM con Elena.`;
    } else if (lower.includes('producto') || lower.includes('comprar') || lower.includes('shampoo') || lower.includes('aceite') || lower.includes('olaplex')) {
      const prodNames = activeAiProducts.map(p => `${p.name} ($${p.basePrice})`).slice(0, 3).join(', ');
      replyText = `🛍️ En nuestra boutique de belleza tenemos disponibles: ${prodNames}. Si los adquieres al finalizar tu cita, ¡tienen tarifa de descuento especial!`;
    } else if (lower.includes('precio') || lower.includes('costo') || lower.includes('cuanto') || lower.includes('tabla')) {
      replyText = `📋 ¡Con gusto! Nuestras tarifas en catálogo son: Kapping Gel $32, Uñas Acrílicas $45 (VIP $38), Spa de Pies $38, Masajes $55 y Balayage $85+. ¿Te gustaría ver las opciones para algún servicio en particular?`;
    } else if (lower.includes('tiempo') || lower.includes('tarde') || lower.includes('espera') || lower.includes('tolerancia')) {
      replyText = `⏰ Te recordamos que la duración estándar de cita es de ${settings.defaultAppointmentDurationMinutes} min y ofrecemos ${grace} minutos de tolerancia por imprevistos viales.`;
    } else if (lower.includes('gracias') || lower.includes('si') || lower.includes('perfecto') || lower.includes('ok')) {
      replyText = `🎉 ¡Maravilloso! Te esperamos en Lalan AI Studio. Tu reserva queda registrada con anticipo del ${settings.depositPercent}%.`;
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const botMsg: ChatMessage = {
      id: `msg_bot_${Date.now()}`,
      sender: 'bot',
      text: replyText,
      timestamp: timeStr,
      isAiGenerated: true,
    };

    setConversations(prev =>
      prev.map(conv => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            messages: [...conv.messages, botMsg],
            lastMessage: replyText,
            lastMessageTime: 'Ahora',
          };
        }
        return conv;
      })
    );

    addSystemLog({
      level: 'success',
      service: 'AI_Scheduler',
      message: `Respuesta IA enviada a ${conversationId} ofreciendo catálogo y precios dinámicos.`,
    });
  };

  const toggleBotChannel = (channelId: CommunicationChannel, enabled: boolean) => {
    setBotConfigs(prev =>
      prev.map(bot => (bot.id === channelId ? { ...bot, enabled } : bot))
    );
    const botName = channelId === 'whatsapp' ? 'WhatsApp' : channelId === 'instagram' ? 'Instagram DM' : 'Facebook Messenger';
    showToast(
      `${botName} ${enabled ? 'Activado' : 'Desactivado'}`,
      `El Bot IA para ${botName} ahora está ${enabled ? 'en línea respondiendo clientes' : 'en pausa'}.`,
      enabled ? 'success' : 'warning'
    );
    addSystemLog({
      level: enabled ? 'info' : 'warn',
      service: 'Meta_Webhook',
      message: `Canal ${botName} cambiado a estado ${enabled ? 'ONLINE' : 'PAUSED'}.`,
    });
  };

  const updateBotMessage = (
    channelId: CommunicationChannel,
    field: 'welcomeMessage' | 'offHoursMessage',
    text: string
  ) => {
    setBotConfigs(prev =>
      prev.map(bot => (bot.id === channelId ? { ...bot, [field]: text } : bot))
    );
    showToast('Mensaje Guardado', 'La plantilla de mensaje automatizado se actualizó.', 'success');
  };

  const updateSettings = (newSettings: Partial<SalonBusinessSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
    showToast('Ajustes Guardados', 'Los parámetros de agenda, descanso y tolerancia se actualizaron.', 'success');
  };

  const addSystemLog = (log: Omit<SystemLog, 'id' | 'timestamp'>) => {
    const newLog: SystemLog = {
      ...log,
      id: `log_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
    };
    setSystemLogs(prev => [newLog, ...prev.slice(0, 49)]);
  };

  const triggerSplash = () => {
    setShowSplash(true);
  };

  const closeSplash = () => {
    setShowSplash(false);
  };

  // Salon Lounge & Music Player State
  const [loungeTracks, setLoungeTracks] = useState<LoungeTrack[]>(() => {
    const saved = localStorage.getItem('aura_lounge_tracks');
    return saved ? JSON.parse(saved) : INITIAL_LOUNGE_TRACKS;
  });

  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlayingLounge, setIsPlayingLounge] = useState<boolean>(false);
  const [activeLoungeClient, setActiveLoungeClient] = useState<Client | null>(() => INITIAL_CLIENTS[0]);
  const [servedHospitalityHistory, setServedHospitalityHistory] = useState<{ id: string; clientName: string; item: string; time: string }[]>([
    { id: 'h_1', clientName: 'Valeria Méndez', item: 'Matcha Latte con Avena', time: '11:15' },
    { id: 'h_2', clientName: 'Valeria Méndez', item: 'Macarons Franceses Variados', time: '11:25' },
  ]);

  useEffect(() => {
    localStorage.setItem('aura_lounge_tracks', JSON.stringify(loungeTracks));
  }, [loungeTracks]);

  const currentTrack = loungeTracks[currentTrackIndex] || loungeTracks[0] || {
    id: 'trk_default',
    title: 'Lalan Lounge Radio',
    artist: 'Lalan Ambient Soundscape',
    durationSeconds: 180,
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
    vibe: 'Lofi Chillhop & Neo-Soul',
    source: 'salon_radio',
  };

  const playTrack = (indexOrId?: number | string) => {
    let nextIdx = currentTrackIndex;
    if (typeof indexOrId === 'number') {
      nextIdx = Math.max(0, Math.min(indexOrId, loungeTracks.length - 1));
    } else if (typeof indexOrId === 'string') {
      const found = loungeTracks.findIndex(t => t.id === indexOrId);
      if (found !== -1) nextIdx = found;
    }
    setCurrentTrackIndex(nextIdx);
    setIsPlayingLounge(true);
    const track = loungeTracks[nextIdx];
    loungeAudio.play(track ? track.vibe : 'lofi');
  };

  const togglePlayLounge = () => {
    if (isPlayingLounge) {
      setIsPlayingLounge(false);
      loungeAudio.stop();
    } else {
      setIsPlayingLounge(true);
      const track = loungeTracks[currentTrackIndex];
      loungeAudio.play(track ? track.vibe : 'lofi');
    }
  };

  const nextLoungeTrack = () => {
    const nextIdx = (currentTrackIndex + 1) % loungeTracks.length;
    setCurrentTrackIndex(nextIdx);
    if (isPlayingLounge) {
      const track = loungeTracks[nextIdx];
      loungeAudio.play(track ? track.vibe : 'lofi');
    }
  };

  const prevLoungeTrack = () => {
    const prevIdx = (currentTrackIndex - 1 + loungeTracks.length) % loungeTracks.length;
    setCurrentTrackIndex(prevIdx);
    if (isPlayingLounge) {
      const track = loungeTracks[prevIdx];
      loungeAudio.play(track ? track.vibe : 'lofi');
    }
  };

  const addTrackToLounge = (track: Omit<LoungeTrack, 'id'>) => {
    const newTrack: LoungeTrack = {
      ...track,
      id: `trk_${Date.now()}`,
    };
    setLoungeTracks(prev => [newTrack, ...prev]);
    showToast('Pista Agregada al Lounge', `"${track.title}" añadida a la cola del salón.`, 'success');
  };

  const removeLoungeTrack = (id: string) => {
    setLoungeTracks(prev => prev.filter(t => t.id !== id));
  };

  const serveHospitalityItem = (item: string) => {
    const clientName = activeLoungeClient ? activeLoungeClient.name : 'Cliente en Sillón';
    const newEntry = {
      id: `h_${Date.now()}`,
      clientName,
      item,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setServedHospitalityHistory(prev => [newEntry, ...prev]);
    showToast('Cortesía Servida ☕', `${item} registrado para ${clientName}.`, 'success');
  };

  const playMusicForClient = (client: Client) => {
    setActiveLoungeClient(client);
    const matchingTrackIdx = loungeTracks.findIndex(t => 
      (client.hospitality?.musicVibe && t.vibe.toLowerCase().includes(client.hospitality.musicVibe.toLowerCase().slice(0, 4))) ||
      t.dedicatedForClientName === client.name
    );

    if (matchingTrackIdx !== -1) {
      setCurrentTrackIndex(matchingTrackIdx);
    }
    setIsPlayingLounge(true);
    loungeAudio.play(client.hospitality?.musicVibe || 'lofi');
    navigateTo('lounge');
    showToast(`Ambiente para ${client.name}`, `Música (${client.hospitality?.musicVibe || 'Lofi Chill'}) y amenidades activadas.`, 'info');
  };

  return (
    <AppContext.Provider
      value={{
        currentScreen,
        navigateTo,
        screenHistory,
        goBack,
        clients,
        addClient,
        updateClient,
        deleteClient,
        services,
        addService,
        updateService,
        deleteService,
        toggleServiceAi,
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        toggleProductAi,
        appointments,
        addAppointment,
        updateAppointmentStatus,
        deleteAppointment,
        conversations,
        activeConversationId,
        setActiveConversationId,
        toggleChatAiStatus,
        sendMessageToConversation,
        startChatWithClient,
        botConfigs,
        toggleBotChannel,
        updateBotMessage,
        settings,
        updateSettings,
        metricsPeriod,
        setMetricsPeriod,
        currentMetrics: INITIAL_METRICS_DATA[metricsPeriod],
        systemLogs,
        addSystemLog,
        toast,
        showToast,
        dismissToast,
        showSplash,
        triggerSplash,
        closeSplash,
        isPhoneFrame,
        setIsPhoneFrame,
        loungeTracks,
        currentTrackIndex,
        currentTrack,
        isPlayingLounge,
        activeLoungeClient,
        servedHospitalityHistory,
        playTrack,
        togglePlayLounge,
        nextLoungeTrack,
        prevLoungeTrack,
        addTrackToLounge,
        removeLoungeTrack,
        setActiveLoungeClient,
        serveHospitalityItem,
        playMusicForClient,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

