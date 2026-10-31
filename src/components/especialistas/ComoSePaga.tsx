import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgePercent, Check, ChevronDown, Landmark, Plus, RotateCcw, Trash2, Wallet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useConfirmar } from '../ui/ModalConfirmar';
import { IOSToggle } from '../ui/IOSToggle';
import {
  Acuerdo, Acuerdos, Deduccion, MODALIDADES, Modalidad, PERIODOS, TIPOS_DEDUCCION, TipoDeduccion, pagos,
} from '../../services/pagosEspecialistas';

const CAMPO = 'min-w-0 px-2.5 py-2 sm:py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.8125rem] sm:text-xs text-slate-900 dark:text-white';
const TARJETA = 'p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3';
const TITULO = 'text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white';
const AYUDA = 'text-[0.75rem] text-slate-400 leading-relaxed';

const chip = (on: boolean) =>
  `px-2.5 py-1.5 rounded-full text-[0.75rem] font-semibold border transition cursor-pointer ${
    on ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-slate-50 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 border-slate-200 dark:border-neutral-700'
  }`;

const NUEVO: Acuerdo = {
  modalidad: 'comision', periodo: 'quincenal', comisionServicio: 50, comisionProducto: 10,
  baseComision: 'cobrado', propinasCompletas: true, reglas: [],
};

const numero = (v: string) => (v.trim() === '' ? null : Number(v));

/**
 * Las tres preguntas: cómo le pagas, cada cuánto y cuánto. Sirve igual para
 * la regla de la sede que para una especialista con su acuerdo propio.
 */
const FormAcuerdo: React.FC<{
  inicial: Acuerdo | null;
  simbolo: string;
  onGuardar: (a: Acuerdo) => Promise<boolean>;
  textoGuardar: string;
}> = ({ inicial, simbolo, onGuardar, textoGuardar }) => {
  const { services } = useApp();
  const [a, setA] = useState<Acuerdo>(inicial ?? NUEVO);
  const [masOpciones, setMasOpciones] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [nuevaRegla, setNuevaRegla] = useState({ serviceId: '', porcentaje: '' });
  useEffect(() => { setA(inicial ?? NUEVO); }, [inicial]);

  const m = a.modalidad;
  const llevaSueldo = m === 'sueldo' || m === 'mixto' || m === 'mayor_de';
  const llevaComision = m === 'comision' || m === 'mixto' || m === 'mayor_de';
  const nombreServicio = (id?: string | null) => services.find(s => s.id === id)?.name ?? 'Servicio';
  const set = (p: Partial<Acuerdo>) => setA(x => ({ ...x, ...p }));

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-200">1. ¿Cómo le pagas?</p>
        <div className="flex flex-wrap gap-1.5">
          {MODALIDADES.map(x => (
            <button key={x.id} type="button" aria-pressed={m === x.id} onClick={() => set({ modalidad: x.id as Modalidad })} className={chip(m === x.id)}>
              {m === x.id && <Check className="inline w-3 h-3 mr-0.5" />}{x.nombre}
            </button>
          ))}
        </div>
        <p className="text-[0.6875rem] text-slate-400">{MODALIDADES.find(x => x.id === m)?.explica}</p>
      </div>

      <div className="space-y-1.5">
        <p className="text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-200">2. ¿Cada cuánto le pagas?</p>
        <div className="flex flex-wrap gap-1.5">
          {PERIODOS.map(x => (
            <button key={x.id} type="button" aria-pressed={a.periodo === x.id} onClick={() => set({ periodo: x.id })} className={chip(a.periodo === x.id)}>
              {x.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-200">3. ¿Cuánto?</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {llevaSueldo && (
            <label className="space-y-0.5">
              <span className="text-[0.6875rem] text-slate-500">{m === 'mayor_de' ? 'Mínimo por periodo' : 'Sueldo por periodo'} ({simbolo})</span>
              <input type="number" min={0} inputMode="decimal" value={a.sueldoBase ?? ''} onChange={e => set({ sueldoBase: numero(e.target.value) })} className={`${CAMPO} w-full`} />
            </label>
          )}
          {llevaComision && (
            <label className="space-y-0.5">
              <span className="text-[0.6875rem] text-slate-500">% de cada servicio</span>
              <input type="number" min={0} max={100} inputMode="decimal" value={a.comisionServicio ?? ''} onChange={e => set({ comisionServicio: numero(e.target.value) })} className={`${CAMPO} w-full`} />
            </label>
          )}
          {m !== 'sueldo' && m !== 'alquiler' && (
            <label className="space-y-0.5">
              <span className="text-[0.6875rem] text-slate-500">% de producto que vende</span>
              <input type="number" min={0} max={100} inputMode="decimal" value={a.comisionProducto ?? ''} onChange={e => set({ comisionProducto: numero(e.target.value) })} className={`${CAMPO} w-full`} />
            </label>
          )}
          {m === 'sueldo' && (
            <label className="space-y-0.5">
              <span className="text-[0.6875rem] text-slate-500">% de producto que vende (opcional)</span>
              <input type="number" min={0} max={100} inputMode="decimal" value={a.comisionProducto ?? ''} onChange={e => set({ comisionProducto: numero(e.target.value) })} className={`${CAMPO} w-full`} />
            </label>
          )}
          {m === 'alquiler' && (
            <label className="space-y-0.5">
              <span className="text-[0.6875rem] text-slate-500">Renta por periodo ({simbolo})</span>
              <input type="number" min={0} inputMode="decimal" value={a.rentaMonto ?? ''} onChange={e => set({ rentaMonto: numero(e.target.value) })} className={`${CAMPO} w-full`} />
            </label>
          )}
        </div>
        {m === 'alquiler' && (
          <p className="text-[0.6875rem] text-slate-400">
            Lo que cobre por tu caja a su nombre es de ella: Lalan se lo suma y le resta la renta.
          </p>
        )}
      </div>

      <button type="button" onClick={() => setMasOpciones(v => !v)} aria-expanded={masOpciones} className="flex items-center gap-1 text-[0.75rem] font-semibold text-[var(--primary)] cursor-pointer">
        <ChevronDown className={`w-3.5 h-3.5 transition ${masOpciones ? 'rotate-180' : ''}`} /> Más opciones
      </button>
      {masOpciones && (
        <div className="space-y-3 p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/50">
          {llevaComision && (
            <div className="space-y-1.5">
              <p className="text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-200">La comisión se calcula sobre…</p>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" aria-pressed={a.baseComision === 'cobrado'} onClick={() => set({ baseComision: 'cobrado' })} className={chip(a.baseComision === 'cobrado')}>Lo cobrado (con descuento)</button>
                <button type="button" aria-pressed={a.baseComision === 'lista'} onClick={() => set({ baseComision: 'lista' })} className={chip(a.baseComision === 'lista')}>El precio de lista</button>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-200">Las propinas son de ella</p>
              <p className="text-[0.6875rem] text-slate-400">Se suman completas a su pago.</p>
            </div>
            <IOSToggle checked={a.propinasCompletas} onChange={v => set({ propinasCompletas: v })} ariaLabel="Las propinas son de ella" />
          </div>
          {llevaComision && (
            <div className="space-y-1.5">
              <p className="text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-200">Servicios con otro %</p>
              {(a.reglas ?? []).filter(r => r.serviceId).map((r, i) => (
                <div key={`${r.serviceId}-${i}`} className="flex items-center gap-2 text-[0.75rem]">
                  <span className="flex-1 min-w-0 truncate text-slate-700 dark:text-neutral-200">{nombreServicio(r.serviceId)}</span>
                  <span className="font-bold tabular-nums">{r.porcentaje} %</span>
                  <button type="button" aria-label={`Quitar ${nombreServicio(r.serviceId)}`} onClick={() => set({ reglas: (a.reglas ?? []).filter(x => x !== r) })} className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <select value={nuevaRegla.serviceId} onChange={e => setNuevaRegla(p => ({ ...p, serviceId: e.target.value }))} aria-label="Servicio" className={`${CAMPO} flex-1`}>
                  <option value="">Elige un servicio</option>
                  {services.filter(s => !(a.reglas ?? []).some(r => r.serviceId === s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input type="number" min={0} max={100} placeholder="%" aria-label="Porcentaje" value={nuevaRegla.porcentaje} onChange={e => setNuevaRegla(p => ({ ...p, porcentaje: e.target.value }))} className={`${CAMPO} w-16`} />
                <button
                  type="button"
                  disabled={!nuevaRegla.serviceId || nuevaRegla.porcentaje === ''}
                  onClick={() => {
                    set({ reglas: [...(a.reglas ?? []), { serviceId: nuevaRegla.serviceId, porcentaje: Number(nuevaRegla.porcentaje) }] });
                    setNuevaRegla({ serviceId: '', porcentaje: '' });
                  }}
                  className="h-8 px-2.5 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] text-[0.75rem] font-bold disabled:opacity-40 cursor-pointer"
                >
                  Añadir
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={guardando}
        onClick={async () => { setGuardando(true); try { await onGuardar(a); } finally { setGuardando(false); } }}
        className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] sm:text-[0.75rem] font-bold hover:opacity-90 transition disabled:opacity-40 cursor-pointer"
      >
        {guardando ? 'Guardando…' : textoGuardar}
      </button>
    </div>
  );
};

/** Lo que dice una deducción en una línea: "3.04 % · el salón pone 7.09 %" */
const resumenDeduccion = (d: Deduccion, simbolo: string) => {
  const plata = (n: number | null) => (n == null ? '' : `${simbolo}${n.toLocaleString('es-DO')}`);
  switch (d.tipo) {
    case 'porcentaje': return `${d.porcentaje ?? 0} %${d.parteSalon ? ` · el salón pone ${d.parteSalon} %` : ''}${d.tope ? ` · tope ${plata(d.tope)}` : ''}`;
    case 'escalones': return `Por escalones anuales (${d.escalones?.length ?? 0})`;
    case 'monto': return `${plata(d.monto)} cada corte`;
    case 'prestamo': return 'Préstamo en cuotas';
    case 'una_vez': return 'Una sola vez';
  }
};

/**
 * Cómo se le paga a cada especialista en esta sede, y lo que se le descuenta.
 */
export const ComoSePaga: React.FC<{ sede: string; enfocar?: string | null }> = ({ sede, enfocar }) => {
  const { showToast, baseCurrency, especialistas: equipo } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [datos, setDatos] = useState<Acuerdos | null>(null);
  const [deducciones, setDeducciones] = useState<Deduccion[]>([]);
  const [abierta, setAbierta] = useState<string | null>(enfocar ?? null);
  const [nueva, setNueva] = useState({ nombre: '', tipo: 'monto' as TipoDeduccion, valor: '', parteSalon: '', paraTodas: true });
  const [asignando, setAsignando] = useState<{ deduccionId: string; staffId: string; monto: string; saldo: string } | null>(null);
  const simbolo = baseCurrency?.symbol ?? '';

  const cargar = useCallback(async () => {
    try {
      const [a, d] = await Promise.all([pagos.acuerdos(sede || undefined), pagos.deducciones(sede || undefined)]);
      setDatos(a);
      setDeducciones(d ?? []);
    } catch (e: any) {
      showToast('No se pudo cargar', e?.message ?? '', 'warning');
    }
  }, [sede, showToast]);
  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => { if (enfocar) setAbierta(enfocar); }, [enfocar]);

  const guardar = (staffId: string | null) => async (a: Acuerdo) => {
    try {
      await pagos.guardarAcuerdo(sede || undefined, { ...a, staffId });
      showToast('Guardado', staffId ? 'Su acuerdo quedó listo.' : 'La regla de la sede quedó lista.', 'success');
      await cargar();
      if (staffId) setAbierta(null);
      return true;
    } catch (e: any) {
      showToast('No se pudo guardar', e?.message ?? '', 'warning');
      return false;
    }
  };

  const volverAPlantilla = async (staffId: string, nombre: string) => {
    const si = await confirmar({
      titulo: `¿${nombre} vuelve a la regla de la sede?`,
      mensaje: 'Se borra su acuerdo propio. Lo que ya se cerró en cortes anteriores no cambia.',
      textoConfirmar: 'Volver a la regla',
    });
    if (!si) return;
    await pagos.quitarAcuerdo(sede || undefined, staffId);
    await cargar();
  };

  const crear = async () => {
    const v = numero(nueva.valor);
    const d: Partial<Deduccion> = { nombre: nueva.nombre.trim(), tipo: nueva.tipo, paraTodas: nueva.paraTodas };
    if (nueva.tipo === 'porcentaje') { d.porcentaje = v; d.parteSalon = numero(nueva.parteSalon); d.antesDeImpuesto = true; }
    if (nueva.tipo === 'monto' || nueva.tipo === 'una_vez') d.monto = v;
    try {
      await pagos.crearDeduccion(sede || undefined, d);
      setNueva({ nombre: '', tipo: 'monto', valor: '', parteSalon: '', paraTodas: true });
      await cargar();
    } catch (e: any) {
      showToast('No se pudo crear', e?.message ?? '', 'warning');
    }
  };

  const quitarDeduccion = async (d: Deduccion) => {
    const si = await confirmar({
      titulo: `¿Quitar «${d.nombre}»?`,
      mensaje: 'Deja de descontarse desde el próximo corte. Los cortes ya cerrados no cambian.',
      textoConfirmar: 'Quitar', tono: 'peligro',
    });
    if (!si) return;
    await pagos.quitarDeduccion(d.id);
    await cargar();
  };

  const quitarAsignacion = async (d: Deduccion, staffId: string, id: string) => {
    const si = await confirmar({
      titulo: `¿Quitarle «${d.nombre}» a ${nombreDe(staffId)}?`,
      mensaje: 'Deja de descontársele desde el próximo corte. Los cortes ya cerrados no cambian.',
      textoConfirmar: 'Quitar', tono: 'peligro',
    });
    if (!si) return;
    await pagos.desasignar(id);
    await cargar();
  };

  const nombreDe = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of datos?.especialistas ?? []) m.set(e.id, e.name);
    for (const e of equipo ?? []) if (!m.has(e.id)) m.set(e.id, e.name);
    return (id: string) => m.get(id) ?? 'Especialista';
  }, [datos, equipo]);

  if (!datos) return <p className="py-6 text-center text-[0.75rem] text-slate-400">Cargando…</p>;

  return (
    <div className="space-y-3">
      {modalConfirmar}

      {/* La regla de la sede: lo que vale para quien no tiene acuerdo propio */}
      <div className={TARJETA}>
        <div className="flex items-center gap-1.5">
          <Wallet className="w-4 h-4 text-[var(--primary)]" />
          <h3 className={TITULO}>La regla de {datos.sede.nombre}</h3>
        </div>
        <p className={AYUDA}>
          Lo que vale para todas las especialistas de esta sede. Si alguna se paga distinto, cámbiala abajo.
        </p>
        <FormAcuerdo inicial={datos.plantilla} simbolo={simbolo} onGuardar={guardar(null)} textoGuardar="Guardar la regla de la sede" />
      </div>

      {/* Cada una */}
      <div className={TARJETA}>
        <h3 className={TITULO}>Cada especialista</h3>
        <div className="space-y-2">
          {datos.especialistas.map(e => (
            <div key={e.id} className="rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800/60">
              <button
                type="button"
                onClick={() => setAbierta(abierta === e.id ? null : e.id)}
                aria-expanded={abierta === e.id}
                className="w-full p-2.5 flex items-center gap-2 text-left cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[0.8125rem] sm:text-xs font-semibold text-slate-900 dark:text-white truncate">{e.name}</p>
                  <p className="text-[0.6875rem] text-slate-400 truncate">{e.role}</p>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[0.6875rem] font-bold ${
                  e.etiqueta === 'Sin acuerdo de pago' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-[var(--primary)]/10 text-[var(--primary)]'
                }`}>
                  {e.etiqueta}
                </span>
                <span className="shrink-0 text-[0.6875rem] text-slate-400 hidden sm:inline">{e.usaPlantilla ? 'Regla de la sede' : 'Propio'}</span>
                <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition ${abierta === e.id ? 'rotate-180' : ''}`} />
              </button>
              {abierta === e.id && (
                <div className="px-3 pb-3 space-y-3">
                  {!e.usaPlantilla && (
                    <button type="button" onClick={() => void volverAPlantilla(e.id, e.name.split(' ')[0])} className="flex items-center gap-1 text-[0.75rem] font-semibold text-slate-500 hover:text-[var(--primary)] cursor-pointer">
                      <RotateCcw className="w-3.5 h-3.5" /> Volver a la regla de la sede
                    </button>
                  )}
                  <FormAcuerdo
                    inicial={e.acuerdo ?? datos.plantilla}
                    simbolo={simbolo}
                    onGuardar={guardar(e.id)}
                    textoGuardar={`Guardar el acuerdo de ${e.name.split(' ')[0]}`}
                  />
                  {!!e.deducciones.length && (
                    <p className="text-[0.6875rem] text-slate-400">Se le descuenta: {e.deducciones.map(d => d.nombre).join(', ')}.</p>
                  )}
                </div>
              )}
            </div>
          ))}
          {!datos.especialistas.length && (
            <p className="py-3 text-center text-[0.75rem] text-slate-400">No hay especialistas en esta sede. Añádelas en la pestaña Personas.</p>
          )}
        </div>
      </div>

      {/* Deducciones */}
      <div className={TARJETA}>
        <div className="flex items-center gap-1.5">
          <BadgePercent className="w-4 h-4 text-[var(--primary)]" />
          <h3 className={TITULO}>Deducciones</h3>
        </div>
        <p className={AYUDA}>
          Lo que se descuenta en cada corte: seguros de ley, uso de plataforma, préstamos. Cada una sale como una línea en su recibo.
          La parte que pone el salón no se le descuenta: se ve como costo del salón.
        </p>

        {baseCurrency?.code === 'DOP' && !deducciones.some(d => d.nombre.startsWith('SFS')) && (
          <button
            type="button"
            onClick={async () => {
              try { setDeducciones(await pagos.sembrarRD(sede || undefined)); showToast('Listas', 'Revisa las cifras con tu contador antes de usarlas.', 'success'); }
              catch (e: any) { showToast('No se pudo', e?.message ?? '', 'warning'); }
            }}
            className="w-full p-2.5 rounded-xl border border-dashed border-[var(--primary)]/40 text-[0.75rem] font-semibold text-[var(--primary)] flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[var(--primary)]/5"
          >
            <Landmark className="w-4 h-4" /> Traer SFS, AFP e ISR de República Dominicana
          </button>
        )}

        <div className="space-y-2">
          {deducciones.map(d => (
            <div key={d.id} className="p-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800/60 space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[0.8125rem] sm:text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                    {d.nombre}
                    {d.borrador && (
                      <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[0.625rem] font-bold">
                        Confirma la cifra
                      </span>
                    )}
                  </p>
                  <p className="text-[0.6875rem] text-slate-400">{resumenDeduccion(d, simbolo)}</p>
                </div>
                {(d.tipo === 'porcentaje' || d.tipo === 'monto' || d.tipo === 'escalones') && (
                  <label className="shrink-0 flex items-center gap-1.5 text-[0.6875rem] text-slate-500">
                    A todas
                    <IOSToggle
                      checked={d.paraTodas}
                      onChange={async v => { await pagos.editarDeduccion(d.id, { paraTodas: v }); await cargar(); }}
                      ariaLabel={`${d.nombre} a todas`}
                    />
                  </label>
                )}
                <button type="button" aria-label={`Quitar ${d.nombre}`} onClick={() => void quitarDeduccion(d)} className="shrink-0 w-8 h-8 sm:w-7 sm:h-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center cursor-pointer">
                  <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </button>
              </div>

              {d.tipo === 'porcentaje' && d.borrador && (
                <div className="flex items-center gap-2 text-[0.75rem]">
                  <span className="text-slate-500">Ella</span>
                  <input type="number" defaultValue={d.porcentaje ?? ''} aria-label="Porcentaje de ella" onBlur={async ev => { await pagos.editarDeduccion(d.id, { porcentaje: numero(ev.target.value) }); await cargar(); }} className={`${CAMPO} w-20`} />
                  <span className="text-slate-500">Salón</span>
                  <input type="number" defaultValue={d.parteSalon ?? ''} aria-label="Porcentaje del salón" onBlur={async ev => { await pagos.editarDeduccion(d.id, { parteSalon: numero(ev.target.value) }); await cargar(); }} className={`${CAMPO} w-20`} />
                </div>
              )}

              {/* A quién: los préstamos y lo de una vez son siempre de una persona */}
              {!!d.asignaciones.length && (
                <div className="space-y-1">
                  {d.asignaciones.map(x => (
                    <div key={x.id} className="flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-0.5 text-[0.75rem]">
                      <span className="basis-full sm:basis-auto sm:flex-1 min-w-0 truncate font-semibold text-slate-700 dark:text-neutral-200">{nombreDe(x.staffId)}</span>
                      {x.monto != null && <span className="tabular-nums">{simbolo}{x.monto.toLocaleString('es-DO')}{d.tipo === 'prestamo' ? ' por corte' : ''}</span>}
                      {x.saldo != null && <span className="tabular-nums text-slate-400">quedan {simbolo}{x.saldo.toLocaleString('es-DO')}</span>}
                      <button type="button" aria-label={`Quitar a ${nombreDe(x.staffId)}`} onClick={() => void quitarAsignacion(d, x.staffId, x.id)} className="ml-auto sm:ml-0 w-7 h-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {(!d.paraTodas || d.tipo === 'prestamo' || d.tipo === 'una_vez') && (
                asignando?.deduccionId === d.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={asignando.staffId} onChange={e => setAsignando({ ...asignando, staffId: e.target.value })} aria-label="Especialista" className={`${CAMPO} flex-1`}>
                      <option value="">¿A quién?</option>
                      {datos.especialistas.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                    {d.tipo === 'prestamo' && (
                      <input type="number" min={0} placeholder={`Total ${simbolo}`} aria-label="Total del préstamo" value={asignando.saldo} onChange={e => setAsignando({ ...asignando, saldo: e.target.value })} className={`${CAMPO} w-24`} />
                    )}
                    {d.tipo !== 'porcentaje' && d.tipo !== 'escalones' && (
                      <input type="number" min={0} placeholder={d.tipo === 'prestamo' ? `Cuota ${simbolo}` : `Monto ${simbolo}`} aria-label="Monto" value={asignando.monto} onChange={e => setAsignando({ ...asignando, monto: e.target.value })} className={`${CAMPO} w-24`} />
                    )}
                    <button
                      type="button"
                      disabled={!asignando.staffId}
                      onClick={async () => {
                        try {
                          await pagos.asignar(d.id, { staffId: asignando.staffId, monto: numero(asignando.monto), saldo: numero(asignando.saldo) });
                          setAsignando(null);
                          await cargar();
                        } catch (e: any) { showToast('No se pudo', e?.message ?? '', 'warning'); }
                      }}
                      className="h-8 px-3 rounded-lg bg-[var(--primary)] text-white text-[0.75rem] font-bold disabled:opacity-40 cursor-pointer"
                    >
                      Poner
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAsignando({ deduccionId: d.id, staffId: '', monto: '', saldo: '' })} className="flex items-center gap-1 text-[0.75rem] font-semibold text-[var(--primary)] cursor-pointer">
                    <Plus className="w-3.5 h-3.5" /> Ponérsela a una especialista
                  </button>
                )
              )}
            </div>
          ))}
        </div>

        {/* Nueva deducción */}
        <div className="pt-1 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {TIPOS_DEDUCCION.filter(t => t.id !== 'escalones').map(t => (
              <button key={t.id} type="button" aria-pressed={nueva.tipo === t.id} title={t.ejemplo} onClick={() => setNueva(p => ({ ...p, tipo: t.id }))} className={chip(nueva.tipo === t.id)}>
                {t.nombre}
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <input
              value={nueva.nombre}
              onChange={e => setNueva(p => ({ ...p, nombre: e.target.value }))}
              placeholder={TIPOS_DEDUCCION.find(t => t.id === nueva.tipo)?.ejemplo ?? 'Nombre'}
              aria-label="Nombre de la deducción"
              className={`${CAMPO} flex-1`}
            />
            {(nueva.tipo === 'porcentaje' || nueva.tipo === 'monto') && (
              <input type="number" min={0} value={nueva.valor} onChange={e => setNueva(p => ({ ...p, valor: e.target.value }))} placeholder={nueva.tipo === 'porcentaje' ? '% de ella' : `Monto ${simbolo}`} aria-label="Valor" className={`${CAMPO} sm:w-28`} />
            )}
            {nueva.tipo === 'porcentaje' && (
              <input type="number" min={0} value={nueva.parteSalon} onChange={e => setNueva(p => ({ ...p, parteSalon: e.target.value }))} placeholder="% del salón" aria-label="Parte del salón" className={`${CAMPO} sm:w-28`} />
            )}
            {(nueva.tipo === 'porcentaje' || nueva.tipo === 'monto') && (
              <label className="flex items-center gap-1.5 text-[0.75rem] text-slate-500">
                A todas <IOSToggle checked={nueva.paraTodas} onChange={v => setNueva(p => ({ ...p, paraTodas: v }))} ariaLabel="A todas" />
              </label>
            )}
            <button
              type="button"
              disabled={!nueva.nombre.trim()}
              onClick={() => void crear()}
              className="w-full sm:w-auto px-3 py-2.5 sm:py-2 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] sm:text-[0.75rem] font-bold disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4 sm:hidden" /> Añadir
            </button>
          </div>
          {(nueva.tipo === 'prestamo' || nueva.tipo === 'una_vez') && (
            <p className="text-[0.6875rem] text-slate-400">Después de crearla, pónsela a la especialista con su monto.</p>
          )}
        </div>
      </div>
    </div>
  );
};
