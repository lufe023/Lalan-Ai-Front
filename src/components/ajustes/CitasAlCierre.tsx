import React from 'react';
import { Moon } from 'lucide-react';
import { hora12 } from '../../utils/hora';
import type { CitasAlCierre as CitasAlCierreDatos, DiaDeHorario } from '../../types';

/**
 * Qué pasa con la última cita del día, la que cae cerca del cierre. Es de
 * cada sede y vale igual en la Vitrina, con Lalan en los chats y en la
 * agenda del equipo.
 *
 * - «Que terminen antes de cerrar»: lo de siempre. Abres de 5 a 8 y el
 *   servicio dura 1 h 15: la última hora es 6:30.
 * - «Pueden pasarse un poco»: hasta X minutos después de cerrar.
 * - «Recibir hasta la hora de cierre»: a las 8 todavía llega una clienta,
 *   dure lo que dure el servicio.
 *
 * Nunca abre horas para EMPEZAR después de cerrar: eso es el horario extra.
 */

export const CITAS_AL_CIERRE_INICIAL: CitasAlCierreDatos = { modo: 'terminan', margenMin: 30 };

const MARGENES = [15, 30, 45, 60] as const;
/** Las citas empiezan cada media hora (la misma cuadrícula de la Vitrina y de Lalan) */
const PASO_MIN = 30;
/** El servicio del ejemplo */
const EJEMPLO_MIN = 60;

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** La última hora en que puede empezar un servicio de `duracion` con esa regla (en la cuadrícula del tramo) */
function ultimaHora(abre: string, cierra: string, duracion: number, v: CitasAlCierreDatos): string | null {
  const a = minutos(abre), c = minutos(cierra);
  const tope = v.modo === 'empiezan' ? c : Math.min(c, c + (v.modo === 'pasarse' ? v.margenMin : 0) - duracion);
  if (tope < a) return null;
  return hhmm(a + Math.floor((tope - a) / PASO_MIN) * PASO_MIN);
}

const OPCIONES: { modo: CitasAlCierreDatos['modo']; titulo: string; texto: string }[] = [
  { modo: 'terminan', titulo: 'Que terminen antes de cerrar', texto: 'Solo se ofrecen las horas en que el servicio termina a tiempo.' },
  { modo: 'pasarse', titulo: 'Pueden pasarse un poco', texto: 'La última cita puede terminar un rato después de cerrar.' },
  { modo: 'empiezan', titulo: 'Recibir hasta la hora de cierre', texto: 'Una clienta puede llegar a la hora de cerrar, dure lo que dure el servicio.' },
];

const CHIP = 'px-3 py-1.5 rounded-xl text-[0.75rem] font-bold tabular-nums transition ios-touch cursor-pointer';
const chip = (activo: boolean) => `${CHIP} ${activo
  ? 'bg-[var(--primary)] text-white shadow-sm'
  : 'bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-300'}`;

export const CitasAlCierre: React.FC<{
  valor?: CitasAlCierreDatos | null;
  /** La semana de la sede, para el ejemplo con sus horas de verdad */
  semana: DiaDeHorario[];
  /** El nombre de la sede si el salón tiene varias (se dice de cuál es) */
  sede?: string | null;
  onGuardar: (v: CitasAlCierreDatos) => void;
}> = ({ valor, semana, sede, onGuardar }) => {
  const v = { ...CITAS_AL_CIERRE_INICIAL, ...(valor ?? {}) };
  const cambiar = (parte: Partial<CitasAlCierreDatos>) => onGuardar({ ...v, ...parte });

  // El ejemplo con el primer día abierto y su último tramo
  const dia = semana.find(d => d.abierto && d.tramos.length);
  const tramo = dia?.tramos[dia.tramos.length - 1];
  const ultima = tramo ? ultimaHora(tramo.desde, tramo.hasta, EJEMPLO_MIN, v) : null;
  const nombreDia = dia ? ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][dia.dia] : '';

  return (
    <div className="space-y-2.5">
      <div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
          <Moon className="w-4 h-4 text-[var(--primary)]" />
          <span>La última cita del día{sede ? ` · ${sede}` : ''}</span>
        </div>
        <p className="mt-0.5 text-[0.75rem] text-slate-500 dark:text-slate-400 leading-snug">
          Qué hacer con los servicios que terminarían después de cerrar. Vale igual en tu Vitrina, con Lalan en los chats y en tu agenda.
        </p>
      </div>

      <div role="radiogroup" aria-label="La última cita del día" className="space-y-1.5">
        {OPCIONES.map(o => {
          const activo = v.modo === o.modo;
          return (
            <button
              key={o.modo}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => cambiar({ modo: o.modo })}
              className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition ios-touch cursor-pointer border ${activo
                ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                : 'border-slate-200/70 dark:border-neutral-700/70 bg-slate-50 dark:bg-neutral-800/60'}`}
            >
              <span className={`mt-0.5 size-4 shrink-0 rounded-full border-2 ${activo ? 'border-[var(--primary)] bg-[var(--primary)] shadow-[inset_0_0_0_2px_white] dark:shadow-[inset_0_0_0_2px_#171717]' : 'border-slate-300 dark:border-neutral-600'}`} />
              <span className="flex-1 min-w-0">
                <span className="block text-[0.75rem] font-bold text-slate-800 dark:text-slate-200">{o.titulo}</span>
                <span className="block text-[0.6875rem] text-slate-500 dark:text-slate-400 leading-snug">{o.texto}</span>
              </span>
            </button>
          );
        })}
      </div>

      {v.modo === 'pasarse' && (
        <div className="space-y-1.5">
          <p className="text-[0.75rem] font-bold text-slate-800 dark:text-slate-200">¿Cuánto después de cerrar?</p>
          <div className="flex flex-wrap gap-1.5">
            {MARGENES.map(m => (
              <button key={m} type="button" className={chip(v.margenMin === m)} aria-pressed={v.margenMin === m}
                onClick={() => cambiar({ margenMin: m })}>{m === 60 ? '1 h' : `${m} min`}</button>
            ))}
          </div>
        </div>
      )}

      {tramo && ultima && (
        <p className="text-[0.75rem] text-slate-600 dark:text-slate-300 leading-snug">
          Por ejemplo, el {nombreDia} cierras a las {hora12(tramo.hasta)}: un servicio de 1 hora la última hora para agendarlo es <b>{hora12(ultima)}</b>
        </p>
      )}
    </div>
  );
};
