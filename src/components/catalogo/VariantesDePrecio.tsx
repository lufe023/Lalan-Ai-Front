import React, { useState } from 'react';
import { Bot, CheckCircle2, MapPin, Plus, Trash2 } from 'lucide-react';
import type { PriceTier } from '../../types';
import { useSedeActiva, type SedeDelSalon } from '../../context/SedeActivaContext';

/**
 * Las variantes de precio de un servicio o de un producto, sede por sede.
 *
 * Sedes hermanas, no siamesas: cada variante tiene el precio del salón y, en
 * "Todas las sedes", una fila por sede donde se elige si cobra lo mismo, otro
 * precio o (en servicios) si ahí no se ofrece. Dentro de una sede, cada
 * variante lleva la etiqueta de esa sede para que se sepa qué se está tocando.
 * Quitar una variante pide confirmación.
 */

/** Lo que una sede hace con una variante */
export interface EnSede { modo: 'salon' | 'propio' | 'no'; precio: number }
/** sede → variante → lo que hace */
export type PreciosDeSedes = Record<string, Record<string, EnSede>>;
/** Lo que se manda al servidor por sede: null = cobra lo del salón, [] = no se ofrece */
export interface PrecioEnSede { locationId: string; tiers: PriceTier[] | null }

const mismoTier = (a: PriceTier, b: PriceTier) => a.id === b.id || a.name.trim().toLowerCase() === b.name.trim().toLowerCase();

/**
 * Lo que cada sede hace hoy con cada variante del salón.
 * `propias`: las variantes que cobra cada sede con precio propio; `ocultas`:
 * las sedes donde el servicio no se ofrece.
 */
export function preciosDeSedesDesde(
  tiers: PriceTier[], sedes: SedeDelSalon[], propias: Record<string, PriceTier[]>, ocultas: string[] = [], permiteNo = true,
): PreciosDeSedes {
  const r: PreciosDeSedes = {};
  for (const s of sedes) {
    r[s.id] = {};
    const suyas = propias[s.id];
    for (const t of tiers) {
      if (suyas) {
        const suya = suyas.find(x => mismoTier(x, t));
        r[s.id][t.id] = !suya ? { modo: permiteNo ? 'no' : 'salon', precio: t.price }
          : Number(suya.price) === Number(t.price) ? { modo: 'salon', precio: t.price }
          : { modo: 'propio', precio: Number(suya.price) };
      } else {
        r[s.id][t.id] = { modo: ocultas.includes(s.id) ? 'no' : 'salon', precio: t.price };
      }
    }
  }
  return r;
}

/** Lo que se guarda de cada sede a partir de lo elegido en pantalla */
export function preciosParaGuardar(tiers: PriceTier[], sedes: SedeDelSalon[], p: PreciosDeSedes): PrecioEnSede[] {
  return sedes.map(s => {
    const fila = p[s.id] ?? {};
    const modos = tiers.map(t => fila[t.id]?.modo ?? 'salon');
    if (modos.every(m => m === 'salon')) return { locationId: s.id, tiers: null };
    return {
      locationId: s.id,
      tiers: tiers
        .filter(t => (fila[t.id]?.modo ?? 'salon') !== 'no')
        .map(t => (fila[t.id]?.modo === 'propio' ? { ...t, price: fila[t.id].precio } : t)),
    };
  });
}

const campo = 'px-2.5 py-2 rounded-lg bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)]';

const Precio: React.FC<{ moneda: string; valor: number; onChange: (n: number) => void; etiqueta: string; chico?: boolean }> = ({ moneda, valor, onChange, etiqueta, chico }) => (
  <label className={`flex items-center gap-1 ${campo} ${chico ? 'w-24 py-1.5' : 'w-32'}`}>
    <span className="text-[0.6875rem] font-bold text-slate-400 shrink-0">{moneda}</span>
    <input type="number" min="0" step="any" value={Number.isFinite(valor) ? valor : 0} aria-label={etiqueta}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full min-w-0 bg-transparent text-[0.8125rem] font-black tabular-nums focus:outline-none" />
  </label>
);

const Chip: React.FC<{ children: React.ReactNode; tono?: 'neutro' | 'aviso' | 'sede' }> = ({ children, tono = 'neutro' }) => (
  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[0.6875rem] font-semibold ${
    tono === 'aviso' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
      : tono === 'sede' ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
      : 'bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400'}`}>
    {children}
  </span>
);

export const VariantesDePrecio: React.FC<{
  tiers: PriceTier[];
  onTiers: (t: PriceTier[]) => void;
  moneda: string;
  /** Solo en "Todas las sedes" con varias sedes; sin esto no hay filas por sede */
  porSede?: PreciosDeSedes;
  onPorSede?: (p: PreciosDeSedes) => void;
  /** La sede de la que son estos precios cuando no se ven todas (una sede activa, o la copia de una sede) */
  sedeDeEstos?: SedeDelSalon | null;
  /** Servicios: una sede puede no ofrecer una variante. Productos: no */
  permiteNo?: boolean;
  /** Servicios: la asistente ofrece o no cada variante */
  conAsistente?: boolean;
  nombreBase?: string;
  ejemploNombre?: string;
}> = ({ tiers, onTiers, moneda, porSede, onPorSede, sedeDeEstos, permiteNo = false, conAsistente = false, nombreBase = 'Precio base', ejemploNombre = 'Ej: Cabello largo, retoque' }) => {
  const { sedes, varias } = useSedeActiva();
  const conSedes = !!porSede && !!onPorSede && varias;
  const [borrando, setBorrando] = useState<string | null>(null);
  const [nueva, setNueva] = useState<{ nombre: string; precio: number; sedes: string[] } | null>(null);

  const cambiarTier = (id: string, cambio: Partial<PriceTier>) => onTiers(tiers.map(t => (t.id === id ? { ...t, ...cambio } : t)));
  const cambiarSede = (sede: string, tier: PriceTier, cambio: Partial<EnSede>) => {
    if (!porSede || !onPorSede) return;
    const actual = porSede[sede]?.[tier.id] ?? { modo: 'salon', precio: tier.price };
    onPorSede({ ...porSede, [sede]: { ...(porSede[sede] ?? {}), [tier.id]: { ...actual, ...cambio } } });
  };
  const quitar = (id: string) => {
    onTiers(tiers.filter(t => t.id !== id));
    if (porSede && onPorSede) {
      const r: PreciosDeSedes = {};
      for (const [s, fila] of Object.entries(porSede)) { const { [id]: _fuera, ...resto } = fila; r[s] = resto; }
      onPorSede(r);
    }
    setBorrando(null);
  };
  const agregar = () => {
    if (!nueva?.nombre.trim()) return;
    const t: PriceTier = { id: `tier_${Date.now()}`, name: nueva.nombre.trim(), price: nueva.precio, description: '' };
    onTiers([...tiers, t]);
    if (porSede && onPorSede) {
      const r: PreciosDeSedes = { ...porSede };
      for (const s of sedes) r[s.id] = { ...(r[s.id] ?? {}), [t.id]: { modo: nueva.sedes.includes(s.id) ? 'salon' : 'no', precio: t.price } };
      onPorSede(r);
    }
    setNueva(null);
  };

  /** Qué dice la variante de sí misma, de un vistazo */
  const resumen = (t: PriceTier) => {
    if (!conSedes) return sedeDeEstos && varias ? [<Chip key="s" tono="sede"><MapPin className="w-2.5 h-2.5" /> {sedeDeEstos.name}</Chip>] : [];
    const no = sedes.filter(s => porSede![s.id]?.[t.id]?.modo === 'no');
    const otro = sedes.filter(s => porSede![s.id]?.[t.id]?.modo === 'propio');
    if (!no.length && !otro.length) return [<Chip key="t" tono="sede"><MapPin className="w-2.5 h-2.5" /> Igual en todas las sedes</Chip>];
    const chips: React.ReactNode[] = [];
    const en = sedes.filter(s => !no.includes(s));
    if (no.length) chips.push(<Chip key="en" tono="sede"><MapPin className="w-2.5 h-2.5" /> {en.length ? `Solo en ${en.map(s => s.name).join(', ')}` : 'En ninguna sede'}</Chip>);
    if (otro.length) chips.push(<Chip key="otro" tono="aviso">Otro precio en {otro.map(s => s.name).join(', ')}</Chip>);
    return chips;
  };

  return (
    <div className="space-y-2">
      {tiers.map((t, i) => (
        <div key={t.id} className={`rounded-xl border p-3 space-y-2 ${i === 0
          ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
          : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700/80'}`}>
          <div className="flex flex-wrap items-center gap-1">
            {i === 0 && (
              <span className="inline-flex items-center gap-1 text-[0.6875rem] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-2.5 h-2.5" /> {nombreBase}
              </span>
            )}
            {resumen(t)}
          </div>

          {borrando === t.id ? (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50">
              <span className="text-[0.75rem] text-rose-700 dark:text-rose-300">¿Quitar «{t.name || 'esta variante'}»{conSedes ? ' de todas las sedes' : ''}?</span>
              <span className="flex gap-1.5">
                <button type="button" onClick={() => setBorrando(null)} className="px-2.5 py-1 rounded-lg text-[0.75rem] font-bold text-slate-600 dark:text-neutral-300 bg-white dark:bg-neutral-800 cursor-pointer">Cancelar</button>
                <button type="button" onClick={() => quitar(t.id)} className="px-2.5 py-1 rounded-lg text-[0.75rem] font-bold text-white bg-rose-500 cursor-pointer">Quitar</button>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input type="text" value={t.name} placeholder={i === 0 ? nombreBase : ejemploNombre} aria-label="Nombre de la variante"
                onChange={e => cambiarTier(t.id, { name: e.target.value })}
                className={`flex-1 min-w-0 text-[0.8125rem] font-semibold ${campo}`} />
              <Precio moneda={moneda} valor={t.price} etiqueta={conSedes ? `Precio del salón de ${t.name}` : `Precio de ${t.name}`}
                onChange={n => cambiarTier(t.id, { price: n })} />
              {tiers.length > 1 && (
                <button type="button" onClick={() => setBorrando(t.id)} title="Quitar variante" aria-label={`Quitar ${t.name}`}
                  className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          <input type="text" value={t.description ?? ''} placeholder="Cuándo aplica (opcional): ej. cabello debajo de los hombros"
            onChange={e => cambiarTier(t.id, { description: e.target.value })}
            className={`w-full text-[0.75rem] text-slate-600 dark:text-neutral-300 ${campo} py-1.5`} />

          {conAsistente && i > 0 && (
            <label className="inline-flex items-center gap-1.5 text-[0.75rem] text-slate-600 dark:text-neutral-300 cursor-pointer">
              <input type="checkbox" checked={t.aiOfrece !== false} onChange={e => cambiarTier(t.id, { aiOfrece: e.target.checked })} className="accent-purple-500" />
              <Bot className="w-3.5 h-3.5 text-purple-500" /> La asistente la ofrece
            </label>
          )}

          {conSedes && (
            <div className="pt-2 border-t border-slate-200/70 dark:border-neutral-700/60 space-y-1.5">
              <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">En cada sede</div>
              {sedes.map(s => {
                const e = porSede![s.id]?.[t.id] ?? { modo: 'salon' as const, precio: t.price };
                const opciones: { id: EnSede['modo']; label: string }[] = [
                  { id: 'salon', label: 'Igual' }, { id: 'propio', label: 'Otro precio' },
                  ...(permiteNo ? [{ id: 'no' as const, label: 'No se ofrece' }] : []),
                ];
                return (
                  <div key={s.id} className="flex flex-wrap items-center gap-2">
                    <span className="flex-1 min-w-[8rem] text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-200 truncate">{s.name}</span>
                    <span className="ml-auto flex items-center gap-2">
                    <span className="flex rounded-lg bg-slate-100 dark:bg-neutral-800 p-0.5" role="radiogroup" aria-label={`${t.name} en ${s.name}`}>
                      {opciones.map(o => (
                        <button key={o.id} type="button" role="radio" aria-checked={e.modo === o.id}
                          onClick={() => cambiarSede(s.id, t, { modo: o.id, precio: o.id === 'propio' && e.modo !== 'propio' ? t.price : e.precio })}
                          className={`px-1.5 sm:px-2 py-1 rounded-md text-[0.6875rem] font-bold whitespace-nowrap cursor-pointer ${e.modo === o.id
                            ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-2xs'
                            : 'text-slate-500 dark:text-neutral-400'}`}>
                          {o.label}
                        </button>
                      ))}
                    </span>
                    {e.modo === 'propio' ? (
                      <Precio chico moneda={moneda} valor={e.precio} etiqueta={`Precio de ${t.name} en ${s.name}`} onChange={n => cambiarSede(s.id, t, { precio: n })} />
                    ) : (
                      <span className={`w-24 text-right text-[0.75rem] tabular-nums ${e.modo === 'no' ? 'text-slate-400' : 'text-slate-500 dark:text-neutral-400'}`}>
                        {e.modo === 'no' ? '—' : `${moneda} ${t.price}`}
                      </span>
                    )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {nueva ? (
        <div className="rounded-xl border border-dashed border-[var(--primary)]/50 bg-[var(--primary)]/5 p-3 space-y-2">
          <div className="text-[0.75rem] font-bold text-slate-800 dark:text-white">Nueva variante</div>
          <div className="flex items-center gap-2">
            <input autoFocus type="text" value={nueva.nombre} placeholder={ejemploNombre} aria-label="Nombre de la nueva variante"
              onChange={e => setNueva({ ...nueva, nombre: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }}
              className={`flex-1 min-w-0 text-[0.8125rem] font-semibold ${campo}`} />
            <Precio moneda={moneda} valor={nueva.precio} etiqueta="Precio de la nueva variante" onChange={n => setNueva({ ...nueva, precio: n })} />
          </div>
          {conSedes && permiteNo && (
            <div className="space-y-1">
              <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">¿En qué sedes se ofrece?</div>
              <div className="flex flex-wrap gap-1">
                <button type="button" onClick={() => setNueva({ ...nueva, sedes: sedes.map(s => s.id) })}
                  className={`px-2.5 py-1 rounded-full text-[0.6875rem] font-bold cursor-pointer ${nueva.sedes.length === sedes.length ? 'bg-[var(--primary)] text-white' : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300'}`}>
                  Todas
                </button>
                {sedes.map(s => {
                  const elegida = nueva.sedes.includes(s.id) && nueva.sedes.length < sedes.length;
                  return (
                    <button key={s.id} type="button"
                      onClick={() => setNueva({ ...nueva, sedes: nueva.sedes.length === sedes.length ? [s.id] : elegida ? nueva.sedes.filter(x => x !== s.id) : [...nueva.sedes, s.id] })}
                      className={`px-2.5 py-1 rounded-full text-[0.6875rem] font-bold cursor-pointer ${elegida ? 'bg-[var(--primary)] text-white' : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300'}`}>
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {!conSedes && sedeDeEstos && varias && (
            <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">Se agrega en <b>{sedeDeEstos.name}</b>.</p>
          )}
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => setNueva(null)} className="px-3 py-1.5 rounded-lg text-[0.75rem] font-bold text-slate-600 dark:text-neutral-300 bg-slate-100 dark:bg-neutral-800 cursor-pointer">Cancelar</button>
            <button type="button" onClick={agregar} disabled={!nueva.nombre.trim() || (conSedes && permiteNo && !nueva.sedes.length)}
              className="px-3 py-1.5 rounded-lg text-[0.75rem] font-bold text-white bg-[var(--primary)] disabled:opacity-40 cursor-pointer">Agregar</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setNueva({ nombre: '', precio: tiers[0]?.price ?? 0, sedes: sedes.map(s => s.id) })}
          className="w-full py-2 rounded-xl border border-dashed border-slate-300 dark:border-neutral-700 text-[0.75rem] font-bold text-slate-600 dark:text-neutral-300 hover:border-[var(--primary)] hover:text-[var(--primary)] flex items-center justify-center gap-1 cursor-pointer transition">
          <Plus className="w-3.5 h-3.5" /> Agregar variante
        </button>
      )}
    </div>
  );
};
