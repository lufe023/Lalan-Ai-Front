import React, { useEffect, useState } from 'react';
import { Car, Home, LocateFixed, MapPin, Plus, Save, Store, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CampoNumero } from '../ui/CampoNumero';
import { DOMICILIO_INICIAL, miUbicacion, montoTraslado, precioEjemplo } from '../../services/domicilio';
import type { CobroTraslado, ConfigDomicilio, TipoSede, ZonaDomicilio } from '../../types';

const COBROS: { id: CobroTraslado; titulo: string; texto: string }[] = [
  { id: 'distancia', titulo: 'Por distancia', texto: 'Con la ubicación de la clienta: salida + precio por km.' },
  { id: 'zonas', titulo: 'Por zona', texto: 'Un precio por sector (Piantini, Naco…).' },
  { id: 'fijo', titulo: 'Monto fijo', texto: 'El mismo vaya a donde vaya.' },
  { id: 'gratis', titulo: 'Sin cargo', texto: 'No se cobra; igual cuenta el tiempo.' },
];
const MINUTOS = [15, 20, 30, 45, 60];
const REDONDEOS = [1, 5, 10, 50, 100];
const KM_EJEMPLO = [3, 8, 15];

const CHIP = 'px-3 py-1.5 rounded-xl text-[0.75rem] font-bold tabular-nums transition ios-touch cursor-pointer';
const chip = (activo: boolean) => `${CHIP} ${activo
  ? 'bg-[var(--primary)] text-white shadow-sm'
  : 'bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-300'}`;
const campo = 'w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none';
const nota = 'text-[0.6875rem] text-slate-500 dark:text-neutral-400 leading-relaxed';
const etiqueta = 'block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1';

/**
 * Ajustes → El salón: si esta sede atiende en su local o A DOMICILIO, y
 * cómo se cobra el traslado. Es de cada sede: un salón que hace las dos
 * cosas tiene una sede de cada tipo, y así agenda, caja, reportes e
 * inventario no se mezclan.
 */
export const AjustesDomicilio: React.FC<{
  /** El nombre de la sede si el salón tiene varias */
  sede?: string | null;
  moneda?: string | null;
  /** Abrir Ajustes → Vitrina, donde se pone el pin de la sede */
  onPonerPin: () => void;
  /** Abrir la Bienvenida en el paso de sedes (para crear la otra sede) */
  onOtraSede: () => void;
}> = ({ sede, moneda, onPonerPin, onOtraSede }) => {
  const { settings, updateSettings, showToast } = useApp();
  const [tipo, setTipo] = useState<TipoSede>(settings.tipo ?? 'local');
  const [c, setC] = useState<ConfigDomicilio>({ ...DOMICILIO_INICIAL, ...(settings.domicilio ?? {}) });
  const [gps, setGps] = useState<'leyendo' | string | null>(null);

  // Al cambiar de sede (o al llegar lo guardado) se ve lo de esa sede
  useEffect(() => {
    setTipo(settings.tipo ?? 'local');
    setC({ ...DOMICILIO_INICIAL, ...(settings.domicilio ?? {}) });
  }, [settings.tipo, settings.domicilio]);

  const cambiar = (parte: Partial<ConfigDomicilio>) => setC(x => ({ ...x, ...parte }));
  const cambiarZona = (id: string, parte: Partial<ZonaDomicilio>) =>
    cambiar({ zonas: c.zonas.map(z => (z.id === id ? { ...z, ...parte } : z)) });
  const nuevaZona = () => cambiar({
    zonas: [...c.zonas, { id: `z-${Date.now().toString(36)}`, nombre: '', precio: 0, minutos: c.minutosTraslado }],
  });

  const elegirTipo = (t: TipoSede) => {
    setTipo(t);
    // El tipo se guarda al tocarlo: cambia lo que Lalan y la Vitrina dicen de esta sede
    updateSettings({ tipo: t });
    showToast('Guardado', t === 'domicilio'
      ? 'Esta sede ahora atiende a domicilio. Lalan pide la dirección al agendar.'
      : 'Esta sede atiende en su local.', 'success');
  };

  const salidaConMiGps = async () => {
    setGps('leyendo');
    try {
      const p = await miUbicacion();
      cambiar({ salida: p });
      setGps(null);
    } catch (e: any) {
      setGps(e?.message ?? 'No se pudo leer la ubicación.');
    }
  };

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    const zonas = c.zonas.filter(z => z.nombre.trim());
    if (c.cobro === 'zonas' && !zonas.length) {
      showToast('Falta una zona', 'Escribe al menos una zona con su precio, o elige otra forma de cobrar.', 'warning');
      return;
    }
    updateSettings({ domicilio: { ...c, zonas } });
    showToast('Guardado', 'Lalan, la Vitrina y la agenda ya calculan el traslado así.', 'success');
  };

  const salida = c.salida ?? settings.pin ?? null;
  const sinSalida = !salida && c.cobro === 'distancia';
  const m = moneda ?? '';

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
          <Home className="w-4 h-4 text-[var(--primary)]" />
          <span>Dónde atiende{sede ? ` ${sede}` : ' esta sede'}</span>
        </div>
        <p className="mt-0.5 text-[0.75rem] text-slate-500 dark:text-slate-400 leading-snug">
          Si haces las dos cosas, ten una sede para el local y otra a domicilio: cada una lleva su agenda, su caja y su inventario (el kit que se carga), y no se mezclan.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {([
          { id: 'local' as const, icono: Store, titulo: 'En el local', texto: 'Las clientas vienen al salón.' },
          { id: 'domicilio' as const, icono: Car, titulo: 'A domicilio', texto: 'La especialista va a su casa.' },
        ]).map(o => (
          <button key={o.id} type="button" onClick={() => elegirTipo(o.id)} aria-pressed={tipo === o.id}
            className={`p-3 rounded-2xl text-left border transition ios-touch cursor-pointer ${tipo === o.id
              ? 'border-[var(--primary)] bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]'
              : 'border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900'}`}>
            <o.icono className={`w-5 h-5 ${tipo === o.id ? 'text-[var(--primary)]' : 'text-slate-400'}`} />
            <span className="mt-1 block text-[0.8125rem] font-bold text-slate-900 dark:text-white">{o.titulo}</span>
            <span className="block text-[0.6875rem] text-slate-500 dark:text-neutral-400 leading-snug">{o.texto}</span>
          </button>
        ))}
      </div>

      {tipo === 'domicilio' && (
        <form onSubmit={guardar} className="space-y-3 p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/50 border border-slate-200/70 dark:border-neutral-700/60">
          <div>
            <span className={etiqueta}>Cómo cobras el traslado</span>
            <div className="grid grid-cols-2 gap-1.5">
              {COBROS.map(o => (
                <button key={o.id} type="button" onClick={() => cambiar({ cobro: o.id })} aria-pressed={c.cobro === o.id}
                  className={`p-2 rounded-xl text-left transition ios-touch cursor-pointer ${c.cobro === o.id
                    ? 'bg-[var(--primary)] text-white shadow-sm'
                    : 'bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-200'}`}>
                  <span className="block text-[0.75rem] font-bold">{o.titulo}</span>
                  <span className={`block text-[0.6875rem] leading-snug ${c.cobro === o.id ? 'text-white/85' : 'text-slate-500 dark:text-neutral-400'}`}>{o.texto}</span>
                </button>
              ))}
            </div>
            <p className={`${nota} mt-1`}>Se cobra aparte del servicio y sale en su propia línea en Caja. Lalan y la Vitrina lo dicen como aproximado; tú o la especialista ponen el monto final en la cita.</p>
          </div>

          {c.cobro === 'distancia' && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className={etiqueta}>Por salir</span>
                  <CampoNumero valor={c.base} onCambio={n => cambiar({ base: n ?? 0 })} className={campo} placeholder="0" aria-label="Lo que se cobra por salir" />
                </label>
                <label className="block">
                  <span className={etiqueta}>Por km</span>
                  <CampoNumero valor={c.porKm} onCambio={n => cambiar({ porKm: n ?? 0 })} className={campo} placeholder="0" aria-label="Precio por kilómetro" />
                </label>
                <label className="block">
                  <span className={etiqueta}>Mínimo</span>
                  <CampoNumero valor={c.minimo} onCambio={n => cambiar({ minimo: n ?? 0 })} className={campo} placeholder="0" aria-label="Lo mínimo por un traslado" />
                </label>
              </div>
              <label className="block">
                <span className={etiqueta}>Hasta cuántos km vas (vacío = sin tope)</span>
                <CampoNumero valor={c.maxKm} onCambio={n => cambiar({ maxKm: n && n > 0 ? n : null })} conMiles={false} decimales={1} className={campo} placeholder="Sin tope" aria-label="Distancia máxima" />
              </label>

              <div className={`p-2.5 rounded-xl border ${sinSalida ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700'}`}>
                <div className="flex items-start gap-2">
                  <MapPin className={`w-4 h-4 mt-0.5 shrink-0 ${sinSalida ? 'text-amber-600' : 'text-[var(--primary)]'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.75rem] font-bold text-slate-800 dark:text-neutral-100">
                      {sinSalida ? 'Falta de dónde sale la especialista' : 'De dónde sale la especialista'}
                    </p>
                    <p className={nota}>
                      {c.salida ? `Tu ubicación guardada (${c.salida.lat.toFixed(4)}, ${c.salida.lng.toFixed(4)}).`
                        : settings.pin ? 'El pin de la sede en el mapa.'
                          : 'Sin un punto de salida no se puede calcular la distancia. Ponlo con tu ubicación o con el pin del mapa.'}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <button type="button" onClick={salidaConMiGps} disabled={gps === 'leyendo'}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--primary)] text-white text-[0.6875rem] font-bold ios-touch cursor-pointer disabled:opacity-60">
                        <LocateFixed className="w-3.5 h-3.5" /> {gps === 'leyendo' ? 'Leyendo…' : 'Usar donde estoy ahora'}
                      </button>
                      <button type="button" onClick={onPonerPin}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.6875rem] font-bold text-slate-700 dark:text-neutral-200 ios-touch cursor-pointer">
                        <MapPin className="w-3.5 h-3.5" /> Poner el pin en el mapa
                      </button>
                      {c.salida && (
                        <button type="button" onClick={() => cambiar({ salida: null })}
                          className="px-2.5 py-1 rounded-lg text-[0.6875rem] font-bold text-slate-500 ios-touch cursor-pointer">Usar el pin de la sede</button>
                      )}
                    </div>
                    {gps && gps !== 'leyendo' && <p className="mt-1 text-[0.6875rem] font-semibold text-rose-600" role="alert">{gps}</p>}
                  </div>
                </div>
              </div>
            </>
          )}

          {c.cobro === 'zonas' && (
            <div className="space-y-1.5">
              <span className={etiqueta}>Tus zonas</span>
              {c.zonas.map(z => (
                <div key={z.id} className="grid grid-cols-[1fr_5.5rem_4.5rem_auto] gap-1.5 items-center">
                  <input value={z.nombre} maxLength={60} placeholder="Piantini" onChange={e => cambiarZona(z.id, { nombre: e.target.value })} className={campo} aria-label="Nombre de la zona" />
                  <CampoNumero valor={z.precio} onCambio={n => cambiarZona(z.id, { precio: n ?? 0 })} className={campo} placeholder="Precio" aria-label={`Precio a ${z.nombre || 'la zona'}`} />
                  <CampoNumero valor={z.minutos} onCambio={n => cambiarZona(z.id, { minutos: Math.max(5, Math.round(n ?? c.minutosTraslado)) })} conMiles={false} decimales={0} className={campo} placeholder="min" aria-label={`Minutos de ida a ${z.nombre || 'la zona'}`} />
                  <button type="button" onClick={() => cambiar({ zonas: c.zonas.filter(x => x.id !== z.id) })} aria-label={`Quitar ${z.nombre || 'la zona'}`}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 ios-touch cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {c.zonas.length > 0 && <p className={nota}>Nombre · precio · minutos de ida. Lalan reconoce la zona en la dirección que da la clienta.</p>}
              <button type="button" onClick={nuevaZona}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-dashed border-slate-300 dark:border-neutral-600 text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200 ios-touch cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> Agregar zona
              </button>
            </div>
          )}

          {c.cobro === 'fijo' && (
            <label className="block">
              <span className={etiqueta}>Monto del traslado</span>
              <CampoNumero valor={c.fijo} onCambio={n => cambiar({ fijo: n ?? 0 })} className={campo} placeholder="0" aria-label="Monto fijo del traslado" />
            </label>
          )}

          <div>
            <span className={etiqueta}>Minutos de ida, cuando no se sabe a dónde</span>
            <div className="flex flex-wrap gap-1.5">
              {MINUTOS.map(n => (
                <button key={n} type="button" onClick={() => cambiar({ minutosTraslado: n })} className={chip(c.minutosTraslado === n)}>{n} min</button>
              ))}
            </div>
            <p className={`${nota} mt-1`}>La ida y la vuelta bloquean a la especialista en la agenda (no a una silla). Con la ubicación de la clienta, el tiempo sale de la distancia.</p>
          </div>

          {c.cobro !== 'gratis' && (
            <div>
              <span className={etiqueta}>Redondear hacia arriba de</span>
              <div className="flex flex-wrap gap-1.5">
                {REDONDEOS.map(n => (
                  <button key={n} type="button" onClick={() => cambiar({ redondeo: n })} className={chip(c.redondeo === n)}>{n === 1 ? 'Sin redondeo' : `${n} en ${n}`}</button>
                ))}
              </div>
            </div>
          )}

          {c.cobro === 'distancia' && (
            <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700">
              <p className="text-[0.75rem] font-bold text-slate-800 dark:text-neutral-100">Así saldría</p>
              <div className="mt-1 grid grid-cols-3 gap-1.5 text-center">
                {KM_EJEMPLO.map(km => (
                  <div key={km} className="py-1.5 rounded-lg bg-slate-50 dark:bg-neutral-800">
                    <span className="block text-[0.6875rem] text-slate-500 dark:text-neutral-400">a {km} km</span>
                    <span className="block text-[0.8125rem] font-bold tabular-nums text-slate-900 dark:text-white">{montoTraslado(c.maxKm != null && km > c.maxKm ? null : precioEjemplo(c, km), m)}</span>
                  </div>
                ))}
              </div>
              <p className={`${nota} mt-1`}>Km de calle aproximados: la línea recta por 1.4, porque nadie va en línea recta.</p>
            </div>
          )}

          <button type="submit"
            className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold flex items-center justify-center gap-1.5 ios-touch cursor-pointer hover:opacity-90 shadow-sm">
            <Save className="w-3.5 h-3.5" /> Guardar traslado
          </button>
        </form>
      )}

      <button type="button" onClick={onOtraSede}
        className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-left ios-touch cursor-pointer">
        <Plus className="w-4 h-4 text-[var(--primary)] shrink-0" />
        <span className="flex-1">
          <span className="block text-[0.75rem] font-bold text-slate-800 dark:text-neutral-100">
            {tipo === 'domicilio' ? '¿También atiendes en un local? Agrega esa sede' : '¿También vas a domicilio? Agrega esa sede'}
          </span>
          <span className={nota}>Así Lalan pregunta «¿en el salón o a domicilio?» y nada se mezcla.</span>
        </span>
      </button>
    </div>
  );
};
