import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import { usePlan } from '../../context/PlanContext';

/**
 * El interruptor «Sale en la Vitrina» de un servicio, producto u oferta. Va al
 * lado del de la asistente porque es la misma pregunta: qué se publica. Sin la
 * Vitrina en el plan no aparece.
 */
export const SaleEnVitrina: React.FC<{ activo: boolean; cambiar: (v: boolean) => Promise<unknown> | void; que?: string }> = ({ activo, cambiar, que = 'Sale en la Vitrina' }) => {
  const { tieneModulo } = usePlan();
  const [ocupado, setOcupado] = useState(false);
  if (!tieneModulo('vitrina')) return null;
  const alternar = async () => {
    setOcupado(true);
    try { await cambiar(!activo); } finally { setOcupado(false); }
  };
  return (
    <div data-guia="sale-en-vitrina" className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-neutral-800/60 text-xs">
      <div className="flex items-center gap-1.5">
        <Globe className={`w-4 h-4 ${activo ? 'text-fuchsia-500' : 'text-slate-400'}`} />
        <span className="text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-300">{activo ? que : 'No sale en la Vitrina'}</span>
      </div>
      <button
        type="button" onClick={alternar} disabled={ocupado} aria-pressed={activo}
        className={`px-3 py-1 rounded-full text-[0.6875rem] font-extrabold transition ios-touch cursor-pointer disabled:opacity-60 ${
          activo ? 'bg-fuchsia-500 text-white shadow-xs' : 'bg-slate-200 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400'
        }`}
      >
        {activo ? '✓ Publicado' : 'Oculto'}
      </button>
    </div>
  );
};
