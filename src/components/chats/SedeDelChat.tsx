import React, { useState } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import { CHIP_AMBAR, CHIP_CHAT, CHIP_NEUTRO } from './chipsDelChat';
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
 * Es un chip de la fila de herramientas de arriba del chat.
 */
export const SedeDelChat: React.FC<{ conversacion: Conversation }> = ({ conversacion }) => {
  const { showToast, recargarConversaciones } = useApp();
  // Cualquiera del equipo puede pasar un chat a otra sede, también quien está atada a una
  const sedes = useSedes({ todasLasDelSalon: true });
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

  const texto = conversacion.sedePorElegir ? 'Sede por elegir' : actual?.name ?? 'Otra sede';
  return (
    /* Un chip que abre la lista de sedes del teléfono: un toque y se elige */
    <label
      title={conversacion.sedePorElegir ? 'Lalan le pregunta en cuál quiere atenderse. Puedes elegirla tú.' : `Se atiende en ${texto}. Toca para pasarlo a otra sede.`}
      className={`${CHIP_CHAT} ${conversacion.sedePorElegir ? CHIP_AMBAR : CHIP_NEUTRO} relative max-w-[13rem] ${ocupado ? 'opacity-60' : ''}`}
    >
      <MapPin className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{texto}</span>
      <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
      <select
        value="" disabled={ocupado} onChange={e => void pasar(e.target.value)}
        aria-label={conversacion.sedePorElegir ? 'Elegir la sede de este chat' : `Se atiende en ${texto}. Pasar a otra sede`}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        <option value="">{conversacion.sedePorElegir ? 'Elegir sede…' : 'Pasar a…'}</option>
        {sedes.filter(s => s.id !== conversacion.locationId || conversacion.sedePorElegir).map(s => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </label>
  );
};
