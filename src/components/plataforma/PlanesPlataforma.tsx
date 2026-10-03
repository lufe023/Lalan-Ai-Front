import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Plus, Save, Infinity as SinLimite } from 'lucide-react';
import { api } from '../../services/api';
import { NOMBRE_RECURSO, RECURSOS, type CatalogoModulos, type ClaveModulo, type Limites, type PlanLalan, type Recurso } from '../../types/plataforma';

const GRUPOS: { id: string; nombre: string }[] = [
  { id: 'atencion', nombre: 'Atención' }, { id: 'salon', nombre: 'El salón' }, { id: 'dinero', nombre: 'Dinero' }, { id: 'experiencia', nombre: 'Experiencia' },
];

type Borrador = Omit<PlanLalan, 'id' | 'clave' | 'negocios'> & { id?: string };

const nuevo = (): Borrador => ({
  nombre: '', descripcion: '', precioMensual: 0, moneda: 'DOP', orden: 9, activo: true, modulos: [],
  limites: { mensajesMes: 400, sedes: 1, usuarios: 2, especialistas: 3 },
});

/** Un número de tope, o "sin límite" */
const Tope: React.FC<{ r: Recurso; valor: number | null; onChange: (v: number | null) => void }> = ({ r, valor, onChange }) => (
  <label className="block space-y-1">
    <span className="text-[0.75rem] font-semibold text-slate-500">{NOMBRE_RECURSO[r]}</span>
    <div className="flex gap-1">
      <input type="number" min={0} value={valor ?? ''} placeholder="Sin límite" onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))))}
        className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem] tabular-nums" />
      <button type="button" title="Sin límite" onClick={() => onChange(null)}
        className={`px-2 rounded-lg border cursor-pointer ${valor === null ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700 text-slate-400'}`}>
        <SinLimite className="w-3.5 h-3.5" />
      </button>
    </div>
  </label>
);

const EditorPlan: React.FC<{ plan: Borrador; catalogo: CatalogoModulos; negocios?: number; onGuardado: () => void }> = ({ plan, catalogo, negocios, onGuardado }) => {
  const [b, setB] = useState<Borrador>(plan);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  useEffect(() => setB(plan), [plan]);
  const alternar = (m: ClaveModulo) => setB((x) => ({ ...x, modulos: x.modulos.includes(m) ? x.modulos.filter((y) => y !== m) : [...x.modulos, m] }));
  const limite = (r: Recurso, v: number | null) => setB((x) => ({ ...x, limites: { ...x.limites, [r]: v } as Limites }));

  const guardar = async () => {
    setGuardando(true); setAviso('');
    const cuerpo = { nombre: b.nombre, descripcion: b.descripcion || undefined, precioMensual: Number(b.precioMensual), moneda: b.moneda, orden: b.orden, activo: b.activo, modulos: b.modulos, limites: b.limites };
    try {
      if (b.id) await api.patch(`/plataforma/planes/${b.id}`, cuerpo); else await api.post('/plataforma/planes', cuerpo);
      setAviso('Guardado. Los salones de este plan ya lo ven así.'); onGuardado();
    } catch (e) { setAviso((e as Error).message); } finally { setGuardando(false); }
  };

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-4 text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]">
      <div className="grid sm:grid-cols-[1fr_140px_90px] gap-2">
        <input value={b.nombre} onChange={(e) => setB({ ...b, nombre: e.target.value })} placeholder="Nombre (ej.: Plan Salón)" className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.9375rem] font-bold" />
        <input type="number" min={0} value={b.precioMensual} onChange={(e) => setB({ ...b, precioMensual: Number(e.target.value) })} aria-label="Precio al mes" className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.875rem] tabular-nums" />
        <select value={b.moneda} onChange={(e) => setB({ ...b, moneda: e.target.value })} className="px-2 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem]">
          <option value="DOP">RD$ / mes</option><option value="USD">US$ / mes</option>
        </select>
      </div>
      <textarea value={b.descripcion ?? ''} onChange={(e) => setB({ ...b, descripcion: e.target.value })} rows={2} placeholder="Para quién es (se usa en la web y en el panel)"
        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem]" />

      <div>
        <div className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-500 mb-2">Siempre incluido</div>
        <div className="flex flex-wrap gap-1.5">{catalogo.siempreIncluido.map((s) => <span key={s} className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-neutral-800 text-[0.75rem] text-slate-500">{s}</span>)}</div>
      </div>
      {GRUPOS.map((g) => {
        const mods = catalogo.modulos.filter((m) => m.grupo === g.id);
        if (!mods.length) return null;
        return (
          <div key={g.id}>
            <div className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-500 mb-2">{g.nombre}</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {mods.map((m) => {
                const si = b.modulos.includes(m.id);
                return (
                  <button key={m.id} type="button" onClick={() => alternar(m.id)} aria-pressed={si}
                    className={`p-2.5 rounded-xl border text-left flex gap-2 cursor-pointer transition ${si ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-slate-200 dark:border-neutral-700 opacity-70'}`}>
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${si ? 'bg-[var(--primary)] text-white' : 'border border-slate-300 dark:border-neutral-600'}`}>{si && <Check className="w-3.5 h-3.5" />}</span>
                    <span><b className="text-[0.8125rem] text-slate-900 dark:text-white">{m.nombre}</b><span className="block text-[0.6875rem] text-slate-500 mt-0.5">{m.descripcion}</span></span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div>
        <div className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-500 mb-2">Límites</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">{RECURSOS.map((r) => <Tope key={r} r={r} valor={b.limites[r]} onChange={(v) => limite(r, v)} />)}</div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void guardar()} disabled={guardando || b.nombre.trim().length < 2}
          className="px-4 py-2.5 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {b.id ? 'Guardar cambios' : 'Crear plan'}
        </button>
        <label className="flex items-center gap-1.5 text-[0.8125rem] text-slate-600 dark:text-neutral-300">
          <input type="checkbox" checked={b.activo} onChange={(e) => setB({ ...b, activo: e.target.checked })} className="accent-[var(--primary)]" /> Se puede asignar a clientes nuevos
        </label>
        {negocios !== undefined && <span className="text-[0.75rem] text-slate-400">{negocios} {negocios === 1 ? 'cliente tiene' : 'clientes tienen'} este plan</span>}
        {aviso && <span className="text-[0.75rem] font-semibold text-[var(--primary)]">{aviso}</span>}
      </div>
    </div>
  );
};

/** Qué incluye cada plan: se edita aquí y aplica al momento a todos sus clientes */
export const PlanesPlataforma: React.FC = () => {
  const [planes, setPlanes] = useState<PlanLalan[] | null>(null);
  const [catalogo, setCatalogo] = useState<CatalogoModulos | null>(null);
  const [elegido, setElegido] = useState<string | 'nuevo' | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([api.get<PlanLalan[]>('/plataforma/planes'), api.get<CatalogoModulos>('/plataforma/planes/modulos')]);
      setPlanes(p); setCatalogo(c); setElegido((e) => e ?? p[0]?.id ?? 'nuevo');
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  if (error) return <p className="text-xs text-rose-600">{error}</p>;
  if (!planes || !catalogo) return <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando planes…</div>;
  const plan = planes.find((p) => p.id === elegido);

  return (
    <div className="space-y-3 text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]">
      <div className="flex flex-wrap gap-2">
        {planes.map((p) => (
          <button key={p.id} type="button" onClick={() => setElegido(p.id)}
            className={`px-3.5 py-2 rounded-xl border text-left cursor-pointer ${elegido === p.id ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900'}`}>
            <b className="text-[0.8125rem] block">{p.nombre}</b>
            <span className={`text-[0.6875rem] ${elegido === p.id ? 'text-white/80' : 'text-slate-500'}`}>{p.moneda === 'DOP' ? 'RD$' : 'US$'} {p.precioMensual.toLocaleString('es-DO')} · {p.modulos.length} módulos · {p.negocios} clientes</span>
          </button>
        ))}
        <button type="button" onClick={() => setElegido('nuevo')} className={`px-3.5 py-2 rounded-xl border border-dashed text-[0.8125rem] font-semibold flex items-center gap-1 cursor-pointer ${elegido === 'nuevo' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-slate-300 text-slate-500'}`}>
          <Plus className="w-3.5 h-3.5" /> Nuevo plan
        </button>
      </div>
      {elegido === 'nuevo'
        ? <EditorPlan plan={nuevo()} catalogo={catalogo} onGuardado={() => { setElegido(null); void cargar(); }} />
        : plan && <EditorPlan key={plan.id} plan={plan} catalogo={catalogo} negocios={plan.negocios} onGuardado={() => void cargar()} />}
    </div>
  );
};
