import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { URL_API } from '../../services/api';
import type { Client } from '../../types';

const NOMBRE_CANAL: Record<string, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger' };
/** La imagen de iniciales que pone la app cuando un chat no tiene foto: no se ofrece */
const RELLENO = /^https?:\/\/ui-avatars\.com\//;

/** Al servidor se le guarda la ruta como la dio él (sin la dirección de la API delante) */
const rutaDelServidor = (url: string) => (url.startsWith(`${URL_API}/`) ? url.slice(URL_API.length + 1) : url);

/**
 * Las fotos de perfil que la clienta tiene en cada canal (las que Lalan
 * guardó de sus chats de Instagram y Messenger): el salón toca la que
 * prefiere y esa queda en su ficha. WhatsApp no da la foto de nadie, así
 * que de ahí nunca sale una.
 */
export const ElegirFotoDeCanal: React.FC<{ clienta: Client; onCambio: (avatar: string) => void }> = ({ clienta, onCambio }) => {
  const { conversations, updateClient } = useApp();
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vistas = new Set<string>();
  const fotos = conversations
    .flatMap(c => (c.clientId === clienta.id && c.fotoDelCanal && !RELLENO.test(c.fotoDelCanal) ? [{ ...c, foto: c.fotoDelCanal }] : []))
    .filter(c => (vistas.has(c.foto) ? false : (vistas.add(c.foto), true)));
  if (!fotos.length || (fotos.length === 1 && fotos[0].foto === clienta.avatar)) return null;

  const elegir = async (url: string) => {
    if (url === clienta.avatar || guardando) return;
    setGuardando(url); setError(null);
    try {
      await updateClient(clienta.id, { avatar: rutaDelServidor(url) });
      onCambio(url);
    } catch {
      setError('No se pudo cambiar la foto. Intenta de nuevo.');
    } finally {
      setGuardando(null);
    }
  };

  return (
    <div>
      <span className="text-[0.6875rem] uppercase font-bold text-slate-400 block mb-1.5">Foto de la ficha</span>
      <div className="flex flex-wrap gap-3">
        {fotos.map(c => {
          const actual = c.foto === clienta.avatar;
          return (
            <button
              key={c.id} type="button" onClick={() => elegir(c.foto)} disabled={!!guardando}
              title={actual ? 'Es la foto de la ficha' : `Usar la foto de ${NOMBRE_CANAL[c.channel] ?? c.channel}`}
              className="flex flex-col items-center gap-1 cursor-pointer disabled:cursor-wait ios-touch"
            >
              <span className="relative">
                <img
                  src={c.foto} alt={`Foto de ${NOMBRE_CANAL[c.channel] ?? c.channel}`}
                  className={`w-12 h-12 rounded-full object-cover border-2 ${actual ? 'border-[var(--primary)]' : 'border-transparent opacity-80 hover:opacity-100'} ${guardando === c.foto ? 'animate-pulse' : ''}`}
                />
                {actual && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[var(--primary)] text-white flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </span>
              <span className="text-[0.6875rem] font-semibold text-slate-500 dark:text-neutral-400">{NOMBRE_CANAL[c.channel] ?? c.channel}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="text-[0.6875rem] text-rose-600 mt-1">{error}</p>}
    </div>
  );
};
