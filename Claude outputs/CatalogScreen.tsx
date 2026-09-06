import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Search, Sparkles, Bot, BotOff, Pencil, Trash2, X,
  Package, Scissors, Star, ChevronDown, Loader2, Tag, DollarSign,
  Clock, ToggleLeft, ToggleRight, Smile, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { IOSHeader } from '../components/ui/IOSHeader';
import { useApp } from '../context/AppContext';
import { SalonService, SalonProduct, ServiceCategory, ProductCategory, PriceTier } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────

const SERVICE_CATEGORIES: { key: ServiceCategory; label: string; icon: string; color: string }[] = [
  { key: 'nails',    label: 'Uñas',      icon: '💅', color: '#f9a8d4' },
  { key: 'hair',     label: 'Cabello',   icon: '💇‍♀️', color: '#c4b5fd' },
  { key: 'massage',  label: 'Masajes',   icon: '💆‍♀️', color: '#86efac' },
  { key: 'pedi_spa', label: 'Pedi Spa',  icon: '🦶', color: '#93c5fd' },
  { key: 'facial',   label: 'Facial',    icon: '✨', color: '#fde68a' },
];

const PRODUCT_CATEGORIES: { key: ProductCategory; label: string; icon: string; color: string }[] = [
  { key: 'nailcare',  label: 'Uñas',       icon: '💅', color: '#f9a8d4' },
  { key: 'haircare',  label: 'Cabello',    icon: '💇‍♀️', color: '#c4b5fd' },
  { key: 'skincare',  label: 'Piel',       icon: '🧴', color: '#86efac' },
  { key: 'spa_body',  label: 'Spa & Body', icon: '🛁', color: '#93c5fd' },
];

const SERVICE_COLORS = [
  '#f9a8d4','#c4b5fd','#86efac','#93c5fd','#fde68a',
  '#fb923c','#f87171','#34d399','#60a5fa','#a78bfa',
];

const BEAUTY_EMOJIS = [
  '💅','💇‍♀️','💆‍♀️','🦶','✨','💎','🌸','🪷','🌺','🧖‍♀️',
  '💄','👄','💋','🌹','🍃','🌿','🪻','🧴','🪨','🕯️',
  '🛁','🧼','💫','⭐','🌟','🎀','🎁','🌙','☀️','🦋',
  '🌊','🫧','💐','🌷','🍓','🫶','✌️','👑','💈','🔮',
];

// ─── Sub-components ──────────────────────────────────────────────────────────

const FormField: React.FC<{
  label: string; required?: boolean; error?: string; hint?: string;
  children: React.ReactNode;
}> = ({ label, required, error, hint, children }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-semibold text-slate-600 dark:text-neutral-400 tracking-wide">
      {label} {required && <span className="text-rose-400">*</span>}
    </label>
    {children}
    {error && (
      <p className="flex items-center gap-1 text-[11px] text-rose-500 font-medium">
        <AlertCircle className="w-3 h-3 shrink-0" />{error}
      </p>
    )}
    {hint && !error && <p className="text-[10px] text-slate-400 dark:text-neutral-500">{hint}</p>}
  </div>
);

const inputCls = (err?: string) =>
  `w-full px-3 py-2 text-sm rounded-xl border transition outline-none focus:ring-2
   ${err
     ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100 dark:border-rose-500/60 dark:focus:ring-rose-500/20'
     : 'border-slate-200 dark:border-neutral-700 focus:border-[var(--primary)] focus:ring-[var(--primary)]/15'
   }
   bg-white dark:bg-neutral-800/80 text-slate-800 dark:text-neutral-100
   placeholder:text-slate-400 dark:placeholder:text-neutral-500`;

// Price Tiers Editor
interface PriceTiersEditorProps {
  tiers: PriceTier[];
  onChange: (tiers: PriceTier[]) => void;
  currency?: string;
}
const PriceTiersEditor: React.FC<PriceTiersEditorProps> = ({ tiers, onChange, currency = '$' }) => {
  const addTier = () => {
    const newTier: PriceTier = {
      id: crypto.randomUUID(),
      name: '',
      price: 0,
      description: '',
      isDefault: tiers.length === 0,
    };
    onChange([...tiers, newTier]);
  };

  const updateTier = (idx: number, patch: Partial<PriceTier>) => {
    const updated = tiers.map((t, i) => i === idx ? { ...t, ...patch } : t);
    onChange(updated);
  };

  const removeTier = (idx: number) => onChange(tiers.filter((_, i) => i !== idx));
  const setDefault = (idx: number) =>
    onChange(tiers.map((t, i) => ({ ...t, isDefault: i === idx })));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-600 dark:text-neutral-400 tracking-wide">
          Lista de Precios <span className="text-slate-400 font-normal">(estilo Odoo)</span>
        </label>
        <button
          type="button"
          onClick={addTier}
          className="flex items-center gap-1 text-[11px] text-[var(--primary)] font-semibold hover:opacity-80 transition"
        >
          <Plus className="w-3 h-3" /> Agregar nivel
        </button>
      </div>

      {tiers.length === 0 && (
        <p className="text-[11px] text-slate-400 dark:text-neutral-500 italic py-1">
          Sin niveles — el precio base aplica a todos los clientes.
        </p>
      )}

      {tiers.map((tier, idx) => (
        <div key={tier.id} className="rounded-xl border border-slate-200 dark:border-neutral-700 p-2.5 flex flex-col gap-2 bg-slate-50/60 dark:bg-neutral-800/40">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tier.name}
              onChange={e => updateTier(idx, { name: e.target.value })}
              placeholder="Ej: VIP Frecuente, Happy Hour…"
              className={`${inputCls()} text-xs flex-1`}
            />
            <input
              type="number"
              value={tier.price || ''}
              onChange={e => updateTier(idx, { price: Number(e.target.value) })}
              placeholder="Precio"
              min={0}
              className={`${inputCls()} text-xs w-24`}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tier.description || ''}
              onChange={e => updateTier(idx, { description: e.target.value })}
              placeholder="Descripción opcional (ej: Clientas con +10 visitas)"
              className={`${inputCls()} text-[11px] flex-1`}
            />
            <button
              type="button"
              onClick={() => setDefault(idx)}
              title="Marcar como precio por defecto"
              className={`shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition font-medium
                ${tier.isDefault
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'text-slate-500 border-slate-200 dark:border-neutral-600 hover:border-[var(--primary)] hover:text-[var(--primary)]'
                }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              {tier.isDefault ? 'Default' : 'Default?'}
            </button>
            <button
              type="button"
              onClick={() => removeTier(idx)}
              className="shrink-0 text-rose-400 hover:text-rose-600 transition p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// Emoji Picker
const EmojiPicker: React.FC<{ value: string; onChange: (emoji: string) => void }> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-12 h-10 text-xl rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 flex items-center justify-center hover:border-[var(--primary)] transition"
        title="Elegir ícono emoji"
      >
        {value || <Smile className="w-4 h-4 text-slate-400" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 4 }}
            className="absolute left-0 top-12 z-50 p-2 rounded-2xl border border-slate-200 dark:border-neutral-700 glass-ios shadow-2xl w-64"
          >
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide px-1 mb-1.5">
              Elegir ícono
            </p>
            <div className="grid grid-cols-8 gap-0.5">
              {BEAUTY_EMOJIS.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => { onChange(e); setOpen(false); }}
                  className={`text-lg p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-700 transition
                    ${value === e ? 'bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]' : ''}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Service Modal ────────────────────────────────────────────────────────────

interface ServiceFormData {
  name: string; category: ServiceCategory; categoryName: string;
  price: string; durationMinutes: string; icon: string; color: string;
  popular: boolean; description: string; aiAvailable: boolean;
  priceTiers: PriceTier[];
}

const EMPTY_SERVICE: ServiceFormData = {
  name: '', category: 'nails', categoryName: 'Uñas',
  price: '', durationMinutes: '60', icon: '💅', color: '#f9a8d4',
  popular: false, description: '', aiAvailable: true, priceTiers: [],
};

const ServiceModal: React.FC<{
  service?: SalonService;
  onClose: () => void;
  onSave: (data: ServiceFormData) => Promise<void>;
}> = ({ service, onClose, onSave }) => {
  const isEdit = !!service;
  const [form, setForm] = useState<ServiceFormData>(
    service
      ? {
          name: service.name, category: service.category,
          categoryName: service.categoryName, price: String(service.price),
          durationMinutes: String(service.durationMinutes), icon: service.icon,
          color: service.color, popular: service.popular ?? false,
          description: service.description ?? '', aiAvailable: service.aiAvailable,
          priceTiers: service.priceTiers ?? [],
        }
      : EMPTY_SERVICE
  );
  const [errors, setErrors] = useState<Partial<Record<keyof ServiceFormData, string>>>({});
  const [apiError, setApiError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<ServiceFormData>) => {
    setForm(f => ({ ...f, ...patch }));
    const key = Object.keys(patch)[0] as keyof ServiceFormData;
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
    if (apiError) setApiError('');
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof ServiceFormData, string>> = {};
    if (!form.name.trim()) e.name = 'El nombre del servicio es obligatorio.';
    const p = Number(form.price);
    if (!form.price || isNaN(p) || p < 0) e.price = 'Ingresa un precio base válido.';
    const d = Number(form.durationMinutes);
    if (!form.durationMinutes || isNaN(d) || d < 5) e.durationMinutes = 'Mínimo 5 minutos.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setApiError('');
    try {
      await onSave(form);
      onClose();
    } catch (err: any) {
      setApiError(err?.message ?? 'Ocurrió un error al guardar el servicio.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        className="relative z-10 w-full sm:max-w-lg glass-ios rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-200/60 dark:border-neutral-700/60 shrink-0">
          <h2 className="text-base font-bold text-slate-800 dark:text-white">
            {isEdit ? 'Editar Servicio' : 'Nuevo Servicio'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-neutral-700 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form id="service-form" onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {apiError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700/50 text-rose-600 dark:text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{apiError}</span>
            </div>
          )}

          {/* Name + Icon */}
          <div className="flex gap-2 items-start">
            <div className="shrink-0 mt-5">
              <EmojiPicker value={form.icon} onChange={icon => set({ icon })} />
            </div>
            <div className="flex-1">
              <FormField label="Nombre del servicio" required error={errors.name}>
                <input
                  autoFocus
                  type="text"
                  value={form.name}
                  onChange={e => set({ name: e.target.value })}
                  placeholder="Ej: Manicure Gel Francés"
                  className={inputCls(errors.name)}
                />
              </FormField>
            </div>
          </div>

          {/* Category */}
          <FormField label="Categoría" required>
            <div className="grid grid-cols-3 gap-1.5">
              {SERVICE_CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => set({ category: cat.key, categoryName: cat.label, icon: form.icon || cat.icon })}
                  className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border text-xs font-medium transition
                    ${form.category === cat.key
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                      : 'border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-neutral-600'
                    }`}
                >
                  <span className="text-base">{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </FormField>

          {/* Price + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Precio base (USD)" required error={errors.price}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number" min={0} step="0.01"
                  value={form.price}
                  onChange={e => set({ price: e.target.value })}
                  placeholder="0.00"
                  className={`${inputCls(errors.price)} pl-7`}
                />
              </div>
            </FormField>
            <FormField label="Duración (minutos)" required error={errors.durationMinutes}>
              <input
                type="number" min={5} step={5}
                value={form.durationMinutes}
                onChange={e => set({ durationMinutes: e.target.value })}
                placeholder="60"
                className={inputCls(errors.durationMinutes)}
              />
            </FormField>
          </div>

          {/* Color */}
          <FormField label="Color de acento">
            <div className="flex items-center gap-2 flex-wrap">
              {SERVICE_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set({ color: c })}
                  className={`w-7 h-7 rounded-full border-2 transition ${form.color === c ? 'border-slate-700 dark:border-white scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </FormField>

          {/* Description */}
          <FormField label="Descripción" hint="Aparece en el catálogo y en las respuestas del bot.">
            <textarea
              value={form.description}
              onChange={e => set({ description: e.target.value })}
              placeholder="Describe el servicio brevemente…"
              rows={2}
              className={`${inputCls()} resize-none`}
            />
          </FormField>

          {/* Toggles */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => set({ popular: !form.popular })}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition
                ${form.popular ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' : 'border-slate-200 dark:border-neutral-700 text-slate-500'}`}
            >
              <Star className="w-3.5 h-3.5" />
              {form.popular ? 'Popular ✓' : 'Popular'}
            </button>
            <button
              type="button"
              onClick={() => set({ aiAvailable: !form.aiAvailable })}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition
                ${form.aiAvailable ? 'border-violet-300 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400' : 'border-slate-200 dark:border-neutral-700 text-slate-500'}`}
            >
              <Bot className="w-3.5 h-3.5" />
              {form.aiAvailable ? 'IA activa ✓' : 'IA inactiva'}
            </button>
          </div>

          {/* Price Tiers */}
          <div className="border-t border-slate-200 dark:border-neutral-700 pt-4">
            <PriceTiersEditor tiers={form.priceTiers} onChange={tiers => set({ priceTiers: tiers })} />
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200/60 dark:border-neutral-700/60 shrink-0">
          <button
            form="service-form"
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-2xl bg-[var(--primary)] text-white font-bold text-sm shadow-md hover:opacity-90 active:scale-[0.98] transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
            ) : (
              <>{isEdit ? 'Guardar cambios' : 'Crear servicio'}</>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Product Modal ────────────────────────────────────────────────────────────

interface ProductFormData {
  name: string; category: ProductCategory; categoryName: string;
  sku: string; basePrice: string; stock: string;
  image: string; description: string; aiAvailable: boolean;
  priceTiers: PriceTier[];
}

const EMPTY_PRODUCT: ProductFormData = {
  name: '', category: 'nailcare', categoryName: 'Uñas',
  sku: '', basePrice: '', stock: '0',
  image: '🧴', description: '', aiAvailable: true, priceTiers: [],
};

const ProductModal: React.FC<{
  product?: SalonProduct;
  onClose: () => void;
  onSave: (data: ProductFormData) => Promise<void>;
}> = ({ product, onClose, onSave }) => {
  const isEdit = !!product;
  const [form, setForm] = useState<ProductFormData>(
    product
      ? {
          name: product.name, category: product.category,
          categoryName: product.categoryName, sku: product.sku,
          basePrice: String(product.basePrice), stock: String(product.stock),
          image: product.image ?? '🧴', description: product.description,
          aiAvailable: product.aiAvailable, priceTiers: product.priceTiers ?? [],
        }
      : EMPTY_PRODUCT
  );
  const [errors, setErrors] = useState<Partial<Record<keyof ProductFormData, string>>>({});
  const [apiError, setApiError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<ProductFormData>) => {
    setForm(f => ({ ...f, ...patch }));
    const key = Object.keys(patch)[0] as keyof ProductFormData;
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
    if (apiError) setApiError('');
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof ProductFormData, string>> = {};
    if (!form.name.trim()) e.name = 'El nombre del producto es obligatorio.';
    if (!form.sku.trim()) e.sku = 'El SKU es obligatorio.';
    const p = Number(form.basePrice);
    if (!form.basePrice || isNaN(p) || p < 0) e.basePrice = 'Ingresa un precio válido.';
    const s = Number(form.stock);
    if (isNaN(s) || s < 0) e.stock = 'Ingresa un stock válido (≥ 0).';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setApiError('');
    try {
      await onSave(form);
      onClose();
    } catch (err: any) {
      setApiError(err?.message ?? 'Ocurrió un error al guardar el producto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        className="relative z-10 w-full sm:max-w-lg glass-ios rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh]"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-200/60 dark:border-neutral-700/60 shrink-0">
          <h2 className="text-base font-bold text-slate-800 dark:text-white">
            {isEdit ? 'Editar Producto' : 'Nuevo Producto'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-neutral-700 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form id="product-form" onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {apiError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700/50 text-rose-600 dark:text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{apiError}</span>
            </div>
          )}

          {/* Name + Emoji icon */}
          <div className="flex gap-2 items-start">
            <div className="shrink-0 mt-5">
              <EmojiPicker value={form.image} onChange={image => set({ image })} />
            </div>
            <div className="flex-1">
              <FormField label="Nombre del producto" required error={errors.name}>
                <input
                  autoFocus
                  type="text"
                  value={form.name}
                  onChange={e => set({ name: e.target.value })}
                  placeholder="Ej: Base Coat Gel OPI"
                  className={inputCls(errors.name)}
                />
              </FormField>
            </div>
          </div>

          {/* Category */}
          <FormField label="Categoría" required>
            <div className="grid grid-cols-4 gap-1.5">
              {PRODUCT_CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => set({ category: cat.key, categoryName: cat.label })}
                  className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border text-[10px] font-medium transition
                    ${form.category === cat.key
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                      : 'border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-400 hover:border-slate-300'
                    }`}
                >
                  <span className="text-base">{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </FormField>

          {/* SKU + Price + Stock */}
          <div className="grid grid-cols-3 gap-2">
            <FormField label="SKU" required error={errors.sku} hint="Código único">
              <input
                type="text"
                value={form.sku}
                onChange={e => set({ sku: e.target.value.toUpperCase() })}
                placeholder="OPI-001"
                className={`${inputCls(errors.sku)} uppercase`}
              />
            </FormField>
            <FormField label="Precio (USD)" required error={errors.basePrice}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number" min={0} step="0.01"
                  value={form.basePrice}
                  onChange={e => set({ basePrice: e.target.value })}
                  placeholder="0.00"
                  className={`${inputCls(errors.basePrice)} pl-7`}
                />
              </div>
            </FormField>
            <FormField label="Stock" required error={errors.stock}>
              <input
                type="number" min={0}
                value={form.stock}
                onChange={e => set({ stock: e.target.value })}
                placeholder="0"
                className={inputCls(errors.stock)}
              />
            </FormField>
          </div>

          {/* Description */}
          <FormField label="Descripción" hint="El bot puede recomendar este producto si está activo para IA.">
            <textarea
              value={form.description}
              onChange={e => set({ description: e.target.value })}
              placeholder="Describe el producto brevemente…"
              rows={2}
              className={`${inputCls()} resize-none`}
            />
          </FormField>

          {/* AI toggle */}
          <button
            type="button"
            onClick={() => set({ aiAvailable: !form.aiAvailable })}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition
              ${form.aiAvailable ? 'border-violet-300 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400' : 'border-slate-200 dark:border-neutral-700 text-slate-500'}`}
          >
            <Bot className="w-3.5 h-3.5" />
            {form.aiAvailable ? 'IA puede recomendar ✓' : 'IA desactivada'}
          </button>

          {/* Price Tiers */}
          <div className="border-t border-slate-200 dark:border-neutral-700 pt-4">
            <PriceTiersEditor tiers={form.priceTiers} onChange={tiers => set({ priceTiers: tiers })} />
          </div>
        </form>

        <div className="px-5 py-4 border-t border-slate-200/60 dark:border-neutral-700/60 shrink-0">
          <button
            form="product-form"
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-2xl bg-[var(--primary)] text-white font-bold text-sm shadow-md hover:opacity-90 active:scale-[0.98] transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
            ) : (
              <>{isEdit ? 'Guardar cambios' : 'Agregar al inventario'}</>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Category Overview Panel ──────────────────────────────────────────────────

const CategoryOverview: React.FC<{
  services: SalonService[];
  products: SalonProduct[];
}> = ({ services, products }) => {
  const totalServices = services.length;
  const totalProducts = products.length;

  return (
    <div className="mb-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500 mb-2 px-1">
        Categorías
      </p>
      <div className="grid grid-cols-2 gap-2">
        {/* Services by category */}
        <div className="rounded-2xl bg-white/70 dark:bg-neutral-800/60 border border-slate-200/60 dark:border-neutral-700/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Servicios</p>
          {SERVICE_CATEGORIES.map(cat => {
            const count = services.filter(s => s.category === cat.key).length;
            return (
              <div key={cat.key} className="flex items-center justify-between text-xs mb-1 last:mb-0">
                <span className="flex items-center gap-1 text-slate-600 dark:text-neutral-300">
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </span>
                <span className="font-bold text-slate-700 dark:text-neutral-200">{count}</span>
              </div>
            );
          })}
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-neutral-700 flex justify-between text-xs font-bold text-slate-700 dark:text-neutral-200">
            <span>Total</span><span>{totalServices}</span>
          </div>
        </div>

        {/* Products by category */}
        <div className="rounded-2xl bg-white/70 dark:bg-neutral-800/60 border border-slate-200/60 dark:border-neutral-700/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Productos</p>
          {PRODUCT_CATEGORIES.map(cat => {
            const count = products.filter(p => p.category === cat.key).length;
            return (
              <div key={cat.key} className="flex items-center justify-between text-xs mb-1 last:mb-0">
                <span className="flex items-center gap-1 text-slate-600 dark:text-neutral-300">
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </span>
                <span className="font-bold text-slate-700 dark:text-neutral-200">{count}</span>
              </div>
            );
          })}
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-neutral-700 flex justify-between text-xs font-bold text-slate-700 dark:text-neutral-200">
            <span>Total</span><span>{totalProducts}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Service Card ─────────────────────────────────────────────────────────────

const ServiceCard: React.FC<{
  service: SalonService;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAi: () => void;
}> = ({ service, onEdit, onDelete, onToggleAi }) => {
  const hasTiers = service.priceTiers && service.priceTiers.length > 0;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-2xl bg-white/70 dark:bg-neutral-800/60 border border-slate-200/60 dark:border-neutral-700/60 group"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
        style={{ backgroundColor: service.color + '30' }}
      >
        {service.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{service.name}</p>
          {service.popular && <Star className="w-3 h-3 text-amber-400 shrink-0" />}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-500 dark:text-neutral-400">
            ${service.price.toFixed(2)} · {service.durationMinutes}min
          </span>
          {hasTiers && (
            <span className="text-[10px] bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded-full font-medium">
              {service.priceTiers.length} niveles
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onToggleAi}
          title={service.aiAvailable ? 'IA activa — click para desactivar' : 'IA inactiva — click para activar'}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition
            ${service.aiAvailable ? 'text-violet-500 bg-violet-50 dark:bg-violet-900/30' : 'text-slate-400 bg-slate-100 dark:bg-neutral-700'}`}
        >
          {service.aiAvailable ? <Bot className="w-3.5 h-3.5" /> : <BotOff className="w-3.5 h-3.5" />}
        </button>
        <button onClick={onEdit} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-neutral-700 transition">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-400 hover:text-rose-600 bg-rose-50 dark:bg-rose-900/20 transition">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
};

// ─── Product Card ─────────────────────────────────────────────────────────────

const ProductCard: React.FC<{
  product: SalonProduct;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAi: () => void;
}> = ({ product, onEdit, onDelete, onToggleAi }) => {
  const hasTiers = product.priceTiers && product.priceTiers.length > 0;
  const lowStock = product.stock <= 3;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-2xl bg-white/70 dark:bg-neutral-800/60 border border-slate-200/60 dark:border-neutral-700/60 group"
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 bg-slate-100 dark:bg-neutral-700">
        {product.image || '📦'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{product.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-500 dark:text-neutral-400">
            ${product.basePrice.toFixed(2)}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
            ${lowStock
              ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
              : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
            }`}>
            {product.stock} en stock
          </span>
          {hasTiers && (
            <span className="text-[10px] bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded-full font-medium">
              {product.priceTiers.length} niveles
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onToggleAi}
          title={product.aiAvailable ? 'IA activa' : 'IA inactiva'}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition
            ${product.aiAvailable ? 'text-violet-500 bg-violet-50 dark:bg-violet-900/30' : 'text-slate-400 bg-slate-100 dark:bg-neutral-700'}`}
        >
          {product.aiAvailable ? <Bot className="w-3.5 h-3.5" /> : <BotOff className="w-3.5 h-3.5" />}
        </button>
        <button onClick={onEdit} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-neutral-700 transition">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-400 hover:text-rose-600 bg-rose-50 dark:bg-rose-900/20 transition">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

type CatalogTab = 'services' | 'products';

export const CatalogScreen: React.FC = () => {
  const {
    services, addService, updateService, deleteService, toggleServiceAi,
    products, addProduct, updateProduct, deleteProduct, toggleProductAi,
    showToast,
  } = useApp();

  const [tab, setTab] = useState<CatalogTab>('services');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showCategoryOverview, setShowCategoryOverview] = useState(false);

  // Modal state
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<SalonService | undefined>();
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SalonProduct | undefined>();

  // Filtered lists
  const filteredServices = useMemo(() => {
    let list = services;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.categoryName.toLowerCase().includes(q));
    }
    if (filterCategory !== 'all') list = list.filter(s => s.category === filterCategory);
    return list;
  }, [services, search, filterCategory]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.categoryName.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    if (filterCategory !== 'all') list = list.filter(p => p.category === filterCategory);
    return list;
  }, [products, search, filterCategory]);

  // Handlers
  const handleSaveService = async (data: ServiceFormData) => {
    const payload: Omit<SalonService, 'id'> = {
      name: data.name,
      category: data.category,
      categoryName: data.categoryName,
      price: Number(data.price),
      durationMinutes: Number(data.durationMinutes),
      icon: data.icon,
      color: data.color,
      popular: data.popular,
      description: data.description,
      aiAvailable: data.aiAvailable,
      priceTiers: data.priceTiers,
    };
    if (editingService) {
      await updateService(editingService.id, payload);
      showToast('Servicio actualizado', `"${data.name}" fue editado correctamente.`, 'success');
    } else {
      await addService(payload);
      showToast('Servicio creado', `"${data.name}" ya está en tu catálogo.`, 'success');
    }
  };

  const handleSaveProduct = async (data: ProductFormData) => {
    const payload: Omit<SalonProduct, 'id'> = {
      name: data.name,
      category: data.category,
      categoryName: data.categoryName,
      sku: data.sku,
      basePrice: Number(data.basePrice),
      stock: Number(data.stock),
      image: data.image,
      description: data.description,
      aiAvailable: data.aiAvailable,
      priceTiers: data.priceTiers,
    };
    if (editingProduct) {
      await updateProduct(editingProduct.id, payload);
      showToast('Producto actualizado', `"${data.name}" fue editado correctamente.`, 'success');
    } else {
      await addProduct(payload);
      showToast('Producto agregado', `"${data.name}" ya está en el inventario.`, 'success');
    }
  };

  const handleDeleteService = async (service: SalonService) => {
    if (!confirm(`¿Eliminar "${service.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteService(service.id);
      showToast('Servicio eliminado', `"${service.name}" fue removido del catálogo.`, 'info');
    } catch {
      showToast('Error', 'No se pudo eliminar el servicio.', 'warning');
    }
  };

  const handleDeleteProduct = async (product: SalonProduct) => {
    if (!confirm(`¿Eliminar "${product.name}"?`)) return;
    try {
      await deleteProduct(product.id);
      showToast('Producto eliminado', `"${product.name}" fue removido del inventario.`, 'info');
    } catch {
      showToast('Error', 'No se pudo eliminar el producto.', 'warning');
    }
  };

  const categories = tab === 'services' ? SERVICE_CATEGORIES : PRODUCT_CATEGORIES;

  return (
    <div className="flex flex-col h-full">
      <IOSHeader
        title="Catálogo"
        subtitle={`${services.length} servicios · ${products.length} productos`}
      />

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Tabs */}
        <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-neutral-800 rounded-2xl mb-4">
          {(['services', 'products'] as CatalogTab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setFilterCategory('all'); setSearch(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition
                ${tab === t
                  ? 'bg-white dark:bg-neutral-700 text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-300'
                }`}
            >
              {t === 'services' ? <Scissors className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
              {t === 'services' ? 'Servicios' : 'Productos'}
            </button>
          ))}
        </div>

        {/* Category Overview toggle */}
        <button
          onClick={() => setShowCategoryOverview(o => !o)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/60 dark:bg-neutral-800/50 border border-slate-200/60 dark:border-neutral-700/60 text-xs font-semibold text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 transition mb-3"
        >
          <span className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Resumen de categorías</span>
          <ChevronDown className={`w-3.5 h-3.5 transition ${showCategoryOverview ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {showCategoryOverview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <CategoryOverview services={services} products={products} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'services' ? 'Buscar servicios…' : 'Buscar productos, SKU…'}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 text-slate-800 dark:text-neutral-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition"
          />
        </div>

        {/* Category filter chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 scrollbar-none">
          <button
            onClick={() => setFilterCategory('all')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition
              ${filterCategory === 'all' ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700 text-slate-500 dark:text-neutral-400 bg-white dark:bg-neutral-800'}`}
          >
            Todas
          </button>
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => setFilterCategory(cat.key)}
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition
                ${filterCategory === cat.key ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700 text-slate-500 dark:text-neutral-400 bg-white dark:bg-neutral-800'}`}
            >
              <span>{cat.icon}</span> {cat.label}
            </button>
          ))}
        </div>

        {/* Services List */}
        {tab === 'services' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-400 font-medium">{filteredServices.length} servicio(s)</p>
              <button
                onClick={() => { setEditingService(undefined); setShowServiceModal(true); }}
                className="flex items-center gap-1 text-xs font-bold text-[var(--primary)] hover:opacity-80 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Nuevo servicio
              </button>
            </div>
            <AnimatePresence mode="popLayout">
              {filteredServices.length === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 text-center">
                  <Scissors className="w-10 h-10 text-slate-300 dark:text-neutral-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No se encontraron servicios</p>
                </motion.div>
              ) : (
                filteredServices.map(service => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    onEdit={() => { setEditingService(service); setShowServiceModal(true); }}
                    onDelete={() => handleDeleteService(service)}
                    onToggleAi={() => toggleServiceAi(service.id, !service.aiAvailable)}
                  />
                ))
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Products List */}
        {tab === 'products' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-400 font-medium">{filteredProducts.length} producto(s)</p>
              <button
                onClick={() => { setEditingProduct(undefined); setShowProductModal(true); }}
                className="flex items-center gap-1 text-xs font-bold text-[var(--primary)] hover:opacity-80 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Nuevo producto
              </button>
            </div>
            <AnimatePresence mode="popLayout">
              {filteredProducts.length === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 text-center">
                  <Package className="w-10 h-10 text-slate-300 dark:text-neutral-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No se encontraron productos</p>
                </motion.div>
              ) : (
                filteredProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onEdit={() => { setEditingProduct(product); setShowProductModal(true); }}
                    onDelete={() => handleDeleteProduct(product)}
                    onToggleAi={() => toggleProductAi(product.id, !product.aiAvailable)}
                  />
                ))
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => {
          if (tab === 'services') { setEditingService(undefined); setShowServiceModal(true); }
          else { setEditingProduct(undefined); setShowProductModal(true); }
        }}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 w-14 h-14 rounded-full bg-[var(--primary)] text-white shadow-xl flex items-center justify-center hover:opacity-90 active:scale-95 transition z-20"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Modals */}
      <AnimatePresence>
        {showServiceModal && (
          <ServiceModal
            service={editingService}
            onClose={() => { setShowServiceModal(false); setEditingService(undefined); }}
            onSave={handleSaveService}
          />
        )}
        {showProductModal && (
          <ProductModal
            product={editingProduct}
            onClose={() => { setShowProductModal(false); setEditingProduct(undefined); }}
            onSave={handleSaveProduct}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
