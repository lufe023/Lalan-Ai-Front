import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { useSedes } from '../../hooks/useSedes';
import type { Conversation } from '../../types';

/**
 * En qué sede se atiende este chat (solo en un salón con varias).
 *
 * Por un número o un Instagram de todas las sedes, Lalan le pregunta a la
 * clienta en cuál quiere atenderse y pasa el chat ahí. Si escribió al
 * número de una sede pero va a otra, aquí el equipo lo pasa a mano.
 */
export const SedeDelChat: React.FC<{ conversacion: Conversation }> = ({ conversacion }) => {
  const { showToast, recargarConversaciones } = useApp();
  const sedes = useSedes();
  const [ocupado, setOcupado] = useState(false);
  if (sedes.length < 2) return null;

  const actual = sedes.find(s => s.id === conversacion.locationId);
  const pasar = async (locationId: string) => {
    if (!locationId || (locationId === conversacion.locationId && !conversacion.sedePorElegir)) return;
    setOcupado(true);
    try {
      await api.patch(`/conversations/${conversacion.id}/sede`, { locationId });
      await recargarConversaciones();
      showToast('Chat pasado de sede', `Ahora se atiende en ${sedes.find(s => s.id === locationId)?.name ?? 'esa sede'}.`, 'success');
    } catch (e: any) {
      showToast('No se pudo pasar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="border-t border-slate-100 dark:border-neutral-900 bg-white dark:bg-neutral-950 text-[0.75rem] text-slate-500 dark:text-neutral-400">
      <div className="px-4 py-1.5 flex items-center gap-2">
        <MapPin className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 min-w-0 truncate">
          {conversacion.sedePorElegir
            ? 'Sede por elegir: Lalan le pregunta en cuál quiere atenderse'
            : `Se atiende en ${actual?.name ?? 'otra sede'}`}
        </span>
        <select
          value="" disabled={ocupado} onChange={e => void pasar(e.target.value)}
          aria-label="Pasar a otra sede"
          className="shrink-0 font-bold underline bg-transparent border-0 cursor-pointer"
        >
          <option value="">{conversacion.sedePorElegir ? 'Elegir sede…' : 'Pasar a…'}</option>
          {sedes.filter(s => s.id !== conversacion.locationId || conversacion.sedePorElegir).map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
};
