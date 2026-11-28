import { api } from './api';
import { miles } from '../utils/dinero';
import type { ConfigDomicilio, DomicilioDeCita, EstimacionTraslado, TipoSede } from '../types';

/**
 * Servicios a domicilio: la especialista va a la casa de la clienta.
 *
 * «A domicilio» es un tipo de sede (Ajustes → El salón). Un salón que
 * atiende en su local y también a domicilio tiene una sede de cada tipo, y
 * así agenda, caja, reportes e inventario no se mezclan.
 *
 * El traslado se calcula aproximado, sin Google: con el GPS de la clienta (o
 * el de la especialista cuando ya está en la puerta) y el pin de la sede.
 */

export const esADomicilio = (s: { tipo?: TipoSede | string | null } | null | undefined) => s?.tipo === 'domicilio';

export const DOMICILIO_INICIAL: ConfigDomicilio = {
  cobro: 'distancia', base: 0, porKm: 0, minimo: 0, maxKm: null, redondeo: 1, fijo: 0,
  zonas: [], minutosTraslado: 30, kmPorHora: 25, salida: null,
};

/** Mismo factor que el servidor: en ciudad se anda ~1,4 veces la línea recta */
export const FACTOR_CALLE = 1.4;

/** Lo que costaría a `km` de calle con esta configuración (para el ejemplo de Ajustes) */
export function precioEjemplo(c: ConfigDomicilio, km: number): number {
  const bruto = c.cobro === 'gratis' ? 0 : c.cobro === 'fijo' ? c.fijo : c.base + km * c.porKm;
  const conMinimo = Math.max(bruto, c.minimo);
  const paso = c.redondeo > 0 ? c.redondeo : 1;
  return conMinimo <= 0 ? 0 : Math.ceil(conMinimo / paso - 1e-9) * paso;
}

/** Enlace para abrir la dirección en el mapa del teléfono */
export function enlaceAlMapa(d: { direccion?: string | null; lat?: number | null; lng?: number | null } | null | undefined): string | null {
  if (!d) return null;
  if (d.lat != null && d.lng != null) return `https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}`;
  const t = d.direccion?.trim();
  return t ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t)}` : null;
}

/** Cómo llegar desde donde está la especialista ahora */
export function enlaceComoLlegar(d: { direccion?: string | null; lat?: number | null; lng?: number | null } | null | undefined): string | null {
  if (!d) return null;
  const destino = d.lat != null && d.lng != null ? `${d.lat},${d.lng}` : d.direccion?.trim();
  return destino ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}` : null;
}

/** «RD$ 350» / «Sin cargo» / «Por confirmar» */
export function montoTraslado(precio: number | null | undefined, moneda?: string | null): string {
  if (precio == null) return 'Por confirmar';
  if (precio <= 0) return 'Sin cargo';
  return `${moneda ? `${moneda} ` : ''}${miles(precio, precio % 1 ? 2 : 0)}`;
}

export const COMO_SE_CALCULO: Record<DomicilioDeCita['calculo'], string> = {
  distancia: 'por distancia (aproximado)',
  zona: 'por zona',
  fijo: 'monto fijo',
  gratis: 'sin cargo',
  sin_datos: 'falta la ubicación',
  manual: 'puesto a mano',
};

/**
 * El GPS del teléfono. Pide permiso la primera vez; si lo niegan o no hay
 * señal, dice por qué (para que la pantalla lo muestre tal cual).
 */
export function miUbicacion(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject(new Error('Este aparato no da la ubicación.')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 }),
      (e) => reject(new Error(e.code === e.PERMISSION_DENIED
        ? 'No diste permiso para la ubicación. Actívalo en el candado de la barra de direcciones o en Ajustes del teléfono.'
        : 'No se pudo leer la ubicación. Sal a un lugar abierto o inténtalo otra vez.')),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  });
}

export const domicilioApi = {
  /** El traslado aproximado a un lugar desde la sede a domicilio */
  estimar: (q: { sede?: string | null; lat?: number | null; lng?: number | null; direccion?: string | null }) => {
    const p = new URLSearchParams();
    if (q.sede) p.set('sede', q.sede);
    if (q.lat != null) p.set('lat', String(q.lat));
    if (q.lng != null) p.set('lng', String(q.lng));
    if (q.direccion) p.set('direccion', q.direccion);
    return api.get<EstimacionTraslado>(`/appointments/traslado/estimar?${p.toString()}`);
  },
  /** Poner o corregir la dirección, el GPS de la puerta o el monto final de una cita (todo su bloque) */
  guardarEnCita: (id: string, dto: { direccion?: string; referencia?: string; lat?: number; lng?: number; precio?: number }) =>
    api.post<EstimacionTraslado & { domicilio: DomicilioDeCita | null }>(`/appointments/${id}/traslado`, dto),
};
