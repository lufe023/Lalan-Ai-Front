import React, { useMemo, useState } from 'react';
import { CalendarDays, Check, Moon, Plus, X } from 'lucide-react';
import { IOSModal } from '../ui/IOSModal';
import { IOSToggle } from '../ui/IOSToggle';
import { SelectorHora } from '../ui/SelectorHora';
import { hora12 } from '../../utils/hora';
import type { DiaDeHorario, TramoHorario } from '../../types';

/**
 * El horario de la semana, día por día.
 *
 * Pensado para que la dueña no tenga que configurar siete veces lo mismo:
 * arregla un día y, en el mismo paso, lo copia a los días que quiera
 * ("de lunes a viernes igual", "el sábado igual que el domingo"). Cerrar un
 * día es un interruptor; media jornada o cerrar a almorzar, un toque.
 *
 * Un día puede tener varios turnos (8–12 y 2–6): Lalan nunca agenda una
 * cita que cruce la pausa.
 *
 * Se guarda al momento: no depende del botón de abajo de Parámetros.
 */

/** 0 = domingo, igual que en el servidor */
export const DIAS_SEMANA = [
  { id: 0, nombre: 'Domingo', corto: 'Dom' },
  { id: 1, nombre: 'Lunes', corto: 'Lun' },
  { id: 2, nombre: 'Martes', corto: 'Mar' },
  { id: 3, nombre: 'Miércoles', corto: 'Mié' },
  { id: 4, nombre: 'Jueves', corto: 'Jue' },
  { id: 5, nombre: 'Viernes', corto: 'Vie' },
  { id: 6, nombre: 'Sábado', corto: 'Sáb' },
] as const;
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];
const nombreDe = (dia: number) => DIAS_SEMANA[dia].nombre;
const cortoDe = (dia: number) => DIAS_SEMANA[dia].corto;

/** Atajos para elegir a qué días copiar */
const GRUPOS_DE_DIAS = [
  { id: 'entre_semana', descripcion: 'Lun a Vie', dias: [1, 2, 3, 4, 5] },
  { id: 'fin_de_semana', descripcion: 'Sáb y Dom', dias: [6, 0] },
  { id: 'todos', descripcion: 'Todos', dias: ORDEN_SEMANA },
] as const;

/** Igual que el servidor: más de tres turnos en un día es un error de dedo */
const MAXIMO_TURNOS = 3;
/** Dónde se parte el día para "solo mañana" / "solo tarde" */
const HORA_DE_CORTE = '13:00';
/** La pausa de almuerzo que se propone; luego se ajusta a gusto */
const PAUSA_ALMUERZO = { desde: '12:00', hasta: '14:00' };
const JORNADA_POR_DEFECTO: TramoHorario = { desde: '09:00', hasta: '20:00' };

const TIPOS_DE_JORNADA = [
  { id: 'completa', descripcion: 'Corrida' },
  { id: 'almuerzo', descripcion: 'Con pausa de almuerzo' },
  { id: 'manana', descripcion: 'Solo mañana' },
  { id: 'tarde', descripcion: 'Solo tarde' },
] as const;
type TipoDeJornada = (typeof TIPOS_DE_JORNADA)[number]['id'];

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const aHHmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const rango = (t: TramoHorario) => `${hora12(t.desde)} – ${hora12(t.hasta)}`;
const mismos = (a: TramoHorario[], b: TramoHorario[]) =>
  a.length === b.length && a.every((t, i) => t.desde === b[i].desde && t.hasta === b[i].hasta);

/** La semana completa, de lunes a domingo, aunque llegue incompleta o con la forma vieja de un solo tramo */
export function semanaCompleta(semana: any[] | undefined, desde = JORNADA_POR_DEFECTO.desde, hasta = JORNADA_POR_DEFECTO.hasta): DiaDeHorario[] {
  return ORDEN_SEMANA.map(dia => {
    const d = semana?.find(x => x?.dia === dia);
    if (!d) return { dia, abierto: true, tramos: [{ desde, hasta }] };
    const tramos: TramoHorario[] = Array.isArray(d.tramos) && d.tramos.length ? d.tramos : [{ desde: d.desde ?? desde, hasta: d.hasta ?? hasta }];
    return { dia, abierto: !!d.abierto, tramos };
  });
}

/** El primer y último minuto que más se repiten: la jornada "normal" de este salón */
function jornadaHabitual(semana: DiaDeHorario[]): TramoHorario {
  const cuenta = new Map<string, number>();
  for (const d of semana) {
    if (!d.abierto) continue;
    const k = `${d.tramos[0].desde}|${d.tramos[d.tramos.length - 1].hasta}`;
    cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
  }
  const masComun = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!masComun) return JORNADA_POR_DEFECTO;
  const [desde, hasta] = masComun.split('|');
  return { desde, hasta };
}

/** Por qué los turnos no sirven, o null si están bien */
function problemaDeTurnos(tramos: TramoHorario[]): string | null {
  for (const t of tramos) if (minutos(t.hasta) <= minutos(t.desde)) return 'Cada turno tiene que cerrar después de abrir.';
  const orden = [...tramos].sort((a, b) => minutos(a.desde) - minutos(b.desde));
  for (let i = 1; i < orden.length; i++) {
    if (minutos(orden[i].desde) < minutos(orden[i - 1].hasta)) return 'Dos turnos se pisan: el segundo tiene que abrir después de que cierre el primero.';
  }
  return null;
}

export const HorarioSemanal: React.FC<{
  semana: DiaDeHorario[];
  onGuardar: (semana: DiaDeHorario[]) => void;
  /** Título de la lista ("Horario de la semana", "Horario de Pedro") */
  titulo?: string;
  /** Qué dice un día apagado: "Cerrado" para el salón, "No trabaja" para una persona */
  textoApagado?: string;
  /**
   * Dentro de otra hoja (la de una especialista) no se puede abrir una hoja
   * encima: el día se edita en el mismo lugar, con "Volver".
   */
  enLinea?: boolean;
  /** El nombre de la especialista, si el horario es de una persona y no del salón */
  persona?: string;
}> = ({ semana, onGuardar, titulo = 'Horario de la semana', textoApagado = 'Cerrado', enLinea = false, persona }) => {
  const [editando, setEditando] = useState<DiaDeHorario | null>(null);
  const habitual = useMemo(() => jornadaHabitual(semana), [semana]);

  const cambiarAbierto = (dia: number, abierto: boolean) =>
    onGuardar(semana.map(d => (d.dia === dia ? { ...d, abierto } : d)));

  const guardarDia = (nuevo: DiaDeHorario, tambien: number[]) => {
    const aplicar = new Set([nuevo.dia, ...tambien]);
    onGuardar(semana.map(d => (aplicar.has(d.dia) ? { ...nuevo, dia: d.dia } : d)));
    setEditando(null);
  };

  if (enLinea && editando) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => setEditando(null)} className="text-[0.8125rem] font-bold text-[var(--primary)] ios-touch">
          ‹ Volver a la semana
        </button>
        <p className="text-[1rem] font-bold text-slate-900 dark:text-white">{nombreDe(editando.dia)}</p>
        <ContenidoDia dia={editando} habitual={habitual} semana={semana} onGuardar={guardarDia} persona={persona} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
          <CalendarDays className="w-4 h-4 text-[var(--primary)]" />
          <span>{titulo}</span>
        </div>
        <span className="text-[0.6875rem] text-slate-400">Toca un día para cambiarlo</span>
      </div>

      <ul className="rounded-xl border border-slate-200/70 dark:border-neutral-700/70 divide-y divide-slate-200/70 dark:divide-neutral-800 overflow-hidden">
        {semana.map(d => (
          <li key={d.dia} className="flex items-center gap-2 bg-slate-50 dark:bg-neutral-800/60">
            <button
              type="button"
              onClick={() => setEditando(d)}
              className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5 text-left ios-touch"
            >
              <span className={`w-20 shrink-0 text-[0.8125rem] font-bold ${d.abierto ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-neutral-500'}`}>
                {nombreDe(d.dia)}
              </span>
              {d.abierto ? (
                <span className="flex flex-col text-[0.8125rem] font-semibold text-slate-700 dark:text-slate-200 tabular-nums leading-snug">
                  {d.tramos.map((t, i) => <span key={i}>{rango(t)}</span>)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-slate-400 dark:text-neutral-500">
                  <Moon className="w-3 h-3" /> {textoApagado}
                </span>
              )}
            </button>
            <div className="pr-3">
              <IOSToggle checked={d.abierto} onChange={v => cambiarAbierto(d.dia, v)} />
            </div>
          </li>
        ))}
      </ul>

      {editando && !enLinea && (
        <IOSModal isOpen onClose={() => setEditando(null)} title={nombreDe(editando.dia)}>
          <ContenidoDia dia={editando} habitual={habitual} semana={semana} onGuardar={guardarDia} persona={persona} />
        </IOSModal>
      )}
    </div>
  );
};

const ContenidoDia: React.FC<{
  dia: DiaDeHorario;
  habitual: TramoHorario;
  semana: DiaDeHorario[];
  onGuardar: (dia: DiaDeHorario, tambien: number[]) => void;
  persona?: string;
}> = ({ dia, habitual, semana, onGuardar, persona }) => {
  const [abierto, setAbierto] = useState(dia.abierto);
  const [tramos, setTramos] = useState<TramoHorario[]>(dia.tramos);
  const [tambien, setTambien] = useState<number[]>([]);

  const problema = abierto ? problemaDeTurnos(tramos) : null;
  const otros = ORDEN_SEMANA.filter(x => x !== dia.dia);

  const plantillas: Record<TipoDeJornada, TramoHorario[]> = {
    completa: [habitual],
    almuerzo: minutos(habitual.desde) < minutos(PAUSA_ALMUERZO.desde) && minutos(habitual.hasta) > minutos(PAUSA_ALMUERZO.hasta)
      ? [{ desde: habitual.desde, hasta: PAUSA_ALMUERZO.desde }, { desde: PAUSA_ALMUERZO.hasta, hasta: habitual.hasta }]
      : [{ desde: '08:00', hasta: PAUSA_ALMUERZO.desde }, { desde: PAUSA_ALMUERZO.hasta, hasta: '18:00' }],
    manana: [{ desde: habitual.desde, hasta: HORA_DE_CORTE }],
    tarde: [{ desde: HORA_DE_CORTE, hasta: habitual.hasta }],
  };
  const tipoActual = TIPOS_DE_JORNADA.find(t => mismos(plantillas[t.id], tramos))?.id ?? null;

  const elegirJornada = (tipo: TipoDeJornada) => { setAbierto(true); setTramos(plantillas[tipo]); };
  const cambiarTramo = (i: number, campo: keyof TramoHorario, valor: string) =>
    setTramos(ts => ts.map((t, j) => (j === i ? { ...t, [campo]: valor } : t)));
  const quitarTramo = (i: number) => setTramos(ts => ts.filter((_, j) => j !== i));
  /** El turno nuevo empieza una hora después de que cierre el último */
  const agregarTramo = () => setTramos(ts => {
    const ultimo = minutos(ts[ts.length - 1].hasta);
    const desde = Math.min(ultimo + 60, 22 * 60);
    return [...ts, { desde: aHHmm(desde), hasta: aHHmm(Math.min(desde + 4 * 60, 23 * 60 + 45)) }];
  });

  const alternar = (d: number) => setTambien(t => (t.includes(d) ? t.filter(x => x !== d) : [...t, d]));
  const elegirGrupo = (dias: readonly number[]) => {
    const delGrupo = dias.filter(d => d !== dia.dia);
    const todosPuestos = delGrupo.every(d => tambien.includes(d));
    setTambien(t => (todosPuestos ? t.filter(x => !delGrupo.includes(x)) : [...new Set([...t, ...delGrupo])]));
  };

  const guardar = () => {
    const orden = [...tramos].sort((a, b) => minutos(a.desde) - minutos(b.desde));
    onGuardar({ dia: dia.dia, abierto, tramos: orden }, tambien);
  };

  const cuantos = tambien.length + 1;
  const textoGuardar = cuantos === 1 ? `Guardar ${nombreDe(dia.dia).toLowerCase()}` : `Guardar en ${cuantos} días`;
  const chip = (activo: boolean) =>
    `px-3 py-1.5 rounded-full text-[0.75rem] font-bold border transition-colors ios-touch ${
      activo
        ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
        : 'bg-white dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-300'
    }`;

  return (
      <div className="space-y-5 text-xs pb-2">
        {/* Abierto o cerrado */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/60">
          <div>
            <p className="text-[0.875rem] font-bold text-slate-800 dark:text-white">
              {persona ? (abierto ? 'Trabaja este día' : 'No trabaja este día') : (abierto ? 'Abre este día' : 'Cerrado este día')}
            </p>
            <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">
              {persona
                ? (abierto ? `Lalan le agenda a ${persona} solo dentro de estos turnos.` : `Lalan no le agenda citas a ${persona} este día.`)
                : (abierto ? 'Lalan agenda solo dentro de estos turnos.' : 'Lalan no ofrece citas este día, pero sigue contestando.')}
            </p>
          </div>
          <IOSToggle checked={abierto} onChange={setAbierto} />
        </div>

        {abierto && (
          <>
            <div className="space-y-2">
              <p className="text-[0.75rem] font-bold text-slate-700 dark:text-slate-300">Jornada</p>
              <div className="flex flex-wrap gap-1.5">
                {TIPOS_DE_JORNADA.map(t => (
                  <button key={t.id} type="button" onClick={() => elegirJornada(t.id)} className={chip(tipoActual === t.id)}>
                    {t.descripcion}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {tramos.map((t, i) => (
                <div key={i} className="p-3 rounded-xl border border-slate-200/70 dark:border-neutral-700/70 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[0.75rem] font-bold text-slate-700 dark:text-slate-300">
                      {tramos.length === 1 ? 'Horario' : `Turno ${i + 1}`}
                    </p>
                    {tramos.length > 1 && (
                      <button type="button" onClick={() => quitarTramo(i)} aria-label={`Quitar turno ${i + 1}`}
                        className="p-1 -m-1 rounded-full text-slate-400 hover:text-rose-500 ios-touch">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-[4.5rem_1fr] items-center gap-x-2 gap-y-2">
                    <span className="text-[0.75rem] text-slate-500 dark:text-neutral-400">Abre</span>
                    <SelectorHora value={t.desde} onChange={v => cambiarTramo(i, 'desde', v)} paso={15} etiqueta={`Turno ${i + 1}: abre`} />
                    <span className="text-[0.75rem] text-slate-500 dark:text-neutral-400">Cierra</span>
                    <SelectorHora value={t.hasta} onChange={v => cambiarTramo(i, 'hasta', v)} paso={15} etiqueta={`Turno ${i + 1}: cierra`} />
                  </div>
                </div>
              ))}

              {tramos.length < MAXIMO_TURNOS && (
                <button type="button" onClick={agregarTramo}
                  className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-neutral-600 text-[0.8125rem] font-bold text-[var(--primary)] flex items-center justify-center gap-1 ios-touch">
                  <Plus className="w-3.5 h-3.5" />
                  {tramos.length === 1 ? 'Agregar otro turno (cierras y vuelves a abrir)' : 'Agregar otro turno'}
                </button>
              )}

              {problema && <p className="text-[0.75rem] font-semibold text-amber-600 dark:text-amber-400">{problema}</p>}
            </div>
          </>
        )}

        {/* Copiar a otros días */}
        <div className="space-y-2 pt-3 border-t border-slate-200/70 dark:border-neutral-800">
          <p className="text-[0.75rem] font-bold text-slate-700 dark:text-slate-300">Usar este mismo horario también el…</p>
          <div className="flex flex-wrap gap-1.5">
            {otros.map(d => {
              const actual = semana.find(x => x.dia === d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => alternar(d)}
                  className={chip(tambien.includes(d))}
                  title={actual ? (actual.abierto ? `Ahora: ${actual.tramos.map(rango).join(' · ')}` : 'Ahora: cerrado') : undefined}
                >
                  {tambien.includes(d) && <Check className="inline w-3 h-3 -mt-0.5 mr-0.5" />}
                  {cortoDe(d)}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3">
            {GRUPOS_DE_DIAS.map(g => (
              <button key={g.id} type="button" onClick={() => elegirGrupo(g.dias)} className="text-[0.75rem] font-bold text-[var(--primary)] ios-touch">
                {g.descripcion}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={!!problema}
          onClick={guardar}
          className="w-full py-3 rounded-xl bg-[var(--primary)] text-white text-[0.875rem] font-bold ios-touch disabled:opacity-40"
        >
          {textoGuardar}
        </button>
      </div>
  );
};
