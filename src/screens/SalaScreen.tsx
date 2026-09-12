import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from 'motion/react';
import {
  Clock, Megaphone, Scissors, CheckCircle2, X, UserPlus,
  Search, DoorOpen, ChevronRight, MapPin, Pencil,
} from 'lucide-react';
import { useApp, QueueTicket, PorLlegar, SalonZone, SalonStaff } from '../context/AppContext';
import { IOSHeader } from '../components/ui/IOSHeader';
import { PageContent } from '../components/ui/PageContent';
import { alRecibir } from '../services/socket';

/** Red de seguridad por si el socket se cae; el aviso en vivo es lo principal */
const REFRESCO_MS = 30000;

const minutosDesde = (iso?: string | null) => {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
};

const comoRato = (min: number) =>
  min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;

const laHora = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Sala en vivo.
 *
 * La pregunta que responde es una sola: ¿qué está pasando en el salón AHORA?
 * Quién está sentada, a quién se llamó, quién espera y quién todavía no ha
 * llegado. Deliberadamente NO habla de dinero — para eso está Caja — ni de
 * la agenda completa: solo la gente que está o debería estar aquí hoy.
 */
/**
 * Tarjeta de un turno, con su panel de reasignación.
 *
 * Va A NIVEL DE MÓDULO y no dentro de SalaScreen. Definida adentro, React la
 * ve como un componente distinto en cada render y remonta el subárbol — con
 * un <input> dentro eso significa perder el foco en CADA tecla escrita.
 *
 * Es el mismo error que ya nos costó el mini reproductor del sidebar. Los
 * parámetros son muchos y explícitos a propósito: preferible eso a un
 * componente que parece funcionar y se rompe al escribir.
 */
const TarjetaTurno: React.FC<{
  t: QueueTicket;
  acciones: React.ReactNode;
  reduceMotion: boolean | null;
  editando: string | null;
  abrirEdicion: (t: QueueTicket) => void;
  cerrarEdicion: () => void;
  borrador: { zoneId: string; staffId: string; reason: string };
  setBorrador: React.Dispatch<React.SetStateAction<{ zoneId: string; staffId: string; reason: string }>>;
  zonas: SalonZone[];
  staff: SalonStaff[];
  moverTurno: (id: string, dto: any) => Promise<void>;
  accionTurno: (id: string, accion: any, body?: any) => Promise<void>;
}> = ({
  t, acciones, reduceMotion, editando, abrirEdicion, cerrarEdicion,
  borrador, setBorrador, zonas: zonasActivas, staff: staffActivos,
  moverTurno, accionTurno,
}) => {
  const tonoZona = t.zone?.color || 'var(--primary)';
  return (
    <>
    <motion.div
      layout={reduceMotion ? false : 'position'}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
      className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex items-center gap-3"
    >
      {/* El código es lo que se grita en la sala: manda en la tarjeta */}
      <div
        className="shrink-0 px-2.5 py-1.5 rounded-xl text-white text-sm font-extrabold tabular-nums tracking-tight"
        style={{ backgroundColor: tonoZona }}
      >
        {t.code}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
          {t.displayName}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-neutral-400 truncate flex items-center gap-1.5 flex-wrap">
          {t.reason && <span className="truncate">{t.reason}</span>}
          {t.zone && (
            <>
              {t.reason && <span className="text-slate-300 dark:text-neutral-700">·</span>}
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5" />{t.zone.name}
              </span>
            </>
          )}
          {(t.staff?.name ?? t.staffName) && (
            <>
              <span className="text-slate-300 dark:text-neutral-700">·</span>
              <span>{t.staff?.name ?? t.staffName}</span>
            </>
          )}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        {acciones}
        {/* Reasignar: el caso de la clienta que termina una cosa y pasa a
            otra en la misma visita, o del turno que salió sin especialista. */}
        <button
          type="button"
          onClick={() => abrirEdicion(t)}
          title="Cambiar zona, especialista o servicio"
          className={`w-7 h-7 rounded-xl flex items-center justify-center transition cursor-pointer ${
            editando === t.id
              ? 'bg-[var(--primary)] text-white'
              : 'text-slate-400 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10'
          }`}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>

    {editando === t.id && (
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="overflow-hidden"
      >
        <div className="mx-2 -mt-1 mb-1 p-3 rounded-b-2xl bg-slate-50 dark:bg-neutral-800/60 border border-t-0 border-slate-200 dark:border-neutral-700 space-y-2">
          <input
            value={borrador.reason}
            onChange={e => setBorrador(b => ({ ...b, reason: e.target.value }))}
            placeholder="¿A qué pasa ahora? (tintado, pedicure…)"
            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={borrador.zoneId}
              onChange={e => setBorrador(b => ({ ...b, zoneId: e.target.value }))}
              className="px-2 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[11px] text-slate-900 dark:text-white"
            >
              <option value="">Sin zona</option>
              {zonasActivas.map(z => (
                <option key={z.id} value={z.id}>{z.prefix} · {z.name}</option>
              ))}
            </select>
            <select
              value={borrador.staffId}
              onChange={e => {
                const id = e.target.value;
                const s = staffActivos.find(x => x.id === id);
                setBorrador(b => ({
                  ...b,
                  staffId: id,
                  // La zona de la especialista se rellena sola. Si ella no
                  // tiene zona, se respeta la que ya estuviera puesta: "sin
                  // zona" no debería borrar una elección deliberada.
                  zoneId: s?.zoneId ?? b.zoneId,
                }));
              }}
              className="px-2 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[11px] text-slate-900 dark:text-white"
            >
              <option value="">Sin especialista</option>
              {staffActivos.map(s => (
                <option key={s.id} value={s.id}>{s.name} · {s.role}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                await moverTurno(t.id, {
                  zoneId: borrador.zoneId || null,
                  staffId: borrador.staffId || null,
                  reason: borrador.reason || null,
                });
                cerrarEdicion();
              }}
              className="flex-1 py-2 rounded-xl bg-[var(--primary)] text-white text-[11px] font-bold hover:opacity-90 transition cursor-pointer"
            >
              Guardar
            </button>
            {/* Volver a llamar vive AQUÍ y no entre las acciones de arriba
                porque no es lo mismo llamar por primera vez que repetir: se
                usa cuando la clienta no oyó, y conviene que cueste un toque
                más que las acciones del día a día. */}
            <button
              type="button"
              onClick={async () => { await accionTurno(t.id, 'call'); cerrarEdicion(); }}
              title="Suena otra vez en la pantalla"
              className="px-3 py-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1.5 hover:bg-amber-500/25 transition cursor-pointer"
            >
              <Megaphone className="w-3 h-3" /> Volver a llamar
            </button>
            <button
              type="button"
              onClick={() => cerrarEdicion()}
              className="px-3 py-2 rounded-xl text-[11px] font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-neutral-700 transition cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      </motion.div>
    )}
    </>
  );
};

export const SalaScreen: React.FC = () => {
  const {
    sala, salaCargando, loadSala, darTurno, accionTurno, moverTurno,
    zonas, loadZonas, especialistas, loadEspecialistas,
    clients, navigateTo,
  } = useApp();

  const reduceMotion = useReducedMotion();

  const [nuevoWalkIn, setNuevoWalkIn] = useState(false);
  const [nombre, setNombre] = useState('');
  const [motivo, setMotivo] = useState('');
  const [zonaElegida, setZonaElegida] = useState<string>('');
  const [staffElegida, setStaffElegida] = useState<string>('');
  const [busca, setBusca] = useState('');
  const [clienteElegido, setClienteElegido] = useState<string>('');

  // Reasignación: qué turno se está editando y con qué valores
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState({ zoneId: '', staffId: '', reason: '' });

  /**
   * Abre el panel con lo que el turno tiene AHORA, no en blanco: casi
   * siempre se cambia una sola cosa, y vaciar los otros dos campos haría que
   * guardar borrara datos que nadie quiso tocar.
   */
  const abrirEdicion = useCallback((t: QueueTicket) => {
    if (editando === t.id) { setEditando(null); return; }
    setEditando(t.id);
    setBorrador({
      zoneId: t.zoneId ?? '',
      staffId: t.staffId ?? '',
      reason: t.reason ?? '',
    });
  }, [editando]);

  useEffect(() => { void loadZonas(); void loadEspecialistas(); }, [loadZonas, loadEspecialistas]);

  /**
   * En vivo por socket, con sondeo lento de respaldo.
   *
   * El socket no trae los datos, solo el aviso de que algo cambió: la sala
   * se vuelve a pedir por HTTP con la sesión de quien mira. Así el mismo
   * canal sirve para esta pantalla y para la pared sin sesión.
   */
  useEffect(() => {
    void loadSala();
    const dejarDeEscuchar = alRecibir('sala:cambio', () => { void loadSala(); });
    const id = window.setInterval(() => { void loadSala(); }, REFRESCO_MS);
    // Sin esto, una pestaña olvidada en segundo plano seguiría pidiendo la
    // sala toda la noche.
    const alVolver = () => { if (!document.hidden) void loadSala(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      dejarDeEscuchar();
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [loadSala]);

  const clientasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = clients ?? [];
    return (q ? lista.filter(c => c.name.toLowerCase().includes(q)) : lista).slice(0, 12);
  }, [clients, busca]);

  const limpiarWalkIn = useCallback(() => {
    setNuevoWalkIn(false);
    setNombre(''); setMotivo(''); setZonaElegida(''); setStaffElegida('');
    setBusca(''); setClienteElegido('');
  }, []);

  const crearWalkIn = useCallback(async () => {
    const cl = clients?.find(c => c.id === clienteElegido);
    const t = await darTurno({
      clientId: cl?.id ?? null,
      clientName: cl?.name ?? nombre,
      zoneId: zonaElegida || null,
      staffId: staffElegida || null,
      reason: motivo || null,
    });
    if (t) limpiarWalkIn();
  }, [clients, clienteElegido, nombre, zonaElegida, staffElegida, motivo, darTurno, limpiarWalkIn]);


  const Boton = ({ onClick, tono, children, title }: {
    onClick: () => void; tono: 'primary' | 'ghost' | 'danger';
    children: React.ReactNode; title?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer active:scale-[0.97] flex items-center gap-1 ${
        tono === 'primary'
          ? 'bg-[var(--primary)] text-white hover:opacity-90'
          : tono === 'danger'
          ? 'text-slate-400 hover:text-rose-500 hover:bg-rose-500/10'
          : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700'
      }`}
    >
      {children}
    </button>
  );

  const Seccion = ({ icono, titulo, cuenta, tono, children }: {
    icono: React.ReactNode; titulo: string; cuenta: number;
    tono?: string; children: React.ReactNode;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <span className={tono ?? 'text-slate-400'}>{icono}</span>
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{titulo}</h3>
        <span className="text-[10px] font-bold text-slate-400 tabular-nums">{cuenta}</span>
      </div>
      {children}
    </div>
  );

  const vacio = (texto: string) => (
    <p className="py-4 text-center text-[11px] text-slate-400 rounded-2xl border border-dashed border-slate-200 dark:border-neutral-800">
      {texto}
    </p>
  );

  const atendiendo = sala?.atendiendo ?? [];
  const llamando = sala?.llamando ?? [];
  const esperando = sala?.esperando ?? [];
  const porLlegar = sala?.porLlegar ?? [];

  const zonasActivas = zonas.filter(z => z.active);
  const staffActivos = especialistas.filter(e => e.active);

  /** Lo que toda tarjeta necesita y no cambia entre secciones */
  const propsTarjeta = {
    reduceMotion, editando, abrirEdicion,
    cerrarEdicion: () => setEditando(null),
    borrador, setBorrador,
    zonas: zonasActivas, staff: staffActivos,
    moverTurno, accionTurno,
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full">
      <IOSHeader title="Sala" subtitle="QUIÉN ESTÁ EN EL SALÓN AHORA" />

      <PageContent className="space-y-5 text-xs select-none">
        <div className="max-w-4xl mx-auto w-full space-y-5">

          {/* ── Resumen ──────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { n: atendiendo.length, t: 'En sillón', c: 'text-emerald-600 dark:text-emerald-400' },
              { n: llamando.length + esperando.length, t: 'Esperando', c: 'text-amber-600 dark:text-amber-400' },
              { n: porLlegar.length, t: 'Por llegar', c: 'text-slate-500 dark:text-neutral-400' },
            ].map(x => (
              <div key={x.t} className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 text-center">
                <div className={`text-xl font-extrabold tabular-nums ${x.c}`}>{x.n}</div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{x.t}</div>
              </div>
            ))}
          </div>

          {/* ── Walk-in ──────────────────────────────────────────── */}
          {nuevoWalkIn ? (
            <div className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Llegó sin cita
                </h3>
                <button onClick={limpiarWalkIn} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={clienteElegido ? (clients?.find(c => c.id === clienteElegido)?.name ?? '') : busca}
                  onChange={e => { setBusca(e.target.value); setClienteElegido(''); setNombre(e.target.value); }}
                  placeholder="Nombre, o busca si ya es clienta…"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white"
                />
              </div>
              {!clienteElegido && busca.trim().length > 1 && (
                <div className="flex flex-wrap gap-1">
                  {clientasFiltradas.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setClienteElegido(c.id); setNombre(c.name); setBusca(c.name); }}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[11px] font-semibold text-slate-700 dark:text-neutral-200 hover:border-[var(--primary)] hover:text-[var(--primary)] transition cursor-pointer"
                    >
                      {c.name}
                    </button>
                  ))}
                  {!clientasFiltradas.length && (
                    <span className="text-[11px] text-slate-400 py-1">
                      Sin ficha — se le da el turno igual, solo con el nombre.
                    </span>
                  )}
                </div>
              )}

              <input
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="¿A qué viene? (manicure, corte…)"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white"
              />

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={zonaElegida}
                  onChange={e => setZonaElegida(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white"
                >
                  <option value="">Zona automática</option>
                  {zonasActivas.map(z => (
                    <option key={z.id} value={z.id}>{z.prefix} · {z.name}</option>
                  ))}
                </select>
                <select
                  value={staffElegida}
                  onChange={e => {
                    const id = e.target.value;
                    setStaffElegida(id);
                    // Elegir especialista llena la zona: ya sabemos dónde
                    // trabaja, preguntarlo otra vez es trabajo de más.
                    const s = staffActivos.find(x => x.id === id);
                    if (s?.zoneId) setZonaElegida(s.zoneId);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white"
                >
                  <option value="">Sin especialista</option>
                  {staffActivos.map(s => (
                    <option key={s.id} value={s.id}>{s.name} · {s.role}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={crearWalkIn}
                disabled={!nombre.trim() && !clienteElegido}
                className="w-full py-2.5 rounded-xl bg-[var(--primary)] text-white text-xs font-bold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Dar turno
              </button>
            </div>
          ) : (
            <button
              onClick={() => setNuevoWalkIn(true)}
              className="w-full py-2.5 rounded-2xl border border-dashed border-slate-300 dark:border-neutral-700 text-xs font-bold text-slate-500 dark:text-neutral-400 flex items-center justify-center gap-2 hover:border-[var(--primary)] hover:text-[var(--primary)] transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> Llegó alguien sin cita
            </button>
          )}

          <LayoutGroup id="sala">
            {/* ── En sillón ──────────────────────────────────────── */}
            <Seccion icono={<Scissors className="w-3.5 h-3.5" />} titulo="En sillón" cuenta={atendiendo.length}
              tono="text-emerald-500">
              <AnimatePresence initial={false}>
                {atendiendo.map(t => (
                  <TarjetaTurno key={t.id} t={t} {...propsTarjeta} acciones={
                    <>
                      <span className="text-[10px] text-slate-400 tabular-nums mr-1">
                        {comoRato(minutosDesde(t.startedAt))}
                      </span>
                      <Boton tono="primary" onClick={() => accionTurno(t.id, 'finish')}>
                        <CheckCircle2 className="w-3 h-3" /> Terminó
                      </Boton>
                    </>
                  } />
                ))}
              </AnimatePresence>
              {!atendiendo.length && vacio('Ningún sillón ocupado.')}
            </Seccion>

            {/* ── Llamadas ───────────────────────────────────────── */}
            {!!llamando.length && (
              <Seccion icono={<Megaphone className="w-3.5 h-3.5" />} titulo="Llamadas" cuenta={llamando.length}
                tono="text-amber-500">
                <AnimatePresence initial={false}>
                  {llamando.map(t => (
                    <TarjetaTurno key={t.id} t={t} {...propsTarjeta} acciones={
                      <>
                        <span className="text-[10px] text-amber-500 font-bold tabular-nums mr-1">
                          {comoRato(minutosDesde(t.calledAt))}
                        </span>
                        <Boton tono="primary" onClick={() => accionTurno(t.id, 'serve')}>
                          Se sentó
                        </Boton>
                        <Boton tono="danger" title="Se le llamó y no apareció"
                          onClick={() => accionTurno(t.id, 'no-show')}>
                          No vino
                        </Boton>
                      </>
                    } />
                  ))}
                </AnimatePresence>
              </Seccion>
            )}

            {/* ── Esperando ──────────────────────────────────────── */}
            <Seccion icono={<Clock className="w-3.5 h-3.5" />} titulo="Esperando" cuenta={esperando.length}>
              <AnimatePresence initial={false}>
                {esperando.map(t => {
                  const espera = minutosDesde(t.createdAt);
                  return (
                    <TarjetaTurno key={t.id} t={t} {...propsTarjeta} acciones={
                      <>
                        {/* Más de 20 minutos esperando ya es una queja en camino */}
                        <span className={`text-[10px] tabular-nums mr-1 ${
                          espera > 20 ? 'text-rose-500 font-bold' : 'text-slate-400'
                        }`}>
                          {comoRato(espera)}
                        </span>
                        <Boton tono="ghost" onClick={() => accionTurno(t.id, 'call')}>
                          <Megaphone className="w-3 h-3" /> Llamar
                        </Boton>
                        <Boton tono="primary" onClick={() => accionTurno(t.id, 'serve')}>
                          Se sentó
                        </Boton>
                        <Boton tono="danger" onClick={() => accionTurno(t.id, 'cancel')} title="Se fue">
                          <X className="w-3 h-3" />
                        </Boton>
                      </>
                    } />
                  );
                })}
              </AnimatePresence>
              {!esperando.length && vacio('Nadie esperando.')}
            </Seccion>

            {/* ── Por llegar ─────────────────────────────────────── */}
            <Seccion icono={<DoorOpen className="w-3.5 h-3.5" />} titulo="Citas de hoy que no han llegado" cuenta={porLlegar.length}>
              <AnimatePresence initial={false}>
                {porLlegar.map((c: PorLlegar) => (
                  <motion.div
                    key={c.id}
                    layout={reduceMotion ? false : 'position'}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="p-3 rounded-2xl bg-slate-50/70 dark:bg-neutral-800/40 border border-slate-200/70 dark:border-neutral-800 flex items-center gap-3"
                  >
                    <div className="shrink-0 w-12 text-center">
                      <div className="text-xs font-bold text-slate-700 dark:text-neutral-200 tabular-nums">
                        {laHora(c.startsAt)}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {c.clientName}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-neutral-400 truncate">
                        {c.serviceName}{c.staffName ? ` · ${c.staffName}` : ''}
                      </div>
                    </div>
                    <Boton tono="primary" onClick={() => darTurno({ appointmentId: c.id })}>
                      Llegó <ChevronRight className="w-3 h-3" />
                    </Boton>
                  </motion.div>
                ))}
              </AnimatePresence>
              {!porLlegar.length && vacio('Todas las citas de hoy ya llegaron.')}
            </Seccion>
          </LayoutGroup>

          {/* Sin zonas configuradas el sistema funciona, pero los códigos
              salen todos con prefijo T y la pantalla pierde la mitad de la
              gracia. Mejor decirlo una vez que dejarlo pasar. */}
          {!zonasActivas.length && (
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  Todavía no hay zonas
                </div>
                <div className="text-[11px] text-amber-700/80 dark:text-amber-400/70">
                  Los turnos salen como T1, T2… Crea tus zonas y tendrás G15, B3.
                </div>
              </div>
              <button
                onClick={() => navigateTo('settings')}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-[11px] font-bold hover:opacity-90 cursor-pointer transition"
              >
                Ir a Ajustes
              </button>
            </div>
          )}

          {salaCargando && !sala && (
            <p className="py-8 text-center text-xs text-slate-400">Cargando la sala…</p>
          )}
        </div>
      </PageContent>
    </motion.div>
  );
};
