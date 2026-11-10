import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Bot, CalendarCheck, CalendarClock, Check, ChevronDown, ClipboardList, Loader2, MapPin, MessageCircle,
  NotebookPen, Pause, Play, Plus, Settings2, Trash2, TrendingDown, TrendingUp, Wallet, X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { usePlan } from '../../context/PlanContext';
import { useSedes } from '../../hooks/useSedes';
import { SelectorSede } from '../ui/SelectorSede';
import { useConfirmar } from '../ui/ModalConfirmar';
import {
  ABRIR_PLAN, dinero, fechaCorta, planesApi, type EntradaBitacora, type PasoDelPlan, type PlanCompleto, type Plantillas, type TipoEntrada,
} from '../../services/planesSeguimiento';
import { PlantillasDePlan } from './PlantillasDePlan';

const campo = 'w-full px-2.5 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.8125rem]';
const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const horaCorta = (iso: string) => new Date(iso).toLocaleString('es-DO', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const ESTADO: Record<string, { texto: string; color: string }> = {
  activo: { texto: 'Activo', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  pausado: { texto: 'En pausa', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  terminado: { texto: 'Terminado', color: 'bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300' },
  abandonado: { texto: 'Lo dejó', color: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
};

/**
 * Planes de seguimiento en la ficha: el tratamiento de varias sesiones de
 * la clienta, con sus pasos, lo que avisó, cómo va midiendo, la bitácora
 * (sesiones, mensajes de Lalán y lo que ella contestó) y el paquete.
 */
export const PlanesSeguimiento: React.FC<{ clienteId: string; clienteNombre: string }> = ({ clienteId, clienteNombre }) => {
  const { showToast } = useApp();
  const { tieneModulo } = usePlan();
  const incluido = tieneModulo('planes_seguimiento');
  const [planes, setPlanes] = useState<PlanCompleto[] | null>(null);
  const [abierta, setAbierta] = useState(false);
  const [empezando, setEmpezando] = useState(false);
  const [plantillas, setPlantillas] = useState(false);

  const cargar = useCallback(async () => {
    try { setPlanes(await planesApi.deCliente(clienteId)); } catch { setPlanes([]); }
  }, [clienteId]);
  useEffect(() => {
    setPlanes(null); setEmpezando(false);
    // Desde Mi semana o un aviso: la ficha abre con el plan a la vista
    let abrir = false;
    try { abrir = sessionStorage.getItem(ABRIR_PLAN) === clienteId; } catch { /* nada */ }
    // Se borra después: en desarrollo el efecto corre dos veces seguidas
    if (abrir) setTimeout(() => { try { sessionStorage.removeItem(ABRIR_PLAN); } catch { /* nada */ } }, 0);
    setAbierta(abrir);
    void cargar();
  }, [cargar, clienteId]);

  if (!planes) return null;
  if (!incluido && !planes.length) return null;

  const activo = planes.find((p) => p.estado === 'activo') ?? planes.find((p) => p.estado === 'pausado') ?? null;
  const alertas = planes.reduce((n, p) => n + p.alertas.length, 0);
  const cambiar = (nuevo: PlanCompleto) => setPlanes((l) => (l ?? []).map((p) => (p.id === nuevo.id ? nuevo : p)));

  return (
    <div className={`rounded-2xl border overflow-hidden ${alertas ? 'border-rose-300 dark:border-rose-900' : 'border-slate-200 dark:border-neutral-800'}`}>
      <button type="button" onClick={() => setAbierta((a) => !a)}
        className="w-full px-3.5 py-2.5 flex items-center gap-2 bg-[var(--primary)]/10 text-left cursor-pointer">
        <ClipboardList className="w-4 h-4 text-[var(--primary)] shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
            Plan de seguimiento
            {alertas > 0 && <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[0.625rem] font-bold">{alertas} {alertas === 1 ? 'aviso' : 'avisos'}</span>}
          </span>
          <span className="block text-[0.6875rem] text-slate-500 truncate">
            {activo
              ? `${activo.nombre} · paso ${Math.min(activo.avance.hechos + 1, activo.avance.total)} de ${activo.avance.total}${activo.proximo ? ` · ${activo.proximo.titulo} el ${fechaCorta(activo.proximo.fecha)}` : ''}`
              : planes.length ? `${planes.length} ${planes.length === 1 ? 'plan terminado' : 'planes anteriores'}` : 'Tratamientos de varias sesiones'}
          </span>
        </span>
        {activo && <Progreso hechos={activo.avance.hechos} total={activo.avance.total} chico />}
        <ChevronDown className={`w-4 h-4 text-slate-400 transition ${abierta ? 'rotate-180' : ''}`} />
      </button>

      {abierta && (
        <div className="p-3 space-y-3">
          {!incluido && <p className="text-[0.6875rem] text-amber-700 dark:text-amber-400">«Planes de seguimiento» no está en tu plan: ves lo guardado, pero no puedes empezar planes nuevos.</p>}
          {planes.map((p) => <TarjetaPlan key={p.id} plan={p} onCambio={cambiar} abiertoDeEntrada={p === activo || planes.length === 1} />)}

          {incluido && !empezando && (
            <div className="flex gap-2">
              <button type="button" onClick={() => setEmpezando(true)}
                className="flex-1 py-2 rounded-xl border border-dashed border-[var(--primary)]/50 text-[var(--primary)] text-[0.8125rem] font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[var(--primary)]/5">
                <Plus className="w-4 h-4" /> Empezar un plan
              </button>
              <button type="button" onClick={() => setPlantillas(true)} title="Plantillas de planes"
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 text-[0.8125rem] font-bold flex items-center gap-1.5 cursor-pointer">
                <Settings2 className="w-4 h-4" /> Plantillas
              </button>
            </div>
          )}
          {empezando && (
            <EmpezarPlan clienteId={clienteId} clienteNombre={clienteNombre} onCancelar={() => setEmpezando(false)} onPlantillas={() => setPlantillas(true)}
              onListo={(nuevo) => { setEmpezando(false); setPlanes((l) => [nuevo, ...(l ?? [])]); showToast('Plan empezado', `Lalán tiene las fechas de ${clienteNombre.split(' ')[0]}.`, 'success'); }} />
          )}
        </div>
      )}
      {plantillas && <PlantillasDePlan onCerrar={() => setPlantillas(false)} />}
    </div>
  );
};

const Progreso: React.FC<{ hechos: number; total: number; chico?: boolean }> = ({ hechos, total, chico }) => (
  <span className={`flex items-center gap-1.5 ${chico ? 'w-16' : 'w-full'}`}>
    <span className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-neutral-700 overflow-hidden">
      <span className="block h-full bg-[var(--primary)] rounded-full transition-all" style={{ width: `${total ? (hechos / total) * 100 : 0}%` }} />
    </span>
    {!chico && <span className="text-[0.6875rem] font-bold text-slate-500 whitespace-nowrap">{hechos} de {total}</span>}
  </span>
);

/** Un plan: avisos, pasos, cómo va midiendo, paquete y bitácora */
const TarjetaPlan: React.FC<{ plan: PlanCompleto; onCambio: (p: PlanCompleto) => void; abiertoDeEntrada: boolean }> = ({ plan, onCambio, abiertoDeEntrada }) => {
  const { showToast } = useApp();
  const todasLasSedes = useSedes({ todasLasDelSalon: true });
  const { confirmar, modalConfirmar } = useConfirmar();
  const [abierto, setAbierto] = useState(abiertoDeEntrada);
  const [anotando, setAnotando] = useState<{ paso: number | null; tipo: TipoEntrada } | null>(null);
  const [pagando, setPagando] = useState(false);
  const [verTodo, setVerTodo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const e = ESTADO[plan.estado] ?? ESTADO.activo;
  const vivo = plan.estado === 'activo' || plan.estado === 'pausado';

  const hacer = async (f: () => Promise<PlanCompleto>, ok?: string) => {
    setOcupado(true);
    try { onCambio(await f()); if (ok) showToast(ok, '', 'success'); } catch (err) { showToast('No se pudo', (err as Error).message, 'warning'); }
    setOcupado(false);
  };
  const cambiarEstado = async (estado: PlanCompleto['estado']) => {
    const textos: Record<string, { titulo: string; mensaje: string; boton: string }> = {
      pausado: { titulo: '¿Poner el plan en pausa?', mensaje: 'Lalán deja de escribirle hasta que lo retomes.', boton: 'Pausar' },
      terminado: { titulo: '¿Dar el plan por terminado?', mensaje: 'Queda en su ficha con toda la bitácora.', boton: 'Terminar' },
      abandonado: { titulo: '¿La clienta dejó el plan?', mensaje: 'Queda anotado que lo dejó. Lalán no le escribe más por este plan.', boton: 'Sí, lo dejó' },
    };
    const t = textos[estado];
    if (t && !(await confirmar({ titulo: t.titulo, mensaje: t.mensaje, textoConfirmar: t.boton, tono: estado === 'abandonado' ? 'peligro' : undefined }))) return;
    await hacer(() => planesApi.actualizar(plan.id, { estado }));
  };

  const bitacora = verTodo ? plan.bitacora : plan.bitacora.slice(0, 4);

  return (
    <div className="rounded-xl bg-slate-50 dark:bg-neutral-800/60 overflow-hidden">
      {modalConfirmar}
      <button type="button" onClick={() => setAbierto((a) => !a)} className="w-full p-2.5 text-left space-y-1.5 cursor-pointer">
        <span className="flex items-start gap-2">
          <span className="flex-1 min-w-0">
            <span className="block text-[0.8125rem] font-bold text-slate-900 dark:text-white">{plan.nombre}</span>
            <span className="flex flex-wrap items-center gap-1 mt-0.5">
              <span className={`px-1.5 py-0.5 rounded-full text-[0.625rem] font-bold ${e.color}`}>{e.texto}</span>
              <span className="text-[0.6875rem] text-slate-500">Desde el {fechaCorta(plan.inicio)}{plan.estado === 'activo' ? ` · día ${plan.avance.diaDelPlan} de ${plan.avance.duracion}` : ''}</span>
              {todasLasSedes.length > 1 && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 text-[0.625rem] font-semibold"><MapPin className="w-2.5 h-2.5" />{plan.sede.nombre}</span>}
              {plan.especialista && <span className="px-1.5 py-0.5 rounded-full bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-300 text-[0.625rem] font-semibold">Con {plan.especialista}</span>}
            </span>
          </span>
          <ChevronDown className={`w-4 h-4 mt-0.5 text-slate-400 transition ${abierto ? 'rotate-180' : ''}`} />
        </span>
        <Progreso hechos={plan.avance.hechos} total={plan.avance.total} />
      </button>

      {abierto && (
        <div className="px-2.5 pb-2.5 space-y-3">
          {/* Lo que la clienta avisó: el dato concreto, y atenderlo aquí mismo */}
          {plan.alertas.map((a) => (
            <div key={a.id} className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 space-y-1.5">
              <p className="flex items-center gap-1.5 text-[0.75rem] font-bold text-rose-700 dark:text-rose-300"><AlertTriangle className="w-3.5 h-3.5" /> Avisó el {fechaCorta(a.fecha)}</p>
              <p className="text-[0.8125rem] text-slate-800 dark:text-neutral-100">«{a.nota}»</p>
              <div className="flex flex-wrap gap-1.5">
                {plan.cliente.telefono && (
                  <a href={`https://wa.me/${plan.cliente.telefono.replace(/\D/g, '')}`} target="_blank" rel="noopener"
                    className="px-2.5 py-1.5 rounded-lg bg-[#25D366] text-white text-[0.75rem] font-bold flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> Escribirle</a>
                )}
                <button type="button" disabled={ocupado} onClick={() => void hacer(() => planesApi.atender(a.id), 'Aviso atendido')}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-rose-200 dark:border-rose-900/60 text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200 flex items-center gap-1 cursor-pointer"><Check className="w-3.5 h-3.5" /> Ya lo atendí</button>
              </div>
            </div>
          ))}

          {(plan.objetivo || plan.rutinaCasa) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {plan.objetivo && <Dato titulo="Objetivo" texto={plan.objetivo} />}
              {plan.rutinaCasa && <Dato titulo="Rutina en casa (Lalán se la recuerda)" texto={plan.rutinaCasa} />}
            </div>
          )}

          {/* Los pasos con su fecha */}
          <ol className="space-y-1">
            {plan.pasos.map((p) => (
              <FilaPaso key={p.indice} p={p} plan={plan} ocupado={ocupado}
                onHecho={(si) => void hacer(() => planesApi.paso(plan.id, p.indice, { hecho: si }))}
                onAnotar={() => setAnotando({ paso: p.indice, tipo: p.tipo === 'cita' ? 'sesion' : 'nota' })} />
            ))}
          </ol>

          {plan.evolucion.length > 0 && <Evolucion evolucion={plan.evolucion} />}

          {plan.paquete && (
            <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 space-y-1.5">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[var(--primary)]" />
                <span className="flex-1 text-[0.8125rem] font-bold text-slate-800 dark:text-neutral-100">Paquete {dinero(plan.paquete.precio, plan.paquete.moneda)}</span>
                <span className={`text-[0.75rem] font-bold ${plan.paquete.saldo > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {plan.paquete.saldo > 0 ? `Debe ${dinero(plan.paquete.saldo, plan.paquete.moneda)}` : 'Pagado'}
                </span>
              </div>
              {plan.pagos.length > 0 && (
                <p className="text-[0.6875rem] text-slate-500">
                  {plan.pagos.map((x) => `${dinero(x.monto, plan.paquete!.moneda)} el ${fechaCorta(x.fecha)} (${x.metodo}${x.enCaja ? ', en caja' : ''})`).join(' · ')}
                </p>
              )}
              {plan.paquete.saldo > 0 && vivo && !pagando && (
                <button type="button" onClick={() => setPagando(true)} className="text-[0.75rem] font-bold text-[var(--primary)] cursor-pointer">Registrar un pago</button>
              )}
              {pagando && <RegistrarPago saldo={plan.paquete.saldo} moneda={plan.paquete.moneda} onCancelar={() => setPagando(false)}
                onPagar={async (monto, metodo) => { await hacer(() => planesApi.pagar(plan.id, monto, metodo), 'Pago registrado'); setPagando(false); }} />}
            </div>
          )}

          {/* Bitácora */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h4 className="flex-1 text-[0.6875rem] uppercase font-bold tracking-wider text-slate-400">Bitácora</h4>
              {vivo && !anotando && (
                <button type="button" onClick={() => setAnotando({ paso: null, tipo: 'nota' })} className="text-[0.75rem] font-bold text-[var(--primary)] flex items-center gap-1 cursor-pointer"><NotebookPen className="w-3.5 h-3.5" /> Anotar</button>
              )}
            </div>
            {anotando && (
              <Anotar plan={plan} inicial={anotando} onCancelar={() => setAnotando(null)}
                onGuardar={async (d) => { await hacer(() => planesApi.anotar(plan.id, d), d.tipo === 'sesion' ? 'Sesión anotada' : 'Nota guardada'); setAnotando(null); }} />
            )}
            {bitacora.map((b) => <FilaBitacora key={b.id} b={b} pasos={plan.pasos} confirmar={confirmar} onQuitar={() => void hacer(() => planesApi.quitarEntrada(b.id))} />)}
            {plan.bitacora.length > 4 && (
              <button type="button" onClick={() => setVerTodo((v) => !v)} className="w-full text-[0.75rem] font-bold text-slate-500 cursor-pointer">{verTodo ? 'Ver menos' : `Ver las ${plan.bitacora.length}`}</button>
            )}
          </div>

          {vivo && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-200 dark:border-neutral-700">
              {plan.estado === 'activo'
                ? <BotonChico onClick={() => void cambiarEstado('pausado')} icono={<Pause className="w-3.5 h-3.5" />}>Pausar</BotonChico>
                : <BotonChico onClick={() => void hacer(() => planesApi.actualizar(plan.id, { estado: 'activo' }))} icono={<Play className="w-3.5 h-3.5" />}>Retomar</BotonChico>}
              <BotonChico onClick={() => void cambiarEstado('terminado')} icono={<Check className="w-3.5 h-3.5" />}>Terminar</BotonChico>
              <BotonChico onClick={() => void cambiarEstado('abandonado')} icono={<X className="w-3.5 h-3.5" />}>Lo dejó</BotonChico>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const BotonChico: React.FC<{ onClick: () => void; icono: React.ReactNode; children: React.ReactNode }> = ({ onClick, icono, children }) => (
  <button type="button" onClick={onClick} className="px-2.5 py-1.5 rounded-lg text-[0.75rem] font-bold text-slate-600 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 flex items-center gap-1 cursor-pointer">{icono}{children}</button>
);

const Dato: React.FC<{ titulo: string; texto: string }> = ({ titulo, texto }) => (
  <div className="p-2 rounded-lg bg-white dark:bg-neutral-900">
    <p className="text-[0.625rem] uppercase font-bold tracking-wider text-slate-400">{titulo}</p>
    <p className="text-[0.75rem] text-slate-700 dark:text-neutral-200">{texto}</p>
  </div>
);

/** Un paso: hecho, agendado, atrasado o por venir, y lo que se puede hacer ahí mismo */
const FilaPaso: React.FC<{ p: PasoDelPlan; plan: PlanCompleto; ocupado: boolean; onHecho: (si: boolean) => void; onAnotar: () => void }> = ({ p, plan, ocupado, onHecho, onAnotar }) => {
  const { navigateTo } = useApp();
  const atrasado = plan.atrasados.some((a) => a.indice === p.indice);
  const esProximo = plan.proximo?.indice === p.indice;
  const vivo = plan.estado === 'activo' || plan.estado === 'pausado';
  const icono = p.tipo === 'mensaje' ? <Bot className="w-3.5 h-3.5" /> : p.tipo === 'tarea' ? <ClipboardList className="w-3.5 h-3.5" /> : <CalendarClock className="w-3.5 h-3.5" />;
  const abrirCita = (id: string) => { try { sessionStorage.setItem('lalan.abrirCita', id); } catch { /* nada */ } navigateTo('calendar'); };
  let estado: React.ReactNode;
  if (p.hecho) estado = <span className="text-emerald-700 dark:text-emerald-400">{p.tipo === 'mensaje' ? 'Lalán le escribió' : 'Hecho'}{p.hechoEn ? ` el ${fechaCorta(p.hechoEn)}` : ''}</span>;
  else if (p.agendada) estado = <button type="button" onClick={() => abrirCita(p.agendada!.id)} className="text-sky-700 dark:text-sky-300 font-semibold underline-offset-2 hover:underline cursor-pointer">Agendada: {horaCorta(p.agendada.startsAt)}</button>;
  else if (atrasado) estado = <span className="text-rose-700 dark:text-rose-400 font-semibold">Atrasada desde el {fechaCorta(p.fecha)}</span>;
  else if (p.tipo === 'mensaje') estado = <span className="text-slate-500">Lalán le escribe el {fechaCorta(p.fecha)}</span>;
  else estado = <span className="text-slate-500">Toca el {fechaCorta(p.fecha)}</span>;
  return (
    <li className={`flex items-start gap-2 p-1.5 rounded-lg ${esProximo && vivo ? 'bg-[var(--primary)]/5' : ''}`}>
      <span className={`mt-0.5 grid place-items-center size-6 rounded-full shrink-0 ${p.hecho ? 'bg-emerald-500 text-white' : atrasado ? 'bg-rose-500 text-white' : p.tipo === 'mensaje' ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300' : 'bg-slate-200 dark:bg-neutral-700 text-slate-600 dark:text-neutral-300'}`}>
        {p.hecho ? <Check className="w-3.5 h-3.5" /> : icono}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[0.8125rem] font-semibold text-slate-800 dark:text-neutral-100">{p.titulo}{p.servicio && p.servicio !== p.titulo ? <span className="font-normal text-slate-500"> · {p.servicio}</span> : null}</span>
        <span className="block text-[0.6875rem]">{estado}</span>
        {p.tipo === 'mensaje' && p.mensaje && !p.hecho && <span className="block text-[0.6875rem] text-slate-500 italic">«{p.mensaje}»</span>}
      </span>
      {vivo && !p.hecho && (
        <span className="flex gap-1 shrink-0">
          {p.tipo === 'cita' && <button type="button" disabled={ocupado} onClick={onAnotar} className="px-2 py-1 rounded-lg text-[0.6875rem] font-bold bg-[var(--primary)] text-white cursor-pointer disabled:opacity-50">Anotar sesión</button>}
          {p.tipo !== 'cita' && <button type="button" disabled={ocupado} onClick={() => onHecho(true)} className="px-2 py-1 rounded-lg text-[0.6875rem] font-bold bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 cursor-pointer">Hecho</button>}
          {p.tipo === 'cita' && !p.agendada && <button type="button" onClick={() => navigateTo('calendar')} title="Abrir la agenda" className="p-1 rounded-lg text-slate-400 hover:text-[var(--primary)] cursor-pointer"><CalendarCheck className="w-4 h-4" /></button>}
        </span>
      )}
    </li>
  );
};

/** Cada medición: del primer valor al último, con una línea chiquita */
const Evolucion: React.FC<{ evolucion: PlanCompleto['evolucion'] }> = ({ evolucion }) => (
  <div className="space-y-1.5">
    <h4 className="text-[0.6875rem] uppercase font-bold tracking-wider text-slate-400">Cómo va</h4>
    <div className="grid gap-1.5 sm:grid-cols-2">
      {evolucion.map((m) => {
        const primero = m.puntos[0].valor;
        const ultimo = m.puntos[m.puntos.length - 1].valor;
        const cambio = primero ? ((ultimo - primero) / Math.abs(primero)) * 100 : 0;
        const min = Math.min(...m.puntos.map((x) => x.valor));
        const max = Math.max(...m.puntos.map((x) => x.valor));
        const pts = m.puntos.map((x, i) => `${m.puntos.length === 1 ? 50 : (i / (m.puntos.length - 1)) * 100},${max === min ? 12 : 22 - ((x.valor - min) / (max - min)) * 20}`).join(' ');
        return (
          <div key={m.nombre} className="p-2 rounded-lg bg-white dark:bg-neutral-900 flex items-center gap-2">
            <span className="flex-1 min-w-0">
              <span className="block text-[0.6875rem] text-slate-500 truncate" title={m.nombre}>{m.nombre}</span>
              <span className="flex items-center gap-1 text-[0.8125rem] font-bold text-slate-800 dark:text-neutral-100">
                {m.puntos.length > 1 ? <>{primero} → {ultimo}</> : primero}
                {m.puntos.length > 1 && cambio !== 0 && (
                  <span className="flex items-center gap-0.5 text-[0.6875rem] font-semibold text-slate-500">
                    {cambio < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}{Math.abs(Math.round(cambio))}%
                  </span>
                )}
              </span>
            </span>
            {m.puntos.length > 1 && (
              <svg viewBox="0 0 100 24" className="w-16 h-6 shrink-0" preserveAspectRatio="none" aria-hidden>
                <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

const ICONO_ENTRADA: Record<TipoEntrada, React.ReactNode> = {
  sesion: <CalendarCheck className="w-3.5 h-3.5 text-[var(--primary)]" />,
  mensaje: <Bot className="w-3.5 h-3.5 text-violet-600" />,
  respuesta: <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />,
  nota: <NotebookPen className="w-3.5 h-3.5 text-slate-500" />,
};

const FilaBitacora: React.FC<{ b: EntradaBitacora; pasos: PasoDelPlan[]; confirmar: ReturnType<typeof useConfirmar>['confirmar']; onQuitar: () => void }> = ({ b, pasos, confirmar, onQuitar }) => (
  <div className={`p-2 rounded-lg ${b.alerta ? 'bg-rose-50 dark:bg-rose-950/30' : b.tipo === 'respuesta' ? 'bg-emerald-50/70 dark:bg-emerald-950/20' : 'bg-white dark:bg-neutral-900'}`}>
    <div className="flex items-center gap-1.5 text-[0.6875rem] text-slate-500">
      {ICONO_ENTRADA[b.tipo]}
      <span className="font-semibold text-slate-700 dark:text-neutral-200">{b.autor ?? (b.tipo === 'mensaje' ? 'Lalán' : 'Equipo')}</span>
      <span>· {new Date(b.fecha).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}</span>
      {b.paso != null && pasos[b.paso] && <span className="truncate">· {pasos[b.paso].titulo}</span>}
      <span className="flex-1" />
      {(b.tipo === 'sesion' || b.tipo === 'nota') && (
        <button type="button" aria-label="Quitar" title="Quitar" className="p-0.5 text-slate-300 hover:text-rose-600 cursor-pointer"
          onClick={async () => { if (await confirmar({ titulo: '¿Quitar esta entrada?', mensaje: 'No se puede deshacer.', textoConfirmar: 'Quitar', tono: 'peligro' })) onQuitar(); }}>
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
    <p className="text-[0.75rem] text-slate-800 dark:text-neutral-100 mt-0.5">{b.nota}</p>
    {b.mediciones && (
      <div className="flex flex-wrap gap-1 mt-1">
        {Object.entries(b.mediciones).map(([k, v]) => (
          <span key={k} className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-[0.625rem] font-semibold text-slate-600 dark:text-neutral-300">{k}: {String(v)}</span>
        ))}
      </div>
    )}
  </div>
);

/** Anotar una sesión (con sus mediciones) o una nota */
const Anotar: React.FC<{
  plan: PlanCompleto; inicial: { paso: number | null; tipo: TipoEntrada };
  onCancelar: () => void; onGuardar: (d: { tipo: TipoEntrada; nota: string; paso: number | null; mediciones: Record<string, number | string> | null }) => Promise<void>;
}> = ({ plan, inicial, onCancelar, onGuardar }) => {
  const [tipo, setTipo] = useState<TipoEntrada>(inicial.tipo);
  const [paso, setPaso] = useState<number | null>(inicial.paso);
  const [nota, setNota] = useState('');
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const citas = plan.pasos.filter((p) => p.tipo === 'cita');
  const ultimo = useMemo(() => Object.fromEntries(plan.evolucion.map((m) => [m.nombre, m.puntos[m.puntos.length - 1]?.valor])), [plan.evolucion]);
  const guardar = async () => {
    if (!nota.trim()) return;
    setGuardando(true);
    const mediciones = Object.fromEntries(Object.entries(valores).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, Number(v.replace(',', '.')) || v]));
    await onGuardar({ tipo, nota: nota.trim(), paso: tipo === 'sesion' ? paso : null, mediciones: Object.keys(mediciones).length ? mediciones : null });
    setGuardando(false);
  };
  return (
    <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-[var(--primary)]/30 space-y-2">
      <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-neutral-800">
        {(['sesion', 'nota'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTipo(t)}
            className={`py-1.5 rounded-md text-[0.75rem] font-bold cursor-pointer ${tipo === t ? 'bg-white dark:bg-neutral-900 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}>{t === 'sesion' ? 'Sesión' : 'Nota'}</button>
        ))}
      </div>
      {tipo === 'sesion' && citas.length > 0 && (
        <select value={paso ?? ''} onChange={(e) => setPaso(e.target.value === '' ? null : Number(e.target.value))} className={campo} aria-label="Paso del plan">
          <option value="">Sesión fuera del plan</option>
          {citas.map((p) => <option key={p.indice} value={p.indice}>{p.titulo} ({fechaCorta(p.fecha)}){p.hecho ? ' · hecha' : ''}</option>)}
        </select>
      )}
      <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3} maxLength={1500} autoFocus className={campo}
        placeholder={tipo === 'sesion' ? 'Qué viste y qué hiciste: «Menos descamación. Se mantiene el protocolo».' : 'Una nota para el equipo'} />
      {tipo === 'sesion' && plan.mediciones.length > 0 && (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {plan.mediciones.map((m) => (
            <label key={m} className="block">
              <span className="block text-[0.6875rem] text-slate-500 truncate" title={m}>{m}{ultimo[m] != null ? ` · antes ${ultimo[m]}` : ''}</span>
              <input inputMode="decimal" value={valores[m] ?? ''} onChange={(e) => setValores((v) => ({ ...v, [m]: e.target.value }))} className={campo} />
            </label>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className="px-3 py-1.5 rounded-lg text-[0.75rem] font-bold text-slate-500 cursor-pointer">Cancelar</button>
        <button type="button" disabled={guardando || !nota.trim()} onClick={() => void guardar()}
          className="px-3 py-1.5 rounded-lg text-[0.75rem] font-bold bg-[var(--primary)] text-white flex items-center gap-1 cursor-pointer disabled:opacity-50">
          {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar
        </button>
      </div>
    </div>
  );
};

const RegistrarPago: React.FC<{ saldo: number; moneda: string | null; onCancelar: () => void; onPagar: (monto: number, metodo: string) => Promise<void> }> = ({ saldo, moneda, onCancelar, onPagar }) => {
  const [monto, setMonto] = useState(String(saldo));
  const [metodo, setMetodo] = useState('efectivo');
  const [guardando, setGuardando] = useState(false);
  const n = Number(monto.replace(',', '.'));
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} className={campo} aria-label="Monto" />
        <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className={campo} aria-label="Cómo pagó">
          <option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option>
        </select>
      </div>
      {metodo === 'efectivo' && <p className="text-[0.6875rem] text-slate-500">Si la caja de la sede está abierta, entra a la gaveta.</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className="px-3 py-1.5 rounded-lg text-[0.75rem] font-bold text-slate-500 cursor-pointer">Cancelar</button>
        <button type="button" disabled={guardando || !(n > 0) || n > saldo + 0.01}
          onClick={async () => { setGuardando(true); await onPagar(n, metodo); setGuardando(false); }}
          className="px-3 py-1.5 rounded-lg text-[0.75rem] font-bold bg-[var(--primary)] text-white cursor-pointer disabled:opacity-50">Registrar {n > 0 ? dinero(n, moneda) : ''}</button>
      </div>
    </div>
  );
};

/** Empezar un plan: la plantilla, desde cuándo, con quién, en qué sede y el precio del paquete */
const EmpezarPlan: React.FC<{
  clienteId: string; clienteNombre: string; onCancelar: () => void; onPlantillas: () => void; onListo: (p: PlanCompleto) => void;
}> = ({ clienteId, clienteNombre, onCancelar, onPlantillas, onListo }) => {
  const { showToast, especialistas } = useApp();
  const sedes = useSedes();
  const [lista, setLista] = useState<Plantillas | null>(null);
  const [planId, setPlanId] = useState('');
  const [inicio, setInicio] = useState(hoyLocal());
  const [staffId, setStaffId] = useState('');
  const [sede, setSede] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [rutina, setRutina] = useState('');
  const [precio, setPrecio] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [usando, setUsando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await planesApi.plantillas();
      setLista(r);
      if (r.plantillas.length && !planId) { setPlanId(r.plantillas[0].id); setPrecio(r.plantillas[0].precio ? String(r.plantillas[0].precio) : ''); }
    } catch (e) { showToast('No se pudo', (e as Error).message, 'warning'); }
  }, [planId, showToast]);
  useEffect(() => { void cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const elegida = lista?.plantillas.find((p) => p.id === planId) ?? null;
  const usarModelo = async (clave: string) => {
    setUsando(clave);
    try { const { id } = await planesApi.desdeModelo(clave); const r = await planesApi.plantillas(); setLista(r); setPlanId(id); setPrecio(String(r.plantillas.find((p) => p.id === id)?.precio ?? '')); }
    catch (e) { showToast('No se pudo', (e as Error).message, 'warning'); }
    setUsando(null);
  };
  const empezar = async () => {
    if (!planId) return;
    if (sedes.length > 1 && !sede) { showToast('Elige la sede', 'Dinos en qué sede lleva el plan.', 'warning'); return; }
    setGuardando(true);
    try {
      onListo(await planesApi.empezar({
        clientId: clienteId, planId, inicio, staffId: staffId || null, ...(sede ? { locationId: sede } : {}),
        objetivo: objetivo.trim() || null, rutinaCasa: rutina.trim() || null, precio: precio.trim() ? Number(precio.replace(',', '.')) || null : null,
      }));
    } catch (e) { showToast('No se pudo empezar', (e as Error).message, 'warning'); }
    setGuardando(false);
  };

  if (!lista) return <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>;

  return (
    <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-[var(--primary)]/30 space-y-2.5">
      <p className="text-[0.8125rem] font-bold text-slate-900 dark:text-white">Plan para {clienteNombre.split(' ')[0]}</p>
      {!lista.plantillas.length && <p className="text-[0.75rem] text-slate-500">Todavía no tienes plantillas. Usa una de Lalán y la ajustas cuando quieras:</p>}
      {lista.plantillas.length > 0 && (
        <select value={planId} onChange={(e) => { setPlanId(e.target.value); const p = lista.plantillas.find((x) => x.id === e.target.value); setPrecio(p?.precio ? String(p.precio) : ''); }} className={campo} aria-label="Plantilla">
          {lista.plantillas.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.duracionDias} días)</option>)}
        </select>
      )}
      {lista.modelos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {lista.modelos.map((m) => (
            <button key={m.clave} type="button" disabled={!!usando} onClick={() => void usarModelo(m.clave)} title={m.descripcion}
              className="px-2.5 py-1 rounded-full text-[0.6875rem] font-bold bg-[var(--primary)]/10 text-[var(--primary)] flex items-center gap-1 cursor-pointer disabled:opacity-50">
              {usando === m.clave ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} {m.nombre}
            </button>
          ))}
        </div>
      )}
      {elegida && (
        <>
          <ol className="text-[0.6875rem] text-slate-500 space-y-0.5 pl-1">
            {elegida.pasos.map((p, i) => <li key={i}>Día {p.dia}: {p.titulo}{p.tipo === 'mensaje' ? ' (Lalán le escribe)' : p.servicio ? ` · ${p.servicio}` : ''}</li>)}
          </ol>
          <div className="grid grid-cols-2 gap-1.5">
            <label className="block"><span className="block text-[0.6875rem] text-slate-500">Empieza</span><input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={campo} /></label>
            <label className="block"><span className="block text-[0.6875rem] text-slate-500">Con</span>
              <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className={campo}>
                <option value="">Quien esté</option>
                {especialistas.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="block"><span className="block text-[0.6875rem] text-slate-500">Precio del paquete ({lista.moneda})</span><input inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="Cada sesión aparte" className={campo} /></label>
            {sedes.length > 1 && <label className="block"><span className="block text-[0.6875rem] text-slate-500">Sede</span><SelectorSede sedes={sedes} value={sede} onChange={setSede} className="w-full !rounded-lg py-2" /></label>}
          </div>
          <input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} maxLength={400} placeholder="Objetivo: «frenar la caída en la coronilla»" className={campo} />
          <textarea value={rutina} onChange={(e) => setRutina(e.target.value)} maxLength={1000} rows={2} placeholder="Rutina en casa (Lalán se la recuerda)" className={campo} />
        </>
      )}
      <div className="flex items-center gap-2">
        <button type="button" onClick={onPlantillas} className="text-[0.75rem] font-bold text-slate-500 cursor-pointer">Editar plantillas</button>
        <span className="flex-1" />
        <button type="button" onClick={onCancelar} className="px-3 py-1.5 rounded-lg text-[0.75rem] font-bold text-slate-500 cursor-pointer">Cancelar</button>
        <button type="button" disabled={guardando || !elegida} onClick={() => void empezar()}
          className="px-3 py-1.5 rounded-lg text-[0.75rem] font-bold bg-[var(--primary)] text-white flex items-center gap-1 cursor-pointer disabled:opacity-50">
          {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Empezar
        </button>
      </div>
    </div>
  );
};
