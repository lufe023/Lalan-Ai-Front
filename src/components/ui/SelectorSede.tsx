import React from 'react';
import type { Sede } from '../../hooks/useSedes';

interface SelectorSedeProps {
  sedes: Sede[];
  /** '' = todas (si se ofrecen) o la principal */
  value: string;
  onChange: (sede: string) => void;
  /** Ofrecer "Todas las sedes" (informes); la caja y los canales son de una sola */
  todas?: boolean;
  className?: string;
}

/** El selector de sede de la cadena. Con una sola sede no se muestra */
export const SelectorSede: React.FC<SelectorSedeProps> = ({ sedes, value, onChange, todas = false, className = '' }) => {
  if (sedes.length < 2) return null;
  return (
    <select
      value={value || (todas ? '' : sedes[0].id)}
      onChange={e => onChange(e.target.value)}
      aria-label="Sede"
      className={`px-2 py-1.5 rounded-full text-[0.75rem] bg-slate-100 dark:bg-neutral-800 border-0 ${className}`}
    >
      {todas && <option value="">Todas las sedes</option>}
      {sedes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );
};
