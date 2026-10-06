import React, { useEffect, useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { bienvenidaApi } from '../../services/bienvenida';
import type { SedeBienvenida } from '../../types/bienvenida';
import type { DiaDeHorario } from '../../types';
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

/** Paso 3: el horario de la semana (el mismo para todas las sedes; luego cada una se ajusta en Ajustes) */
export const PasoHorario: React.FC<{ onSiguiente: () => void }> = ({ onSiguiente }) => {
  const [semana, setSemana] = useState<DiaDeHorario[] | null>(null);
  const [varias, setVarias] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    bienvenidaApi.sedes()
      .then((s) => { setSemana(semanaCompleta(s[0]?.horarioSemanal)); setVarias(s.length > 1); })
      .catch((e) => setError((e as Error).message));
  }, []);

  const seguir = async () => {
    if (!semana) return;
    setError('');
    setGuardando(true);
    try {
      await bienvenidaApi.horario(semana);
      onSiguiente();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  if (!semana && !error) return <Cargando />;

  return (
    <div className="space-y-5">
      <Encabezado
        titulo="¿Cuándo abres?"
        texto={`Lalan solo agenda dentro de este horario.${varias ? ' Lo pongo igual en todas tus sedes; si alguna es distinta, la cambias en Ajustes.' : ''}`}
      />
      {semana && (
        <Tarjeta>
          <HorarioSemanal semana={semana} onGuardar={setSemana} />
        </Tarjeta>
      )}
      {error && <Aviso tipo="error">{error}</Aviso>}
      <BotonPrincipal onClick={seguir} cargando={guardando} className="w-full">Siguiente</BotonPrincipal>
    </div>
  );
};
