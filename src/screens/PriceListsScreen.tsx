/**
 * PriceListsScreen — gestión de listas de precios estilo Odoo.
 *
 * Secciones:
 *  - Lista de price lists con badge default / conteo de clientes
 *  - Modal de creación/edición con editor de reglas inline
 *  - Panel de asignación rápida a clientes
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useApp, PriceList, PriceListRule, PriceRuleTarget } from '../context/AppContext';

// ─── Utility ─────────────────────────────────────────────────────────────────

function formatModifier(rule: PriceListRule): string {
  if (rule.fixedPrice !== undefined) return `Precio fijo: $${rule.fixedPrice.toFixed(2)}`;
  if (rule.discountPercent !== undefined) return `${rule.discountPercent}% descuento`;
  if (rule.priceMultiplier !== undefined) {
    const pct = Math.round((1 - rule.priceMultiplier) * 100);
    return pct > 0 ? `${pct}% descuento (×${rule.priceMultiplier})` : `Recargo ×${rule.priceMultiplier}`;
  }
  return '—';
}

function targetLabel(target: PriceRuleTarget): string {
  switch (target) {
    case 'service_category': return 'Categoría de servicio';
    case 'product_category': return 'Categoría de producto';
    case 'specific_service': return 'Servicio específico';
    case 'specific_product': return 'Producto específico';
  }
}

function targetKey(rule: PriceListRule): string {
  return rule.serviceCategoryKey ?? rule.productCategoryKey ?? rule.serviceId ?? rule.productId ?? '—';
}

const RULE_TARGET_OPTIONS: { value: PriceRuleTarget; label: string }[] = [
  { value: 'service_category', label: 'Categoría de servicio' },
  { value: 'product_category', label: 'Categoría de producto' },
  { value: 'specific_service', label: 'Servicio específico' },
  { value: 'specific_product', label: 'Producto específico' },
];

// ─── Empty rule factory ───────────────────────────────────────────────────────
function emptyRule(): Omit<PriceListRule, 'id'> {
  return { target: 'service_category', discountPercent: 10 };
}

// ─── Rule editor row ─────────────────────────────────────────────────────────
interface RuleRowProps {
  rule: Omit<PriceListRule, 'id'>;
  index: number;
  services: { id: string; name: string; category: string }[];
  products: { id: string; name: string; category: string }[];
  onChange: (index: number, patch: Partial<Omit<PriceListRule, 'id'>>) => void;
  onRemove: (index: number) => void;
}

function RuleRow({ rule, index, services, products, onChange, onRemove }: RuleRowProps) {
  const set = (patch: Partial<Omit<PriceListRule, 'id'>>) => onChange(index, patch);

  const clearKeys = () => set({
    serviceCategoryKey: undefined,
    productCategoryKey: undefined,
    serviceId: undefined,
    productId: undefined,
  });

  // Collect unique category keys from services/products
  const serviceCategories = [...new Set(services.map(s => s.category))];
  const productCategories = [...new Set(products.map(p => p.category))];

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Target type */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Aplica a</span>
        <select
          value={rule.target}
          onChange={e => { clearKeys(); set({ target: e.target.value as PriceRuleTarget }); }}
          style={selectStyle}
        >
          {RULE_TARGET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Context key */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {rule.target === 'service_category' || rule.target === 'product_category' ? 'Categoría' : 'Elemento'}
        </span>
        {rule.target === 'service_category' && (
          <select value={rule.serviceCategoryKey ?? ''} onChange={e => set({ serviceCategoryKey: e.target.value })} style={selectStyle}>
            <option value="">— seleccionar —</option>
            {serviceCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {rule.target === 'product_category' && (
          <select value={rule.productCategoryKey ?? ''} onChange={e => set({ productCategoryKey: e.target.value })} style={selectStyle}>
            <option value="">— seleccionar —</option>
            {productCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {rule.target === 'specific_service' && (
          <select value={rule.serviceId ?? ''} onChange={e => set({ serviceId: e.target.value })} style={selectStyle}>
            <option value="">— seleccionar —</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {rule.target === 'specific_product' && (
          <select value={rule.productId ?? ''} onChange={e => set({ productId: e.target.value })} style={selectStyle}>
            <option value="">— seleccionar —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {/* Modifier type */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Tipo de ajuste</span>
        <select
          value={rule.fixedPrice !== undefined ? 'fixed' : rule.priceMultiplier !== undefined ? 'multiplier' : 'discount'}
          onChange={e => {
            const v = e.target.value;
            if (v === 'fixed') set({ fixedPrice: 0, discountPercent: undefined, priceMultiplier: undefined });
            else if (v === 'multiplier') set({ priceMultiplier: 0.9, discountPercent: undefined, fixedPrice: undefined });
            else set({ discountPercent: 10, fixedPrice: undefined, priceMultiplier: undefined });
          }}
          style={selectStyle}
        >
          <option value="discount">% Descuento</option>
          <option value="fixed">Precio fijo</option>
          <option value="multiplier">Multiplicador</option>
        </select>
      </div>

      {/* Modifier value */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {rule.fixedPrice !== undefined ? 'Precio ($)' : rule.priceMultiplier !== undefined ? 'Multiplicador' : 'Descuento (%)'}
        </span>
        {rule.discountPercent !== undefined && (
          <input type="number" min={0} max={100} step={0.5}
            value={rule.discountPercent}
            onChange={e => set({ discountPercent: parseFloat(e.target.value) || 0 })}
            style={inputStyle}
          />
        )}
        {rule.fixedPrice !== undefined && (
          <input type="number" min={0} step={0.01}
            value={rule.fixedPrice}
            onChange={e => set({ fixedPrice: parseFloat(e.target.value) || 0 })}
            style={inputStyle}
          />
        )}
        {rule.priceMultiplier !== undefined && (
          <input type="number" min={0} max={10} step={0.01}
            value={rule.priceMultiplier}
            onChange={e => set({ priceMultiplier: parseFloat(e.target.value) || 0 })}
            style={inputStyle}
          />
        )}
      </div>

      <button onClick={() => onRemove(index)} title="Eliminar regla"
        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 14, alignSelf: 'flex-end' }}>
        ×
      </button>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
  color: '#e5e7eb', padding: '7px 10px', fontSize: 13, outline: 'none', width: '100%',
};
const inputStyle: React.CSSProperties = {
  background: '#1f2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
  color: '#e5e7eb', padding: '7px 10px', fontSize: 13, outline: 'none', width: '100%',
};

// ─── Price List Form (modal) ──────────────────────────────────────────────────
interface PriceListFormState {
  name: string;
  description: string;
  isDefault: boolean;
  startDate: string;
  endDate: string;
  rules: Omit<PriceListRule, 'id'>[];
}

function initialForm(pl?: PriceList): PriceListFormState {
  if (!pl) return { name: '', description: '', isDefault: false, startDate: '', endDate: '', rules: [] };
  return {
    name: pl.name,
    description: pl.description ?? '',
    isDefault: pl.isDefault,
    startDate: pl.startDate ?? '',
    endDate: pl.endDate ?? '',
    rules: pl.rules.map(({ id: _id, ...r }) => r),
  };
}

interface PriceListModalProps {
  existing?: PriceList;
  onClose: () => void;
  onSave: (dto: Omit<PriceList, 'id' | 'clientCount'>) => Promise<void>;
  services: { id: string; name: string; category: string }[];
  products: { id: string; name: string; category: string }[];
}

function PriceListModal({ existing, onClose, onSave, services, products }: PriceListModalProps) {
  const [form, setForm] = useState<PriceListFormState>(initialForm(existing));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (patch: Partial<PriceListFormState>) => setForm(f => ({ ...f, ...patch }));

  const changeRule = (i: number, patch: Partial<Omit<PriceListRule, 'id'>>) => {
    setForm(f => {
      const rules = [...f.rules];
      rules[i] = { ...rules[i], ...patch };
      return { ...f, rules };
    });
  };
  const removeRule = (i: number) => setForm(f => ({ ...f, rules: f.rules.filter((_, idx) => idx !== i) }));
  const addRule = () => setForm(f => ({ ...f, rules: [...f.rules, emptyRule()] }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('El nombre es obligatorio.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        isDefault: form.isDefault,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        rules: form.rules as PriceListRule[],
      });
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, width: '100%', maxWidth: 700, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
              {existing ? 'Editar lista de precios' : 'Nueva lista de precios'}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Define el nombre, vigencia y reglas de ajuste.</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} style={{ overflowY: 'auto', flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Nombre de la lista *</label>
            <input value={form.name} onChange={e => set({ name: e.target.value })}
              placeholder="Ej: Lista VIP Clientas Frecuentes"
              style={{ ...inputStyle, fontSize: 15 }} required />
          </div>

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Descripción (opcional)</label>
            <input value={form.description} onChange={e => set({ description: e.target.value })}
              placeholder="Breve descripción de cuándo aplica" style={inputStyle} />
          </div>

          {/* Default + Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Lista por defecto</label>
              <button type="button"
                onClick={() => set({ isDefault: !form.isDefault })}
                style={{
                  background: form.isDefault ? 'rgba(124,106,247,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${form.isDefault ? 'rgba(124,106,247,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
                  color: form.isDefault ? '#7c6af7' : '#9ca3af', fontSize: 13, fontWeight: 600, textAlign: 'left',
                }}>
                {form.isDefault ? '✓ Sí, por defecto' : 'No (asignación manual)'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Válida desde</label>
              <input type="date" value={form.startDate} onChange={e => set({ startDate: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Válida hasta</label>
              <input type="date" value={form.endDate} onChange={e => set({ endDate: e.target.value })} style={inputStyle} />
            </div>
          </div>

          {/* Rules */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={labelStyle}>Reglas de precio ({form.rules.length})</label>
              <button type="button" onClick={addRule}
                style={{ background: 'rgba(124,106,247,0.1)', border: '1px solid rgba(124,106,247,0.25)', borderRadius: 6, padding: '5px 12px', color: '#a78bfa', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                + Agregar regla
              </button>
            </div>
            {form.rules.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#4b5563', fontSize: 13, border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 8 }}>
                Sin reglas — agrega una para definir ajustes de precio
              </div>
            )}
            {form.rules.map((rule, i) => (
              <RuleRow key={i} rule={rule} index={i} services={services} products={products}
                onChange={changeRule} onRemove={removeRule} />
            ))}
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button type="button" onClick={onClose}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 18px', color: '#9ca3af', fontSize: 13, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              style={{ background: saving ? '#374151' : '#7c6af7', border: 'none', borderRadius: 8, padding: '9px 22px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              {saving && <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />}
              {saving ? 'Guardando…' : existing ? 'Guardar cambios' : 'Crear lista'}
            </button>
          </div>
        </form>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6b7280',
};

// ─── Assign panel ─────────────────────────────────────────────────────────────
interface AssignPanelProps {
  priceList: PriceList;
  onClose: () => void;
}

function AssignPanel({ priceList, onClose }: AssignPanelProps) {
  const { clients, assignPriceList, unassignPriceList, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const isAssigned = (clientId: string) =>
    (clients.find(c => c.id === clientId) as any)?.priceListId === priceList.id;

  const toggle = async (clientId: string) => {
    setBusy(clientId);
    try {
      if (isAssigned(clientId)) {
        await unassignPriceList(clientId);
        showToast('Lista removida', 'Se removió la lista de precios del cliente', 'info');
      } else {
        await assignPriceList(priceList.id, clientId);
        showToast('Lista asignada', 'Lista de precios asignada correctamente', 'success');
      }
    } catch (err: any) {
      showToast('Error', err?.message ?? 'No se pudo actualizar', 'warning');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Asignar lista a clientes</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{priceList.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <input
            autoFocus
            placeholder="Buscar clienta…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.map(client => {
            const assigned = isAssigned(client.id);
            return (
              <button
                key={client.id}
                onClick={() => toggle(client.id)}
                disabled={busy === client.id}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 20px', background: 'none', border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer',
                  textAlign: 'left', transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <img src={client.avatar} alt={client.name} style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>{client.name}</div>
                  <div style={{ fontSize: 11.5, color: '#6b7280' }}>{client.phone}</div>
                </div>
                {busy === client.id
                  ? <span style={{ fontSize: 12, color: '#9ca3af' }}>…</span>
                  : assigned
                    ? <span style={{ fontSize: 12, fontWeight: 700, color: '#7c6af7' }}>✓ Asignada</span>
                    : <span style={{ fontSize: 12, color: '#4b5563' }}>Asignar</span>
                }
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: '#4b5563', fontSize: 13 }}>
              No se encontraron clientas
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Price List Card ──────────────────────────────────────────────────────────
interface PriceListCardProps {
  pl: PriceList;
  onEdit: () => void;
  onDelete: () => void;
  onAssign: () => void;
}

function PriceListCard({ pl, onEdit, onDelete, onAssign }: PriceListCardProps) {
  return (
    <div style={{
      background: '#1f2937', border: `1px solid ${pl.isDefault ? 'rgba(124,106,247,0.35)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 14,
      transition: 'border-color 0.15s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#f9fafb' }}>{pl.name}</span>
            {pl.isDefault && (
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', background: 'rgba(124,106,247,0.15)', color: '#a78bfa', border: '1px solid rgba(124,106,247,0.25)', borderRadius: 99, padding: '2px 8px' }}>
                Por defecto
              </span>
            )}
          </div>
          {pl.description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>{pl.description}</div>}
          {(pl.startDate || pl.endDate) && (
            <div style={{ fontSize: 11.5, color: '#4b5563', marginTop: 4 }}>
              {pl.startDate && `Desde ${pl.startDate}`}
              {pl.startDate && pl.endDate && ' · '}
              {pl.endDate && `Hasta ${pl.endDate}`}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={onAssign} title="Asignar a clientes"
            style={{ background: 'rgba(62,207,142,0.08)', border: '1px solid rgba(62,207,142,0.2)', borderRadius: 6, padding: '5px 10px', color: '#3ecf8e', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            👥 {pl.clientCount ?? 0}
          </button>
          <button onClick={onEdit}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '5px 10px', color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}>
            Editar
          </button>
          <button onClick={onDelete} disabled={pl.isDefault}
            title={pl.isDefault ? 'No se puede eliminar la lista por defecto' : 'Eliminar'}
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 6, padding: '5px 10px', color: pl.isDefault ? '#374151' : '#ef4444', fontSize: 12, cursor: pl.isDefault ? 'not-allowed' : 'pointer' }}>
            Eliminar
          </button>
        </div>
      </div>

      {/* Rules summary */}
      {pl.rules.length === 0 ? (
        <div style={{ fontSize: 12, color: '#374151', fontStyle: 'italic' }}>Sin reglas definidas</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {pl.rules.map((rule, i) => (
            <div key={rule.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ color: '#4b5563', minWidth: 160 }}>{targetLabel(rule.target)}: <span style={{ color: '#6b7280' }}>{targetKey(rule)}</span></span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>→ {formatModifier(rule)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export function PriceListsScreen() {
  const {
    priceLists, isLoadingPriceLists, loadPriceLists,
    createPriceList, updatePriceList, deletePriceList,
    services, products, showToast,
  } = useApp();

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<PriceList | undefined>();
  const [assignTarget, setAssignTarget] = useState<PriceList | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<PriceList | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { loadPriceLists(); }, [loadPriceLists]);

  const handleSave = useCallback(async (dto: Omit<PriceList, 'id' | 'clientCount'>) => {
    if (editTarget) {
      await updatePriceList(editTarget.id, dto);
      showToast('Lista actualizada', dto.name, 'success');
    } else {
      await createPriceList(dto);
      showToast('Lista creada', dto.name, 'success');
    }
  }, [editTarget, createPriceList, updatePriceList, showToast]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deletePriceList(confirmDelete.id);
      showToast('Lista eliminada', confirmDelete.name, 'info');
      setConfirmDelete(null);
    } catch (err: any) {
      showToast('Error', err?.message ?? 'No se pudo eliminar', 'warning');
    } finally {
      setDeleting(false);
    }
  };

  // Slim service/product shape for rule selectors
  const svcOptions = services.map(s => ({ id: s.id, name: s.name, category: s.category }));
  const prdOptions = products.map(p => ({ id: p.id, name: p.name, category: p.category }));

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: '0 auto', fontFamily: 'inherit' }}>

      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f9fafb', margin: 0 }}>Listas de precios</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 5 }}>
            Define descuentos, precios fijos o multiplicadores por categoría o elemento. Asigna listas a clientas VIP.
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(undefined); setShowModal(true); }}
          style={{ background: '#7c6af7', border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          + Nueva lista
        </button>
      </div>

      {/* Info banner */}
      <div style={{ background: 'rgba(124,106,247,0.06)', border: '1px solid rgba(124,106,247,0.15)', borderRadius: 10, padding: '12px 16px', fontSize: 12.5, color: '#a78bfa', marginBottom: 24, lineHeight: 1.6 }}>
        💡 <strong>Cómo funciona:</strong> La lista <em>por defecto</em> aplica a todos los clientes sin asignación específica.
        Las listas asignadas directamente a una clienta tienen prioridad. En el chat IA se muestra el precio de la lista por defecto.
      </div>

      {/* Loading */}
      {isLoadingPriceLists && (
        <div style={{ textAlign: 'center', padding: 48, color: '#6b7280', fontSize: 14 }}>
          <div style={{ width: 24, height: 24, border: '2px solid rgba(124,106,247,0.2)', borderTopColor: '#7c6af7', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
          Cargando listas…
        </div>
      )}

      {/* Empty state */}
      {!isLoadingPriceLists && priceLists.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 24px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 12 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏷️</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#9ca3af', marginBottom: 6 }}>Sin listas de precios</div>
          <div style={{ fontSize: 13, color: '#4b5563', marginBottom: 20 }}>
            Crea tu primera lista para aplicar descuentos automáticos a servicios y productos.
          </div>
          <button
            onClick={() => { setEditTarget(undefined); setShowModal(true); }}
            style={{ background: '#7c6af7', border: 'none', borderRadius: 8, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Crear primera lista
          </button>
        </div>
      )}

      {/* Lists */}
      {!isLoadingPriceLists && priceLists.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {priceLists.map(pl => (
            <PriceListCard
              key={pl.id}
              pl={pl}
              onEdit={() => { setEditTarget(pl); setShowModal(true); }}
              onDelete={() => setConfirmDelete(pl)}
              onAssign={() => setAssignTarget(pl)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <PriceListModal
          existing={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(undefined); }}
          onSave={handleSave}
          services={svcOptions}
          products={prdOptions}
        />
      )}

      {/* Assign Panel */}
      {assignTarget && (
        <AssignPanel
          priceList={assignTarget}
          onClose={() => setAssignTarget(undefined)}
        />
      )}

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
          <div style={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 28, maxWidth: 380, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f9fafb', marginBottom: 10 }}>¿Eliminar lista?</div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 24, lineHeight: 1.6 }}>
              Se eliminará <strong style={{ color: '#e5e7eb' }}>{confirmDelete.name}</strong> y sus {confirmDelete.rules.length} reglas.
              Las clientas asignadas volverán a la lista por defecto.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)}
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 16px', color: '#9ca3af', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ background: '#ef4444', border: 'none', borderRadius: 8, padding: '8px 18px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: deleting ? 'default' : 'pointer' }}>
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
