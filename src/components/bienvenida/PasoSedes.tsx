import React, { useEffect, useState } from 'react';
import { Check, MapPin, Plus } from 'lucide-react';
import { bienvenidaApi } from '../../services/bienvenida';
import type { SedeBienvenida } from '../../types/bienvenida';
import type { CitasAlCierre as CitasAlCierreDatos, DiaDeHorario, HorarioExtra as HorarioExtraDatos } from '../../types';
import { CITAS_AL_CIERRE_INICIAL, CitasAlCierre } from '../ajustes/CitasAlCierre';
import { HORARIO_EXTRA_INICIAL, HorarioExtra } from '../ajustes/HorarioExtra';
import { HorarioSemanal, semanaCompleta } from '../ajustes/HorarioSemanal';
import { Aviso, BotonPrincipal, BotonSecundario, Cargando, Encabezado, Etiqueta, Tarjeta, claseCampo } from './comun';

interface Borrador { nombre: string; direccion: string; telefono: string }
const borradorDe = (s: SedeBienvenida): Borrador => ({ nombre: s.name, direccion: s.address ?? '', telefono: s.phone ?? '' });

/** Paso 2: dirección y teléfono de cada local (y otra sucursal, si el plan la incluye) */
export const PasoSedes: React.FC<{ onSiguiente: () => void }> = ({ onSiguiente }) => {
  const [sedes, setSedes] = useState<SedeBienvenida[] | null>(null);
  const [borradores, setBorradores] = useState<Record<string, Borrador>>({});
  const [nueva, setNueva] = useState<Borrador | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cargar = (lista: SedeBienvenida[]) => {
    setSedes(lista);
    setBorradores(Object.fromEntries(lista.map((s) => [s.id, borradorDe(s)])));
  };
  useEffect(() => { bienvenidaApi.sedes().then(cargar).catch((e) => setError((e as Error).message)); }, []);

  const cambiar = (id: string, campo: keyof Borrador, valor: string) =>
    setBorradores((b) => ({ ...b, [id]: { ...b[id], [campo]: valor } }));

  const seguir = async () => {
    setError('');
    setGuardando(true);
    try {
      for (const s of sedes ?? []) {
        const b = borradores[s.id];
        if (!b) continue;
        const original = borradorDe(s);
        if (b.nombre === original.nombre && b.direccion === original.direccion && b.telefono === original.telefono) continue;
        await bienvenidaApi.guardarSede(s.id, { nombre: b.nombre.trim() || undefined, direccion: b.direccion.trim() || null, telefono: b.telefono.trim() || null });
      }
      if (nueva?.nombre.trim()) {
        await bienvenidaApi.nuevaSede({ nombre: nueva.nombre.trim(), direccion: nueva.direccion.trim() || undefined, telefono: nueva.telefono.trim() || undefined });
      }
      onSiguiente();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  if (!sedes && !error) return <Cargando />;

  const campos = (b: Borrador, cambio: (c: keyof Borrador, v: string) => void) => (
    <div className="space-y-3">
      <Etiqueta texto="Nombre del local">
        <input value={b.nombre} onChange={(e) => cambio('nombre', e.target.value)} maxLength={120} className={claseCampo} />
      </Etiqueta>
      <Etiqueta texto="Dirección">
        <input value={b.direccion} onChange={(e) => cambio('direccion', e.target.value)} maxLength={200} placeholder="Calle, número, sector" className={claseCampo} />
      </Etiqueta>
      <Etiqueta texto="Teléfono del local">
        <input value={b.telefono} onChange={(e) => cambio('telefono', e.target.value)} inputMode="tel" maxLength={30} placeholder="809 555 1234" className={claseCampo} />
      </Etiqueta>
    </div>
  );

  return (
    <div className="space-y-5">
      <Encabezado titulo="¿Dónde estás?" texto="Lalan se lo dice a las clientas cuando preguntan cómo llegar." />
      {(sedes ?? []).map((s) => (
        <Tarjeta key={s.id}>
          <div className="flex items-center gap-2 mb-3 text-[0.8125rem] font-bold text-slate-500"><MapPin className="w-4 h-4" /> {s.name}</div>
          {borradores[s.id] && campos(borradores[s.id], (c, v) => cambiar(s.id, c, v))}
        </Tarjeta>
      ))}
      {nueva ? (
        <Tarjeta>
          <div className="mb-3 text-[0.8125rem] font-bold text-slate-500">Otra sucursal</div>
          {campos(nueva, (c, v) => setNueva((n) => (n ? { ...n, [c]: v } : n)))}
        </Tarjeta>
      ) : (
        <BotonSecundario onClick={() => setNueva({ nombre: '', direccion: '', telefono: '' })} className="w-full">
          <Plus className="w-4 h-4" /> Tengo otra sucursal
        </BotonSecundario>
      )}
      {error && <Aviso tipo="error">{error}</Aviso>}
      <BotonPrincipal onClick={seguir} cargando={guardando} className="w-full">Siguiente</BotonPrincipal>
    </div>
  );
};

/**
 * Paso 3: el horario. Las mismas opciones que Ajustes → El salón: cada día
 * con sus turnos (corrida, con almuerzo, solo mañana o tarde), «Mismo
 * horario a varios días», qué pasa con la última cita del día y el horario
 * extra. Con varias sedes se elige: igual en todas, o una por una.
 */
export const PasoHorario: React.FC<{ onSiguiente: () => void }> = ({ onSiguiente }) => {
  const [sedes, setSedes] = useState<SedeBienvenida[] | null>(null);
  /** 'todas' = el mismo en todas; si no, el id de la sede que se está poniendo */
  const [para, setPara] = useState<string>('todas');
  const [hechas, setHechas] = useState<string[]>([]);
  const [semana, setSemana] = useState<DiaDeHorario[] | null>(null);
  const [cierre, setCierre] = useState<CitasAlCierreDatos>(CITAS_AL_CIERRE_INICIAL);
  const [extra, setExtra] = useState<HorarioExtraDatos>(HORARIO_EXTRA_INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cargarDe = (s?: SedeBienvenida) => {
    setSemana(semanaCompleta(s?.horarioSemanal));
    setCierre({ ...CITAS_AL_CIERRE_INICIAL, ...(s?.citasAlCierre ?? {}) });
    setExtra({ ...HORARIO_EXTRA_INICIAL, ...(s?.horarioExtra ?? {}) });
  };

  useEffect(() => {
    bienvenidaApi.sedes()
      .then((s) => { setSedes(s); cargarDe(s[0]); })
      .catch((e) => setError((e as Error).message));
  }, []);

  const varias = (sedes?.length ?? 0) > 1;
  const elegir = (id: string) => {
    setPara(id);
    setError('');
    cargarDe(id === 'todas' ? sedes?.[0] : sedes?.find((s) => s.id === id));
  };

  const seguir = async () => {
    if (!semana) return;
    setError('');
    setGuardando(true);
    try {
      const una = para !== 'todas';
      const nuevas = await bienvenidaApi.horario(semana, { ...(una ? { locationIds: [para] } : {}), citasAlCierre: cierre, horarioExtra: extra });
      setSedes(nuevas);
      if (una) {
        const listas = [...new Set([...hechas, para])];
        setHechas(listas);
        // Una por una: pasa a la siguiente que falte; al terminar, al siguiente paso
        const falta = nuevas.find((s) => !listas.includes(s.id));
        if (falta) { setPara(falta.id); cargarDe(falta); return; }
      }
      onSiguiente();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  if (!semana && !error) return <Cargando />;

  const nombrePara = para === 'todas' ? null : sedes?.find((s) => s.id === para)?.name ?? null;
  const falta = para !== 'todas' ? sedes?.find((s) => s.id !== para && !hechas.includes(s.id)) : undefined;
  const chip = (activo: boolean) => `px-3 py-1.5 rounded-full text-[0.8125rem] font-bold border transition-colors cursor-pointer ${activo
    ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
    : 'bg-white dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-300'}`;

  return (
    <div className="space-y-5">
      <Encabezado
        titulo="¿Cuándo abres?"
        texto="Lalan solo agenda dentro de este horario. Toca un día para cambiarlo, o «Mismo horario a varios días» para poner de una vez los que son iguales."
      />
      {varias && (
        <Tarjeta>
          <p className="text-[0.8125rem] font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> ¿Para qué sede?</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => elegir('todas')} className={chip(para === 'todas')}>Igual en todas</button>
            {(sedes ?? []).map((s) => (
              <button key={s.id} type="button" onClick={() => elegir(s.id)} className={chip(para === s.id)}>
                {hechas.includes(s.id) && <Check className="inline w-3.5 h-3.5 -mt-0.5 mr-0.5" />}{s.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[0.75rem] text-slate-400">
            {para === 'todas' ? 'Si alguna abre distinto, elígela y ponle el suyo.' : `Solo ${nombrePara}. Al guardar paso a la siguiente.`}
          </p>
        </Tarjeta>
      )}
      {semana && (
        <Tarjeta>
          <HorarioSemanal semana={semana} onGuardar={setSemana} titulo={nombrePara ? `Horario de ${nombrePara}` : 'Horario de la semana'} sobreTodo />
        </Tarjeta>
      )}
      {semana && (
        <Tarjeta>
          <CitasAlCierre valor={cierre} semana={semana} sede={nombrePara} onGuardar={setCierre} />
        </Tarjeta>
      )}
      {semana && (
        <Tarjeta>
          <HorarioExtra valor={extra} semana={semana} sede={nombrePara} onGuardar={setExtra} />
        </Tarjeta>
      )}
      {error && <Aviso tipo="error">{error}</Aviso>}
      <BotonPrincipal onClick={seguir} cargando={guardando} className="w-full">
        {falta ? `Guardar y seguir con ${falta.name}` : 'Siguiente'}
      </BotonPrincipal>
    </div>
  );
};
