import React from 'react';
import { NOMBRE_RECURSO, RECURSOS, type Limites, type Uso } from '../../types/plataforma';

/** Barras de "cuánto lleva de lo que su plan permite" */
export const UsoDelPlan: React.FC<{ uso: Uso; limites: Limites; compacto?: boolean }> = ({ uso, limites, compacto }) => (
  <div className={compacto ? 'space-y-1.5' : 'space-y-2.5'}>
    {RECURSOS.map((r) => {
      const tope = limites[r];
      const p = tope ? Math.min(100, Math.round((uso[r] / tope) * 100)) : 0;
      const color = !tope ? 'bg-slate-300 dark:bg-neutral-700' : p >= 100 ? 'bg-rose-500' : p >= 80 ? 'bg-amber-500' : 'bg-[var(--primary)]';
      return (
        <div key={r}>
          <div className="flex justify-between text-[0.75rem]">
            <span className="text-slate-600 dark:text-neutral-300">{NOMBRE_RECURSO[r]}</span>
            <span className="tabular-nums font-semibold text-slate-900 dark:text-white">
              {uso[r].toLocaleString('es-DO')} {tope !== null ? <span className="text-slate-400 font-normal">de {tope.toLocaleString('es-DO')}</span> : <span className="text-slate-400 font-normal">· sin límite</span>}
            </span>
          </div>
          {!compacto && <div className="h-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 mt-1 overflow-hidden"><div className={`h-full rounded-full ${color}`} style={{ width: `${tope ? p : 100}%`, opacity: tope ? 1 : 0.35 }} /></div>}
        </div>
      );
    })}
  </div>
);
