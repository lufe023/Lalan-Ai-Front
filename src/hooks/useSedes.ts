import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { sedeActiva, sedePropia } from '../services/sedeActiva';

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
    // Con una sede activa (menú de la cuenta) la pantalla ya está en esa sede: sin selector propio
    const propia = todas ? null : (sedePropia() ?? (sedeActiva() || null));
    api.get<Sede[]>('/users/sedes')
      .then(s => setSedes((s ?? []).filter(x => !propia || x.id === propia)))
      .catch(() => setSedes([]));
  }, [todas]);
  return sedes;
}
