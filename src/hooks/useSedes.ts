import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { sedePropia } from '../services/sedeLocal';

export interface Sede { id: string; name: string }

/**
 * Las sedes que esta persona puede elegir. Con una sola, las pantallas no
 * muestran selector: quien está atada a una sede solo ve la suya (el servidor
 * ignoraría cualquier otra).
 */
export function useSedes(opciones?: { todasLasDelSalon?: boolean }) {
  const todas = !!opciones?.todasLasDelSalon;
  const [sedes, setSedes] = useState<Sede[]>([]);
  useEffect(() => {
    const propia = todas ? null : sedePropia();
    api.get<Sede[]>('/users/sedes')
      .then(s => setSedes((s ?? []).filter(x => !propia || x.id === propia)))
      .catch(() => setSedes([]));
  }, [todas]);
  return sedes;
}
