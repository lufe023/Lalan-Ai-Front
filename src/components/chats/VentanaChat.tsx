import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FotoClienta } from '../ui/FotoClienta';
import { GrabadorVoz } from './GrabadorVoz';
import { useDeslizarParaVolver } from '../../hooks/useDeslizarParaVolver';
import { motion } from 'motion/react';
import { AlertTriangle, Bot, Check, CheckCheck, Clock, Minus, Send, Sparkles, UserCheck, Wand2, X } from 'lucide-react';
import { api, subirArchivo } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { CommunicationChannel, ChatStatus, ChatMessage } from '../../types';
import { IOSToggle } from '../ui/IOSToggle';
import { ContenidoMensaje, OrigenDelChat, ReaccionDeMensaje } from './ContenidoMensaje';
import { TurnoEspecial } from './TurnoEspecial';
import { ClientaDelChat } from './ClientaDelChat';
import { SedeDelChat } from './SedeDelChat';
import { BloquearChat, ProteccionDelChat } from './ProteccionDelChat';
import { useAuth } from '../../context/AuthContext';

/** "1:22 a. m." si es de hoy; "26 sep, 1:22 a. m." si no. Nunca el ISO crudo. */
export function horaDeMensaje(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hora = d.toLocaleTimeString('es', { hour: 'numeric', hour12: true, minute: '2-digit' });
  return d.toDateString() === new Date().toDateString()
    ? hora
    : `${d.toLocaleDateString('es', { day: 'numeric', month: 'short' })}, ${hora}`;
}

/** El check de cada mensaje que salió del salón, como en WhatsApp */
export function EstadoDeEnvio({ estado }: { estado?: ChatMessage['deliveryStatus'] }) {
  switch (estado) {
    case 'pendiente': return <Clock className="w-3 h-3" aria-label="Enviando" />;
    case 'enviado': return <Check className="w-3 h-3" aria-label="Enviado" />;
    case 'entregado': return <CheckCheck className="w-3 h-3" aria-label="Entregado" />;
    case 'leido': return <CheckCheck className="w-3 h-3 text-sky-300" aria-label="Leído" />;
    case 'fallido': return <AlertTriangle className="w-3 h-3 text-amber-200" aria-label="No se envió" />;
    default: return <CheckCheck className="w-3 h-3" />;
  }
}

export const getChannelBadge = (channel: CommunicationChannel) => {
  switch (channel) {
    case 'whatsapp':
      return (
        <span className="px-1.5 py-0.5 rounded-full text-[0.6875rem] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          WhatsApp
        </span>
      );
    case 'instagram':
      return (
        <span className="px-1.5 py-0.5 rounded-full text-[0.6875rem] font-extrabold bg-pink-500/15 text-pink-600 dark:text-pink-400">
          Instagram DM
        </span>
      );
    case 'messenger':
      return (
        <span className="px-1.5 py-0.5 rounded-full text-[0.6875rem] font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400">
          Messenger
        </span>
      );
  }
};

export const getStatusIndicator = (status: ChatStatus) => {
  switch (status) {
    case 'ai_active':
      return (
        <span className="flex items-center gap-1 text-[0.6875rem] font-bold text-purple-600 dark:text-purple-400">
          <Bot className="w-3 h-3 animate-pulse" />
          Bot IA Activo
        </span>
      );
    case 'manual_control':
      return (
        <span className="flex items-center gap-1 text-[0.6875rem] font-bold text-sky-600 dark:text-sky-400">
          <UserCheck className="w-3 h-3" />
          Manual
        </span>
      );
    case 'needs_attention':
      return (
        <span className="flex items-center gap-1 text-[0.6875rem] font-bold text-amber-600 dark:text-amber-400 animate-bounce">
          <AlertTriangle className="w-3 h-3" />
          Atención
        </span>
      );
  }
};


/** Si quien lee está a menos de esto del final, los mensajes nuevos lo bajan solos */
const CERCA_DEL_FINAL_PX = 160;

interface VentanaChatProps {
  conversacionId: string;
  /** En la computadora: ventanita abajo a la derecha, como los chats de la web */
  flotante?: boolean;
  minimizada?: boolean;
  onCerrar: () => void;
  onMinimizar?: () => void;
}

/**
 * Un chat abierto. En el teléfono ocupa toda la pantalla; en la computadora
 * es una ventanita y se pueden tener varias a la vez.
 */
export const VentanaChat: React.FC<VentanaChatProps> = ({ conversacionId, flotante = false, minimizada = false, onCerrar, onMinimizar }) => {
  const { conversations, toggleChatAiStatus, sendMessageToConversation, recargarConversaciones, showToast, settings, descartarAviso, marcarLeida } = useApp();
  const agente = settings.aiAgentName || 'Lalan';
  const [inputText, setInputText] = useState('');
  const activeConversation = conversations.find(c => c.id === conversacionId);
  const { currentUser } = useAuth();
  const esSuperAdmin = currentUser?.role === 'super_admin';
  // Deslizar desde el borde izquierdo = Volver a la lista de chats
  useDeslizarParaVolver(onCerrar, !flotante);
  const puedeAutorizarTurno = esSuperAdmin || currentUser?.role === 'admin';
  const activeConversationId = conversacionId;

  /* Con el chat en manos de una persona, se puede escribirle a la clienta o
     decirle a la asistente qué responder (lo mismo que la dueña hace
     contestando el aviso de WhatsApp): ella lo aplica y retoma el chat. */
  const [paraLaAsistente, setParaLaAsistente] = useState(false);
  const [indicando, setIndicando] = useState(false);
  useEffect(() => { setParaLaAsistente(false); }, [activeConversationId]);

  const darIndicacion = async (texto: string) => {
    if (!activeConversationId) return;
    setIndicando(true);
    try {
      await api.post(`/chat/panel/conversaciones/${activeConversationId}/indicacion`, { texto });
      setInputText('');
      setParaLaAsistente(false);
      showToast(`${agente} se encarga`, 'Le responde a la clienta con lo que le dijiste y retoma el chat.', 'success');
    } catch (err) {
      showToast('No se pudo pasar la indicación', (err as Error)?.message || 'Inténtalo de nuevo o escríbele tú a la clienta.', 'warning');
    } finally {
      setIndicando(false);
    }
  };

  /**
   * Nota de voz grabada en el chat. Con "Para Lalan": se transcribe y Lalan la
   * aplica como indicación (la clienta no oye la voz). Si no: le llega a la
   * clienta como nota de voz y Lalan se pausa en este chat.
   */
  const enviarVoz = async (tramos: Blob[]) => {
    if (!activeConversationId || activeConversationId.startsWith('temp_') || !tramos.length) return;
    const paraLalan = paraLaAsistente && activeConversation?.status !== 'ai_active';
    // Cada pausa del grabador deja un tramo: el servidor los junta en una sola nota
    const formulario = new FormData();
    tramos.forEach((audio, i) => {
      const ext = audio.type.includes('webm') ? 'webm' : audio.type.includes('ogg') ? 'ogg' : 'm4a';
      formulario.append('audio', audio, `nota-de-voz-${i + 1}.${ext}`);
    });
    setIndicando(true);
    try {
      if (paraLalan) {
        const r = await subirArchivo<{ texto: string }>(`/chat/panel/conversaciones/${activeConversationId}/indicacion-voz`, formulario);
        setParaLaAsistente(false);
        showToast(`${agente} se encarga`, `Entendió: «${r.texto}»`, 'success');
      } else {
        const r = await subirArchivo<{ deliveryStatus?: string; failureReason?: string }>(`/conversations/${activeConversationId}/nota-de-voz`, formulario);
        if (r.deliveryStatus === 'fallido') showToast('No se envió', r.failureReason ?? 'Meta no aceptó la nota de voz.', 'warning');
        await recargarConversaciones();
      }
    } catch (err) {
      showToast('No se pudo enviar la nota de voz', (err as Error)?.message || 'Inténtalo de nuevo.', 'warning');
    } finally {
      setIndicando(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConversationId || indicando) return;
    if (paraLaAsistente && activeConversation?.status !== 'ai_active') { void darIndicacion(inputText.trim()); return; }

    sendMessageToConversation(activeConversationId, inputText.trim(), 'agent');
    setInputText('');
  };

  /* Lo que se ve en el hilo: lo que de verdad se dijo. Las sugerencias de la
     asistente no se le enviaron a nadie, van aparte en su barra. */
  const hilo = activeConversation?.messages.filter(m => !m.isSuggestion) ?? [];
  const ventanaCerrada = !!activeConversation?.windowExpiresAt
    && new Date(activeConversation.windowExpiresAt).getTime() < Date.now();
  const ultimaDeLaClienta = [...hilo].reverse().find(m => m.sender === 'client');
  // La sugerencia vigente: la última, y solo si es posterior a lo último que escribió la clienta
  const sugerencia = [...(activeConversation?.messages ?? [])].reverse().find(m => m.isSuggestion);
  // …y ya nadie respondió después (si la usaron o contestaron otra cosa, ya no aplica)
  const yaRespondida = !!sugerencia && hilo.some(m => (m.sender === 'agent' || m.sender === 'bot') && m.timestamp > sugerencia.timestamp);
  const sugerenciaVigente = sugerencia && !yaRespondida && (!ultimaDeLaClienta || sugerencia.timestamp >= ultimaDeLaClienta.timestamp)
    ? sugerencia : undefined;

  // Abierto (y no minimizado) = leído, también lo que llega mientras está a la vista
  const noLeidos = activeConversation?.unreadCount ?? 0;
  useEffect(() => {
    if (!minimizada && noLeidos > 0) marcarLeida(conversacionId);
  }, [minimizada, noLeidos, conversacionId, marcarLeida]);

  /* Se abre en lo último, como cualquier chat. Si llega algo nuevo y quien
     lee está abajo, baja solo; si subió a leer lo anterior, no se le mueve. */
  const cuerpoRef = useRef<HTMLDivElement>(null);
  const cercaDelFinal = useRef(true);
  const alDesplazar = () => {
    const el = cuerpoRef.current;
    if (el) cercaDelFinal.current = el.scrollHeight - el.scrollTop - el.clientHeight < CERCA_DEL_FINAL_PX;
  };
  useLayoutEffect(() => {
    const el = cuerpoRef.current;
    if (el) { el.scrollTop = el.scrollHeight; cercaDelFinal.current = true; }
  }, [conversacionId, minimizada]);
  const cantidad = hilo.length;
  const ultimoEsDelSalon = hilo[cantidad - 1]?.sender === 'agent';
  useEffect(() => {
    const el = cuerpoRef.current;
    if (el && (cercaDelFinal.current || ultimoEsDelSalon)) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [cantidad, ultimoEsDelSalon, sugerenciaVigente?.id]);

  if (!activeConversation) return null;

  if (flotante) {
    const color = activeConversation.status === 'ai_active' ? 'bg-purple-500'
      : activeConversation.status === 'needs_attention' ? 'bg-amber-500' : 'bg-emerald-500';
    return (
      <section
        aria-label={`Chat con ${activeConversation.clientName}`}
        className={`w-[360px] flex flex-col rounded-t-2xl shadow-2xl overflow-hidden border border-b-0 border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark] ${minimizada ? '' : 'h-[min(520px,calc(100vh-96px))]'}`}
      >
        <div
          className="px-3 py-2 flex items-center gap-2 border-b border-slate-200/70 dark:border-neutral-800 bg-white dark:bg-neutral-900 shrink-0 cursor-pointer select-none"
          onClick={onMinimizar}
        >
          <div className="relative shrink-0">
            <FotoClienta foto={activeConversation.clientAvatar} nombre={activeConversation.clientName} className="w-8 h-8 text-xs" />
            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-neutral-900 ${color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold truncate">{activeConversation.clientName}</h4>
            <div className="flex items-center gap-1.5">{getStatusIndicator(activeConversation.status)}</div>
          </div>
          {minimizada && noLeidos > 0 && (
            <span className="px-1.5 rounded-full bg-[var(--primary)] text-white text-[0.6875rem] font-extrabold">{noLeidos}</span>
          )}
          <div onClick={e => e.stopPropagation()} title={activeConversation.status === 'ai_active' ? `Atiende ${agente}` : 'Atiende una persona'}>
            <IOSToggle
              id={`toggle-chat-ai-${conversacionId}`}
              checked={activeConversation.status === 'ai_active'}
              onChange={checked => {
                void toggleChatAiStatus(activeConversation.id, checked);
                if (checked) descartarAviso(activeConversation.id);
              }}
              activeColor="#9333ea"
            />
          </div>
          <button type="button" aria-label={minimizada ? 'Abrir' : 'Minimizar'} onClick={e => { e.stopPropagation(); onMinimizar?.(); }} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer">
            <Minus className="w-4 h-4" />
          </button>
          <button type="button" aria-label="Cerrar chat" onClick={e => { e.stopPropagation(); onCerrar(); }} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        {!minimizada && (
          <>
        {/* Chat Messages Body */}
        <div ref={cuerpoRef} onScroll={alDesplazar} className={`flex-1 overflow-y-auto hide-scrollbar ${flotante ? 'p-3' : 'p-4'} space-y-3 bg-slate-50/50 dark:bg-[#0c0c0e]`}>
          <OrigenDelChat mensajes={hilo} />
          {hilo.map((msg, idx) => {
            const isClient = msg.sender === 'client';
            const isBot = msg.sender === 'bot';

            // Avisos del sistema ("pasó a una persona"): al centro, no son de nadie
            if (msg.sender === 'system') {
              return (
                <div key={msg.id || idx} className="flex justify-center">
                  <div className="px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-[0.75rem] text-amber-800 dark:text-amber-200 flex items-center gap-1.5 max-w-[90%]">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>{msg.text}</span>
                    <span className="opacity-60 shrink-0">· {horaDeMensaje(msg.timestamp)}</span>
                  </div>
                </div>
              );
            }

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
                  <div className="flex items-center gap-1 text-[0.6875rem] font-bold opacity-80 mb-0.5">
                    {isClient ? (
                      <span>{activeConversation.clientName}</span>
                    ) : isBot ? (
                      <span className="flex items-center gap-0.5">
                        <Bot className="w-2.5 h-2.5" /> {agente}
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5">
                        <UserCheck className="w-2.5 h-2.5" /> Equipo del salón
                      </span>
                    )}
                  </div>

                  <ContenidoMensaje msg={msg} sobreColor={!isClient} esSuperAdmin={esSuperAdmin} />

                  <div className="flex items-center justify-end gap-1 text-[0.6875rem] opacity-70 mt-1">
                    <span>{horaDeMensaje(msg.timestamp)}</span>
                    {!isClient && <EstadoDeEnvio estado={msg.deliveryStatus} />}
                  </div>
                  {msg.deliveryStatus === 'fallido' && (
                    <div className="mt-1 text-[0.6875rem] font-semibold bg-black/20 rounded-lg px-2 py-1">
                      No se envió{msg.failureReason ? `: ${msg.failureReason}` : ''}
                    </div>
                  )}
                </div>
                <ReaccionDeMensaje emoji={msg.reaccion} aLaDerecha={!isClient} />
              </motion.div>
            );
          })}
        </div>

        {/* La respuesta que propone la asistente mientras atiende una persona */}
        {sugerenciaVigente && (
          <div className="px-3 py-2 bg-purple-50 dark:bg-purple-950/40 border-t border-purple-200/70 dark:border-purple-900 flex items-start gap-2 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-purple-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[0.6875rem] font-bold text-purple-700 dark:text-purple-300">{agente} sugiere responder:</div>
              <p className="text-[0.75rem] text-slate-700 dark:text-neutral-200 whitespace-pre-wrap line-clamp-3">{sugerenciaVigente.text}</p>
            </div>
            <button
              onClick={() => setInputText(sugerenciaVigente.text)}
              className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[0.6875rem] font-bold shrink-0 cursor-pointer"
            >
              Usar
            </button>
          </div>
        )}

        {/* ¿A quién le escribes? A la clienta, o a la asistente para que ella le responda */}
        {activeConversation.status !== 'ai_active' && !ventanaCerrada && (
          <div className="px-4 pt-2 flex items-center gap-1.5 shrink-0 bg-white/60 dark:bg-neutral-950/60" role="radiogroup" aria-label="A quién le escribes">
            {[
              { valor: false, texto: 'Escribirle yo' },
              { valor: true, texto: `Decirle a ${agente} qué responder` },
            ].map(o => (
              <button
                key={String(o.valor)}
                type="button"
                role="radio"
                aria-checked={paraLaAsistente === o.valor}
                data-medir={o.valor ? 'Chat: indicación a la asistente' : 'Chat: escribir yo'}
                onClick={() => setParaLaAsistente(o.valor)}
                className={`px-3 py-1 rounded-full text-[0.75rem] font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                  paraLaAsistente === o.valor
                    ? o.valor ? 'bg-purple-600 text-white' : 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300'
                }`}
              >
                {o.valor && <Wand2 className="w-3 h-3" aria-hidden="true" />}{o.texto}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="relative p-3 px-4 glass-ios border-t border-slate-200/70 dark:border-neutral-800/80 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            placeholder={
              activeConversation.status === 'ai_active'
                ? `Si escribes, ${agente} se pausa en este chat…`
                : paraLaAsistente
                  ? `Ej.: dile que sí, que venga mañana a las 4 de la tarde (${activeConversation.clientName.split(' ')[0]} no ve esto)`
                  : 'Escribe un mensaje...'
            }
            aria-label={paraLaAsistente ? `Indicación para ${agente}` : 'Mensaje para la clienta'}
            value={inputText}
            disabled={ventanaCerrada}
            onChange={e => setInputText(e.target.value)}
            className="flex-1 px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />

          {inputText.trim() || ventanaCerrada ? (
            <button
              type="submit"
              disabled={!inputText.trim() || indicando}
              aria-label={paraLaAsistente ? `Pasarle la indicación a ${agente}` : 'Enviar'}
              className={`w-10 h-10 rounded-2xl ${paraLaAsistente && activeConversation.status !== 'ai_active' ? 'bg-purple-600' : 'bg-[var(--primary)]'} text-white flex items-center justify-center disabled:opacity-40 transition ios-touch cursor-pointer shadow-sm`}
            >
              {paraLaAsistente && activeConversation.status !== 'ai_active' ? <Wand2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            </button>
          ) : (
            <GrabadorVoz
              onListo={enviarVoz}
              onAviso={(t, d) => showToast(t, d, 'warning')}
              deshabilitado={indicando}
              color={paraLaAsistente && activeConversation.status !== 'ai_active' ? 'bg-purple-600' : 'bg-[var(--primary)]'}
              etiqueta={paraLaAsistente && activeConversation.status !== 'ai_active' ? `Mantén presionado para decirle a ${agente} qué responder` : 'Mantén presionado para grabar una nota de voz'}
            />
          )}
        </form>
        {/* Regla de Meta: pasadas 24 h desde su último mensaje, no se le puede escribir */}
        <ProteccionDelChat key={activeConversation.id} conversacion={activeConversation} puedeBloquear={puedeAutorizarTurno} />
        <ClientaDelChat key={`clienta-${activeConversation.id}`} conversacion={activeConversation} />
        <SedeDelChat key={`sede-${activeConversation.id}`} conversacion={activeConversation} />
        <TurnoEspecial key={activeConversation.id} conversacion={activeConversation} puedeAutorizar={puedeAutorizarTurno}>
          {puedeAutorizarTurno && <BloquearChat conversacion={activeConversation} />}
        </TurnoEspecial>
        {ventanaCerrada && (
          <p className="px-4 pb-2 text-[0.6875rem] text-amber-700 dark:text-amber-300 bg-white dark:bg-neutral-950">
            Pasaron más de 24 horas desde su último mensaje: WhatsApp no deja escribirle hasta que ella vuelva a escribir.
          </p>
        )}
          </>
        )}
      </section>
    );
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col">
      <div id="active-chat-screen" className="relative z-10 w-full h-full flex flex-col bg-white dark:bg-neutral-950">
        {/* Custom iOS Chat Header */}
        <div
          className="px-4 pb-3 glass-nav border-b border-slate-200/70 dark:border-neutral-800/80 flex items-center justify-between shrink-0 pt-safe-header"
          style={{ paddingTop: 'var(--header-safe-pt, max(calc(env(safe-area-inset-top, 0px) + 8px), 52px))' }}
        >
          <div className="flex items-center gap-2.5">
            <button
              onClick={onCerrar}
              className="text-[var(--primary)] text-xs font-bold -ml-1 pr-1 ios-touch cursor-pointer"
            >
              ← Volver
            </button>
            <div className="relative">
              <FotoClienta foto={activeConversation.clientAvatar} nombre={activeConversation.clientName} className="w-9 h-9 text-xs border border-white/60" />
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
              <div className="flex items-center gap-1.5 text-[0.6875rem] text-slate-400">
                {getChannelBadge(activeConversation.channel)}
                {getStatusIndicator(activeConversation.status)}
              </div>
            </div>
          </div>

          {/* AI vs Manual Control Toggle */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-neutral-900 px-2.5 py-1.5 rounded-xl border border-slate-200/60 dark:border-neutral-800">
            <div className="text-right">
              <span className="text-[0.6875rem] uppercase font-bold text-slate-400 block leading-none">
                Modo Bot IA
              </span>
              <span className="text-[0.6875rem] font-extrabold text-slate-800 dark:text-slate-200">
                {activeConversation.status === 'ai_active' ? `🤖 ${agente}` : '👤 Una persona'}
              </span>
            </div>
            <IOSToggle
              id={`toggle-chat-ai-${conversacionId}`}
              checked={activeConversation.status === 'ai_active'}
              onChange={checked => {
                void toggleChatAiStatus(activeConversation.id, checked);
                if (checked) descartarAviso(activeConversation.id);
              }}
              activeColor="#9333ea"
            />
          </div>
        </div>

        {/* Chat Messages Body */}
        <div ref={cuerpoRef} onScroll={alDesplazar} className={`flex-1 overflow-y-auto hide-scrollbar ${flotante ? 'p-3' : 'p-4'} space-y-3 bg-slate-50/50 dark:bg-[#0c0c0e]`}>
          <OrigenDelChat mensajes={hilo} />
          {hilo.map((msg, idx) => {
            const isClient = msg.sender === 'client';
            const isBot = msg.sender === 'bot';

            // Avisos del sistema ("pasó a una persona"): al centro, no son de nadie
            if (msg.sender === 'system') {
              return (
                <div key={msg.id || idx} className="flex justify-center">
                  <div className="px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-[0.75rem] text-amber-800 dark:text-amber-200 flex items-center gap-1.5 max-w-[90%]">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>{msg.text}</span>
                    <span className="opacity-60 shrink-0">· {horaDeMensaje(msg.timestamp)}</span>
                  </div>
                </div>
              );
            }

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
                  <div className="flex items-center gap-1 text-[0.6875rem] font-bold opacity-80 mb-0.5">
                    {isClient ? (
                      <span>{activeConversation.clientName}</span>
                    ) : isBot ? (
                      <span className="flex items-center gap-0.5">
                        <Bot className="w-2.5 h-2.5" /> {agente}
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5">
                        <UserCheck className="w-2.5 h-2.5" /> Equipo del salón
                      </span>
                    )}
                  </div>

                  <ContenidoMensaje msg={msg} sobreColor={!isClient} esSuperAdmin={esSuperAdmin} />

                  <div className="flex items-center justify-end gap-1 text-[0.6875rem] opacity-70 mt-1">
                    <span>{horaDeMensaje(msg.timestamp)}</span>
                    {!isClient && <EstadoDeEnvio estado={msg.deliveryStatus} />}
                  </div>
                  {msg.deliveryStatus === 'fallido' && (
                    <div className="mt-1 text-[0.6875rem] font-semibold bg-black/20 rounded-lg px-2 py-1">
                      No se envió{msg.failureReason ? `: ${msg.failureReason}` : ''}
                    </div>
                  )}
                </div>
                <ReaccionDeMensaje emoji={msg.reaccion} aLaDerecha={!isClient} />
              </motion.div>
            );
          })}
        </div>

        {/* La respuesta que propone la asistente mientras atiende una persona */}
        {sugerenciaVigente && (
          <div className="px-3 py-2 bg-purple-50 dark:bg-purple-950/40 border-t border-purple-200/70 dark:border-purple-900 flex items-start gap-2 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-purple-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[0.6875rem] font-bold text-purple-700 dark:text-purple-300">{agente} sugiere responder:</div>
              <p className="text-[0.75rem] text-slate-700 dark:text-neutral-200 whitespace-pre-wrap line-clamp-3">{sugerenciaVigente.text}</p>
            </div>
            <button
              onClick={() => setInputText(sugerenciaVigente.text)}
              className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[0.6875rem] font-bold shrink-0 cursor-pointer"
            >
              Usar
            </button>
          </div>
        )}

        {/* ¿A quién le escribes? A la clienta, o a la asistente para que ella le responda */}
        {activeConversation.status !== 'ai_active' && !ventanaCerrada && (
          <div className="px-4 pt-2 flex items-center gap-1.5 shrink-0 bg-white/60 dark:bg-neutral-950/60" role="radiogroup" aria-label="A quién le escribes">
            {[
              { valor: false, texto: 'Escribirle yo' },
              { valor: true, texto: `Decirle a ${agente} qué responder` },
            ].map(o => (
              <button
                key={String(o.valor)}
                type="button"
                role="radio"
                aria-checked={paraLaAsistente === o.valor}
                data-medir={o.valor ? 'Chat: indicación a la asistente' : 'Chat: escribir yo'}
                onClick={() => setParaLaAsistente(o.valor)}
                className={`px-3 py-1 rounded-full text-[0.75rem] font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                  paraLaAsistente === o.valor
                    ? o.valor ? 'bg-purple-600 text-white' : 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300'
                }`}
              >
                {o.valor && <Wand2 className="w-3 h-3" aria-hidden="true" />}{o.texto}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="relative p-3 px-4 glass-ios border-t border-slate-200/70 dark:border-neutral-800/80 flex items-center gap-2 shrink-0 pb-safe-tab"
        >
          <input
            type="text"
            placeholder={
              activeConversation.status === 'ai_active'
                ? `Si escribes, ${agente} se pausa en este chat…`
                : paraLaAsistente
                  ? `Ej.: dile que sí, que venga mañana a las 4 de la tarde (${activeConversation.clientName.split(' ')[0]} no ve esto)`
                  : 'Escribe un mensaje...'
            }
            aria-label={paraLaAsistente ? `Indicación para ${agente}` : 'Mensaje para la clienta'}
            value={inputText}
            disabled={ventanaCerrada}
            onChange={e => setInputText(e.target.value)}
            className="flex-1 px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />

          {inputText.trim() || ventanaCerrada ? (
            <button
              type="submit"
              disabled={!inputText.trim() || indicando}
              aria-label={paraLaAsistente ? `Pasarle la indicación a ${agente}` : 'Enviar'}
              className={`w-10 h-10 rounded-2xl ${paraLaAsistente && activeConversation.status !== 'ai_active' ? 'bg-purple-600' : 'bg-[var(--primary)]'} text-white flex items-center justify-center disabled:opacity-40 transition ios-touch cursor-pointer shadow-sm`}
            >
              {paraLaAsistente && activeConversation.status !== 'ai_active' ? <Wand2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            </button>
          ) : (
            <GrabadorVoz
              onListo={enviarVoz}
              onAviso={(t, d) => showToast(t, d, 'warning')}
              deshabilitado={indicando}
              color={paraLaAsistente && activeConversation.status !== 'ai_active' ? 'bg-purple-600' : 'bg-[var(--primary)]'}
              etiqueta={paraLaAsistente && activeConversation.status !== 'ai_active' ? `Mantén presionado para decirle a ${agente} qué responder` : 'Mantén presionado para grabar una nota de voz'}
            />
          )}
        </form>
        {/* Regla de Meta: pasadas 24 h desde su último mensaje, no se le puede escribir */}
        <ProteccionDelChat key={activeConversation.id} conversacion={activeConversation} puedeBloquear={puedeAutorizarTurno} />
        <ClientaDelChat key={`clienta-${activeConversation.id}`} conversacion={activeConversation} />
        <SedeDelChat key={`sede-${activeConversation.id}`} conversacion={activeConversation} />
        <TurnoEspecial key={activeConversation.id} conversacion={activeConversation} puedeAutorizar={puedeAutorizarTurno}>
          {puedeAutorizarTurno && <BloquearChat conversacion={activeConversation} />}
        </TurnoEspecial>
        {ventanaCerrada && (
          <p className="px-4 pb-2 text-[0.6875rem] text-amber-700 dark:text-amber-300 bg-white dark:bg-neutral-950">
            Pasaron más de 24 horas desde su último mensaje: WhatsApp no deja escribirle hasta que ella vuelva a escribir.
          </p>
        )}
      </div>
    </div>
  );
};
