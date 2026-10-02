import React, { useState } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { IOSModal } from '../ui/IOSModal';
import { IOSSegmentedControl } from '../ui/IOSSegmentedControl';
import { IOSToggle } from '../ui/IOSToggle';
import { SelectorHora } from '../ui/SelectorHora';
import { HorarioSemanal, DIAS_SEMANA } from './HorarioSemanal';
import { useAusencias } from '../../hooks/useAusencias';
import { cuandoNoViene, diasFueraDelSalon, fechaCorta } from '../../utils/turnos';
import { api } from '../../services/api';
import { useApp, type SalonStaff } from '../../context/AppContext';
import type { DiaDeHorario } from '../../types';

/**
 * El horario de una especialista y los días que no viene.
 *
 * Por defecto trabaja todo el horario del salón (no hay que tocar nada).
 * "Horario propio" es para el barbero que alquila silla y viene solo en la
 * tarde, o la masajista que no viene los lunes. Las ausencias son aparte:
 * vacaciones o un día libre no cambian su semana, y se acaban solas.
 */

const MODOS = [
  { id: 'salon', label: 'Igual que el salón' },
  { id: 'propio', label: 'Horario propio' },
] as const;
type Modo = (typeof MODOS)[number]['id'];

const hoyLocal = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

interface CitaAfectada { id: string; clientName: string; serviceName: string | null; startsAt: string }

export const HorarioEspecialista: React.FC<{
  persona: SalonStaff;
  semanaSalon: DiaDeHorario[];
  onCerrar: () => void;
}> = ({ persona, semanaSalon, onCerrar }) => {
  const { guardarEspecialista, showToast } = useApp();
  const nombre = persona.name.split(' ')[0];
  const [semana, setSemana] = useState<DiaDeHorario[] | null>(persona.horarioSemanal ?? null);
  const modo: Modo = semana ? 'propio' : 'salon';

  const guardarSemana = async (nueva: DiaDeHorario[] | null) => {
    const antes = semana;
    setSemana(nueva);
    const ok = await guardarEspecialista({ id: persona.id, name: persona.name, horarioSemanal: nueva });
    if (!ok) setSemana(antes);
  };

  const fuera = semana ? diasFueraDelSalon(semanaSalon, semana) : [];

  // ── Ausencias ──
  const { ausencias, motivos, motivo, recargar } = useAusencias(persona.id);
  const [anotando, setAnotando] = useState(false);
  const [nueva, setNueva] = useState({ motivo: 'vacaciones', desde: hoyLocal(), hasta: hoyLocal(), soloHoras: false, horaDesde: '14:00', horaHasta: '16:00', nota: '' });
  const [guardando, setGuardando] = useState(false);
  const [afectadas, setAfectadas] = useState<CitaAfectada[] | null>(null);

  const unSoloDia = nueva.desde === nueva.hasta;
  const problema = nueva.hasta < nueva.desde ? 'La última fecha no puede ser antes de la primera.'
    : nueva.soloHoras && unSoloDia && nueva.horaHasta <= nueva.horaDesde ? 'La hora de regreso tiene que ser después de la de salida.'
    : null;

  const anotar = async () => {
    setGuardando(true);
    try {
      const r = await api.post<{ citasAfectadas: CitaAfectada[] }>(`/salon/staff/${persona.id}/ausencias`, {
        motivo: nueva.motivo, desde: nueva.desde, hasta: nueva.hasta, nota: nueva.nota || undefined,
        ...(nueva.soloHoras && unSoloDia ? { horaDesde: nueva.horaDesde, horaHasta: nueva.horaHasta } : {}),
      });
      setAfectadas(r?.citasAfectadas?.length ? r.citasAfectadas : null);
      setAnotando(false);
      await recargar();
      showToast('Ausencia anotada', `Lalan no le agenda a ${nombre} ${unSoloDia ? 'ese día' : 'esos días'}.`, 'success');
    } catch (e: any) {
      showToast('No se pudo anotar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async (id: string) => {
    try { await api.delete(`/salon/ausencias/${id}`); await recargar(); }
    catch (e: any) { showToast('No se pudo quitar', e?.message ?? 'Inténtalo de nuevo.', 'warning'); }
  };

  const chip = (activo: boolean) =>
    `px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ios-touch ${
      activo ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
        : 'bg-white dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-300'}`;
  const campo = 'w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white text-sm dark:[color-scheme:dark]';

  return (
    <IOSModal isOpen onClose={onCerrar} title={persona.name} subtitle={persona.role}>
      <div className="space-y-6 text-xs pb-4">
        {/* ── Horario ── */}
        <section className="space-y-3">
          <IOSSegmentedControl
            options={MODOS.map(m => ({ id: m.id, label: m.label }))}
            value={modo}
            onChange={(id: string) => {
              if (id === modo) return;
              // Al pasar a horario propio se parte del del salón: solo cambia lo distinto
              void guardarSemana(id === 'propio' ? semanaSalon.map(d => ({ ...d, tramos: d.tramos.map(t => ({ ...t })) })) : null);
            }}
            size="sm"
          />
          {modo === 'salon' ? (
            <p className="text-[11px] text-slate-500 dark:text-neutral-400 leading-relaxed">
              {nombre} trabaja todo el horario del salón. Si viene solo algunos días o en otro horario, elige «Horario propio».
            </p>
          ) : (
            <>
              <HorarioSemanal
                semana={semana!}
                onGuardar={s => void guardarSemana(s)}
                titulo={`Horario de ${nombre}`}
                textoApagado="No trabaja"
                persona={nombre}
                enLinea
              />
              {fuera.length > 0 && (
                <p className="flex gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  <span>
                    El {fuera.map(d => DIAS_SEMANA[d].nombre.toLowerCase()).join(', ')} su horario se sale del del salón.
                    En esos ratos Lalan no le agenda: si de verdad atiende, amplía el horario del salón.
                  </span>
                </p>
              )}
            </>
          )}
        </section>

        {/* ── Ausencias ── */}
        <section className="space-y-2.5 pt-4 border-t border-slate-200/70 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-800 dark:text-white">Días que no viene</p>
            {!anotando && (
              <button type="button" onClick={() => { setAnotando(true); setAfectadas(null); }}
                className="text-[12px] font-bold text-[var(--primary)] flex items-center gap-1 ios-touch">
                <Plus className="w-3.5 h-3.5" /> Anotar
              </button>
            )}
          </div>

          {afectadas && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 space-y-1">
              <p className="text-[12px] font-bold text-amber-800 dark:text-amber-300">
                {nombre} tiene {afectadas.length} {afectadas.length === 1 ? 'cita' : 'citas'} en esas fechas
              </p>
              {afectadas.map(c => (
                <p key={c.id} className="text-[11px] text-amber-700 dark:text-amber-400">
                  {fechaCorta(c.startsAt.slice(0, 10))} · {new Date(c.startsAt).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit', hour12: true })} — {c.clientName}{c.serviceName ? ` · ${c.serviceName}` : ''}
                </p>
              ))}
              <p className="text-[11px] text-amber-700 dark:text-amber-400">Muévelas o pásaselas a otra persona desde la Agenda.</p>
            </div>
          )}

          {anotando && (
            <div className="p-3 rounded-xl border border-slate-200/70 dark:border-neutral-700/70 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {motivos.map(m => (
                  <button key={m.id} type="button" onClick={() => setNueva(n => ({ ...n, motivo: m.id }))} className={chip(nueva.motivo === m.id)}>
                    {m.emoji} {m.descripcion}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">Desde</span>
                  <input type="date" value={nueva.desde} min={hoyLocal()}
                    onChange={e => setNueva(n => ({ ...n, desde: e.target.value, hasta: n.hasta < e.target.value ? e.target.value : n.hasta }))}
                    className={campo} />
                </label>
                <label className="space-y-1">
                  <span className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">Hasta (incluido)</span>
                  <input type="date" value={nueva.hasta} min={nueva.desde} onChange={e => setNueva(n => ({ ...n, hasta: e.target.value }))} className={campo} />
                </label>
              </div>
              {unSoloDia && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Solo unas horas</span>
                    <IOSToggle checked={nueva.soloHoras} onChange={v => setNueva(n => ({ ...n, soloHoras: v }))} />
                  </div>
                  {nueva.soloHoras && (
                    <div className="grid grid-cols-[4.5rem_1fr] items-center gap-x-2 gap-y-2">
                      <span className="text-[11px] text-slate-500">Sale</span>
                      <SelectorHora value={nueva.horaDesde} onChange={v => setNueva(n => ({ ...n, horaDesde: v }))} paso={15} />
                      <span className="text-[11px] text-slate-500">Regresa</span>
                      <SelectorHora value={nueva.horaHasta} onChange={v => setNueva(n => ({ ...n, horaHasta: v }))} paso={15} />
                    </div>
                  )}
                </div>
              )}
              <input value={nueva.nota} onChange={e => setNueva(n => ({ ...n, nota: e.target.value }))} maxLength={200}
                placeholder="Nota para el equipo (opcional, la clienta no la ve)" className={campo} />
              {problema && <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">{problema}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setAnotando(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-[12px] font-bold text-slate-600 dark:text-slate-300 ios-touch">
                  Cancelar
                </button>
                <button type="button" disabled={!!problema || guardando} onClick={anotar}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--primary)] text-white text-[12px] font-bold ios-touch disabled:opacity-40">
                  {guardando ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          {ausencias.length ? (
            <ul className="space-y-1.5">
              {ausencias.map(a => (
                <li key={a.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60">
                  <span className="text-base">{motivos.find(m => m.id === a.motivo)?.emoji ?? '•'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-slate-800 dark:text-slate-100">{motivo(a.motivo)}</p>
                    <p className="text-[11px] text-slate-500 dark:text-neutral-400 truncate">
                      {cuandoNoViene(a)}{a.nota ? ` · ${a.nota}` : ''}
                    </p>
                  </div>
                  <button type="button" onClick={() => quitar(a.id)} aria-label="Quitar ausencia"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 ios-touch">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : !anotando && (
            <p className="text-[11px] text-slate-400">
              Nada anotado. Vacaciones, un día libre o unas horas: anótalo aquí y Lalan no le agenda esos ratos.
            </p>
          )}
        </section>
      </div>
    </IOSModal>
  );
};

