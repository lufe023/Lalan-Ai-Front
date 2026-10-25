import React, { useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { NOMBRE_PRESENCIA, saberProductosApi, type ComponenteEnProducto } from '../../services/saberProductos';

/**
 * Debajo de la receta de un servicio: qué insumos llevan algo de cuidado según
 * la base de Lalan. Es lo que hará saltar el aviso en la cita de una clienta
 * alérgica. Lee la receta guardada; `version` cambia al guardarla.
 */
export const RiesgosDeReceta: React.FC<{ serviceId: string; version: string; nombres: Record<string, string> }> = ({ serviceId, version, nombres }) => {
  const [filas, setFilas] = useState<{ productId: string; conocido: string; componentes: ComponenteEnProducto[] }[]>([]);
  useEffect(() => {
    saberProductosApi.riesgosDeServicio(serviceId).then(setFilas).catch(() => setFilas([]));
  }, [serviceId, version]);
  if (!filas.length) return null;
  return (
    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1.5">
      <p className="text-[0.75rem] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
        <FlaskConical className="w-3.5 h-3.5 text-amber-500" /> Lo que llevan estos insumos
      </p>
      {filas.map((f) => (
        <p key={f.productId} className="text-[0.75rem] text-slate-700 dark:text-neutral-200">
          <b>{nombres[f.productId] ?? f.conocido}</b>: {f.componentes.map((c) => `${c.componente} (${c.presencia === 'marca' ? c.marca : NOMBRE_PRESENCIA[c.presencia].toLowerCase()})`).join(', ')}
        </p>
      ))}
      <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">Si una clienta con cita es alérgica a algo de esto, el equipo lo verá en su cita.</p>
    </div>
  );
};
