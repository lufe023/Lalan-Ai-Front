import React, { useEffect, useState } from 'react';
import { Bot, CalendarCheck, ClipboardList, Loader2, MessageCircle, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { IOSModal } from '../ui/IOSModal';
import { useConfirmar } from '../ui/ModalConfirmar';
import { dinero, planesApi, type PasoPlantilla, type Plantilla, type Plantillas, type TipoPaso } from '../../services/planesSeguimiento';

const campo = 'w-full px-2.5 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.8125rem]';
const ICONO: Record<TipoPaso, React.ReactNode> = {
  cita: <CalendarCheck className="w-3.5 h-3.5" />,
  mensaje: <MessageCircle className="w-3.5 h-3.5" />,
  tarea: <ClipboardList className="w-3.5 h-3.5" />,
};
const TIPO: Record<TipoPaso, string> = { cita: 'Sesión en el salón', mensaje: 'Mensaje de Lalán', tarea: 'Tarea' };

type Borrador = { id: string | null; nombre: string; descripcion: string; precio: string; pasos: PasoPlantilla[]; mediciones: string };

const vacio = (): Borrador => ({
  id: null, nombre: '', descripcion: '', precio: '', mediciones: '',
  pasos: [
    { dia: 0, tipo: 'cita', titulo: 'Evaluación y primera sesión' },
    { dia: 7, tipo: 'cita', titulo: 'Segunda sesión' },
  ],
});
const deplantilla = (p: Plantilla): Borrador => ({
  id: p.id, nombre: p.nombre, descripcion: p.descripcion ?? '', precio: p.precio != null ? String(p.precio) : '',
  pasos: p.pasos.map((x) => ({ ...x })), mediciones: p.mediciones.join(', '),
});

/**
 * Las plantillas de plan del salón: las que la dueña arma y las que Lalán
 * trae listas por tipo de negocio. Cada plan que empieza copia sus pasos.
 */
export const PlantillasDePlan: React.FC<{ onCerrar: () => void }> = ({ onCerrar }) => {
  const { showToast } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [datos, setDatos] = useState<Plantillas | null>(null);
  const [editando, setEditando] = useState<Borrador | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = async () => {
    try { setDatos(await planesApi.plantillas()); } catch (e) { showToast('No se pudieron cargar', (e as Error).message, 'warning'); }
  };
  useEffect(() => { void cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const desdeModelo = async (clave: string) => {
    setOcupado(clave);
    try { await planesApi.desdeModelo(clave); await cargar(); showToast('Plantilla lista', 'Puedes cambiarle los pasos o el precio.', 'success'); }
    catch (e) { showToast('No se pudo añadir', (e as Error).message, 'warning'); }
    finally { setOcupado(null); }
  };

  const archivar = async (p: Plantilla) => {
    const ok = await confirmar({
      titulo: `¿Quitar «${p.nombre}»?`,
      mensaje: p.activos
        ? `${p.activos} ${p.activos === 1 ? 'clienta sigue' : 'clientas siguen'} con este plan y no les pasa nada: conservan sus pasos. Solo deja de salir para planes nuevos.`
        : 'Deja de salir para planes nuevos.',
      textoConfirmar: 'Quitar',
      tono: 'peligro',
    });
    if (!ok) return;
    setOcupado(p.id);
    try { await planesApi.quitarPlantilla(p.id); await cargar(); }
    catch (e) { showToast('No se pudo quitar', (e as Error).message, 'warning'); }
    finally { setOcupado(null); }
  };

  const yaTiene = new Set(datos?.plantillas.map((p) => p.plantilla).filter(Boolean));
  const modelos = datos?.modelos.filter((m) => !yaTiene.has(m.clave)) ?? [];

  return (
    <IOSModal isOpen onClose={onCerrar} title="Plantillas de plan" subtitle="Los tratamientos de varias sesiones que ofrece el salón" forma="angosta">
      {modalConfirmar}
      {!datos ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : editando ? (
        <Editor borrador={editando} moneda={datos.moneda} onCancelar={() => setEditando(null)}
          onGuardado={async () => { setEditando(null); await cargar(); }} />
      ) : (
        <div className="space-y-5 pb-6">
          <div className="space-y-2">
            {datos.plantillas.length === 0 && (
              <p className="text-[0.8125rem] text-slate-500">Todavía no hay plantillas. Toma una de Lalán abajo o arma la tuya.</p>
            )}
            {datos.plantillas.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-200 dark:border-neutral-700 p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[0.875rem]">{p.nombre}</p>
                    <p className="text-[0.75rem] text-slate-500">
                      {p.pasos.length} pasos en {p.duracionDias} días
                      {p.precio != null && <> · {dinero(p.precio, p.currencyCode)}</>}
                      {p.activos > 0 && <> · <span className="font-semibold text-[var(--primary)]">{p.activos} {p.activos === 1 ? 'clienta' : 'clientas'} ahora</span></>}
                    </p>
                    {p.mediciones.length > 0 && <p className="text-[0.75rem] text-slate-500 mt-0.5">Mide: {p.mediciones.join(', ')}</p>}
                  </div>
                  <button type="button" onClick={() => setEditando(deplantilla(p))} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800" aria-label={`Editar ${p.nombre}`}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => void archivar(p)} disabled={ocupado === p.id} className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950" aria-label={`Quitar ${p.nombre}`}>
                    {ocupado === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {p.pasos.map((x, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-[0.6875rem]">
                      {ICONO[x.tipo]} Día {x.dia}: {x.titulo}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setEditando(vacio())}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-neutral-600 text-[0.8125rem] font-semibold">
              <Plus className="w-4 h-4" /> Armar una plantilla
            </button>
          </div>

          {modelos.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-slate-500 mb-2">
                <Sparkles className="w-3.5 h-3.5" /> Lalán las trae listas
              </p>
              <div className="space-y-2">
                {modelos.map((m) => (
                  <div key={m.clave} className="rounded-xl bg-slate-50 dark:bg-neutral-800/60 p-3 flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[0.8125rem]">{m.nombre}</p>
                      <p className="text-[0.75rem] text-slate-500">{m.descripcion}</p>
                      <p className="text-[0.6875rem] text-slate-500 mt-0.5">{m.pasos} pasos en {m.duracionDias} días · mide {m.mediciones.join(', ')}</p>
                    </div>
                    <button type="button" onClick={() => void desdeModelo(m.clave)} disabled={!!ocupado}
                      className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-[0.75rem] font-semibold disabled:opacity-60">
                      {ocupado === m.clave ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Usar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </IOSModal>
  );
};

/** Nombre, precio, pasos (día, tipo, servicio o mensaje) y qué se mide */
const Editor: React.FC<{ borrador: Borrador; moneda: string; onCancelar: () => void; onGuardado: () => void }> = ({ borrador, moneda, onCancelar, onGuardado }) => {
  const { services, showToast } = useApp();
  const [b, setB] = useState(borrador);
  const [guardando, setGuardando] = useState(false);
  const paso = (i: number, cambio: Partial<PasoPlantilla>) => setB((x) => ({ ...x, pasos: x.pasos.map((p, j) => (j === i ? { ...p, ...cambio } : p)) }));

  const guardar = async () => {
    if (!b.nombre.trim()) { showToast('Falta el nombre', 'Ponle un nombre al plan.', 'warning'); return; }
    if (!b.pasos.some((p) => p.titulo.trim())) { showToast('Faltan los pasos', 'El plan necesita al menos un paso.', 'warning'); return; }
    setGuardando(true);
    const d = {
      nombre: b.nombre.trim(), descripcion: b.descripcion.trim() || null,
      precio: b.precio.trim() ? Number(b.precio) : null,
      pasos: [...b.pasos].filter((p) => p.titulo.trim()).sort((x, y) => x.dia - y.dia)
        .map((p) => ({ dia: p.dia, tipo: p.tipo, titulo: p.titulo.trim(), serviceId: p.tipo === 'cita' ? p.serviceId ?? null : null, mensaje: p.tipo === 'mensaje' ? p.mensaje?.trim() || null : null })),
      mediciones: b.mediciones.split(',').map((x) => x.trim()).filter(Boolean),
    };
    try {
      if (b.id) await planesApi.actualizarPlantilla(b.id, d); else await planesApi.crearPlantilla(d);
      showToast('Plantilla guardada', 'Los planes que ya empezaron siguen con sus pasos de antes.', 'success');
      onGuardado();
    } catch (e) { showToast('No se pudo guardar', (e as Error).message, 'warning'); }
    finally { setGuardando(false); }
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="sm:col-span-2 text-[0.75rem] font-semibold">Nombre
          <input className={`${campo} mt-1`} value={b.nombre} onChange={(e) => setB({ ...b, nombre: e.target.value })} placeholder="Tratamiento capilar 4 semanas" />
        </label>
        <label className="text-[0.75rem] font-semibold">Precio del paquete ({moneda})
          <input className={`${campo} mt-1`} type="number" min={0} inputMode="decimal" value={b.precio} onChange={(e) => setB({ ...b, precio: e.target.value })} placeholder="Sin paquete" />
        </label>
      </div>
      <label className="block text-[0.75rem] font-semibold">Para qué es
        <textarea className={`${campo} mt-1`} rows={2} value={b.descripcion} onChange={(e) => setB({ ...b, descripcion: e.target.value })} placeholder="Caída por estrés o posparto: detox, ampollas y control." />
      </label>

      <div>
        <p className="text-[0.75rem] font-semibold mb-1.5">Pasos</p>
        <div className="space-y-2">
          {b.pasos.map((p, i) => (
            <div key={i} className="rounded-xl border border-slate-200 dark:border-neutral-700 p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-[0.75rem] font-semibold shrink-0">Día
                  <input className={`${campo} w-16`} type="number" min={0} value={p.dia} onChange={(e) => paso(i, { dia: Math.max(0, Number(e.target.value) || 0) })} />
                </label>
                <select className={campo} value={p.tipo} onChange={(e) => paso(i, { tipo: e.target.value as TipoPaso })} aria-label="Tipo de paso">
                  {(Object.keys(TIPO) as TipoPaso[]).map((t) => <option key={t} value={t}>{TIPO[t]}</option>)}
                </select>
                <button type="button" onClick={() => setB({ ...b, pasos: b.pasos.filter((_, j) => j !== i) })} className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 shrink-0" aria-label="Quitar paso">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input className={campo} value={p.titulo} onChange={(e) => paso(i, { titulo: e.target.value })} placeholder="Qué pasa ese día" />
              {p.tipo === 'cita' && (
                <select className={campo} value={p.serviceId ?? ''} onChange={(e) => paso(i, { serviceId: e.target.value || null })} aria-label="Servicio">
                  <option value="">Servicio de la cita (Lalán lo marca hecho al cerrarla)</option>
                  {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              {p.tipo === 'mensaje' && (
                <div className="flex gap-1.5 items-start">
                  <Bot className="w-4 h-4 mt-2 text-[var(--primary)] shrink-0" />
                  <textarea className={campo} rows={2} value={p.mensaje ?? ''} onChange={(e) => paso(i, { mensaje: e.target.value })}
                    placeholder="¿Cómo vas con la rutina en casa? Cuéntame si notas picor o más caída." />
                </div>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setB({ ...b, pasos: [...b.pasos, { dia: (b.pasos.at(-1)?.dia ?? 0) + 7, tipo: 'cita', titulo: '' }] })}
          className="mt-2 flex items-center gap-1 text-[0.8125rem] font-semibold text-[var(--primary)]">
          <Plus className="w-4 h-4" /> Añadir paso
        </button>
      </div>

      <label className="block text-[0.75rem] font-semibold">Qué se mide en cada sesión (separado por comas)
        <input className={`${campo} mt-1`} value={b.mediciones} onChange={(e) => setB({ ...b, mediciones: e.target.value })} placeholder="Densidad, Caída al lavado, Picor" />
      </label>

      <div className="flex gap-2">
        <button type="button" onClick={onCancelar} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 text-[0.8125rem] font-semibold">Cancelar</button>
        <button type="button" onClick={() => void guardar()} disabled={guardando}
          className="flex-1 py-2.5 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60">
          {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
        </button>
      </div>
    </div>
  );
};
