import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, EyeOff, Gift, Loader2, Pencil, Plus, Save, Star, Trash2, X } from 'lucide-react';
import { api } from '../../services/api';
import type { OfertaPlan, PlanLalan } from '../../types/plataforma';
import { IOSToggle } from '../ui/IOSToggle';
import { useConfirmar } from '../ui/ModalConfirmar';
import { botonOferta, detalleOferta, partesOferta } from '../../landing/textoOferta';

const tarjeta = 'p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-3 text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]';
const campo = 'w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem]';
const titulo = 'text-[0.75rem] font-bold uppercase tracking-wider text-slate-500';

/**
 * El orden de los planes en la página y cuál se recomienda. La página los
 * muestra en este orden (de izquierda a derecha en PC, de arriba abajo en
 * el teléfono) y pone «Recomendado» solo en el marcado.
 */
const OrdenEnPagina: React.FC<{ planes: PlanLalan[]; onGuardado: () => void }> = ({ planes, onGuardado }) => {
  const [lista, setLista] = useState(planes);
  const [destacado, setDestacado] = useState<string | null>(planes.find((p) => p.destacado)?.id ?? null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  useEffect(() => { setLista(planes); setDestacado(planes.find((p) => p.destacado)?.id ?? null); }, [planes]);
  const cambiado = lista.some((p, i) => p.id !== planes[i]?.id) || destacado !== (planes.find((p) => p.destacado)?.id ?? null);

  const mover = (i: number, d: -1 | 1) => setLista((l) => {
    const j = i + d;
    if (j < 0 || j >= l.length) return l;
    const n = [...l];
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });

  const guardar = async () => {
    setGuardando(true); setAviso('');
    try {
      await api.patch('/plataforma/planes/pagina', { orden: lista.map((p) => p.id), destacadoId: destacado });
      setAviso('Guardado. La página ya los muestra así.'); onGuardado();
    } catch (e) { setAviso((e as Error).message); } finally { setGuardando(false); }
  };

  return (
    <div className={tarjeta}>
      <div>
        <div className={titulo}>Cómo salen en la página</div>
        <p className="text-[0.6875rem] text-slate-400 mt-0.5">Muévelos con las flechas y toca la estrella del que quieres recomendar (uno solo). El precio sale solo en los planes con «Mostrar precio en la página».</p>
      </div>
      <ol className="space-y-1.5">
        {lista.map((p, i) => {
          const esDestacado = destacado === p.id;
          const oculto = p.enLanding === false || !p.activo;
          return (
            <li key={p.id} className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border ${esDestacado ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-slate-200 dark:border-neutral-700'}`}>
              <span className="w-5 text-center text-[0.75rem] font-bold text-slate-400 tabular-nums">{i + 1}</span>
              <b className={`text-[0.8125rem] flex-1 ${oculto ? 'text-slate-400' : ''}`}>{p.nombre}</b>
              {oculto && <span className="flex items-center gap-1 text-[0.6875rem] text-slate-400" title={!p.activo ? 'No se puede asignar a clientes nuevos' : 'No está marcado para la página'}><EyeOff className="w-3.5 h-3.5" /> No sale</span>}
              <button type="button" onClick={() => setDestacado(esDestacado ? null : p.id)} aria-pressed={esDestacado} aria-label={esDestacado ? `Quitar ${p.nombre} como recomendado` : `Recomendar ${p.nombre}`}
                className={`px-2 py-1 rounded-lg flex items-center gap-1 text-[0.6875rem] font-semibold cursor-pointer ${esDestacado ? 'bg-[var(--primary)] text-white' : 'text-slate-400 hover:text-[var(--primary)]'}`}>
                <Star className={`w-3.5 h-3.5 ${esDestacado ? 'fill-current' : ''}`} /> {esDestacado ? 'Recomendado' : ''}
              </button>
              <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir ${p.nombre}`} className="p-1 rounded-lg text-slate-500 disabled:opacity-30 cursor-pointer"><ArrowUp className="w-4 h-4" /></button>
              <button type="button" onClick={() => mover(i, 1)} disabled={i === lista.length - 1} aria-label={`Bajar ${p.nombre}`} className="p-1 rounded-lg text-slate-500 disabled:opacity-30 cursor-pointer"><ArrowDown className="w-4 h-4" /></button>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void guardar()} disabled={guardando || !cambiado}
          className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar orden
        </button>
        {aviso && <span className="text-[0.75rem] font-semibold text-[var(--primary)]">{aviso}</span>}
      </div>
    </div>
  );
};

type Borrador = Omit<OfertaPlan, 'id'> & { id?: string };

/** Armar o cambiar una oferta, con la vista previa del botón tal como sale en la página */
const EditorOferta: React.FC<{ oferta: Borrador; planes: PlanLalan[]; onGuardada: () => void; onCancelar: () => void }> = ({ oferta, planes, onGuardada, onCancelar }) => {
  const [b, setB] = useState<Borrador>(oferta);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const nombre = (id: string | null) => planes.find((p) => p.id === id)?.nombre ?? '';
  const muestra = { planPrueba: nombre(b.planPruebaId), meses: b.meses, soloDesdeInicio: b.soloDesdeInicio, despues: nombre(b.planDespuesId ?? b.planId) };

  const guardar = async () => {
    setGuardando(true); setError('');
    const cuerpo = { nombre: b.nombre.trim(), planId: b.planId, planPruebaId: b.planPruebaId, meses: b.meses, soloDesdeInicio: b.soloDesdeInicio, planDespuesId: b.planDespuesId, activa: b.activa };
    try {
      if (b.id) await api.patch(`/plataforma/planes/ofertas/${b.id}`, cuerpo); else await api.post('/plataforma/planes/ofertas', cuerpo);
      onGuardada();
    } catch (e) { setError((e as Error).message); } finally { setGuardando(false); }
  };

  return (
    <div className="p-3 rounded-xl border border-[var(--primary)]/50 space-y-3">
      <div className="flex justify-between items-center">
        <b className="text-[0.875rem]">{b.id ? 'Cambiar oferta' : 'Nueva oferta'}</b>
        <button type="button" onClick={onCancelar} aria-label="Cancelar" className="cursor-pointer"><X className="w-4 h-4 text-slate-400" /></button>
      </div>
      <label className="block space-y-1">
        <span className="text-[0.75rem] font-semibold text-slate-500">Nombre (para reconocerla aquí)</span>
        <input value={b.nombre} onChange={(e) => setB({ ...b, nombre: e.target.value })} maxLength={60} placeholder="Ej.: Salón desde el inicio" className={campo} />
      </label>
      <div className="grid sm:grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-[0.75rem] font-semibold text-slate-500">Sale en la tarjeta de</span>
          <select value={b.planId} onChange={(e) => setB({ ...b, planId: e.target.value })} className={campo}>
            {planes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[0.75rem] font-semibold text-slate-500">Prueba gratis con</span>
          <select value={b.planPruebaId} onChange={(e) => setB({ ...b, planPruebaId: e.target.value })} className={campo}>
            {planes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[0.75rem] font-semibold text-slate-500">Meses gratis</span>
          <input type="number" min={1} max={12} value={b.meses} onChange={(e) => setB({ ...b, meses: Math.min(12, Math.max(1, Math.round(Number(e.target.value) || 1))) })} className={`${campo} tabular-nums`} />
        </label>
        <label className="block space-y-1">
          <span className="text-[0.75rem] font-semibold text-slate-500">Al terminar pasa a</span>
          <select value={b.planDespuesId ?? ''} onChange={(e) => setB({ ...b, planDespuesId: e.target.value || null })} className={campo}>
            <option value="">El mismo que eligió ({nombre(b.planId)})</option>
            {planes.filter((p) => p.id !== b.planId).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-[0.8125rem] text-slate-600 dark:text-neutral-300">
        <IOSToggle checked={b.soloDesdeInicio} onChange={(v) => setB({ ...b, soloDesdeInicio: v })} ariaLabel="Solo si lo contrata desde el inicio" />
        Solo si contrata el plan desde el inicio
      </label>
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/60 space-y-1">
        <div className="text-[0.6875rem] font-semibold text-slate-400">Así sale en la tarjeta del {nombre(b.planId)}</div>
        <div className="mx-auto max-w-[260px] px-3 py-2 rounded-[22px] bg-[var(--primary)] text-white text-center leading-tight flex flex-col" aria-label={botonOferta(muestra)}>
          <span className="text-[0.75rem] font-semibold opacity-90">{partesOferta(muestra).arriba}</span>
          <span className="text-[1.25rem] font-bold font-serif">{partesOferta(muestra).grande}</span>
          <span className="text-[0.6875rem] font-semibold opacity-80">{partesOferta(muestra).abajo}</span>
        </div>
        <div className="text-[0.6875rem] text-slate-500 text-center">{detalleOferta(muestra)}</div>
      </div>
      {error && <p className="text-[0.8125rem] font-semibold text-rose-600" role="alert">{error}</p>}
      <button type="button" onClick={() => void guardar()} disabled={guardando || b.nombre.trim().length < 2}
        className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
        {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {b.id ? 'Guardar cambios' : 'Crear oferta'}
      </button>
    </div>
  );
};

/**
 * Los combos de oferta, como los paquetes que arman los salones: en qué
 * tarjeta sale, con qué plan prueba, cuántos meses, si es solo al
 * contratarlo desde el inicio y a qué plan pasa al terminar. La página
 * muestra solo las activas, una por plan.
 */
const Ofertas: React.FC<{ planes: PlanLalan[] }> = ({ planes }) => {
  const [ofertas, setOfertas] = useState<OfertaPlan[] | null>(null);
  const [editando, setEditando] = useState<Borrador | null>(null);
  const [error, setError] = useState('');
  const { confirmar, modalConfirmar } = useConfirmar();
  const nombre = (id: string | null) => planes.find((p) => p.id === id)?.nombre ?? 'un plan borrado';

  const cargar = () => api.get<OfertaPlan[]>('/plataforma/planes/ofertas').then(setOfertas).catch((e) => setError((e as Error).message));
  useEffect(() => { void cargar(); }, []);

  const alternar = async (o: OfertaPlan, activa: boolean) => {
    setError('');
    try {
      await api.patch(`/plataforma/planes/ofertas/${o.id}`, { nombre: o.nombre, planId: o.planId, planPruebaId: o.planPruebaId, meses: o.meses, soloDesdeInicio: o.soloDesdeInicio, planDespuesId: o.planDespuesId, activa });
      await cargar();
    } catch (e) { setError((e as Error).message); }
  };

  const quitar = async (o: OfertaPlan) => {
    if (!(await confirmar({ titulo: `¿Quitar la oferta «${o.nombre}»?`, mensaje: 'Deja de salir en la página. Los salones que ya la tienen siguen igual.', textoConfirmar: 'Sí, quitar', tono: 'peligro' }))) return;
    try { await api.delete(`/plataforma/planes/ofertas/${o.id}`); await cargar(); } catch (e) { setError((e as Error).message); }
  };

  const primero = planes[0]?.id ?? '';
  const nueva = (): Borrador => ({ nombre: '', planId: primero, planPruebaId: primero, meses: 1, soloDesdeInicio: false, planDespuesId: null, activa: true });

  return (
    <div className={tarjeta}>
      {modalConfirmar}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`${titulo} flex items-center gap-1.5`}><Gift className="w-3.5 h-3.5 text-[var(--primary)]" /> Ofertas</div>
          <p className="text-[0.6875rem] text-slate-400 mt-0.5">Arma tus combos: con qué plan prueba gratis quien elige cada tarjeta, cuántos meses y a qué plan pasa después. Cada plan muestra una sola oferta activa; el Plan Gratis también puede tener la suya.</p>
        </div>
        {!editando && (
          <button type="button" onClick={() => setEditando(nueva())} className="shrink-0 px-3 py-1.5 rounded-xl border border-dashed border-[var(--primary)] text-[var(--primary)] text-[0.75rem] font-semibold flex items-center gap-1 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Nueva oferta
          </button>
        )}
      </div>
      {editando && <EditorOferta key={editando.id ?? 'nueva'} oferta={editando} planes={planes} onCancelar={() => setEditando(null)} onGuardada={() => { setEditando(null); void cargar(); }} />}
      {error && <p className="text-[0.8125rem] font-semibold text-rose-600" role="alert">{error}</p>}
      {!ofertas ? <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando ofertas…</div>
        : !ofertas.length ? <p className="text-[0.8125rem] text-slate-500">Todavía no hay ofertas. Sin oferta, la tarjeta dice «Quiero el plan» en vez de la prueba gratis.</p>
        : (
          <ul className="space-y-2">
            {ofertas.map((o) => {
              const muestra = { planPrueba: nombre(o.planPruebaId), meses: o.meses, soloDesdeInicio: o.soloDesdeInicio, despues: nombre(o.planDespuesId ?? o.planId) };
              return (
                <li key={o.id} className={`p-3 rounded-xl border flex items-start gap-3 ${o.activa ? 'border-[var(--primary)]/40' : 'border-slate-200 dark:border-neutral-700 opacity-70'}`}>
                  <IOSToggle checked={o.activa} onChange={(v) => void alternar(o, v)} ariaLabel={o.activa ? `Apagar ${o.nombre}` : `Activar ${o.nombre}`} />
                  <div className="flex-1 min-w-0">
                    <b className="text-[0.8125rem] block">{o.nombre}</b>
                    <span className="block text-[0.75rem] text-slate-600 dark:text-neutral-300">Tarjeta del {nombre(o.planId)}: «{botonOferta(muestra)}»</span>
                    <span className="block text-[0.6875rem] text-slate-400">{detalleOferta(muestra)}</span>
                  </div>
                  <button type="button" onClick={() => setEditando(o)} aria-label={`Cambiar ${o.nombre}`} className="p-1.5 rounded-lg text-slate-500 cursor-pointer"><Pencil className="w-4 h-4" /></button>
                  <button type="button" onClick={() => void quitar(o)} aria-label={`Quitar ${o.nombre}`} className="p-1.5 rounded-lg text-rose-500 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
};

/** Plataforma → Planes: orden en la página, recomendado y ofertas */
export const PaginaYOfertas: React.FC<{ planes: PlanLalan[]; onGuardado: () => void }> = ({ planes, onGuardado }) => (
  <div className="grid lg:grid-cols-2 gap-3 items-start">
    <OrdenEnPagina planes={planes} onGuardado={onGuardado} />
    <Ofertas planes={planes} />
  </div>
);
