import { useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useSedeActiva } from '../context/SedeActivaContext';
import type { ReciboOpts } from '../utils/recibo';

/**
 * Con qué se imprime el recibo de una venta: el diseño del salón y la
 * dirección y el teléfono de la sede donde se cobró (no los de la sede en la
 * que esté mirando quien reimprime).
 */
export function useOpcionesRecibo() {
  const { settings } = useApp();
  const { sedes, varias } = useSedeActiva();
  return useCallback((venta: any, extra: Partial<ReciboOpts> = {}): ReciboOpts => {
    const st = settings as any;
    const sede = sedes.find(s => s.id === venta?.locationId) ?? null;
    return {
      diseno: st?.reciboDiseno ?? undefined,
      salon: st?.salonName || 'Lalan AI Studio & Lounge',
      sede: varias ? sede?.name : undefined,
      direccion: sede ? (sede.address ?? '') : (st?.address ?? ''),
      telefono: sede ? (sede.phone ?? '') : (st?.phone ?? ''),
      ...extra,
    };
  }, [settings, sedes, varias]);
}
