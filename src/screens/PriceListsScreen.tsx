/**
 * Listas de precios: precios especiales para ciertas clientas.
 *
 * Una lista cambia el precio (descuento, precio fijo, multiplicador o una
 * variante del servicio) por categoría, por servicio o producto, o para todo.
 * Caja la aplica sola al abrir la cuenta de la clienta: la asignada a mano,
 * si no la de su etiqueta (VIP…), si no la por defecto. Lalan dice ese precio
 * en el chat solo si la lista lo permite. La Vitrina enseña el precio normal.
 *
 * Las listas no se borran: se archivan (dejan de aplicarse y se pueden activar).
 */

import { Aparecer } from '../components/ui/movimiento';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Archive, ArchiveRestore, Bot, CalendarRange, Check, ChevronDown, Crown, Loader2, Pencil, Plus, Search, Tag, Trash2, Users, X } from 'lucide-react';
import { useApp, PriceList, PriceListRule, PriceRuleTarget } from '../context/AppContext';
import { useBusquedaDeClientas } from '../hooks/useBusquedaDeClientas';
import { IOSHeader } from '../components/ui/IOSHeader';
import { PageContent } from '../components/ui/PageContent';
import { IOSModal } from '../components/ui/IOSModal';
import { IOSToggle } from '../components/ui/IOSToggle';
import { useConfirmar } from '../components/ui/ModalConfirmar';

// ─── Textos y estilos ────────────────────────────────────────────────────────

const RULE_TARGET_OPTIONS: { value: PriceRuleTarget; label: string }[] = [
  { value: 'service_category', label: 'Una categoría de servicios' },
  { value: 'product_category', label: 'Una categoría de productos' },
  { value: 'specific_service', label: 'Un servicio' },
  { value: 'specific_product', label: 'Un producto' },
  { value: 'all_services', label: 'Todos los servicios' },
];

/** Las etiquetas de clienta a las que se puede enlazar una lista */
const ETIQUETAS: { value: string; label: string }[] = [
  { value: 'vip', label: 'VIP' },
  { value: 'frecuente', label: 'Frecuentes' },
  { value: 'nuevo', label: 'Nuevas' },
  { value: 'puntual', label: 'Puntuales' },
];

const campo = 'w-full min-h-[44px] px-3.5 rounded-2xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.9375rem] text-slate-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
const etiquetaCampo = 'block text-[0.75rem] font-semibold text-slate-500 dark:text-neutral-400 mb-1';
const tarjeta = 'rounded-3xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900';
const botonSuave = 'min-h-[36px] px-3.5 rounded-full border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 text-[0.8125rem] font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50';

const fecha = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' });
const hoy = () => new Date().toLocaleDateString('en-CA');

function emptyRule(): Omit<PriceListRule, 'id'> {
  return { target: 'service_category', discountPercent: 10 };
}

/** Lo que hace una regla, dicho como lo diría la dueña */
function queHace(rule: Omit<PriceListRule, 'id'>, simbolo: string): string {
  if (rule.varianteNombre) return `cobra su precio «${rule.varianteNombre}»`;
  if (rule.fixedPrice !== undefined) return `cuesta ${simbolo}${rule.fixedPrice.toLocaleString('es-DO', { maximumFractionDigits: 2 })}`;
  if (rule.discountPercent !== undefined) return `${rule.discountPercent} % menos`;
  if (rule.priceMultiplier !== undefined) {
    const pct = Math.round((1 - rule.priceMultiplier) * 100);
    return pct > 0 ? `${pct} % menos` : pct < 0 ? `${-pct} % más` : 'precio normal';
  }
  return '—';
}

/** Hoy no vale: archivada, todavía no empieza o ya venció */
function porQueNoVale(pl: PriceList): string | null {
  if (pl.active === false) return 'Archivada';
  const h = hoy();
  if (pl.startDate && h < pl.startDate) return `Empieza el ${fecha(pl.startDate)}`;
  if (pl.endDate && h > pl.endDate) return `Venció el ${fecha(pl.endDate)}`;
  return null;
}

// ─── Una regla en el editor ──────────────────────────────────────────────────

interface RuleRowProps {
  rule: Omit<PriceListRule, 'id'>;
  index: number;
  services: { id: string; name: string }[];
  products: { id: string; name: string }[];
  variantes: string[];
  simbolo: string;
  onChange: (index: number, patch: Partial<Omit<PriceListRule, 'id'>>) => void;
  onRemove: (index: number) => void;
}

function RuleRow({ rule, index, services, products, variantes, simbolo, onChange, onRemove }: RuleRowProps) {
  const set = (patch: Partial<Omit<PriceListRule, 'id'>>) => onChange(index, patch);
  const { categoriasDe } = useApp();
  const serviceCategories = categoriasDe('service');
  const productCategories = categoriasDe('product');
  const tipo = rule.varianteNombre !== undefined ? 'variante' : rule.fixedPrice !== undefined ? 'fixed' : rule.priceMultiplier !== undefined ? 'multiplier' : 'discount';
  const id = (c: string) => `regla-${index}-${c}`;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-neutral-700 bg-slate-50/60 dark:bg-neutral-800/40 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200">Regla {index + 1}</span>
        <button type="button" onClick={() => onRemove(index)} aria-label={`Quitar regla ${index + 1}`} title="Quitar regla"
          className="w-8 h-8 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 inline-flex items-center justify-center cursor-pointer">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label htmlFor={id('a')} className={etiquetaCampo}>Aplica a</label>
          <select id={id('a')} value={rule.target} className={campo}
            onChange={e => set({ target: e.target.value as PriceRuleTarget, serviceCategoryKey: undefined, productCategoryKey: undefined, serviceId: undefined, productId: undefined })}>
            {RULE_TARGET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {rule.target !== 'all_services' && (
          <div>
            <label htmlFor={id('cual')} className={etiquetaCampo}>{rule.target.endsWith('category') ? 'Categoría' : rule.target === 'specific_service' ? 'Servicio' : 'Producto'}</label>
            {rule.target === 'service_category' && (
              <select id={id('cual')} value={rule.serviceCategoryKey ?? ''} onChange={e => set({ serviceCategoryKey: e.target.value })} className={campo}>
                <option value="">Elige…</option>
                {serviceCategories.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
              </select>
            )}
            {rule.target === 'product_category' && (
              <select id={id('cual')} value={rule.productCategoryKey ?? ''} onChange={e => set({ productCategoryKey: e.target.value })} className={campo}>
                <option value="">Elige…</option>
                {productCategories.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
              </select>
            )}
            {rule.target === 'specific_service' && (
              <select id={id('cual')} value={rule.serviceId ?? ''} onChange={e => set({ serviceId: e.target.value })} className={campo}>
                <option value="">Elige…</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            {rule.target === 'specific_product' && (
              <select id={id('cual')} value={rule.productId ?? ''} onChange={e => set({ productId: e.target.value })} className={campo}>
                <option value="">Elige…</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
        )}
        <div>
          <label htmlFor={id('tipo')} className={etiquetaCampo}>Cambio</label>
          <select id={id('tipo')} value={tipo} className={campo}
            onChange={e => {
              const v = e.target.value;
              const nada = { fixedPrice: undefined, discountPercent: undefined, priceMultiplier: undefined, varianteNombre: undefined };
              if (v === 'fixed') set({ ...nada, fixedPrice: 0 });
              else if (v === 'multiplier') set({ ...nada, priceMultiplier: 0.9 });
              else if (v === 'variante') set({ ...nada, varianteNombre: variantes.find(x => /vip/i.test(x)) ?? variantes[0] ?? 'VIP' });
              else set({ ...nada, discountPercent: 10 });
            }}>
            <option value="discount">Descuento en %</option>
            <option value="fixed">Precio fijo</option>
            <option value="multiplier">Multiplicar el precio</option>
            <option value="variante">Cobrar una variante del servicio</option>
          </select>
        </div>
        <div>
          <label htmlFor={id('valor')} className={etiquetaCampo}>
            {tipo === 'variante' ? 'Nombre de la variante' : tipo === 'fixed' ? `Precio (${simbolo})` : tipo === 'multiplier' ? 'Multiplicar por' : 'Descuento (%)'}
          </label>
          {tipo === 'variante' && (
            <>
              <input id={id('valor')} list={id('variantes')} value={rule.varianteNombre} onChange={e => set({ varianteNombre: e.target.value })} className={campo} placeholder="VIP" />
              <datalist id={id('variantes')}>{variantes.map(v => <option key={v} value={v} />)}</datalist>
            </>
          )}
          {tipo === 'discount' && (
            <input id={id('valor')} type="number" inputMode="decimal" min={0} max={100} step={0.5} value={rule.discountPercent}
              onChange={e => set({ discountPercent: parseFloat(e.target.value) || 0 })} className={campo} />
          )}
          {tipo === 'fixed' && (
            <input id={id('valor')} type="number" inputMode="decimal" min={0} step={0.01} value={rule.fixedPrice}
              onChange={e => set({ fixedPrice: parseFloat(e.target.value) || 0 })} className={campo} />
          )}
          {tipo === 'multiplier' && (
            <input id={id('valor')} type="number" inputMode="decimal" min={0} max={10} step={0.01} value={rule.priceMultiplier}
              onChange={e => set({ priceMultiplier: parseFloat(e.target.value) || 0 })} className={campo} />
          )}
        </div>
      </div>
      <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">
        {tipo === 'multiplier' ? '0.9 es 10 % menos; 1.1 es 10 % más. ' : ''}
        {tipo === 'variante' ? 'Cada servicio cobra su variante con ese nombre (la tabla de precios del Catálogo); el que no la tiene, su precio normal.' : ''}
        {tipo === 'fixed' ? 'En la moneda principal del salón.' : ''}
      </p>
    </div>
  );
}

// ─── Crear o cambiar una lista ───────────────────────────────────────────────

interface PriceListFormState {
  name: string;
  description: string;
  isDefault: boolean;
  startDate: string;
  endDate: string;
  etiqueta: string;
  aiInforma: boolean;
  rules: Omit<PriceListRule, 'id'>[];
}

function initialForm(pl?: PriceList): PriceListFormState {
  if (!pl) return { name: '', description: '', isDefault: false, startDate: '', endDate: '', etiqueta: '', aiInforma: false, rules: [] };
  return {
    name: pl.name,
    description: pl.description ?? '',
    isDefault: pl.isDefault,
    startDate: pl.startDate ?? '',
    endDate: pl.endDate ?? '',
    etiqueta: pl.etiqueta ?? '',
    aiInforma: pl.aiInforma ?? false,
    rules: pl.rules.map(({ id: _id, ...r }) => r),
  };
}

interface PriceListModalProps {
  isOpen: boolean;
  existing?: PriceList;
  onClose: () => void;
  onSave: (dto: any) => Promise<void>;
  services: { id: string; name: string }[];
  products: { id: string; name: string }[];
  variantes: string[];
  simbolo: string;
}

function PriceListModal({ isOpen, existing, onClose, onSave, services, products, variantes, simbolo }: PriceListModalProps) {
  const [form, setForm] = useState<PriceListFormState>(initialForm(existing));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (isOpen) { setForm(initialForm(existing)); setError(''); } }, [isOpen, existing]);

  const set = (patch: Partial<PriceListFormState>) => setForm(f => ({ ...f, ...patch }));
  const changeRule = (i: number, patch: Partial<Omit<PriceListRule, 'id'>>) =>
    setForm(f => { const rules = [...f.rules]; rules[i] = { ...rules[i], ...patch }; return { ...f, rules }; });
  const removeRule = (i: number) => setForm(f => ({ ...f, rules: f.rules.filter((_, idx) => idx !== i) }));
  const addRule = () => setForm(f => ({ ...f, rules: [...f.rules, emptyRule()] }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Ponle un nombre a la lista.'); return; }
    const sinElegir = form.rules.findIndex(r =>
      (r.target === 'service_category' && !r.serviceCategoryKey) || (r.target === 'product_category' && !r.productCategoryKey) ||
      (r.target === 'specific_service' && !r.serviceId) || (r.target === 'specific_product' && !r.productId));
    if (sinElegir >= 0) { setError(`En la regla ${sinElegir + 1} falta elegir a qué se aplica.`); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        isDefault: form.isDefault,
        // Vacío quita la fecha (al editar); al crear, sin fecha
        startDate: form.startDate || (existing ? null : undefined),
        endDate: form.endDate || (existing ? null : undefined),
        etiqueta: form.etiqueta || null,
        aiInforma: form.aiInforma,
        // Solo lo que el servidor guarda (un solo cambio por regla)
        rules: form.rules.map(r => {
          const { target, serviceCategoryKey, productCategoryKey, serviceId, productId, fixedPrice, discountPercent, priceMultiplier, varianteNombre } = r;
          return Object.fromEntries(Object.entries({ target, serviceCategoryKey, productCategoryKey, serviceId, productId, fixedPrice, discountPercent, priceMultiplier, varianteNombre })
            .filter(([, v]) => v !== undefined && v !== null && v !== '')) as unknown as PriceListRule;
        }),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <IOSModal isOpen={isOpen} onClose={onClose} forma="ventana" id="hoja-lista-precios"
      title={existing ? 'Cambiar lista de precios' : 'Nueva lista de precios'}
      subtitle="Para quién es, cuándo vale y qué precio cambia">
      <form onSubmit={handleSave} className="space-y-4 pb-6">
        <div>
          <label htmlFor="lista-nombre" className={etiquetaCampo}>Nombre</label>
          <input id="lista-nombre" value={form.name} onChange={e => set({ name: e.target.value })} placeholder="Ej.: Clientas VIP" className={campo} />
        </div>
        <div>
          <label htmlFor="lista-descripcion" className={etiquetaCampo}>Nota (opcional)</label>
          <input id="lista-descripcion" value={form.description} onChange={e => set({ description: e.target.value })} placeholder="Para qué es" className={campo} />
        </div>

        <section className="rounded-2xl border border-slate-200 dark:border-neutral-700 divide-y divide-slate-200 dark:divide-neutral-700">
          <div className="p-3">
            <label htmlFor="lista-etiqueta" className={etiquetaCampo}>Se aplica sola a las clientas…</label>
            <select id="lista-etiqueta" value={form.etiqueta} onChange={e => set({ etiqueta: e.target.value })} className={campo}>
              <option value="">Solo a las que yo le asigne</option>
              {ETIQUETAS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="p-3 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[0.875rem] font-semibold text-slate-800 dark:text-neutral-100">Es la lista por defecto</p>
              <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">Vale para todas las clientas que no tengan otra. Solo puede haber una.</p>
            </div>
            <IOSToggle checked={form.isDefault} onChange={v => set({ isDefault: v })} ariaLabel="Lista por defecto" />
          </div>
          <div className="p-3 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[0.875rem] font-semibold text-slate-800 dark:text-neutral-100">Lalan le dice su precio en el chat</p>
              <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">Y agenda la cita con ese precio. Apagado, el precio especial solo se aplica al cobrar en Caja.</p>
            </div>
            <IOSToggle checked={form.aiInforma} onChange={v => set({ aiInforma: v })} ariaLabel="Lalan dice este precio" />
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="lista-desde" className={etiquetaCampo}>Vale desde</label>
            <input id="lista-desde" type="date" value={form.startDate} onChange={e => set({ startDate: e.target.value })} className={campo} />
          </div>
          <div>
            <label htmlFor="lista-hasta" className={etiquetaCampo}>Hasta</label>
            <input id="lista-hasta" type="date" value={form.endDate} onChange={e => set({ endDate: e.target.value })} className={campo} />
          </div>
        </div>
        {(form.startDate || form.endDate) && (
          <button type="button" onClick={() => set({ startDate: '', endDate: '' })} className="text-[0.75rem] font-semibold text-[var(--primary)] cursor-pointer">Quitar fechas (vale siempre)</button>
        )}

        <section className="space-y-2">
          <p className="text-[0.875rem] font-bold text-slate-800 dark:text-neutral-100">Qué precio cambia</p>
          {form.rules.length === 0 && (
            <p className="text-[0.8125rem] text-slate-500 dark:text-neutral-400 rounded-2xl border border-dashed border-slate-300 dark:border-neutral-700 p-4 text-center">
              Sin reglas, esta lista cobra el precio normal.
            </p>
          )}
          {form.rules.map((rule, i) => (
            <RuleRow key={i} rule={rule} index={i} services={services} products={products} variantes={variantes} simbolo={simbolo}
              onChange={changeRule} onRemove={removeRule} />
          ))}
          <button type="button" onClick={addRule} className={botonSuave}><Plus className="w-4 h-4" /> Agregar regla</button>
          {form.rules.length > 1 && (
            <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">Si dos reglas tocan el mismo servicio, manda la del servicio, luego la de su categoría y por último «Todos los servicios».</p>
          )}
        </section>

        {error && <p role="alert" className="rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-[0.8125rem] px-3.5 py-2.5">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="min-h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 text-[0.9375rem] font-semibold cursor-pointer">Cancelar</button>
          <button type="submit" disabled={saving}
            className="flex-1 min-h-[44px] rounded-2xl bg-[var(--primary)] text-white text-[0.9375rem] font-bold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {existing ? 'Guardar cambios' : 'Crear lista'}
          </button>
        </div>
      </form>
    </IOSModal>
  );
}

// ─── A quién se le aplica ────────────────────────────────────────────────────

function AssignPanel({ priceList, onClose }: { priceList?: PriceList; onClose: () => void }) {
  const { clients, assignPriceList, unassignPriceList, showToast, loadPriceLists } = useApp();
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { if (priceList) setSearch(''); }, [priceList]);

  // Busca también en el servidor lo que no está en el caché
  useBusquedaDeClientas(search);

  const esSuya = (c: any) => c.priceListId === priceList?.id;
  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    const lista = clients.filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q));
    // Las que ya la tienen, primero
    return [...lista].sort((a, b) => Number(esSuya(b)) - Number(esSuya(a)));
  }, [clients, search, priceList?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (client: any) => {
    if (!priceList) return;
    setBusy(client.id);
    try {
      if (esSuya(client)) {
        await unassignPriceList(client.id);
        showToast('Lista quitada', `${client.name} vuelve a su precio de siempre`, 'info');
      } else {
        await assignPriceList(priceList.id, client.id);
        showToast('Lista asignada', `${client.name} paga con «${priceList.name}»`, 'success');
      }
      void loadPriceLists();
    } catch (err: any) {
      showToast('No se pudo', err?.message ?? 'Intenta otra vez', 'warning');
    } finally {
      setBusy(null);
    }
  };

  return (
    <IOSModal isOpen={!!priceList} onClose={onClose} forma="ventana" id="hoja-asignar-lista"
      title="Clientas con esta lista" subtitle={priceList?.name}>
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <label htmlFor="buscar-clienta-lista" className="sr-only">Buscar clienta</label>
        <input id="buscar-clienta-lista" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o teléfono…" className={`${campo} pl-10`} />
      </div>
      <ul className={`${tarjeta} divide-y divide-slate-100 dark:divide-neutral-800 overflow-hidden mb-6`}>
        {filtradas.map(client => {
          const suya = esSuya(client);
          return (
            <li key={client.id}>
              <button type="button" onClick={() => void toggle(client)} disabled={busy === client.id}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-neutral-800/60 cursor-pointer disabled:opacity-60">
                <img src={client.avatar} alt="" className="w-9 h-9 rounded-full shrink-0 object-cover" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[0.875rem] font-semibold text-slate-900 dark:text-neutral-100 truncate">{client.name}</span>
                  <span className="block text-[0.75rem] text-slate-500 dark:text-neutral-400">{client.phone}</span>
                </span>
                {busy === client.id
                  ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  : suya
                    ? <span className="inline-flex items-center gap-1 text-[0.75rem] font-bold text-[var(--primary)]"><Check className="w-4 h-4" /> La tiene</span>
                    : <span className="text-[0.75rem] font-semibold text-slate-500 dark:text-neutral-400">Asignar</span>}
              </button>
            </li>
          );
        })}
        {filtradas.length === 0 && <li className="px-4 py-8 text-center text-[0.8125rem] text-slate-500">No encontré clientas con ese nombre.</li>}
      </ul>
    </IOSModal>
  );
}

// ─── Una lista ───────────────────────────────────────────────────────────────

interface PriceListCardProps {
  pl: PriceList;
  simbolo: string;
  nombreDe: (rule: PriceListRule) => string;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onAssign: () => void;
}

function PriceListCard({ pl, simbolo, nombreDe, onEdit, onArchive, onRestore, onAssign }: PriceListCardProps) {
  const archivada = pl.active === false;
  const aviso = porQueNoVale(pl);
  const etiqueta = ETIQUETAS.find(t => t.value === pl.etiqueta)?.label ?? pl.etiqueta;
  const n = pl.clientCount ?? 0;

  return (
    <article className={`${tarjeta} p-4 ${pl.isDefault ? 'ring-1 ring-[var(--primary)]/40' : ''} ${archivada ? 'opacity-75' : ''}`}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 w-9 h-9 shrink-0 rounded-full bg-[var(--primary)]/12 text-[var(--primary)] flex items-center justify-center">
          {pl.etiqueta === 'vip' ? <Crown className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-[1rem] font-bold text-slate-900 dark:text-neutral-100 leading-snug">{pl.name}</h3>
          {pl.description && <p className="text-[0.8125rem] text-slate-500 dark:text-neutral-400 mt-0.5">{pl.description}</p>}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {pl.isDefault && <span className="px-2 py-0.5 rounded-full text-[0.6875rem] font-bold bg-[var(--primary)]/12 text-[var(--primary)]">Por defecto: todas las clientas</span>}
            {pl.etiqueta && <span className="px-2 py-0.5 rounded-full text-[0.6875rem] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">Sola para clientas {etiqueta}</span>}
            {pl.aiInforma && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-bold bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200"><Bot className="w-3 h-3" /> Lalan lo dice</span>}
            {(pl.startDate || pl.endDate) && !aviso && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-bold bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300">
                <CalendarRange className="w-3 h-3" />{pl.startDate ? `Desde ${fecha(pl.startDate)}` : ''}{pl.startDate && pl.endDate ? ' · ' : ''}{pl.endDate ? `Hasta ${fecha(pl.endDate)}` : ''}
              </span>
            )}
            {aviso && <span className="px-2 py-0.5 rounded-full text-[0.6875rem] font-bold bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300">{aviso}: no se aplica</span>}
          </div>
        </div>
      </div>

      {pl.rules.length === 0 ? (
        <p className="text-[0.8125rem] text-slate-500 dark:text-neutral-400 mt-3 pl-12">Cobra el precio normal (sin reglas).</p>
      ) : (
        <ul className="mt-3 pl-12 space-y-1">
          {pl.rules.map((rule, i) => (
            <li key={rule.id ?? i} className="text-[0.8125rem] text-slate-700 dark:text-neutral-300">
              <span className="font-semibold text-slate-900 dark:text-neutral-100">{nombreDe(rule)}</span>: <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{queHace(rule, simbolo)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 mt-3 pl-12">
        {archivada ? (
          <button type="button" onClick={onRestore} className={botonSuave}><ArchiveRestore className="w-4 h-4" /> Activar</button>
        ) : (
          <>
            {!pl.isDefault && (
              <button type="button" onClick={onAssign} className={botonSuave}>
                <Users className="w-4 h-4" /> {n === 0 ? 'Asignar clientas' : n === 1 ? '1 clienta' : `${n} clientas`}
              </button>
            )}
            <button type="button" onClick={onEdit} className={botonSuave}><Pencil className="w-4 h-4" /> Cambiar</button>
            {!pl.isDefault && (
              <button type="button" onClick={onArchive} className={botonSuave}><Archive className="w-4 h-4" /> Archivar</button>
            )}
          </>
        )}
      </div>
    </article>
  );
}

// ─── Pantalla ────────────────────────────────────────────────────────────────

export function PriceListsScreen() {
  const {
    priceLists, isLoadingPriceLists, loadPriceLists, createPriceList, updatePriceList, deletePriceList,
    services, products, showToast, goBack, categoriaPorClave, baseCurrency, loadCurrencies,
  } = useApp() as any;
  const { confirmar, modalConfirmar } = useConfirmar();

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<PriceList | undefined>();
  const [assignTarget, setAssignTarget] = useState<PriceList | undefined>();
  const [verArchivadas, setVerArchivadas] = useState(false);

  useEffect(() => { void loadPriceLists(); void loadCurrencies?.(); }, [loadPriceLists]); // eslint-disable-line react-hooks/exhaustive-deps

  const simbolo: string = baseCurrency?.symbol ?? '$';
  const activas = (priceLists as PriceList[]).filter(pl => pl.active !== false);
  const archivadas = (priceLists as PriceList[]).filter(pl => pl.active === false);

  /** El nombre de lo que toca la regla: la categoría o el servicio con su nombre, nunca la clave */
  const nombreDe = useCallback((r: PriceListRule): string => {
    switch (r.target) {
      case 'all_services': return 'Todos los servicios';
      case 'service_category': return categoriaPorClave('service', r.serviceCategoryKey ?? '')?.name ?? r.serviceCategoryKey ?? '—';
      case 'product_category': return categoriaPorClave('product', r.productCategoryKey ?? '')?.name ?? r.productCategoryKey ?? '—';
      case 'specific_service': return services.find((s: any) => s.id === r.serviceId)?.name ?? 'Un servicio que ya no está';
      case 'specific_product': return products.find((p: any) => p.id === r.productId)?.name ?? 'Un producto que ya no está';
      default: return '—';
    }
  }, [categoriaPorClave, services, products]);

  const handleSave = useCallback(async (dto: any) => {
    if (editTarget) {
      await updatePriceList(editTarget.id, dto);
      showToast('Lista guardada', dto.name, 'success');
    } else {
      await createPriceList(dto);
      showToast('Lista creada', dto.name, 'success');
    }
    void loadPriceLists();
  }, [editTarget, createPriceList, updatePriceList, showToast, loadPriceLists]);

  const archivar = async (pl: PriceList) => {
    const ok = await confirmar({
      titulo: `¿Archivar «${pl.name}»?`,
      mensaje: 'Deja de aplicarse en Caja y en el chat. Sus reglas y sus clientas se guardan, y la puedes activar cuando quieras.',
      textoConfirmar: 'Archivar',
    });
    if (!ok) return;
    try {
      await deletePriceList(pl.id); // el servidor la archiva, no la borra
      showToast('Lista archivada', pl.name, 'info');
      void loadPriceLists();
    } catch (err: any) {
      showToast('No se pudo archivar', err?.message ?? 'Intenta otra vez', 'warning');
    }
  };

  const activar = async (pl: PriceList) => {
    try {
      await updatePriceList(pl.id, { active: true } as any);
      showToast('Lista activa otra vez', pl.name, 'success');
      void loadPriceLists();
    } catch (err: any) {
      showToast('No se pudo activar', err?.message ?? 'Intenta otra vez', 'warning');
    }
  };

  const nombresDeVariantes: string[] = Array.from(new Set<string>(services.flatMap((sv: any) => (sv.priceTiers ?? []).filter((t: any) => !t.isDefault).map((t: any) => String(t.name).trim()).filter(Boolean)))).sort();
  const svcOptions = services.map((s: any) => ({ id: s.id, name: s.name }));
  const prdOptions = products.map((p: any) => ({ id: p.id, name: p.name }));
  const nueva = () => { setEditTarget(undefined); setShowModal(true); };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-neutral-950">
      <IOSHeader title="Listas de precios" subtitle="Precios especiales para tus clientas" showBack onBack={goBack}
        rightAction={
          <button type="button" onClick={nueva} aria-label="Nueva lista" title="Nueva lista"
            className="min-h-[36px] px-3.5 rounded-full bg-[var(--primary)] text-white text-[0.8125rem] font-bold inline-flex items-center gap-1 cursor-pointer">
            <Plus className="w-4 h-4" /> Nueva
          </button>
        } />
      <PageContent>
        <div className="max-w-3xl mx-auto pb-24">
          <section className={`${tarjeta} p-4 mb-4`} aria-label="Cómo funciona">
            <p className="text-[0.875rem] font-bold text-slate-900 dark:text-neutral-100">Para qué sirve</p>
            <p className="text-[0.8125rem] text-slate-600 dark:text-neutral-300 mt-1 leading-relaxed">
              Una lista cambia el precio para ciertas clientas: un descuento a tus VIP, un precio fijo o una promoción con fecha.
              Caja la aplica sola al abrir la cuenta de la clienta: primero la que le asignaste, si no la de su etiqueta (VIP…), si no la por defecto.
              Lalan solo dice ese precio en el chat si la lista lo permite. La Vitrina siempre enseña el precio normal. Vale en todas las sedes.
            </p>
          </section>

          {isLoadingPriceLists && activas.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
          ) : activas.length === 0 ? (
            <div className={`${tarjeta} px-6 py-12 text-center`}>
              <Tag className="w-6 h-6 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-800 dark:text-neutral-100 mt-2">Todavía no tienes listas</p>
              <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 mt-1">Crea una para darle a tus VIP su precio sin pensarlo en Caja.</p>
              <button type="button" onClick={nueva} className="mt-4 min-h-[44px] px-5 rounded-2xl bg-[var(--primary)] text-white text-[0.9375rem] font-bold inline-flex items-center gap-2 cursor-pointer">
                <Plus className="w-4 h-4" /> Crear lista
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {activas.map((pl, i) => (
                <Aparecer key={pl.id} indice={i}>
                  <PriceListCard pl={pl} simbolo={simbolo} nombreDe={nombreDe}
                    onEdit={() => { setEditTarget(pl); setShowModal(true); }}
                    onArchive={() => void archivar(pl)} onRestore={() => void activar(pl)}
                    onAssign={() => setAssignTarget(pl)} />
                </Aparecer>
              ))}
            </div>
          )}

          {archivadas.length > 0 && (
            <section className="mt-6" aria-label="Listas archivadas">
              <button type="button" onClick={() => setVerArchivadas(v => !v)} aria-expanded={verArchivadas}
                className="w-full flex items-center justify-between min-h-[44px] px-1 text-[0.8125rem] font-bold text-slate-600 dark:text-neutral-300 cursor-pointer">
                <span className="inline-flex items-center gap-2"><Archive className="w-4 h-4" /> Archivadas ({archivadas.length})</span>
                {verArchivadas ? <X className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {verArchivadas && (
                <div className="space-y-3 mt-2">
                  {archivadas.map(pl => (
                    <PriceListCard key={pl.id} pl={pl} simbolo={simbolo} nombreDe={nombreDe}
                      onEdit={() => { setEditTarget(pl); setShowModal(true); }}
                      onArchive={() => void archivar(pl)} onRestore={() => void activar(pl)}
                      onAssign={() => setAssignTarget(pl)} />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </PageContent>

      <PriceListModal isOpen={showModal} existing={editTarget}
        onClose={() => { setShowModal(false); setEditTarget(undefined); }}
        onSave={handleSave} services={svcOptions} products={prdOptions} variantes={nombresDeVariantes} simbolo={simbolo} />
      <AssignPanel priceList={assignTarget} onClose={() => setAssignTarget(undefined)} />
      {modalConfirmar}
    </div>
  );
}
