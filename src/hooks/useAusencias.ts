import { useCallback, useEffect, useState } from 'react';
import { api, tokenStore } from '../services/api';
import type { AusenciaEspecialista, MotivoAusencia } from '../types';

/**
 * Las ausencias que todavía no terminan (vacaciones, días libres, unas
 * horas) y el catálogo de motivos. `staffId` = solo las de esa persona.
 */
/**
 * Lo último que llegó, por sesión y persona. Al volver a la Agenda se pinta
 * enseguida y luego se refresca: sin esto, el aviso "Este día: …" aparecía
 * un instante después y empujaba la lista hacia abajo. La clave lleva la
 * sesión para que otra cuenta en el mismo navegador nunca vea lo de esta.
 */
const ultimas = new Map<string, { ausencias: AusenciaEspecialista[]; motivos: MotivoAusencia[] }>();
const claveDe = (staffId?: string) => `${tokenStore.getRefresh() ?? ''}|${staffId ?? ''}`;

export function useAusencias(staffId?: string) {
  const [ausencias, setAusencias] = useState<AusenciaEspecialista[]>(() => ultimas.get(claveDe(staffId))?.ausencias ?? []);
  const [motivos, setMotivos] = useState<MotivoAusencia[]>(() => ultimas.get(claveDe(staffId))?.motivos ?? []);

  const recargar = useCallback(async () => {
    try {
      const lista = await api.get<AusenciaEspecialista[]>(`/salon/ausencias${staffId ? `?staffId=${staffId}` : ''}`) ?? [];
      const clave = claveDe(staffId);
      ultimas.set(clave, { motivos: ultimas.get(clave)?.motivos ?? [], ausencias: lista });
      setAusencias(lista);
    } catch { /* sin conexión: se queda lo que había */ }
  }, [staffId]);

  useEffect(() => {
    void recargar();
    api.get<MotivoAusencia[]>('/salon/ausencias/motivos').then(m => {
      const clave = claveDe(staffId);
      ultimas.set(clave, { ausencias: ultimas.get(clave)?.ausencias ?? [], motivos: m ?? [] });
      setMotivos(m ?? []);
    }).catch(() => {});
  }, [recargar, staffId]);

  const motivo = useCallback((id: string) => motivos.find(m => m.id === id)?.descripcion ?? 'No viene', [motivos]);
  return { ausencias, motivos, motivo, recargar };
}
