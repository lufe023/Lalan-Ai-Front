import React, { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import type { Conversation } from '../../types';

/**
 * Turno fuera de horario para ESTA clienta (una emergencia, un evento).
 *
 * Lalan nunca agenda fuera del horario por su cuenta: si la clienta lo pide,
 * pasa el chat a una persona. La dueña lo autoriza aquí (o contestándole a
 * Lalan "agéndala igual") y durante 24 horas Lalan puede ofrecerle cualquier
 * hora libre. Solo la dueña o la administración lo autorizan; el resto del
 * equipo ve que está autorizado.
 */
export const TurnoEspecial: React.FC<{ conversacion: Conversation; puedeAutorizar: boolean; children?: React.ReactNode }> = ({ conversacion, puedeAutorizar, children }) => {
  const { showToast } = useApp();
  const [estado, setEstado] = useState<{ hasta: string | null; por: string | null } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const hasta = estado ? estado.hasta : conversacion.fueraDeHorarioHasta ?? null;
  const por = estado ? estado.por : conversacion.fueraDeHorarioPor ?? null;
  const vigente = !!hasta && new Date(hasta).getTime() > Date.now();

  if (!vigente && !puedeAutorizar) return null;

  const cambiar = async (autorizar: boolean) => {
    setOcupado(true);
    try {
      const r = await api.post<{ fueraDeHorarioHasta: string | null; fueraDeHorarioPor: string | null }>(
        `/chat/panel/conversaciones/${conversacion.id}/fuera-de-horario`, { autorizar });
      setEstado({ hasta: r.fueraDeHorarioHasta, por: r.fueraDeHorarioPor });
      showToast(autorizar ? 'Turno especial autorizado' : 'Autorización quitada',
        autorizar ? 'Lalan le preguntará qué día y hora le conviene.' : 'Lalan vuelve a agendar solo dentro del horario.', 'success');
    } catch (e: any) {
      showToast('No se pudo cambiar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally {
      setOcupado(false);
    }
  };

  const cuando = hasta ? new Date(hasta).toLocaleString('es-DO', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : '';
  return (
    <div className={`px-4 py-1.5 flex items-center gap-2 text-[10.5px] border-t ${vigente
      ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-200/70 dark:border-violet-900 text-violet-800 dark:text-violet-200'
      : 'bg-white dark:bg-neutral-950 border-slate-100 dark:border-neutral-900 text-slate-500 dark:text-neutral-400'}`}>
      <CalendarClock className="w-3.5 h-3.5 shrink-0" />
      {vigente ? (
        <span className="flex-1 min-w-0">
          <span className="font-bold">Turno fuera de horario autorizado</span>
          {por ? ` por ${por}` : ''} · hasta {cuando}
        </span>
      ) : (
        <span className="flex-1 min-w-0">¿Pide un turno fuera de horario?</span>
      )}
      {puedeAutorizar && (
        <button type="button" disabled={ocupado} onClick={() => void cambiar(!vigente)}
          className="shrink-0 font-bold underline disabled:opacity-50 cursor-pointer">
          {vigente ? 'Quitar' : 'Autorizar 24 h'}
        </button>
      )}
      {children}
    </div>
  );
};
