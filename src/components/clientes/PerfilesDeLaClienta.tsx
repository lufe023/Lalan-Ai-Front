import React from 'react';
import { ExternalLink, MessageCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Client, CommunicationChannel } from '../../types';

const NOMBRE_CANAL: Record<string, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger' };
const COLOR_CANAL: Record<string, string> = {
  whatsapp: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/70 dark:border-emerald-900',
  instagram: 'text-pink-700 dark:text-pink-300 bg-pink-50 dark:bg-pink-950/40 border-pink-200/70 dark:border-pink-900',
  messenger: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200/70 dark:border-blue-900',
};
const CHIP = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[0.75rem] font-semibold';

/**
 * Dónde está la clienta: su chat en cada canal (dentro de Lalan) y su
 * perfil público cuando existe. Instagram tiene enlace por su @usuario;
 * WhatsApp abre el chat con su número. Messenger no da un enlace al perfil
 * de la persona (solo un id de la página), así que ahí solo está el chat.
 */
export const PerfilesDeLaClienta: React.FC<{ clienta: Client }> = ({ clienta }) => {
  const { conversations, setActiveConversationId, navigateTo } = useApp();
  const suyas = conversations.filter(c => c.clientId === clienta.id);
  const digitos = clienta.phone.replace(/\D/g, '');
  const usuariosIg = [...new Set(suyas.filter(c => c.channel === 'instagram' && c.clientHandle).map(c => c.clientHandle!.replace(/^@/, '')))];
  if (!suyas.length && digitos.length < 7) return null;

  const abrirChat = (id: string) => { setActiveConversationId(id); navigateTo('chats'); };
  return (
    <div>
      <span className="text-[0.6875rem] uppercase font-bold text-slate-400 block mb-1.5">Dónde encontrarla</span>
      <div className="flex flex-wrap gap-1.5">
        {suyas.map(c => (
          <button key={c.id} type="button" onClick={() => abrirChat(c.id)} className={`${CHIP} ${COLOR_CANAL[c.channel] ?? ''} cursor-pointer`}>
            <MessageCircle className="w-3 h-3" /> Chat de {NOMBRE_CANAL[c.channel as CommunicationChannel] ?? c.channel}
          </button>
        ))}
        {usuariosIg.map(u => (
          <a key={u} href={`https://www.instagram.com/${encodeURIComponent(u)}/`} target="_blank" rel="noopener noreferrer" className={`${CHIP} ${COLOR_CANAL.instagram}`}>
            @{u} <ExternalLink className="w-3 h-3" />
          </a>
        ))}
        {digitos.length >= 7 && (
          <a href={`https://wa.me/${digitos}`} target="_blank" rel="noopener noreferrer" className={`${CHIP} ${COLOR_CANAL.whatsapp}`}>
            WhatsApp {clienta.phone} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
};
