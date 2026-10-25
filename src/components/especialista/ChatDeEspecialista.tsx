import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Bot, Eye, Loader2, LogOut, Send, ShieldAlert, Sparkles, UserCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useConfirmar } from '../ui/ModalConfirmar';
import { ContenidoMensaje } from '../chats/ContenidoMensaje';
import { EstadoDeEnvio, getChannelBadge, horaDeMensaje } from '../chats/VentanaChat';
import { AVISO_CHAT_ESPECIALISTA, misChatsApi, type MensajeDeMiChat, type MiChat } from '../../services/especialistas';
import type { ChatMessage, CommunicationChannel } from '../../types';

/** Mientras el chat está abierto se pide de nuevo cada tanto (la especialista no entra al socket del salón) */
const REFRESCO_MS = 5_000;
const CERCA_DEL_FINAL_PX = 160;

/** Lo que pinta ContenidoMensaje (la foto, la nota de voz…) con lo que le llega a ella */
function comoMensaje(m: MensajeDeMiChat): ChatMessage {
  return {
    id: m.id, text: m.texto, timestamp: m.en, tipo: m.tipo, adjunto: m.adjunto, eliminado: m.borrado,
    deliveryStatus: m.estado, failureReason: m.motivoFallo,
    sender: m.de === 'clienta' ? 'client' : m.de === 'lalan' ? 'bot' : m.de === 'aviso' ? 'system' : 'agent',
  };
}

/**
 * El chat de una especialista con su clienta. Escribe por el número del
 * salón, firmado con su nombre; arriba, siempre a la vista, el aviso de que
 * la administración y Lalan ven la conversación. Si Lalan la pausa, no puede
 * escribir hasta que la administración lo revise.
 */
export const ChatDeEspecialista: React.FC<{ chatId: string; inicial?: MiChat | null; onCerrar: () => void }> = ({ chatId, inicial, onCerrar }) => {
  const { showToast } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [chat, setChat] = useState<MiChat | null>(inicial ?? null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sinTurno, setSinTurno] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try { setChat(await misChatsApi.chat(chatId)); setSinTurno(null); }
    catch (e) { setSinTurno((e as Error)?.message || 'Este chat ya no está a tu cargo.'); }
  }, [chatId]);

  useEffect(() => {
    void cargar();
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void cargar(); }, REFRESCO_MS);
    return () => window.clearInterval(t);
  }, [cargar]);

  const cuerpoRef = useRef<HTMLDivElement>(null);
  const cercaDelFinal = useRef(true);
  const cantidad = chat?.mensajes.length ?? 0;
  useLayoutEffect(() => {
    const el = cuerpoRef.current;
    if (el && cercaDelFinal.current) el.scrollTop = el.scrollHeight;
  }, [cantidad]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    try {
      const r = await misChatsApi.escribir(chatId, t);
      setChat(r); setTexto(''); cercaDelFinal.current = true;
      if (r.pausado) showToast('Lalan detuvo tu mensaje', 'No salió y la administración ya se enteró. Espera a que lo revisen.', 'warning');
      else if (r.mensajes[r.mensajes.length - 1]?.estado === 'fallido') showToast('No se envió', r.mensajes[r.mensajes.length - 1]?.motivoFallo ?? 'Inténtalo de nuevo.', 'warning');
    } catch (err) {
      showToast('No se pudo enviar', (err as Error)?.message || 'Inténtalo de nuevo.', 'warning');
    } finally { setEnviando(false); }
  };

  const plantilla = async () => {
    if (!chat) return;
    const si = await confirmar({
      titulo: `¿Mandarle un aviso a ${chat.clienta.split(' ')[0]}?`,
      mensaje: 'Pasaron más de 24 horas desde su último mensaje: WhatsApp solo deja escribirle con un aviso aprobado, y lo cobra al salón. Cuando ella conteste, sigues escribiendo normal.',
      textoConfirmar: 'Sí, mandarlo',
    });
    if (!si) return;
    setEnviando(true);
    try { setChat(await misChatsApi.plantilla(chatId)); showToast('Aviso enviado', 'Cuando te conteste, te llega una notificación.', 'success'); }
    catch (err) { showToast('No se pudo', (err as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
    finally { setEnviando(false); }
  };

  const soltar = async () => {
    const si = await confirmar({
      titulo: '¿Terminar esta conversación?',
      mensaje: 'Deja de estar en tus chats. Si quieres volver a escribirle, ábrela otra vez desde su cita.',
      textoConfirmar: 'Sí, terminar',
    });
    if (!si) return;
    try { await misChatsApi.soltar(chatId); onCerrar(); }
    catch (err) { showToast('No se pudo', (err as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
  };

  const hilo = chat?.mensajes.filter(m => m.de !== 'sugerencia') ?? [];
  const ultimaDeLaClienta = [...hilo].reverse().find(m => m.de === 'clienta');
  const sugerencia = [...(chat?.mensajes ?? [])].reverse().find(m => m.de === 'sugerencia');
  const sugerenciaVigente = sugerencia && (!ultimaDeLaClienta || sugerencia.en >= ultimaDeLaClienta.en)
    && !hilo.some(m => m.de === 'yo' && m.en > sugerencia.en) ? sugerencia : undefined;
  const bloqueado = !chat || !!chat.pausado || !chat.ventanaAbierta || !!sinTurno;

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-white dark:bg-neutral-950">
      {modalConfirmar}
      <div className="px-4 pb-3 glass-nav border-b border-slate-200/70 dark:border-neutral-800/80 flex items-center gap-2.5 shrink-0"
        style={{ paddingTop: 'var(--header-safe-pt, max(calc(env(safe-area-inset-top, 0px) + 8px), 52px))' }}>
        <button onClick={onCerrar} aria-label="Volver" className="text-[var(--primary)] text-xs font-bold -ml-1 pr-1 cursor-pointer shrink-0">←<span className="hidden sm:inline"> Volver</span></button>
        <div className="min-w-0 flex-1">
          <h4 className="text-[0.875rem] font-bold text-slate-900 dark:text-white truncate">{chat?.clienta ?? '…'}</h4>
          <div className="flex items-center gap-1.5">{chat && getChannelBadge(chat.canal as CommunicationChannel)}</div>
        </div>
        {chat && !sinTurno && (
          <button type="button" onClick={() => void soltar()} className="shrink-0 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 text-[0.75rem] font-semibold text-slate-600 dark:text-neutral-300 flex items-center gap-1 cursor-pointer">
            <LogOut className="w-3.5 h-3.5" /> Terminar
          </button>
        )}
      </div>

      {/* El aviso fijo: siempre a la vista, no se puede cerrar */}
      <div className="px-4 py-2 bg-sky-50 dark:bg-sky-950/40 border-b border-sky-100 dark:border-sky-900 text-[0.75rem] text-sky-800 dark:text-sky-200 flex items-start gap-2 shrink-0">
        <Eye className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        <p>{AVISO_CHAT_ESPECIALISTA}</p>
      </div>

      <div ref={cuerpoRef} onScroll={() => { const el = cuerpoRef.current; if (el) cercaDelFinal.current = el.scrollHeight - el.scrollTop - el.clientHeight < CERCA_DEL_FINAL_PX; }}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-[#0c0c0e]">
        {!chat && !sinTurno && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" /></div>}
        {chat && !hilo.some(m => m.de !== 'aviso') && (
          <p className="text-center text-[0.8125rem] text-slate-400 py-6">Escríbele a {chat.clienta.split(' ')[0]}. Le llega por el número del salón, con tu nombre.</p>
        )}
        {hilo.map(m => {
          if (m.de === 'aviso') {
            return (
              <div key={m.id} className="flex justify-center">
                <div className="px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-[0.75rem] text-amber-800 dark:text-amber-200 flex items-center gap-1.5 max-w-[90%]">
                  <AlertTriangle className="w-3 h-3 shrink-0" /><span>{m.texto}</span><span className="opacity-60 shrink-0">· {horaDeMensaje(m.en)}</span>
                </div>
              </div>
            );
          }
          const deLaClienta = m.de === 'clienta';
          const color = deLaClienta
            ? 'bg-white dark:bg-neutral-800 text-slate-900 dark:text-white rounded-bl-xs border border-slate-200/60 dark:border-neutral-700/60'
            : m.de === 'lalan' ? 'bg-gradient-to-tr from-purple-700 to-indigo-600 text-white rounded-br-xs'
              : m.de === 'salon' ? 'bg-slate-700 text-white rounded-br-xs'
                : 'bg-gradient-to-tr from-[var(--primary)] to-rose-500 text-white rounded-br-xs';
          return (
            <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex flex-col ${deLaClienta ? 'items-start' : 'items-end'}`}>
              <div className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-[0.8125rem] leading-relaxed shadow-xs ${color}`}>
                <div className="flex items-center gap-1 text-[0.6875rem] font-bold opacity-80 mb-0.5">
                  {deLaClienta ? chat?.clienta
                    : m.de === 'lalan' ? <><Bot className="w-2.5 h-2.5" /> Lalan</>
                      : m.de === 'yo' ? 'Tú'
                        : <><UserCheck className="w-2.5 h-2.5" /> {m.autor ?? 'Equipo del salón'}</>}
                </div>
                <ContenidoMensaje msg={comoMensaje(m)} sobreColor={!deLaClienta} esSuperAdmin={false} rutaArchivo={misChatsApi.archivo(chatId, m.id)} />
                <div className="flex items-center justify-end gap-1 text-[0.6875rem] opacity-70 mt-1">
                  <span>{horaDeMensaje(m.en)}</span>{!deLaClienta && <EstadoDeEnvio estado={m.estado} />}
                </div>
                {m.estado === 'fallido' && (
                  <div className="mt-1 text-[0.6875rem] font-semibold bg-black/20 rounded-lg px-2 py-1">No se envió{m.motivoFallo ? `: ${m.motivoFallo}` : ''}</div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {sugerenciaVigente && !bloqueado && (
        <div className="px-3 py-2 bg-purple-50 dark:bg-purple-950/40 border-t border-purple-200/70 dark:border-purple-900 flex items-start gap-2 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-purple-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[0.6875rem] font-bold text-purple-700 dark:text-purple-300">Lalan sugiere responder:</div>
            <p className="text-[0.75rem] text-slate-700 dark:text-neutral-200 whitespace-pre-wrap line-clamp-3">{sugerenciaVigente.texto}</p>
          </div>
          <button type="button" onClick={() => setTexto(sugerenciaVigente.texto)} className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-[0.6875rem] font-bold shrink-0 cursor-pointer">Usar</button>
        </div>
      )}

      {sinTurno && (
        <p role="status" className="px-4 py-3 border-t border-slate-200 dark:border-neutral-800 text-[0.8125rem] text-slate-600 dark:text-neutral-300 shrink-0">{sinTurno}</p>
      )}
      {chat?.pausado && !sinTurno && (
        <div role="alert" className="px-4 py-3 border-t border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 text-[0.8125rem] text-rose-800 dark:text-rose-200 flex items-start gap-2 shrink-0">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <p><b>Lalan pausó este chat</b> y avisó a la administración. No puedes escribir hasta que lo revisen.</p>
        </div>
      )}
      {chat && !chat.ventanaAbierta && !chat.pausado && !sinTurno && (
        <div className="px-4 py-3 border-t border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-[0.8125rem] text-amber-800 dark:text-amber-200 space-y-2 shrink-0">
          <p>Pasaron más de 24 horas desde su último mensaje: no se le puede escribir hasta que ella vuelva a escribir.</p>
          {chat.puedePlantilla && (
            <button type="button" disabled={enviando} onClick={() => void plantilla()} className="min-h-[40px] px-3 rounded-xl bg-amber-500 text-white text-[0.8125rem] font-bold disabled:opacity-60 cursor-pointer">
              Mandarle un aviso por WhatsApp
            </button>
          )}
        </div>
      )}
      {!bloqueado && (
        <form onSubmit={enviar} className="p-3 px-4 glass-ios border-t border-slate-200/70 dark:border-neutral-800/80 flex items-center gap-2 shrink-0 pb-safe-tab">
          <input type="text" value={texto} onChange={e => setTexto(e.target.value)} placeholder={`Escríbele a ${chat?.clienta.split(' ')[0] ?? 'la clienta'}…`} aria-label="Mensaje para la clienta"
            className="flex-1 px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.875rem] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
          <button type="submit" disabled={!texto.trim() || enviando} aria-label="Enviar"
            className="w-10 h-10 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center disabled:opacity-40 cursor-pointer shadow-sm">
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      )}
    </div>
  );
};
