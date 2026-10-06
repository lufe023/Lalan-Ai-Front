import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { ajustesLalan, esferaPropia, guardarEsferaPropia } from '../../utils/ajustesLalan';
import { COLORES_ESFERA, ESTILOS_ESFERA, EsferaLalan, type ColorEsfera, type EstiloEsfera } from './EsferaLalan';

/**
 * "Cómo se ve Lalan": cada persona elige la forma y el color de su esfera
 * (en su menú de Lalan). Se ven moviéndose para elegir viéndolas. Lo de
 * Plataforma queda como lo que viene de fábrica.
 */
export const ElegirEsfera: React.FC = () => {
  const [propia, setPropia] = useState(esferaPropia);
  const aj = ajustesLalan();
  const forma = (propia.forma ?? aj.estiloEsfera) as EstiloEsfera;
  const color = (propia.color ?? aj.colorEsfera) as ColorEsfera;
  const elegir = (cambio: { forma?: string | null; color?: string | null }) => {
    guardarEsferaPropia(cambio);
    setPropia({ ...esferaPropia() });
  };
  const titulo = 'text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400 mb-1.5';

  return (
    <div className="px-3 pt-2 pb-1 space-y-2">
      <div className={titulo}>Cómo me veo</div>
      <div className="grid grid-cols-3 gap-1">
        {(Object.keys(ESTILOS_ESFERA) as EstiloEsfera[]).map((id) => (
          <button key={id} type="button" onClick={() => elegir({ forma: id })} aria-pressed={forma === id}
            className={`flex flex-col items-center gap-0.5 py-1 rounded-xl border-2 cursor-pointer ${forma === id ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-transparent hover:bg-slate-100 dark:hover:bg-neutral-800'}`}>
            <EsferaLalan modo={forma === id ? 'hablando' : 'reposo'} simulada estilo={id} color={color} tamano={44} />
            <span className={`text-[0.6875rem] font-semibold ${forma === id ? 'text-[var(--primary)]' : 'text-slate-500'}`}>{ESTILOS_ESFERA[id]}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {(Object.keys(COLORES_ESFERA) as ColorEsfera[]).map((id) => (
          <button key={id} type="button" onClick={() => elegir({ color: id })} aria-pressed={color === id} title={COLORES_ESFERA[id]} aria-label={`Color ${COLORES_ESFERA[id]}`}
            className={`relative rounded-full cursor-pointer ring-offset-2 ring-offset-white dark:ring-offset-neutral-900 ${color === id ? 'ring-2 ring-[var(--primary)]' : ''}`}>
            <EsferaLalan modo="reposo" estilo="perla" color={id} tamano={30} />
            {color === id && <Check className="absolute inset-0 m-auto w-3.5 h-3.5 text-white drop-shadow" />}
          </button>
        ))}
      </div>
      {(propia.forma || propia.color) && (
        <button type="button" onClick={() => elegir({ forma: null, color: null })} className="text-[0.75rem] font-semibold text-slate-500 hover:text-[var(--primary)] cursor-pointer">
          Volver a la de siempre
        </button>
      )}
    </div>
  );
};
