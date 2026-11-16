import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, Clock, Loader2, MapPin, Pencil, Plus, Repeat, Trash2, UserRound } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useSedeActiva } from '../context/SedeActivaContext';
import { IOSHeader } from '../components/ui/IOSHeader';
import { PageContent } from '../components/ui/PageContent';
import { useConfirmar } from '../components/ui/ModalConfirmar';
import { alRecibir } from '../services/socket';
import {
  AVISAR_ANTES, EVENTO_PENDIENTES, REPETIR, avisarCambioPendientes, cuandoConAviso, cuandoCorto, pendientesApi,
  type FiltroPendientes, type Pendiente, type PersonaDelEquipo, type Repetir,
} from '../services/pendientes';

const FILTROS: { id: FiltroPendientes; nombre: string }[] = [
  { id: 'todos', nombre: 'Todos' },
  { id: 'mios', nombre: 'Míos' },
  { id: 'encargados', nombre: 'Encargos' },
  { id: 'hechos', nombre: 'Hechos' },
];

/** Atajos de cuándo: lo que la dueña elegiría sin pensar */
const CUANDO: { id: string; nombre: string; calcular: () => Date }[] = [
  { id: 'hora', nombre: 'En 1 hora', calcular: () => new Date(Date.now() + 3_600_000) },
  { id: 'tarde', nombre: 'Hoy 5 p. m.', calcular: () => aLas(0, 17) },
  { id: 'manana', nombre: 'Mañana 9 a. m.', calcular: () => aLas(1, 9) },
  { id: 'otro', nombre: 'Otro día', calcular: () => aLas(1, 9) },
];

function aLas(dias: number, hora: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(hora, 0, 0, 0);
  return d;
}

/** "2026-11-16T10:00" en hora del aparato, para el campo de fecha y hora */
const paraCampo = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return z.toISOString().slice(0, 16);
};

const iniciales = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

/**
 * Recordatorios y encargos: lo que la dueña no quiere olvidar y lo que le
 * encarga a su equipo. Cada uno con su botón (Listo, Pospón, Quitar) y, en
 * los encargos, quién lo tiene y cuándo lo hizo. Lalan los crea también
 * cuando se lo piden hablando.
 */
export const RecordatoriosScreen: React.FC = () => {
  const { goBack, showToast } = useApp();
  const { currentUser } = useAuth();
  const { varias, sedes, actual, fija } = useSedeActiva();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [filtro, setFiltro] = useState<FiltroPendientes>('todos');
  const [lista, setLista] = useState<Pendiente[] | null>(null);
  const [equipo, setEquipo] = useState<PersonaDelEquipo[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [resaltado] = useState<string | null>(() => {
    try {
      const a = sessionStorage.getItem('lalan.abrirAviso');
      if (a?.startsWith('recordatorio:')) { sessionStorage.removeItem('lalan.abrirAviso'); return a.slice('recordatorio:'.length); }
    } catch { /* nada */ }
    return null;
  });

  // El formulario de uno nuevo
  const [texto, setTexto] = useState('');
  const [cuando, setCuando] = useState('manana');
  const [fechaOtra, setFechaOtra] = useState(() => paraCampo(aLas(1, 9)));
  const [antes, setAntes] = useState(0);
  const [repetir, setRepetir] = useState<Repetir | ''>('');
  const [para, setPara] = useState('');
  const [sede, setSede] = useState('');
  const [guardando, setGuardando] = useState(false);
  /** El que se está cambiando (el mismo formulario, con sus datos) */
  const [editando, setEditando] = useState<Pendiente | null>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const puedeEncargar = currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || currentUser?.role === 'assistant';

  const cargar = useCallback(async () => {
    try { setLista(await pendientesApi.lista(filtro)); }
    catch (e) { showToast('No se pudieron cargar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); setLista([]); }
  }, [filtro, showToast]);

  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => { if (puedeEncargar) pendientesApi.equipo().then(setEquipo).catch(() => undefined); }, [puedeEncargar, actual?.id]);
  useEffect(() => {
    const otra = () => void cargar();
    window.addEventListener(EVENTO_PENDIENTES, otra);
    const fuera = alRecibir('avisos:nuevo', otra);
    return () => { window.removeEventListener(EVENTO_PENDIENTES, otra); fuera(); };
  }, [cargar]);

  // La sede del recordatorio: la activa; en «Todas las sedes» hay que elegir (o la de la persona del encargo)
  // Al cambiar uno, la sede es la suya (y se puede mover si el salón tiene varias)
  const personaElegida = equipo.find((p) => p.id === para);
  const pideSede = editando ? varias && !fija : varias && !fija && !actual && !personaElegida?.locationId;
  const sedeFinal = editando ? (sede || editando.sede.id) : actual?.id || personaElegida?.locationId || sede || (sedes.length === 1 ? sedes[0].id : '');
  const otros = useMemo(() => equipo.filter((p) => !p.yo && (!sedeFinal || !p.locationId || p.locationId === sedeFinal)), [equipo, sedeFinal]);

  const limpiar = () => { setTexto(''); setRepetir(''); setPara(''); setAntes(0); setSede(''); setCuando('manana'); setEditando(null); };

  /** Abre el formulario con los datos de uno ya creado */
  const cambiar = (p: Pendiente) => {
    setEditando(p);
    setTexto(p.texto);
    setCuando('otro');
    setFechaOtra(paraCampo(new Date(p.vence)));
    setAntes(p.antesMin ?? 0);
    setRepetir(p.repetir ?? '');
    setPara(p.relacion === 'encargue' ? p.para.id : '');
    setSede(p.sede.id);
    requestAnimationFrame(() => {
      formulario.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('recordatorio-texto')?.focus({ preventScroll: true });
    });
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = texto.trim();
    if (t.length < 2) { showToast('Escribe qué hay que recordar', '', 'warning'); return; }
    if (pideSede && !sedeFinal) { showToast('Elige la sede', 'Este salón tiene varias sedes: dime en cuál va.', 'warning'); return; }
    const vence = cuando === 'otro' ? new Date(fechaOtra) : CUANDO.find((c) => c.id === cuando)!.calcular();
    if (Number.isNaN(vence.getTime())) { showToast('Elige cuándo', '', 'warning'); return; }
    setGuardando(true);
    try {
      if (editando) {
        // Solo lo que cambió: si la hora es la misma, no se vuelve a avisar
        const mismaHora = paraCampo(new Date(editando.vence)) === paraCampo(vence);
        const r = await pendientesApi.editar(editando.id, {
          texto: t, repetir: repetir || null, paraUserId: para || null, sede: sedeFinal || null,
          ...(mismaHora ? {} : { vence: vence.toISOString() }),
          ...(mismaHora && antes === (editando.antesMin ?? 0) ? {} : { antesMin: antes }),
        });
        limpiar();
        avisarCambioPendientes();
        showToast('Cambiado', cuandoConAviso(r.vence, r.avisarEn), 'success');
        void cargar();
        return;
      }
      await pendientesApi.crear({ texto: t, vence: vence.toISOString(), antesMin: antes || null, repetir: repetir || null, paraUserId: para || null, sede: sedeFinal || null });
      limpiar();
      avisarCambioPendientes();
      showToast(para ? `Encargado a ${personaElegida?.name.split(' ')[0] ?? ''}` : 'Te lo recuerdo', cuandoCorto(vence.toISOString()), 'success');
      void cargar();
    } catch (err) {
      showToast('No se pudo guardar', (err as Error)?.message || 'Inténtalo de nuevo.', 'warning');
    } finally { setGuardando(false); }
  };

  const hacer = async (p: Pendiente, accion: () => Promise<unknown>, listo: string) => {
    setOcupado(p.id);
    try { await accion(); avisarCambioPendientes(); showToast(listo, p.texto, 'success'); void cargar(); }
    catch (err) { showToast('No se pudo', (err as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
    finally { setOcupado(null); }
  };

  const quitar = async (p: Pendiente) => {
    const si = await confirmar({ titulo: '¿Quitar este recordatorio?', mensaje: p.texto, textoConfirmar: 'Quitar', tono: 'peligro' });
    if (si) void hacer(p, () => pendientesApi.quitar(p.id), 'Quitado');
  };

  const chip = (activo: boolean) => `min-h-[36px] px-3 rounded-full text-[0.75rem] font-bold whitespace-nowrap cursor-pointer transition ${activo ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white border border-slate-200 text-slate-700 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-300'}`;
  const campo = 'w-full min-h-[44px] px-3.5 rounded-2xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.9375rem] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-neutral-950">
      <IOSHeader title="Recordatorios" subtitle="Lo tuyo y lo que le encargas a tu equipo" showBack onBack={goBack} />
      <PageContent>
        <form ref={formulario} onSubmit={guardar} className={`rounded-3xl border bg-white dark:bg-neutral-900 p-4 mb-4 space-y-3 scroll-mt-4 ${editando ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/25' : 'border-slate-200/80 dark:border-neutral-800'}`}>
          <label htmlFor="recordatorio-texto" className="text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--primary)]">{editando ? 'Cambiar recordatorio' : 'Nuevo recordatorio'}</label>
          <input id="recordatorio-texto" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={300}
            placeholder={para ? 'Qué tiene que hacer…' : 'Qué te recuerdo…'} className={campo} />

          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cuándo">
            {CUANDO.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={cuando === c.id} onClick={() => setCuando(c.id)} className={chip(cuando === c.id)}>{c.nombre}</button>
            ))}
          </div>
          {cuando === 'otro' && (
            <div>
              <label htmlFor="recordatorio-fecha" className="sr-only">Fecha y hora</label>
              <input id="recordatorio-fecha" type="datetime-local" value={fechaOtra} onChange={(e) => setFechaOtra(e.target.value)} className={campo} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label htmlFor="recordatorio-antes" className="block text-[0.75rem] font-semibold text-slate-500 dark:text-neutral-400 mb-1">{para ? 'Avisarle' : 'Avisarme'}</label>
              <select id="recordatorio-antes" value={antes} onChange={(e) => setAntes(Number(e.target.value))} className={campo}>
                {AVISAR_ANTES.map((a) => <option key={a.min} value={a.min}>{a.nombre}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="recordatorio-repetir" className="block text-[0.75rem] font-semibold text-slate-500 dark:text-neutral-400 mb-1">Se repite</label>
              <select id="recordatorio-repetir" value={repetir} onChange={(e) => setRepetir(e.target.value as Repetir | '')} className={campo}>
                <option value="">No se repite</option>
                {REPETIR.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            {puedeEncargar && (
              <div>
                <label htmlFor="recordatorio-para" className="block text-[0.75rem] font-semibold text-slate-500 dark:text-neutral-400 mb-1">Para quién</label>
                <select id="recordatorio-para" value={para} onChange={(e) => setPara(e.target.value)} className={campo}>
                  <option value="">Para mí</option>
                  {otros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            {pideSede && (
              <div>
                <label htmlFor="recordatorio-sede" className="block text-[0.75rem] font-semibold text-slate-500 dark:text-neutral-400 mb-1">Sede</label>
                <select id="recordatorio-sede" value={sede} onChange={(e) => setSede(e.target.value)} className={campo}>
                  <option value="">Elige la sede</option>
                  {sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
          </div>
          {para && <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">Le llega en la app ahora y otra vez a su hora. Cuando lo marque hecho, te avisa.</p>}
          <div className="flex gap-2">
            {editando && (
              <button type="button" onClick={limpiar}
                className="min-h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 text-[0.9375rem] font-semibold cursor-pointer">
                Cancelar
              </button>
            )}
            <button type="submit" disabled={guardando || texto.trim().length < 2}
              className="flex-1 min-h-[44px] rounded-2xl bg-[var(--primary)] text-white text-[0.9375rem] font-bold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : editando ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {editando ? 'Guardar cambios' : para ? 'Encargar' : 'Guardar'}
            </button>
          </div>
          {!editando && <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 text-center">También se lo puedes pedir a Lalan: «recuérdame…» o «encárgale a…».</p>}
        </form>

        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1 mb-3" role="tablist" aria-label="Qué ver">
          {FILTROS.map((f) => (
            <button key={f.id} type="button" role="tab" aria-selected={filtro === f.id} onClick={() => setFiltro(f.id)} className={chip(filtro === f.id)}>{f.nombre}</button>
          ))}
        </div>

        <section aria-label="Lista de recordatorios" className="space-y-2 mb-6">
          {!lista ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
          ) : lista.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-6 py-12 text-center">
              <Bell className="w-6 h-6 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-800 dark:text-neutral-100 mt-2">{filtro === 'hechos' ? 'Todavía no hay nada hecho' : 'Nada pendiente'}</p>
              <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 mt-1">Lo que guardes aquí o le pidas a Lalan te llega en la app a su hora.</p>
            </div>
          ) : lista.map((p) => (
            <article key={p.id} className={`rounded-3xl border bg-white dark:bg-neutral-900 px-4 py-3 ${p.id === resaltado ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/30' : 'border-slate-200/80 dark:border-neutral-800'}`}>
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className={`mt-0.5 w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-[0.75rem] font-bold ${p.relacion === 'mio' ? 'bg-[var(--primary)]/12 text-[var(--primary)]' : 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200'}`}>
                  {p.relacion === 'mio' ? <Bell className="w-4 h-4" /> : iniciales(p.relacion === 'me_toca' ? p.creadoPor.nombre : p.para.nombre)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-[0.9375rem] font-semibold leading-snug text-slate-900 dark:text-neutral-100 ${p.estado === 'hecho' ? 'line-through opacity-60' : ''}`}>{p.texto}</p>
                  <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {p.estado === 'hecho'
                      ? <span>Hecho {p.hechoEn ? cuandoCorto(p.hechoEn) : ''}{p.hechoPor ? ` por ${p.hechoPor.split(' ')[0]}` : ''}</span>
                      : <span className={p.vencido ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>{p.vencido ? 'Ya pasó · ' : ''}{p.vencido ? cuandoCorto(p.vence) : cuandoConAviso(p.vence, p.avisarEn)}</span>}
                    {p.repetir && <span className="inline-flex items-center gap-0.5"><Repeat className="w-3 h-3" />{REPETIR.find((r) => r.id === p.repetir)?.nombre}</span>}
                    {p.relacion === 'encargue' && <span className="inline-flex items-center gap-0.5"><UserRound className="w-3 h-3" />{p.para.nombre.split(' ')[0]}</span>}
                    {p.relacion === 'me_toca' && <span>Te lo encargó {p.creadoPor.nombre.split(' ')[0]}</span>}
                    {varias && !actual && <span className="inline-flex items-center gap-0.5"><MapPin className="w-3 h-3" />{p.sede.nombre}</span>}
                  </p>
                </div>
                {/* Cambiarlo o quitarlo: quien lo creó (lo que me encargaron no lo cambio yo) */}
                {p.relacion !== 'me_toca' && p.estado === 'pendiente' && (
                  <button type="button" disabled={ocupado === p.id} onClick={() => cambiar(p)} aria-label="Cambiar" title="Cambiar"
                    className="-mt-0.5 w-9 h-9 shrink-0 rounded-full text-slate-400 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 inline-flex items-center justify-center cursor-pointer disabled:opacity-50">
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                {p.relacion !== 'me_toca' && (
                  <button type="button" disabled={ocupado === p.id} onClick={() => void quitar(p)} aria-label="Quitar" title="Quitar"
                    className="-mr-1.5 -mt-0.5 w-9 h-9 shrink-0 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 inline-flex items-center justify-center cursor-pointer disabled:opacity-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {p.estado === 'pendiente' && (
                <div className="flex flex-wrap gap-2 mt-2.5 pl-12">
                  <button type="button" disabled={ocupado === p.id} onClick={() => void hacer(p, () => pendientesApi.hecho(p.id), p.repetir ? 'Listo, pasa a la siguiente vez' : 'Listo')}
                    className="min-h-[36px] px-3.5 rounded-full bg-[var(--primary)] text-white text-[0.8125rem] font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50">
                    {ocupado === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Listo
                  </button>
                  <button type="button" disabled={ocupado === p.id} onClick={() => void hacer(p, () => pendientesApi.posponer(p.id, { minutos: 60 }), 'Pospuesto 1 hora')}
                    className="min-h-[36px] px-3.5 rounded-full border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 text-[0.8125rem] font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50">
                    <Clock className="w-3.5 h-3.5" /> 1 h
                  </button>
                  <button type="button" disabled={ocupado === p.id} onClick={() => void hacer(p, () => pendientesApi.posponer(p.id, { manana: true }), 'Para mañana')}
                    className="min-h-[36px] px-3.5 rounded-full border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 text-[0.8125rem] font-semibold cursor-pointer disabled:opacity-50">
                    Mañana
                  </button>
                </div>
              )}
            </article>
          ))}
        </section>
      </PageContent>
      {modalConfirmar}
    </div>
  );
};
