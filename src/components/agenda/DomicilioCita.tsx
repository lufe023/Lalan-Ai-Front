import React, { useState } from 'react';
import { Car, Check, Loader2, LocateFixed, MapPin, Navigation, Pencil } from 'lucide-react';
import { CampoNumero } from '../ui/CampoNumero';
import {
  COMO_SE_CALCULO, domicilioApi, enlaceAlMapa, enlaceComoLlegar, miUbicacion, montoTraslado,
} from '../../services/domicilio';
import type { Appointment, DomicilioDeCita } from '../../types';

const campo = 'w-full px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none text-[0.8125rem]';
const boton = 'flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[0.75rem] font-bold ios-touch cursor-pointer disabled:opacity-60';

/**
 * Una cita A DOMICILIO: a dónde va la especialista, cómo llegar y cuánto
 * sale el traslado. Lo ven la dueña (en la agenda) y la especialista (en
 * «Mis citas»). Ya en la puerta, la especialista toca «Estoy en su casa»: su
 * GPS da la distancia de verdad y la cuenta se rehace; o pone el monto final.
 */
export const DomicilioCita: React.FC<{
  cita: Pick<Appointment, 'id' | 'currencyCode' | 'domicilio' | 'trasladoPrecio' | 'trasladoAntesMin' | 'trasladoDespuesMin'>;
  /** La cita con lo nuevo (para pintarla sin esperar a la agenda) */
  onCambio?: (c: { id: string; domicilio: DomicilioDeCita | null; trasladoPrecio: number }) => void;
  /** Quien la mira puede cambiar la dirección y el monto (dueña o especialista de la cita) */
  editable?: boolean;
  /** Puede poner el monto a mano (la especialista solo si ve precios) */
  conMonto?: boolean;
  /** Por dónde se guarda (la especialista tiene su propia ruta) */
  guardarCon?: typeof domicilioApi.guardarEnCita;
}> = ({ cita, onCambio, editable = true, conMonto = true, guardarCon = domicilioApi.guardarEnCita }) => {
  const d = cita.domicilio ?? null;
  const [editando, setEditando] = useState<null | 'direccion' | 'monto'>(d ? null : 'direccion');
  const [direccion, setDireccion] = useState(d?.direccion ?? '');
  const [referencia, setReferencia] = useState(d?.referencia ?? '');
  const [monto, setMonto] = useState<number | null>(cita.trasladoPrecio ?? null);
  const [ocupado, setOcupado] = useState<null | 'gps' | 'guardar'>(null);
  const [error, setError] = useState('');
  const [explicacion, setExplicacion] = useState<string | null>(null);

  const guardar = async (dto: Parameters<typeof domicilioApi.guardarEnCita>[1], modo: 'gps' | 'guardar') => {
    setError('');
    setOcupado(modo);
    try {
      const r = await guardarCon(cita.id, dto);
      setExplicacion(r.explicacion ?? null);
      setMonto(r.precio ?? 0);
      setEditando(null);
      onCambio?.({ id: cita.id, domicilio: r.domicilio ?? null, trasladoPrecio: r.precio ?? 0 });
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo guardar.');
    } finally {
      setOcupado(null);
    }
  };

  const conMiGps = async () => {
    setError('');
    setOcupado('gps');
    try {
      const p = await miUbicacion();
      await guardar({ lat: p.lat, lng: p.lng, ...(direccion.trim() ? { direccion: direccion.trim() } : {}) }, 'gps');
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo leer la ubicación.');
      setOcupado(null);
    }
  };

  const mapa = enlaceAlMapa(d);
  const llegar = enlaceComoLlegar(d);
  const minutos = (cita.trasladoAntesMin ?? 0) + (cita.trasladoDespuesMin ?? 0);
  // Un bloque (varios servicios seguidos) se traslada una vez: el cargo va en la primera cita
  const enOtraCita = !!d && !cita.trasladoPrecio && !cita.trasladoAntesMin && d.calculo !== 'gratis' && monto === (cita.trasladoPrecio ?? null);

  return (
    <div className="p-4 rounded-3xl border border-sky-500/25 bg-sky-500/5 space-y-3">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
          <Car className="w-4.5 h-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">A domicilio</p>
          {d ? (
            <>
              <p className="text-[0.875rem] font-bold text-slate-900 dark:text-white leading-snug break-words">{d.direccion}</p>
              {d.referencia && <p className="text-[0.75rem] text-slate-600 dark:text-neutral-300 break-words">{d.referencia}</p>}
            </>
          ) : (
            <p className="text-[0.8125rem] font-bold text-amber-700 dark:text-amber-300">Falta a dónde ir</p>
          )}
        </div>
        {editable && d && editando !== 'direccion' && (
          <button type="button" onClick={() => setEditando('direccion')} aria-label="Cambiar la dirección"
            className="p-2 rounded-xl text-slate-500 hover:bg-white/70 dark:hover:bg-neutral-800 ios-touch cursor-pointer">
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </div>

      {(llegar || mapa) && editando !== 'direccion' && (
        <div className="grid grid-cols-2 gap-2">
          {llegar && (
            <a href={llegar} target="_blank" rel="noreferrer" className={`${boton} bg-sky-600 text-white`}>
              <Navigation className="w-4 h-4" /> Cómo llegar
            </a>
          )}
          {mapa && (
            <a href={mapa} target="_blank" rel="noreferrer" className={`${boton} bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200`}>
              <MapPin className="w-4 h-4" /> Ver en el mapa
            </a>
          )}
        </div>
      )}

      {editando === 'direccion' && editable && (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (direccion.trim()) void guardar({ direccion: direccion.trim(), referencia: referencia.trim() }, 'guardar'); }}>
          <input value={direccion} onChange={e => setDireccion(e.target.value)} maxLength={300} placeholder="Calle, número y sector" className={campo} aria-label="Dirección" autoFocus={!d} />
          <input value={referencia} onChange={e => setReferencia(e.target.value)} maxLength={200} placeholder="Referencia: casa azul, apto 3B, al lado del colmado" className={campo} aria-label="Referencia" />
          <div className="flex gap-2">
            <button type="submit" disabled={!direccion.trim() || !!ocupado} className={`${boton} flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900`}>
              {ocupado === 'guardar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar dirección
            </button>
            {d && <button type="button" onClick={() => setEditando(null)} className={`${boton} text-slate-500`}>Cancelar</button>}
          </div>
        </form>
      )}

      <div className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800">
        {conMonto && <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-semibold text-slate-500 dark:text-neutral-400">Traslado, aparte del servicio</p>
            <p className="text-base font-bold tabular-nums text-slate-900 dark:text-white">
              {enOtraCita ? 'En la primera cita' : d?.calculo === 'sin_datos' && !cita.trasladoPrecio ? 'Por confirmar' : montoTraslado(monto, cita.currencyCode)}
            </p>
            <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400 leading-snug">
              {enOtraCita ? 'Es otro servicio de la misma visita: el traslado se cobra una sola vez.' : explicacion ?? [
                d ? COMO_SE_CALCULO[d.calculo] : null,
                d?.km != null ? `≈ ${d.km} km` : null,
                d?.zona ? `zona ${d.zona}` : null,
                d?.calculadoPor ? `lo puso ${d.calculadoPor.split(' ')[0]}` : null,
                minutos ? `${minutos} min de ida y vuelta` : null,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
          {editable && editando !== 'monto' && (
            <button type="button" onClick={() => setEditando('monto')} className={`${boton} bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 shrink-0`}>
              <Pencil className="w-3.5 h-3.5" /> Poner monto
            </button>
          )}
        </div>}
        {!conMonto && minutos > 0 && (
          <p className="text-[0.75rem] text-slate-600 dark:text-neutral-300">{minutos} min de ida y vuelta reservados en tu agenda.</p>
        )}
        {editando === 'monto' && editable && conMonto && (
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (monto != null) void guardar({ precio: monto }, 'guardar'); }}>
            <CampoNumero valor={monto} onCambio={setMonto} className={campo} placeholder="0" aria-label="Monto del traslado" autoFocus />
            <button type="submit" disabled={monto == null || !!ocupado} className={`${boton} bg-slate-900 dark:bg-white text-white dark:text-slate-900 shrink-0`}>
              {ocupado === 'guardar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar
            </button>
          </form>
        )}
        {editable && (
          <button type="button" onClick={conMiGps} disabled={!!ocupado}
            className={`${boton} ${conMonto || minutos > 0 ? 'mt-2' : ''} w-full bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25`}>
            {ocupado === 'gps' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
            {ocupado === 'gps' ? 'Leyendo tu ubicación…' : 'Estoy en su casa: calcular con mi GPS'}
          </button>
        )}
        {error && <p className="mt-1.5 text-[0.75rem] font-semibold text-rose-600" role="alert">{error}</p>}
      </div>
    </div>
  );
};
