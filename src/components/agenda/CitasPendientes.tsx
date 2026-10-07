import React, { useMemo } from 'react';
import { AlertTriangle, CalendarClock, ChevronRight } from 'lucide-react';
import type { Appointment, AppointmentStatus } from '../../types';
import { IOSModal } from '../ui/IOSModal';
import { hora12 } from '../../utils/hora';

/** Estados de una cita que todavía no se cerró (ni atendida ni cancelada) */
const ABIERTAS: AppointmentStatus[] = ['pending', 'confirmed', 'confirmed_by_ai', 'attending'];

const momento = (a: Appointment) => (a.startsAt ? new Date(a.startsAt) : new Date(`${a.date}T${a.time || '00:00'}:00`));

/**
 * Las citas que se pueden perder en el tiempo:
 *  - las que ya pasaron y nadie cerró (¿vino?, ¿se cobró?, ¿se canceló?);
 *  - las que vienen y siguen sin confirmar, aunque sean dentro de meses.
 */
export function citasPendientes(citas: Appointment[]) {
  const ahora = Date.now();
  const sinCerrar = citas.filter(a => ABIERTAS.includes(a.status) && momento(a).getTime() < ahora)
    .sort((x, y) => momento(x).getTime() - momento(y).getTime());
  const porConfirmar = citas.filter(a => a.status === 'pending' && momento(a).getTime() >= ahora)
    .sort((x, y) => momento(x).getTime() - momento(y).getTime());
  return { sinCerrar, porConfirmar, total: sinCerrar.length + porConfirmar.length };
}

const Fila: React.FC<{ a: Appointment; onAbrir: (a: Appointment) => void }> = ({ a, onAbrir }) => {
  const f = momento(a);
  return (
    <button type="button" onClick={() => onAbrir(a)}
      className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-neutral-800 hover:border-[var(--primary)] cursor-pointer">
      <div className="w-12 shrink-0 text-center">
        <div className="text-[0.6875rem] uppercase text-slate-400">{f.toLocaleDateString('es-DO', { month: 'short' })}</div>
        <div className="text-lg font-bold leading-none text-slate-900 dark:text-white">{f.getDate()}</div>
        <div className="text-[0.6875rem] text-slate-400">{f.toLocaleDateString('es-DO', { weekday: 'short' })}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[0.875rem] font-bold truncate text-slate-900 dark:text-white">{a.clientName}</div>
        <div className="text-[0.75rem] text-slate-500 truncate">{hora12(a.time)} · {a.serviceName}{a.staffName ? ` · ${a.staffName}` : ''}</div>
        {f.getFullYear() !== new Date().getFullYear() && <div className="text-[0.6875rem] text-slate-400">{f.getFullYear()}</div>}
      </div>
      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
    </button>
  );
};

export const CitasPendientes: React.FC<{ abierto: boolean; onCerrar: () => void; citas: Appointment[]; onAbrir: (a: Appointment) => void }> = ({ abierto, onCerrar, citas, onAbrir }) => {
  const { sinCerrar, porConfirmar } = useMemo(() => citasPendientes(citas), [citas]);
  return (
    <IOSModal isOpen={abierto} onClose={onCerrar} title="Citas pendientes" subtitle="Las que necesitan que hagas algo">
      <div className="space-y-4 p-1">
        {!sinCerrar.length && !porConfirmar.length && (
          <p className="text-[0.875rem] text-slate-500 text-center py-8">Todo al día: no hay citas pendientes. 💜</p>
        )}
        {sinCerrar.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-[0.75rem] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Ya pasaron y siguen sin cerrar ({sinCerrar.length})
            </h4>
            <p className="text-[0.75rem] text-slate-500">Ábrela y marca si vino (y cóbrala), si no vino o si se canceló.</p>
            {sinCerrar.map(a => <Fila key={a.id} a={a} onAbrir={onAbrir} />)}
          </section>
        )}
        {porConfirmar.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-[0.75rem] font-bold uppercase tracking-wider text-[var(--primary)] flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5" /> Vienen y están sin confirmar ({porConfirmar.length})
            </h4>
            {porConfirmar.map(a => <Fila key={a.id} a={a} onAbrir={onAbrir} />)}
          </section>
        )}
      </div>
    </IOSModal>
  );
};
