import React, { useEffect, useState } from 'react';
import { FotoClienta } from '../components/ui/FotoClienta';
import { pedirSeccionAjustes } from '../components/ajustes/MenuAjustes';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquareText,
  Search,
  Bot,
  UserCheck,
  AlertTriangle,
  Send,
  Sparkles,
  Phone,
  Calendar,
  Clock,
  MoreVertical,
  CheckCheck,
  Smile,
  Zap,
  Check,
  Wand2,
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { CommunicationChannel, ChatStatus, Conversation, ChatMessage } from '../types';
import { IOSHeader } from '../components/ui/IOSHeader';
import { IOSToggle } from '../components/ui/IOSToggle';
import { PageContent } from '../components/ui/PageContent';
import { ChipsFiltro, Insignia, ItemAnimado, ListaAnimada, NumeroAnimado, PuntoEstado, Vacio } from '../components/ui/movimiento';

import { VentanaChat, getChannelBadge, getStatusIndicator, horaDeMensaje } from '../components/chats/VentanaChat';

export const ChatsScreen: React.FC = () => {
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    toggleChatAiStatus,
    sendMessageToConversation,
    showToast,
    settings,
    descartarAviso,
    botConfigs,
    navigateTo,
  } = useApp();
  /* Si ningún canal está conectado, aquí no va a entrar nada: se dice dónde conectarlo */
  const sinCanales = botConfigs.length > 0 && !botConfigs.some(b => b.channelIdentifier);
  const agente = settings.aiAgentName || 'Lalan';
  const { currentUser } = useAuth();

  const [selectedChannel, setSelectedChannel] = useState<CommunicationChannel | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<ChatStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Esc cierra el chat, como las demás hojas
  useEffect(() => {
    if (!activeConversationId) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setActiveConversationId(null); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [activeConversationId, setActiveConversationId]);

  // Filter conversations
  const filteredConversations = conversations.filter(c => {
    const matchesChannel = selectedChannel === 'all' || c.channel === selectedChannel;
    const matchesStatus = selectedStatus === 'all' || c.status === selectedStatus;
    const matchesSearch =
      c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesChannel && matchesStatus && matchesSearch;
  });




  /*
   * El chat abierto. En el teléfono ocupa toda la pantalla, como una app de
   * mensajes. En la computadora se abre como las demás hojas (servicio,
   * producto…): sobre la lista, que se sigue viendo atrás, y se cierra
   * tocando fuera o con Esc.
   */
  const chatAbierto = activeConversationId ? (
    <div className="lg:hidden">
      <VentanaChat conversacionId={activeConversationId} onCerrar={() => setActiveConversationId(null)} />
    </div>
  ) : null;

  return (
    <div id="chats-list-screen" className="relative flex-1 w-full h-full flex flex-col overflow-hidden">
      <IOSHeader
        title="Mensajes"
        subtitle={<><NumeroAnimado valor={conversations.length} /> conversaciones activas</>}
      />

      <PageContent className="space-y-3">
        {sinCanales && (currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
          <button type="button" onClick={() => { pedirSeccionAjustes('chats'); navigateTo('settings'); }}
            className="w-full p-3 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/30 text-left cursor-pointer">
            <b className="text-xs text-slate-900 dark:text-white block">Conecta tu WhatsApp, Instagram o Facebook</b>
            <span className="text-[0.75rem] text-slate-600 dark:text-neutral-300">Aún no llega ningún mensaje porque no hay canales conectados. Toca aquí: se hace en Configuración, con un botón.</span>
          </button>
        )}
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por cliente o mensaje..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>

        {/* Channel Filters */}
        <ChipsFiltro<CommunicationChannel | 'all'>
          valor={selectedChannel}
          onCambio={setSelectedChannel}
          opciones={[
            { id: 'all', label: 'Todos' },
            { id: 'whatsapp', label: '🟢 WhatsApp' },
            { id: 'instagram', label: '🟣 Instagram DM' },
            { id: 'messenger', label: '🔵 Messenger' },
          ]}
        />

        {/* Conversations List: entran en cascada; el chat que recibe un mensaje sube deslizándose */}
        <ListaAnimada className="space-y-2">
          {filteredConversations.map((conv, i) => (
            <ItemAnimado
              key={conv.id}
              indice={i}
              onClick={() => setActiveConversationId(conv.id)}
              className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-neutral-700 transition-[border-color,box-shadow] cursor-pointer ios-touch flex items-center justify-between gap-3"
            >
              <div className="relative shrink-0">
                <FotoClienta foto={conv.clientAvatar} nombre={conv.clientName} className="w-12 h-12 text-base border border-slate-200 dark:border-neutral-700" />
                <PuntoEstado
                  late={conv.status === 'needs_attention'}
                  className={conv.status === 'ai_active' ? 'bg-purple-500' : conv.status === 'needs_attention' ? 'bg-amber-500' : 'bg-emerald-500'}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className={`text-xs text-slate-900 dark:text-white truncate ${conv.unreadCount > 0 ? 'font-extrabold' : 'font-bold'}`}>
                    {conv.clientName}
                  </h4>
                  <span className="text-[0.6875rem] text-slate-400 font-medium shrink-0">
                    {conv.lastMessageAt ? horaDeMensaje(conv.lastMessageAt) : conv.lastMessageTime}
                  </span>
                </div>

                <p className={`text-[0.75rem] truncate mt-0.5 ${conv.unreadCount > 0 ? 'text-slate-800 dark:text-neutral-200 font-semibold' : 'text-slate-500 dark:text-neutral-400'}`}>
                  {conv.lastMessage}
                </p>

                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-1.5">
                    {getChannelBadge(conv.channel)}
                    {getStatusIndicator(conv.status)}
                  </div>

                  <Insignia cuenta={conv.unreadCount} className="px-1.5 py-0.2 rounded-full bg-[var(--primary)] text-white text-[0.6875rem] font-extrabold">
                    {conv.unreadCount} nuevo
                  </Insignia>
                </div>
              </div>
            </ItemAnimado>
          ))}
        </ListaAnimada>
        <Vacio visible={conversations.length > 0 && filteredConversations.length === 0}>Ningún chat coincide con eso.</Vacio>
      </PageContent>
      {chatAbierto}
    </div>
  );
};
