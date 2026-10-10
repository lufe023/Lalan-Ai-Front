import React from 'react';
import { MapPin } from 'lucide-react';
import { useSedeActiva } from '../../context/SedeActivaContext';

/**
 * En qué sedes ha estado una clienta (citas, compras o chats). Con una sola
 * sede no dice nada; si ha estado en todas, una sola etiqueta.
 */
export const SedesDeClienta: React.FC<{ sedes?: string[]; className?: string }> = ({ sedes: suyas, className = '' }) => {
  const { varias, sedes } = useSedeActiva();
  if (!varias || !suyas?.length) return null;
  const nombres = sedes.filter(s => suyas.includes(s.id)).map(s => s.name);
  if (!nombres.length) return null;
  const etiquetas = nombres.length === sedes.length ? ['Todas las sedes'] : nombres;
  return (
    <span className={`inline-flex flex-wrap gap-1 ${className}`}>
      {etiquetas.map(n => (
        <span key={n} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-[0.6875rem] font-semibold">
          <MapPin className="w-2.5 h-2.5" /> {n}
        </span>
      ))}
    </span>
  );
};
