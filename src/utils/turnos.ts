import type { AusenciaEspecialista, DiaDeHorario, TramoHorario } from '../types';
import { hora12 } from './hora';

/**
 * Cuándo trabaja una especialista. Lo mismo que calcula el servidor
 * (common/horario.ts): su horario propio DENTRO del del salón, menos sus
 * ausencias. Aquí solo sirve para enseñarlo; quien decide es el servidor.
 */

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const aHHmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

function intersectar(a: TramoHorario[], b: TramoHorario[]): TramoHorario[] {
  const r: TramoHorario[] = [];
  for (const x of a) for (const y of b) {
    const d = Math.max(minutos(x.desde), minutos(y.desde));
    const h = Math.min(minutos(x.hasta), minutos(y.hasta));
    if (h > d) r.push({ desde: aHHmm(d), hasta: aHHmm(h) });
  }
  return r.sort((p, q) => minutos(p.desde) - minutos(q.desde));
}

/** Los días en que su horario se sale del del salón (para avisar: ahí no se le agenda) */
export function diasFueraDelSalon(salon: DiaDeHorario[], propia: DiaDeHorario[]): number[] {
  return propia.filter(p => {
    if (!p.abierto) return false;
    const s = salon.find(x => x.dia === p.dia);
    const dentro = s?.abierto ? intersectar(s.tramos, p.tramos) : [];
    const largo = (ts: TramoHorario[]) => ts.reduce((n, t) => n + minutos(t.hasta) - minutos(t.desde), 0);
    return largo(dentro) < largo(p.tramos);
  }).map(p => p.dia);
}

/** "2026-10-10" → día de la semana (0 = domingo) */
export const diaDeFecha = (fecha: string) => new Date(`${fecha}T12:00:00Z`).getUTCDay();

/** "10 oct" */
export const fechaCorta = (fecha: string) =>
  new Date(`${fecha}T12:00:00Z`).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "del 10 al 15 oct", "el 10 oct de 2:00 p. m. a 4:00 p. m." */
export function cuandoNoViene(a: AusenciaEspecialista): string {
  if (a.desde !== a.hasta) return `del ${fechaCorta(a.desde)} al ${fechaCorta(a.hasta)}`;
  return `el ${fechaCorta(a.desde)}${a.horaDesde && a.horaHasta ? ` de ${hora12(a.horaDesde)} a ${hora12(a.horaHasta)}` : ''}`;
}

export interface EstadoDelDia {
  trabaja: boolean;
  /** "No trabaja los jueves", "Vacaciones", "Sale de 2:00 p. m. a 4:00 p. m." */
  detalle: string | null;
}

/** ¿Trabaja esa persona ese día? (para la Agenda y la hoja de nueva cita) */
export function estadoDelDia(
  staff: { id: string; horarioSemanal?: DiaDeHorario[] | null },
  fecha: string,
  salon: DiaDeHorario[],
  ausencias: AusenciaEspecialista[],
  motivo: (id: string) => string,
): EstadoDelDia {
  const aus = ausencias.find(a => a.staffId === staff.id && a.desde <= fecha && a.hasta >= fecha);
  if (aus && !aus.horaDesde) return { trabaja: false, detalle: motivo(aus.motivo) };
  const dia = diaDeFecha(fecha);
  const s = salon.find(x => x.dia === dia);
  const p = staff.horarioSemanal?.find(x => x.dia === dia);
  if (s && !s.abierto) return { trabaja: false, detalle: 'El salón no abre' };
  if (p && !p.abierto) return { trabaja: false, detalle: 'No trabaja este día' };
  if (p && s && !intersectar(s.tramos, p.tramos).length) return { trabaja: false, detalle: 'Su horario no coincide con el del salón' };
  if (aus?.horaDesde && aus.horaHasta) return { trabaja: true, detalle: `Sale de ${hora12(aus.horaDesde)} a ${hora12(aus.horaHasta)}` };
  if (p && s) return { trabaja: true, detalle: intersectar(s.tramos, p.tramos).map(t => `${hora12(t.desde)} – ${hora12(t.hasta)}`).join(' · ') };
  return { trabaja: true, detalle: null };
}

function restar(tramos: TramoHorario[], q: TramoHorario): TramoHorario[] {
  const qd = minutos(q.desde), qh = minutos(q.hasta);
  return tramos.flatMap(t => {
    const d = minutos(t.desde), h = minutos(t.hasta);
    if (qh <= d || qd >= h) return [t];
    return [
      ...(qd > d ? [{ desde: t.desde, hasta: q.desde }] : []),
      ...(qh < h ? [{ desde: q.hasta, hasta: t.hasta }] : []),
    ];
  });
}

/**
 * Los ratos en que se puede agendar ese día: los del salón, o —si se eligió
 * a alguien— los suyos (su horario dentro del del salón, menos ausencias).
 * Misma regla que aplica el servidor al guardar.
 */
export function turnosParaAgendar(
  staff: { id: string; horarioSemanal?: DiaDeHorario[] | null } | null,
  fecha: string,
  salon: DiaDeHorario[],
  ausencias: AusenciaEspecialista[],
): TramoHorario[] {
  const s = salon.find(x => x.dia === diaDeFecha(fecha));
  if (!s?.abierto) return [];
  if (!staff) return s.tramos;
  const p = staff.horarioSemanal?.find(x => x.dia === s.dia);
  let tramos = p ? (p.abierto ? intersectar(s.tramos, p.tramos) : []) : s.tramos;
  for (const a of ausencias) {
    if (a.staffId !== staff.id || a.desde > fecha || a.hasta < fecha) continue;
    if (!a.horaDesde || !a.horaHasta) return [];
    tramos = restar(tramos, { desde: a.horaDesde, hasta: a.horaHasta });
  }
  return tramos;
}

/** ¿Cabe una cita de `duracionMin` que empieza a las `hhmm` en alguno de esos ratos? */
export function cabeEn(tramos: TramoHorario[], hhmm: string, duracionMin: number): boolean {
  const d = minutos(hhmm), h = d + duracionMin;
  return tramos.some(t => d >= minutos(t.desde) && h <= minutos(t.hasta));
}

/** "9:00 – 10:00 a. m. · 2:00 – 3:00 p. m." */
export const ratos = (tramos: TramoHorario[]) => tramos.map(t => `${hora12(t.desde)} – ${hora12(t.hasta)}`).join(' · ');
