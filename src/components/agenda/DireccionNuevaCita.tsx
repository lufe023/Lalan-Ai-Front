import React, { useEffect, useRef, useState } from 'react';
import { Car, Loader2, LocateFixed, MapPin } from 'lucide-react';
import { CampoNumero } from '../ui/CampoNumero';
import { domicilioApi, miUbicacion, montoTraslado } from '../../services/domicilio';
import type { DireccionClienta, EstimacionTraslado } from '../../types';

/** Lo que el formulario de la cita manda al guardar */
export interface DireccionElegida {
  direccion: string;
  referencia?: string;
  lat?: number;
  lng?: number;
  /** El monto que puso a mano (gana a la cuenta) */
  precio?: number;
}

const campo = 'w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none';

/**
 * Nueva cita en una sede A DOMICILIO: a dónde va la especialista. Ofrece
 * las direcciones de su ficha (la última arriba), deja escribir otra o usar
 * la ubicación de este teléfono, y muestra el traslado aproximado mientras
 * se escribe.
 */
export const DireccionNuevaCita: React.FC<{
  /** Las direcciones de la ficha de la clienta elegida */
  guardadas?: DireccionClienta[];
  valor: DireccionElegida | null;
  onCambio: (v: DireccionElegida | null) => void;
}> = ({ guardadas = [], valor, onCambio }) => {
  const [est, setEst] = useState<EstimacionTraslado | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [gps, setGps] = useState<string | null>(null);
  const [aMano, setAMano] = useState(false);
  const vez = useRef(0);

  // Con la clienta elegida, su última dirección ya viene puesta (menos esfuerzo)
  useEffect(() => {
    if (!valor && guardadas[0]) {
      const g = guardadas[0];
      onCambio({ direccion: g.direccion, referencia: g.referencia ?? undefined, lat: g.lat ?? undefined, lng: g.lng ?? undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardadas[0]?.id]);

  // El traslado aproximado, medio segundo después de dejar de escribir
  useEffect(() => {
    const texto = valor?.direccion?.trim() ?? '';
    if (!texto && valor?.lat == null) { setEst(null); return; }
    const mia = ++vez.current;
    setCalculando(true);
    const t = window.setTimeout(() => {
      domicilioApi.estimar({ direccion: texto, lat: valor?.lat ?? null, lng: valor?.lng ?? null })
        .then(r => { if (mia === vez.current) setEst(r); })
        .catch(() => { if (mia === vez.current) setEst(null); })
        .finally(() => { if (mia === vez.current) setCalculando(false); });
    }, 500);
    return () => window.clearTimeout(t);
  }, [valor?.direccion, valor?.lat, valor?.lng]);

  const cambiar = (parte: Partial<DireccionElegida>) => onCambio({ direccion: '', ...(valor ?? {}), ...parte });

  const conMiGps = async () => {
    setGps('leyendo');
    try {
      const p = await miUbicacion();
      cambiar({ lat: p.lat, lng: p.lng, direccion: valor?.direccion?.trim() || 'Donde estoy ahora' });
      setGps(null);
    } catch (e: any) {
      setGps(e?.message ?? 'No se pudo leer la ubicación.');
    }
  };

  return (
    <div className="p-3 rounded-2xl border border-sky-500/25 bg-sky-500/5 space-y-2">
      <div className="flex items-center gap-1.5 text-[0.75rem] font-bold text-sky-700 dark:text-sky-300">
        <Car className="w-4 h-4" /> A domicilio: ¿a dónde vamos? *
      </div>

      {guardadas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {guardadas.map(g => {
            const activa = valor?.direccion === g.direccion;
            return (
              <button key={g.id} type="button"
                onClick={() => onCambio({ direccion: g.direccion, referencia: g.referencia ?? undefined, lat: g.lat ?? undefined, lng: g.lng ?? undefined })}
                className={`max-w-full flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[0.75rem] font-semibold text-left transition ios-touch cursor-pointer ${activa
                  ? 'bg-sky-600 text-white' : 'bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200'}`}>
                <MapPin className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{g.direccion}</span>
              </button>
            );
          })}
        </div>
      )}

      <input value={valor?.direccion ?? ''} maxLength={300} required placeholder="Calle, número y sector"
        onChange={e => cambiar({ direccion: e.target.value, lat: undefined, lng: undefined })} className={campo} aria-label="Dirección de la clienta" />
      <input value={valor?.referencia ?? ''} maxLength={200} placeholder="Referencia: casa azul, apto 3B…"
        onChange={e => cambiar({ referencia: e.target.value })} className={campo} aria-label="Referencia" />

      <button type="button" onClick={conMiGps} disabled={gps === 'leyendo'}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200 ios-touch cursor-pointer disabled:opacity-60">
        {gps === 'leyendo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
        {valor?.lat != null ? 'Ubicación puesta · leer otra vez' : 'Estoy con ella: usar mi ubicación'}
      </button>
      {gps && gps !== 'leyendo' && <p className="text-[0.6875rem] font-semibold text-rose-600" role="alert">{gps}</p>}

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="min-w-0">
          <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">Traslado, aparte del servicio</p>
          <p className="text-[0.875rem] font-bold tabular-nums text-slate-900 dark:text-white">
            {aMano && valor?.precio != null ? montoTraslado(valor.precio, est?.moneda)
              : calculando ? 'Calculando…' : est ? montoTraslado(est.precio, est.moneda) : 'Escribe la dirección'}
          </p>
          {est && !aMano && <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400 leading-snug">{est.explicacion}{est.fuera ? ' · fuera de lo que cubres' : ''}</p>}
        </div>
        <button type="button" onClick={() => { setAMano(m => !m); if (aMano) cambiar({ precio: undefined }); }}
          className="shrink-0 px-2.5 py-1.5 rounded-xl text-[0.6875rem] font-bold text-[var(--primary)] ios-touch cursor-pointer">
          {aMano ? 'Usar la cuenta' : 'Poner monto'}
        </button>
      </div>
      {aMano && (
        <CampoNumero valor={valor?.precio ?? est?.precio ?? null} onCambio={n => cambiar({ precio: n ?? undefined })} className={campo} placeholder="Monto del traslado" aria-label="Monto del traslado" />
      )}
    </div>
  );
};
