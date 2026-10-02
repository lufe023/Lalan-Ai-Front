import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { AusenciaEspecialista, MotivoAusencia } from '../types';

/**
 * Las ausencias que todavía no terminan (vacaciones, días libres, unas
 * horas) y el catálogo de motivos. `staffId` = solo las de esa persona.
 */
export function useAusencias(staffId?: string) {
  const [ausencias, setAusencias] = useState<AusenciaEspecialista[]>([]);
  const [motivos, setMotivos] = useState<MotivoAusencia[]>([]);

  const recargar = useCallback(async () => {
    try {
      setAusencias(await api.get<AusenciaEspecialista[]>(`/salon/ausencias${staffId ? `?staffId=${staffId}` : ''}`) ?? []);
    } catch { /* sin conexión: se queda lo que había */ }
  }, [staffId]);

  useEffect(() => {
    void recargar();
    api.get<MotivoAusencia[]>('/salon/ausencias/motivos').then(m => setMotivos(m ?? [])).catch(() => {});
  }, [recargar]);

  const motivo = useCallback((id: string) => motivos.find(m => m.id === id)?.descripcion ?? 'No viene', [motivos]);
  return { ausencias, motivos, motivo, recargar };
}
