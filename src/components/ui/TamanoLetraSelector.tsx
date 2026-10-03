import React, { useState } from 'react';
import { Type } from 'lucide-react';
import { elegirTamano, TAMANOS_LETRA, tamanoGuardado, TamanoLetra } from '../../utils/tamanoLetra';

/** Ajustes → Mi cuenta: letra más grande para quien la necesite (solo en este teléfono) */
export const TamanoLetraSelector: React.FC = () => {
  const [actual, setActual] = useState<TamanoLetra>(tamanoGuardado);
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3 text-slate-900 dark:text-neutral-100">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center"><Type className="w-4 h-4" /></div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">Tamaño de la letra</h3>
          <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">Solo cambia en este teléfono.</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tamaño de la letra">
        {TAMANOS_LETRA.map((t, i) => (
          <button key={t.id} type="button" role="radio" aria-checked={actual === t.id}
            onClick={() => { elegirTamano(t.id); setActual(t.id); }}
            className={`py-3 rounded-xl border flex flex-col items-center gap-1 cursor-pointer ${actual === t.id ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700'}`}>
            <span className="font-bold leading-none" style={{ fontSize: `${1 + i * 0.3}rem` }}>Aa</span>
            <span className="text-[0.75rem] font-semibold">{t.descripcion}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
