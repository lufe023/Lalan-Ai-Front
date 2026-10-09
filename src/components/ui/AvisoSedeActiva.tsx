import React from 'react';
import { MapPin } from 'lucide-react';
import { useSedeActiva } from '../../context/SedeActivaContext';

/**
 * Arriba de lo que se configura por sede (horario, zonas, especialistas):
 * dice de qué sede es lo que se ve. En "Todas las sedes" ofrece entrar a
 * una, porque cada sede tiene lo suyo. Con una sola sede no se muestra.
 */
export const AvisoSedeActiva: React.FC<{ que?: string; enTodas?: string }> = ({
  que = 'El horario, las zonas y las especialistas de abajo son de esta sede.',
  enTodas = 'Estás viendo todas las sedes. Cada sede tiene su propio horario, sus zonas y sus especialistas: elige cuál quieres configurar.',
}) => {
  const { varias, actual, fija, sedes, elegir } = useSedeActiva();
  if (!varias) return null;

  if (actual) {
    return (
      <div className="p-3 rounded-2xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-start gap-2.5">
        <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-[var(--primary)]" />
        <p className="text-[0.8125rem] text-slate-700 dark:text-neutral-200">
          Estás en <b>{actual.name}</b>. {que}
          {!fija && <span className="text-slate-500 dark:text-neutral-400"> Para otra sede, toca tu foto arriba a la derecha.</span>}
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 space-y-2">
      <p className="text-[0.8125rem] text-amber-800 dark:text-amber-200">
        {enTodas}
      </p>
      <div className="flex flex-wrap gap-2">
        {sedes.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => elegir(s.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-500/30 text-[0.8125rem] font-semibold text-slate-800 dark:text-neutral-100 cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5" /> {s.name}
          </button>
        ))}
      </div>
    </div>
  );
};
