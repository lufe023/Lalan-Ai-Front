import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import { useSedeActiva } from '../../context/SedeActivaContext';

/**
 * En qué sede entra o se ajusta la mercancía.
 *
 * Con una sede activa (o una sola sede) ya se sabe y no se pregunta: el
 * servidor la toma de la sede activa. En "Todas las sedes", con varias, hay
 * que elegir: antes la mercancía caía en silencio en la primera sede.
 */
export function useSedeDelStock() {
  const { varias, actual } = useSedeActiva();
  const [sede, setSede] = useState('');
  const pregunta = varias && !actual;
  return {
    /** Lo que se manda como `locationId` ('' = la decide la sede activa) */
    sede: pregunta ? sede : '',
    setSede,
    /** ¿Hay que mostrar el selector? */
    pregunta,
    /** Falta elegir: no se puede guardar todavía */
    falta: pregunta && !sede,
  };
}

const campo = 'w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.875rem]';

export const SedeDelStock: React.FC<{
  value: string;
  onChange: (id: string) => void;
  /** Lo que se pregunta, por ejemplo "¿En qué sede entra?" */
  etiqueta?: string;
}> = ({ value, onChange, etiqueta = '¿En qué sede entra la mercancía?' }) => {
  const { varias, actual, sedes } = useSedeActiva();
  if (!varias) return null;

  if (actual) {
    return (
      <p className="flex items-center gap-1.5 text-[0.75rem] text-slate-500 dark:text-neutral-400">
        <MapPin className="w-3.5 h-3.5 text-[var(--primary)]" /> Entra en <b className="text-slate-700 dark:text-neutral-200">{actual.name}</b>
      </p>
    );
  }

  return (
    <label className="block">
      <span className="text-[0.75rem] text-slate-500">{etiqueta}</span>
      <select className={campo} value={value} onChange={e => onChange(e.target.value)} aria-label="Sede">
        <option value="" disabled>Elige la sede</option>
        {sedes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </label>
  );
};
