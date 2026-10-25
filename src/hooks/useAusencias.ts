import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { sedeActiva } from '../services/sedeActiva';
import type { AusenciaEspecialista, MotivoAusencia } from '../types';

/**
 * Lo último que llegó, por cuenta, sede y persona. Al volver a la Agenda se pinta
 * enseguida y luego se refresca: sin esto, el aviso "Este día: …" aparecía
 * un instante después y empujaba la lista hacia abajo. La clave lleva la
 * cuenta y la sede: otra cuenta u otra sede nunca ven lo de esta.
 */
const ultimas = new Map<string, { ausencias: AusenciaEspecialista[]; motivos: MotivoAusencia[] }>();
/** Cuenta + sede + persona; sin cuenta conocida no se guarda nada */
const claveDe = (staffId?: string): string | null => {
  try {
    const id = JSON.parse(localStorage.getItem('lalan_cached_user') ?? 'null')?.id;
    return id ? `${id}|${sedeActiva()}|${staffId ?? ''}` : null;
  } catch { return null; }
};
const guardadas = (clave: string | null) => (clave ? ultimas.get(clave) : undefined);

/**
 * Las ausencias que todavía no terminan (vacaciones, días libres, unas
 * horas) y el catálogo de motivos. `staffId` = solo las de esa persona.
 */
export function useAusencias(staffId?: string) {
  const [ausencias, setAusencias] = useState<AusenciaEspecialista[]>(() => guardadas(claveDe(staffId))?.ausencias ?? []);
  const [motivos, setMotivos] = useState<MotivoAusencia[]>(() => guardadas(claveDe(staffId))?.motivos ?? []);

  const recargar = useCallback(async () => {
    // La clave se toma antes de pedir: si la sesión o la sede cambian a medio
    // camino, la respuesta no se guarda bajo la cuenta o la sede equivocada
    const clave = claveDe(staffId);
    try {
      const lista = await api.get<AusenciaEspecialista[]>(`/salon/ausencias${staffId ? `?staffId=${staffId}` : ''}`) ?? [];
      if (clave && clave === claveDe(staffId)) ultimas.set(clave, { motivos: guardadas(clave)?.motivos ?? [], ausencias: lista });
      setAusencias(lista);
    } catch { /* sin conexión: se queda lo que había */ }
  }, [staffId]);

  useEffect(() => {
    void recargar();
    const clave = claveDe(staffId);
    api.get<MotivoAusencia[]>('/salon/ausencias/motivos').then(m => {
      if (clave && clave === claveDe(staffId)) ultimas.set(clave, { ausencias: guardadas(clave)?.ausencias ?? [], motivos: m ?? [] });
      setMotivos(m ?? []);
    }).catch(() => {});
  }, [recargar, staffId]);

  const motivo = useCallback((id: string) => motivos.find(m => m.id === id)?.descripcion ?? 'No viene', [motivos]);
  return { ausencias, motivos, motivo, recargar };
}
