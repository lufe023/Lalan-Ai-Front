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
        subtitle={`${conversations.length} conversaciones activas`}
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
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-0.5">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'whatsapp', label: '🟢 WhatsApp' },
            { id: 'instagram', label: '🟣 Instagram DM' },
            { id: 'messenger', label: '🔵 Messenger' },
          ].map(ch => {
            const isSelected = selectedChannel === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => setSelectedChannel(ch.id as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ios-touch cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--primary)] text-white shadow-xs font-bold'
                    : 'bg-white dark:bg-neutral-900 text-slate-700 dark:text-neutral-300 border border-slate-200/80 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700'
                }`}
              >
                {ch.label}
              </button>
            );
          })}
        </div>

        {/* Conversations List */}
        <div className="space-y-2">
          {filteredConversations.map(conv => (
            <motion.div
              key={conv.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveConversationId(conv.id)}
              className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs hover:border-slate-300 dark:hover:border-neutral-700 transition cursor-pointer ios-touch flex items-center justify-between gap-3"
            >
              <div className="relative shrink-0">
                <FotoClienta foto={conv.clientAvatar} nombre={conv.clientName} className="w-12 h-12 text-base border border-slate-200 dark:border-neutral-700" />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-neutral-900 ${
                    conv.status === 'ai_active'
                      ? 'bg-purple-500'
                      : conv.status === 'needs_attention'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                    {conv.clientName}
                  </h4>
                  <span className="text-[0.6875rem] text-slate-400 font-medium shrink-0">
                    {conv.lastMessageAt ? horaDeMensaje(conv.lastMessageAt) : conv.lastMessageTime}
                  </span>
                </div>

                <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 truncate mt-0.5">
                  {conv.lastMessage}
                </p>

                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-1.5">
                    {getChannelBadge(conv.channel)}
                    {getStatusIndicator(conv.status)}
                  </div>

                  {conv.unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[var(--primary)] text-white text-[0.6875rem] font-extrabold">
                      {conv.unreadCount} nuevo
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </PageContent>
      {chatAbierto}
    </div>
  );
};
