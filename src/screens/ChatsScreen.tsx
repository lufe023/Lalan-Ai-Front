import React, { useState } from 'react';
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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { CommunicationChannel, ChatStatus, Conversation } from '../types';
import { IOSHeader } from '../components/ui/IOSHeader';
import { IOSToggle } from '../components/ui/IOSToggle';

export const ChatsScreen: React.FC = () => {
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    toggleChatAiStatus,
    sendMessageToConversation,
    showToast,
  } = useApp();
  const { currentUser } = useAuth();

  const [selectedChannel, setSelectedChannel] = useState<CommunicationChannel | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<ChatStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');

  // Active Conversation Object
  const activeConversation = conversations.find(c => c.id === activeConversationId);

  // Filter conversations
  const filteredConversations = conversations.filter(c => {
    const matchesChannel = selectedChannel === 'all' || c.channel === selectedChannel;
    const matchesStatus = selectedStatus === 'all' || c.status === selectedStatus;
    const matchesSearch =
      c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesChannel && matchesStatus && matchesSearch;
  });

  const getChannelBadge = (channel: CommunicationChannel) => {
    switch (channel) {
      case 'whatsapp':
        return (
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            WhatsApp
          </span>
        );
      case 'instagram':
        return (
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-pink-500/15 text-pink-600 dark:text-pink-400">
            Instagram DM
          </span>
        );
      case 'messenger':
        return (
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400">
            Messenger
          </span>
        );
    }
  };

  const getStatusIndicator = (status: ChatStatus) => {
    switch (status) {
      case 'ai_active':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold text-purple-600 dark:text-purple-400">
            <Bot className="w-3 h-3 animate-pulse" />
            Bot IA Activo
          </span>
        );
      case 'manual_control':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold text-sky-600 dark:text-sky-400">
            <UserCheck className="w-3 h-3" />
            Manual
          </span>
        );
      case 'needs_attention':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 animate-bounce">
            <AlertTriangle className="w-3 h-3" />
            Atención
          </span>
        );
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConversationId) return;

    sendMessageToConversation(activeConversationId, inputText.trim(), 'agent');
    setInputText('');
  };

  const handleSendQuickPrompt = (text: string) => {
    if (!activeConversationId) return;
    sendMessageToConversation(activeConversationId, text, 'agent');
  };

  // If in active conversation view, show full iOS chat interface
  if (activeConversation) {
    return (
      <div id="active-chat-screen" className="flex-1 w-full h-full flex flex-col bg-white dark:bg-neutral-950 select-none">
        {/* Custom iOS Chat Header */}
        <div className="p-3 px-4 glass-nav border-b border-slate-200/70 dark:border-neutral-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setActiveConversationId(null)}
              className="text-[var(--primary)] text-xs font-bold -ml-1 pr-1 ios-touch cursor-pointer"
            >
              ← Volver
            </button>
            <div className="relative">
              <img
                src={activeConversation.clientAvatar}
                alt={activeConversation.clientName}
                className="w-9 h-9 rounded-full object-cover border border-white/60"
              />
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-neutral-900 ${
                  activeConversation.status === 'ai_active'
                    ? 'bg-purple-500'
                    : activeConversation.status === 'needs_attention'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
              />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {activeConversation.clientName}
              </h4>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                {getChannelBadge(activeConversation.channel)}
                <span>• {activeConversation.serviceInterest || 'Consulta'}</span>
              </div>
            </div>
          </div>

          {/* AI vs Manual Control Toggle */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-neutral-900 px-2.5 py-1.5 rounded-xl border border-slate-200/60 dark:border-neutral-800">
            <div className="text-right">
              <span className="text-[9px] uppercase font-bold text-slate-400 block leading-none">
                Modo Bot IA
              </span>
              <span className="text-[10px] font-extrabold text-slate-800 dark:text-slate-200">
                {activeConversation.status === 'ai_active' ? '🤖 Activado' : '👤 Manual'}
              </span>
            </div>
            <IOSToggle
              id="toggle-chat-ai"
              checked={activeConversation.status === 'ai_active'}
              onChange={checked => toggleChatAiStatus(activeConversation.id, checked)}
              activeColor="#9333ea"
            />
          </div>
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto hide-scrollbar p-4 space-y-3 bg-slate-50/50 dark:bg-[#0c0c0e]">
          {/* AI Notice Pill */}
          <div className="flex justify-center">
            <div className="px-3 py-1 rounded-full bg-slate-200/70 dark:bg-neutral-800 text-[10px] text-slate-600 dark:text-neutral-300 flex items-center gap-1.5 shadow-xs font-medium">
              <Sparkles className="w-3 h-3 text-[var(--primary)]" />
              <span>Conexión Meta Graph API v20.0 • Confianza IA: {activeConversation.confidenceScore || 95}%</span>
            </div>
          </div>

          {activeConversation.messages.map((msg, idx) => {
            const isClient = msg.sender === 'client';
            const isBot = msg.sender === 'bot';

            return (
              <motion.div
                key={msg.id || idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${isClient ? 'items-start' : 'items-end'}`}
              >
                <div
                  className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                    isClient
                      ? 'bg-white dark:bg-neutral-800 text-slate-900 dark:text-white rounded-bl-xs border border-slate-200/60 dark:border-neutral-700/60'
                      : isBot
                      ? 'bg-gradient-to-tr from-purple-700 to-indigo-600 text-white rounded-br-xs'
                      : 'bg-gradient-to-tr from-[var(--primary)] to-rose-500 text-white rounded-br-xs'
                  }`}
                >
                  {/* Sender Tag */}
                  <div className="flex items-center gap-1 text-[9px] font-bold opacity-80 mb-0.5">
                    {isClient ? (
                      <span>{activeConversation.clientName}</span>
                    ) : isBot ? (
                      <span className="flex items-center gap-0.5">
                        <Bot className="w-2.5 h-2.5" /> Lalan Bot IA (Automático)
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5">
                        <UserCheck className="w-2.5 h-2.5" /> {currentUser?.name || 'Agente'} (Manual)
                      </span>
                    )}
                  </div>

                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  <div className="flex items-center justify-end gap-1 text-[9px] opacity-70 mt-1">
                    <span>{msg.timestamp}</span>
                    {!isClient && <CheckCheck className="w-3 h-3" />}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Quick Quick-Reply Suggestion Bar */}
        <div className="px-3 py-1.5 bg-white dark:bg-neutral-900 border-t border-slate-100 dark:border-neutral-800/80 flex items-center gap-1.5 overflow-x-auto hide-scrollbar shrink-0">
          <span className="text-[10px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-500" /> Respuestas:
          </span>
          {[
            '✨ Hola, te confirmamos tu turno con gusto.',
            '💅 ¿Deseas Uñas Acrílicas o Kapping Gel?',
            '🦶 Tenemos espacio hoy para Jelly Spa a las 4:30 PM.',
            '💳 Te envío el link para registrar tu 30% de anticipo.',
          ].map((quickText, qIdx) => (
            <button
              key={qIdx}
              onClick={() => handleSendQuickPrompt(quickText)}
              className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-[10px] text-slate-700 dark:text-neutral-300 whitespace-nowrap transition ios-touch cursor-pointer font-medium"
            >
              {quickText}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 px-4 glass-ios border-t border-slate-200/70 dark:border-neutral-800/80 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            placeholder={
              activeConversation.status === 'ai_active'
                ? 'Escribe para responder manualmente...'
                : 'Escribe un mensaje...'
            }
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            className="flex-1 px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            className="w-10 h-10 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center disabled:opacity-40 transition ios-touch cursor-pointer shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    );
  }

  // Otherwise show conversations list
  return (
    <div id="chats-list-screen" className="flex-1 w-full h-full flex flex-col overflow-hidden">
      <IOSHeader
        title="Mensajes"
        subtitle={`${conversations.length} conversaciones activas`}
      />

      <div className="flex-1 overflow-y-auto hide-scrollbar px-4 pb-6 space-y-3">
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
                <img
                  src={conv.clientAvatar}
                  alt={conv.clientName}
                  className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-neutral-700"
                />
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
                  <span className="text-[10px] text-slate-400 font-medium shrink-0">
                    {conv.lastMessageTime}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-neutral-400 truncate mt-0.5">
                  {conv.lastMessage}
                </p>

                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-1.5">
                    {getChannelBadge(conv.channel)}
                    {getStatusIndicator(conv.status)}
                  </div>

                  {conv.unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[var(--primary)] text-white text-[9px] font-extrabold">
                      {conv.unreadCount} nuevo
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
