import React, { useEffect, useState } from 'react';
import { CalendarCheck, CalendarClock, CalendarOff, Check, KeyRound, MapPin, Plus, Scissors, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useSedeActiva } from '../../context/SedeActivaContext';
import { useEncuadres } from '../../hooks/useEncuadres';
import { recibeCitas } from '../../utils/recibeCitas';
import { useConfirmar } from '../ui/ModalConfirmar';
import { HorarioEspecialista } from './HorarioEspecialista';
import { semanaCompleta } from './HorarioSemanal';
import { AvatarEspecialista, FotoEspecialista } from './FotoEspecialista';
import { EntradaEspecialista, PlantillaPermisosEspecialista } from './EntradaEspecialista';

const CAMPO = 'min-w-0 px-2.5 py-2 sm:py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700';

/**
 * Las especialistas del salón, en Ajustes → Equipo: su foto, especialidad,
 * zona, si recibe citas, sus sedes, su entrada a Lalan, su horario.
 *
 * En el teléfono cada fila se parte en tres renglones (quién es, qué hace,
 * sus botones con nombre) para que nada quede cortado ni escondido.
 */
export const EspecialistasEquipo: React.FC<{
  /** La plantilla de permisos va aparte (en la ventana Especialistas tiene su pestaña) */
  sinPlantillaPermisos?: boolean;
  /** Cómo se le paga a cada una ("Comisión 50 %"): se ve en su fila y lleva a cambiarlo */
  etiquetasPago?: Record<string, string>;
  onPago?: (staffId: string) => void;
}> = ({ sinPlantillaPermisos = false, etiquetasPago, onPago }) => {
  const { settings, zonas, loadZonas, especialistas, loadEspecialistas, guardarEspecialista, eliminarEspecialista } = useApp();
  const { sedes: sedesDelSalon, varias: variasSedes } = useSedeActiva();
  const { encuadres, guardar: guardarEncuadre } = useEncuadres();
  const { confirmar, modalConfirmar } = useConfirmar();

  /** Lo que está abierto debajo de cada fila (una cosa a la vez por persona) */
  const [fotoDe, setFotoDe] = useState<string | null>(null);
  const [entradaDe, setEntradaDe] = useState<string | null>(null);
  const [sedesAbiertas, setSedesAbiertas] = useState<string | null>(null);
  const [horarioDe, setHorarioDe] = useState<string | null>(null);
  const [nuevaPersona, setNuevaPersona] = useState({ name: '', role: '', zoneId: '' });

  useEffect(() => { void loadZonas?.(); void loadEspecialistas?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const quitar = async (id: string, nombre: string) => {
    const si = await confirmar({
      titulo: `¿Quitar a ${nombre}?`,
      mensaje: 'Deja de salir en la Vitrina y Lalan ya no le da citas. Si tiene citas o turnos guardados, solo se desactiva para no perder ese historial.',
      textoConfirmar: 'Quitar',
      tono: 'peligro',
    });
    if (si) await eliminarEspecialista(id);
  };

  const zonasActivas = (zonas ?? []).filter(z => z.active);
  const persona = horarioDe ? (especialistas ?? []).find(x => x.id === horarioDe) : null;

  /** Botón de icono: en el teléfono lleva su nombre al lado, en la PC solo el icono */
  const claseBoton = (encendido: boolean) =>
    `shrink-0 h-9 sm:h-7 px-2.5 sm:px-0 sm:w-7 rounded-lg flex items-center justify-center gap-1.5 text-[0.75rem] font-semibold transition cursor-pointer ${
      encendido ? 'text-[var(--primary)] bg-[var(--primary)]/10' : 'text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-neutral-800 sm:bg-transparent sm:dark:bg-transparent hover:text-[var(--primary)] hover:bg-[var(--primary)]/10'
    }`;

  return (
    <>
      {modalConfirmar}
      <div id="ajustes-especialistas" className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3">
        <div className="flex items-center gap-1.5">
          <Scissors className="w-4 h-4 text-[var(--primary)]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            Especialistas
          </h2>
        </div>
        <p className="text-[0.75rem] text-slate-400 leading-relaxed">
          Cada una con su foto, su especialidad y su zona. Toca la carita para
          subir su foto: es la que sale en tu Vitrina. La zona decide a qué cola
          entra un turno cuando no se elige a mano. Con el calendario dices si
          recibe citas (bartender, recepción o caja no reciben, salvo que lo
          enciendas), con la llave le das entrada a Lalan y sus permisos, y con
          el reloj pones su horario y los días que no viene.
        </p>

        <div className="space-y-2">
          {(especialistas ?? []).map(e => {
            const recibe = recibeCitas(e.atiendeCitas, e.role);
            const porOficio = typeof e.atiendeCitas !== 'boolean';
            const nombre = e.name.split(' ')[0];
            return (
              <React.Fragment key={e.id}>
                <div
                  className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 ${
                    e.active
                      ? 'bg-slate-50 dark:bg-neutral-800/60 border-slate-200 dark:border-neutral-700'
                      : 'bg-slate-50/50 dark:bg-neutral-800/20 border-dashed border-slate-200 dark:border-neutral-800 opacity-60'
                  }`}
                >
                  {/* Quién es: foto y nombre */}
                  <div className="flex items-center gap-2 min-w-0 sm:flex-1 sm:min-w-[11rem]">
                    <button
                      type="button"
                      onClick={() => setFotoDe(fotoDe === e.id ? null : e.id)}
                      aria-label={e.fotoId ? `Foto de ${e.name}` : `Subir la foto de ${e.name}`}
                      aria-expanded={fotoDe === e.id}
                      title={e.fotoId ? 'Cambiar o acomodar su foto' : 'Subir su foto para la Vitrina'}
                      className={`shrink-0 rounded-full transition cursor-pointer ${fotoDe === e.id ? 'ring-2 ring-[var(--primary)] ring-offset-1 ring-offset-white dark:ring-offset-neutral-900' : 'hover:opacity-80'}`}
                    >
                      <AvatarEspecialista fotoId={e.fotoId} nombre={e.name} encuadre={e.fotoId ? encuadres[e.fotoId] : null} />
                    </button>
                    <input
                      key={`n-${e.id}-${e.name}`}
                      defaultValue={e.name}
                      aria-label="Nombre"
                      onBlur={ev => {
                        const v = ev.target.value.trim();
                        if (v && v !== e.name) void guardarEspecialista({ id: e.id, name: v });
                      }}
                      className={`${CAMPO} flex-1 text-[0.875rem] sm:text-xs font-semibold text-slate-900 dark:text-white`}
                    />
                  </div>

                  {/* Qué hace: especialidad y zona */}
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      key={`r-${e.id}-${e.role}`}
                      defaultValue={e.role}
                      aria-label="Especialidad"
                      onBlur={ev => {
                        const v = ev.target.value.trim();
                        if (v && v !== e.role) void guardarEspecialista({ id: e.id, name: e.name, role: v });
                      }}
                      placeholder="Especialidad"
                      className={`${CAMPO} flex-1 sm:flex-none sm:w-28 text-[0.8125rem] sm:text-[0.75rem] text-slate-600 dark:text-neutral-300`}
                    />
                    <select
                      value={e.zoneId ?? ''}
                      aria-label="Zona"
                      onChange={ev => guardarEspecialista({ id: e.id, name: e.name, zoneId: ev.target.value || null })}
                      className={`${CAMPO} flex-1 sm:flex-none sm:w-28 text-[0.8125rem] sm:text-[0.75rem] text-slate-600 dark:text-neutral-300`}
                    >
                      <option value="">Sin zona</option>
                      {zonasActivas.map(z => (
                        <option key={z.id} value={z.id}>{z.prefix} · {z.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sus botones: en el teléfono con nombre, para saber qué hace cada uno */}
                  <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap sm:gap-2">
                    {etiquetasPago?.[e.id] && (
                      <button
                        type="button"
                        onClick={() => onPago?.(e.id)}
                        title="Cómo se le paga. Toca para cambiarlo"
                        className={`shrink-0 h-9 sm:h-7 px-2.5 rounded-full text-[0.6875rem] font-bold transition cursor-pointer ${
                          etiquetasPago[e.id] === 'Sin acuerdo de pago'
                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                            : 'bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/15'
                        }`}
                      >
                        {etiquetasPago[e.id]}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void guardarEspecialista({ id: e.id, name: e.name, atiendeCitas: !recibe })}
                      aria-pressed={recibe}
                      aria-label={recibe ? `${e.name} recibe citas` : `${e.name} no recibe citas`}
                      title={`${recibe ? 'Recibe citas' : 'No recibe citas: Lalan nunca se la asigna'}${porOficio ? ' (por su especialidad)' : ''}. Toca para cambiarlo.`}
                      className={`shrink-0 h-9 sm:h-7 px-2.5 sm:px-0 sm:w-7 rounded-lg flex items-center justify-center gap-1.5 text-[0.75rem] font-semibold transition cursor-pointer ${
                        recibe ? 'text-emerald-600 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'
                      }`}
                    >
                      {recibe ? <CalendarCheck className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> : <CalendarOff className="w-4 h-4 sm:w-3.5 sm:h-3.5" />}
                      <span className="sm:hidden">{recibe ? 'Recibe citas' : 'Sin citas'}</span>
                    </button>
                    {variasSedes && (
                      <button
                        type="button"
                        onClick={() => setSedesAbiertas(sedesAbiertas === e.id ? null : e.id)}
                        aria-label={`Sedes donde trabaja ${e.name}`}
                        aria-expanded={sedesAbiertas === e.id}
                        title="En qué sedes trabaja"
                        className={`${claseBoton(sedesAbiertas === e.id || (e.sedes?.length ?? 0) > 1)} sm:w-auto sm:px-2 font-bold`}
                      >
                        <MapPin className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        <span className="sm:hidden">Sedes:</span>
                        {e.sedes?.length ? e.sedes.length : 'Todas'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEntradaDe(entradaDe === e.id ? null : e.id)}
                      aria-label={`Entrada a Lalan de ${e.name}`}
                      aria-expanded={entradaDe === e.id}
                      title="Entrada a Lalan y sus permisos"
                      className={claseBoton(entradaDe === e.id)}
                    >
                      <KeyRound className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      <span className="sm:hidden">Entrada</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHorarioDe(e.id)}
                      aria-label={`Horario de ${e.name}`}
                      title="Horario y días que no viene"
                      className={claseBoton(!!e.horarioSemanal)}
                    >
                      <CalendarClock className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      <span className="sm:hidden">Horario</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void quitar(e.id, nombre)}
                      aria-label={`Quitar a ${e.name}`}
                      title="Quitar"
                      className="shrink-0 ml-auto sm:ml-0 h-9 w-9 sm:h-7 sm:w-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Su foto: la de la Vitrina y el quiosco */}
                {fotoDe === e.id && (
                  <div className="sm:ml-2 p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700">
                    <FotoEspecialista
                      persona={e}
                      encuadre={e.fotoId ? encuadres[e.fotoId] : null}
                      onEncuadre={guardarEncuadre}
                      onCambio={loadEspecialistas}
                    />
                  </div>
                )}
                {/* Su entrada a Lalan: ve sus citas y lo que se le permita */}
                {entradaDe === e.id && (
                  <div className="sm:ml-2 p-3 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700">
                    <EntradaEspecialista staffId={e.id} nombre={e.name} telefono={e.phone ?? null} activa={e.active} />
                  </div>
                )}
                {/* En qué sedes trabaja: la primera que se marca es la suya */}
                {variasSedes && sedesAbiertas === e.id && (
                  <div className="sm:ml-2 p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 space-y-2">
                    <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">
                      ¿En qué sedes trabaja {nombre}? Lalan solo le da citas en las sedes marcadas.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {sedesDelSalon.map(sd => {
                        const marcada = (e.sedes ?? []).includes(sd.id);
                        return (
                          <button
                            key={sd.id}
                            type="button"
                            aria-pressed={marcada}
                            onClick={() => {
                              const actuales = e.sedes ?? [];
                              const nuevas = marcada ? actuales.filter(x => x !== sd.id) : [...actuales, sd.id];
                              void guardarEspecialista({ id: e.id, name: e.name, sedes: nuevas });
                            }}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.75rem] font-semibold border transition cursor-pointer ${
                              marcada ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-slate-50 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 border-slate-200 dark:border-neutral-700'
                            }`}
                          >
                            {marcada && <Check className="w-3 h-3" />} {sd.name}
                          </button>
                        );
                      })}
                    </div>
                    {!(e.sedes ?? []).length && (
                      <p className="text-[0.6875rem] text-slate-400">Sin ninguna marcada trabaja en todas las sedes.</p>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
          {!(especialistas ?? []).length && (
            <p className="py-3 text-center text-[0.75rem] text-slate-400">
              Todavía no hay nadie dado de alta.
            </p>
          )}
        </div>

        {/* Añadir: en el teléfono el nombre va solo arriba y el botón abajo, entero */}
        <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-2">
          <input
            value={nuevaPersona.name}
            onChange={ev => setNuevaPersona(p => ({ ...p, name: ev.target.value }))}
            placeholder="Nombre de la especialista"
            aria-label="Nombre de la especialista nueva"
            className="w-full sm:flex-1 min-w-0 px-3 py-2.5 sm:py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.875rem] sm:text-xs text-slate-900 dark:text-white"
          />
          <div className="flex items-center gap-2 min-w-0">
            <input
              value={nuevaPersona.role}
              onChange={ev => setNuevaPersona(p => ({ ...p, role: ev.target.value }))}
              placeholder="Especialidad"
              aria-label="Especialidad"
              className="flex-1 sm:flex-none sm:w-28 min-w-0 px-2.5 py-2.5 sm:py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem] sm:text-[0.75rem] text-slate-900 dark:text-white"
            />
            <select
              value={nuevaPersona.zoneId}
              onChange={ev => setNuevaPersona(p => ({ ...p, zoneId: ev.target.value }))}
              aria-label="Zona"
              className="flex-1 sm:flex-none sm:w-28 min-w-0 px-2.5 py-2.5 sm:py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem] sm:text-[0.75rem] text-slate-900 dark:text-white"
            >
              <option value="">Sin zona</option>
              {zonasActivas.map(z => (
                <option key={z.id} value={z.id}>{z.prefix} · {z.name}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={!nuevaPersona.name.trim()}
            onClick={async () => {
              const ok = await guardarEspecialista({
                name: nuevaPersona.name,
                role: nuevaPersona.role,
                zoneId: nuevaPersona.zoneId || null,
              });
              if (ok) setNuevaPersona({ name: '', role: '', zoneId: '' });
            }}
            className="w-full sm:w-auto shrink-0 px-3 py-2.5 sm:py-2 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] sm:text-[0.75rem] font-bold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4 sm:hidden" /> Añadir
          </button>
        </div>
      </div>

      {!sinPlantillaPermisos && <PlantillaPermisosEspecialista />}

      {persona && (
        <HorarioEspecialista
          persona={persona}
          semanaSalon={semanaCompleta(settings.horarioSemanal, settings.openingTime, settings.closingTime)}
          onCerrar={() => setHorarioDe(null)}
        />
      )}
    </>
  );
};
