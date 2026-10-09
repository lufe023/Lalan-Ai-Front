import { useEffect, useState } from 'react';
import { api } from '../services/api';

export interface Sede { id: string; name: string }

/** Las sedes del salón. Con una sola, las pantallas no muestran selector */
export function useSedes() {
  const [sedes, setSedes] = useState<Sede[]>([]);
  useEffect(() => {
    api.get<Sede[]>('/users/sedes').then(s => setSedes(s ?? [])).catch(() => setSedes([]));
  }, []);
  return sedes;
}
