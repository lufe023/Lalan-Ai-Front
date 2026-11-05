import React from 'react';
import { MessageCircle, Sparkles, Store } from 'lucide-react';
import { IOSToggle } from '../ui/IOSToggle';
import { hora12 } from '../../utils/hora';
import type { DiaDeHorario, HorarioExtra as HorarioExtraDatos } from '../../types';

/**
 * El horario extra de la sede: un rato antes de abrir o después de cerrar
 * que la dueña abre cuando quiere, como último recurso ("abro de 9 a 7, pero
 * si una clienta solo puede a las 7:30, la atiendo").
 *
 * Encendido, la Vitrina lo muestra aparte como «Horario extendido» y Lalan lo
 * ofrece en los chats como un espacio especial. Apagado, no existe. Es de
 * cada sede y se guarda al momento, como el horario de la semana.
 */

export const HORARIO_EXTRA_INICIAL: HorarioExtraDatos = {
  activo: false, antesMin: 0, despuesMin: 60, soloSiLleno: true, enVitrina: true, enChat: true,
};

const DESPUES = [30, 60, 90, 120] as const;
const ANTES = [0, 30, 60] as const;

/** 90 → "1 h 30"; 30 → "30 min" */
function corto(min: number): string {
  if (!min) return 'No';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h${m ? ` ${m}` : ''}` : `${m} min`;
}

const sumar = (hhmm: string, min: number) => {
  const [h, m] = hhmm.split(':').map(Number);
  const t = Math.max(0, Math.min(24 * 60 - 1, h * 60 + m + min));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

const CHIP = 'px-3 py-1.5 rounded-xl text-[0.75rem] font-bold tabular-nums transition ios-touch cursor-pointer';
const chip = (activo: boolean) => `${CHIP} ${activo
  ? 'bg-[var(--primary)] text-white shadow-sm'
  : 'bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-300'}`;

export const HorarioExtra: React.FC<{
  valor?: HorarioExtraDatos | null;
  /** La semana de la sede, para el ejemplo con sus horas de verdad */
  semana: DiaDeHorario[];
  /** El nombre de la sede si el salón tiene varias (se dice de cuál es) */
  sede?: string | null;
  onGuardar: (v: HorarioExtraDatos) => void;
}> = ({ valor, semana, sede, onGuardar }) => {
  const e = { ...HORARIO_EXTRA_INICIAL, ...(valor ?? {}) };
  const cambiar = (parte: Partial<HorarioExtraDatos>) => onGuardar({ ...e, ...parte });

  // El ejemplo con el primer día abierto: "cierras a las 7:00 p. m.; con el extra, hasta las 8:00 p. m."
  const dia = semana.find(d => d.abierto && d.tramos.length);
  const abre = dia?.tramos[0].desde;
  const cierra = dia?.tramos[dia.tramos.length - 1].hasta;
  const ejemplo = abre && cierra ? [
    e.despuesMin ? `cierras a las ${hora12(cierra)}; se puede reservar hasta las ${hora12(sumar(cierra, e.despuesMin))}` : '',
    e.antesMin ? `abres a las ${hora12(abre)}; se puede reservar desde las ${hora12(sumar(abre, -e.antesMin))}` : '',
  ].filter(Boolean).join(' y ') : '';
  const sinCanal = !e.enVitrina && !e.enChat;

  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
            <Sparkles className="w-4 h-4 text-[var(--primary)]" />
            <span>Horario extra{sede ? ` · ${sede}` : ''}</span>
          </div>
          <p className="mt-0.5 text-[0.75rem] text-slate-500 dark:text-slate-400 leading-snug">
            Un rato fuera de tu horario que abres tú, como último recurso. Si una clienta solo puede a última hora, tu Vitrina y Lalan se lo ofrecen.
          </p>
        </div>
        <IOSToggle checked={e.activo} onChange={activo => cambiar({ activo })} ariaLabel="Horario extra" />
      </div>

      {e.activo && (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/60 dark:border-neutral-700/60 space-y-3">
          <div className="space-y-1.5">
            <p className="text-[0.75rem] font-bold text-slate-800 dark:text-slate-200">Cerrar más tarde</p>
            <div className="flex flex-wrap gap-1.5">
              {[0, ...DESPUES].map(m => (
                <button key={m} type="button" className={chip(e.despuesMin === m)} aria-pressed={e.despuesMin === m}
                  onClick={() => cambiar({ despuesMin: m })}>{corto(m)}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[0.75rem] font-bold text-slate-800 dark:text-slate-200">Abrir más temprano</p>
            <div className="flex flex-wrap gap-1.5">
              {ANTES.map(m => (
                <button key={m} type="button" className={chip(e.antesMin === m)} aria-pressed={e.antesMin === m}
                  onClick={() => cambiar({ antesMin: m })}>{corto(m)}</button>
              ))}
            </div>
          </div>

          {ejemplo && (
            <p className="text-[0.75rem] text-slate-600 dark:text-slate-300 leading-snug">
              Por ejemplo, el {dia ? ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][dia.dia] : 'día'} {ejemplo}{ejemplo.endsWith('.') ? '' : '.'}
            </p>
          )}
          {!e.antesMin && !e.despuesMin && (
            <p className="text-[0.75rem] font-semibold text-amber-700 dark:text-amber-300">Elige cuánto quieres alargar: así no se abre nada.</p>
          )}

          <label className="flex items-start gap-3 pt-2 border-t border-slate-200/70 dark:border-neutral-700/70">
            <span className="flex-1 min-w-0">
              <span className="block text-[0.75rem] font-bold text-slate-800 dark:text-slate-200">Solo cuando el día ya esté lleno</span>
              <span className="block text-[0.6875rem] text-slate-500 dark:text-slate-400">Primero se ofrecen tus horas de siempre; el rato extra, cuando ya no queda ninguna.</span>
            </span>
            <IOSToggle checked={e.soloSiLleno} onChange={soloSiLleno => cambiar({ soloSiLleno })} ariaLabel="Solo cuando el día ya esté lleno" />
          </label>
          <label className="flex items-center gap-3">
            <Store className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="flex-1 text-[0.75rem] font-bold text-slate-800 dark:text-slate-200">En tu Vitrina</span>
            <IOSToggle checked={e.enVitrina} onChange={enVitrina => cambiar({ enVitrina })} ariaLabel="Ofrecerlo en la Vitrina" />
          </label>
          <label className="flex items-center gap-3">
            <MessageCircle className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="flex-1 text-[0.75rem] font-bold text-slate-800 dark:text-slate-200">Con Lalan en los chats</span>
            <IOSToggle checked={e.enChat} onChange={enChat => cambiar({ enChat })} ariaLabel="Ofrecerlo en los chats" />
          </label>
          {sinCanal && (
            <p className="text-[0.75rem] font-semibold text-amber-700 dark:text-amber-300">Así solo tu equipo puede agendar en ese rato, desde la agenda.</p>
          )}
        </div>
      )}
    </div>
  );
};
