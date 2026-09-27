import React, { useMemo, useState } from 'react';
import { ChefHat, Plus, Trash2 } from 'lucide-react';
import { LineaDeReceta, SalonProduct } from '../../types';
import { useDinero } from '../../hooks/useDinero';

const UNIDADES = [
  { id: 'g', label: 'g' },
  { id: 'ml', label: 'ml' },
  { id: 'oz', label: 'oz' },
  { id: 'unit', label: 'piezas' },
];
const UNIDAD_POR_PIEZA = 'unit';
/** Margen (sobre el precio) desde el que un preparado se considera sano */
const MARGEN_BUENO = 0.6;
const MARGEN_JUSTO = 0.35;

/** Igual que el backend (products/preparados.ts): la receta pide 60 g y el paquete trae 500 g → 0,12 paquetes */
function aUnidadDeStock(cantidad: number, unidad: string, insumo: SalonProduct) {
  if (unidad !== insumo.unit && insumo.unit === UNIDAD_POR_PIEZA && (insumo.unitQty ?? 0) > 0) return cantidad / insumo.unitQty!;
  return cantidad;
}

/**
 * La receta de un preparado: qué insumos lleva UNA porción. Con eso, al
 * servirlo se descuentan los insumos y se sabe lo que costó hacerlo.
 */
export const RecetaDelPreparado: React.FC<{
  productoId: string | null;
  receta: LineaDeReceta[];
  onChange: (r: LineaDeReceta[]) => void;
  precio: number;
  /** Moneda del precio del preparado */
  moneda?: string;
  productos: SalonProduct[];
}> = ({ productoId, receta, onChange, precio, moneda, productos }) => {
  const { dinero, enBase } = useDinero();
  // Lo que puede ir en una receta: todo lo que no es otro preparado (primero los insumos)
  const candidatos = useMemo(
    () => productos
      .filter(p => !p.preparedToOrder && p.id !== productoId)
      .sort((a, b) => Number(!!b.supplyOnly) - Number(!!a.supplyOnly) || a.name.localeCompare(b.name)),
    [productos, productoId],
  );
  const [nuevo, setNuevo] = useState('');

  const costo = receta.reduce((s, l) => {
    const insumo = productos.find(p => p.id === l.ingredientId);
    if (insumo?.costPrice == null) return s;
    // Todo en la moneda del salón: el insumo pudo comprarse en otra
    const linea = aUnidadDeStock(l.quantity, l.unit, insumo) * insumo.costPrice;
    return s + (enBase(linea, insumo.currencyCode) ?? linea);
  }, 0);
  const precioEnBase = enBase(precio, moneda) ?? precio;
  const faltanCostos = receta.some(l => productos.find(p => p.id === l.ingredientId)?.costPrice == null);
  const margen = precioEnBase > 0 ? (precioEnBase - costo) / precioEnBase : null;

  const cambiar = (i: number, cambio: Partial<LineaDeReceta>) => onChange(receta.map((l, j) => (j === i ? { ...l, ...cambio } : l)));
  const agregar = () => {
    const insumo = candidatos.find(p => p.id === nuevo);
    if (!insumo || receta.some(l => l.ingredientId === insumo.id)) return;
    // Por defecto en la unidad de su contenido (paquete de 500 g → gramos)
    const unidad = insumo.unit === UNIDAD_POR_PIEZA && insumo.unitQty ? (insumo.unitQtyUnit ?? 'g') : insumo.unit;
    onChange([...receta, { ingredientId: insumo.id, nombre: insumo.name, quantity: 1, unit: unidad }]);
    setNuevo('');
  };

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-[10px] text-slate-600 dark:text-neutral-300 leading-relaxed">
        <b className="text-amber-700 dark:text-amber-400">Una porción lleva…</b> Al servirlo salen estos insumos del inventario.
        Cada 1 o 2 semanas cuenta los insumos de verdad y ajusta: la diferencia es la merma.
      </div>

      {receta.length === 0 && (
        <p className="text-[11px] text-slate-400 text-center py-2">Sin ingredientes todavía.</p>
      )}
      {receta.map((l, i) => {
        const insumo = productos.find(p => p.id === l.ingredientId);
        return (
          <div key={l.ingredientId} className="flex items-center gap-2">
            <span className="flex-1 min-w-0 truncate text-[12px] font-semibold text-slate-800 dark:text-slate-200">
              {insumo?.name ?? l.nombre ?? 'Insumo'}
              {insumo?.unit === UNIDAD_POR_PIEZA && insumo.unitQty ? (
                <span className="block text-[9px] font-normal text-slate-400">se compra en unidades de {insumo.unitQty} {insumo.unitQtyUnit ?? ''}</span>
              ) : null}
            </span>
            <input type="number" min="0" step="0.001" value={l.quantity} aria-label="Cantidad por porción"
              onChange={e => cambiar(i, { quantity: Number(e.target.value) })}
              className="w-20 px-2 py-2 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-right font-bold text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            <select value={l.unit} onChange={e => cambiar(i, { unit: e.target.value })} aria-label="Unidad"
              className="px-2 py-2 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[11px] font-semibold">
              {UNIDADES.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
            <button type="button" onClick={() => onChange(receta.filter((_, j) => j !== i))} aria-label="Quitar"
              className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}

      <div className="flex gap-2">
        <select value={nuevo} onChange={e => setNuevo(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[12px]">
          <option value="">Elegir insumo…</option>
          {candidatos.filter(p => !receta.some(l => l.ingredientId === p.id)).map(p => (
            <option key={p.id} value={p.id}>{p.name}{p.supplyOnly ? '' : ' (también se vende)'}</option>
          ))}
        </select>
        <button type="button" disabled={!nuevo} onClick={agregar}
          className="px-3 py-2.5 rounded-xl bg-[var(--primary)] text-white text-[11px] font-bold disabled:opacity-40 flex items-center gap-1 cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> Agregar
        </button>
      </div>
      {candidatos.length === 0 && (
        <p className="text-[10px] text-slate-400">Primero crea los insumos (por ejemplo "Salchichón de lomo") como productos de tipo <b>Insumo</b>.</p>
      )}

      {receta.length > 0 && (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 text-[11px]">
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-neutral-300">
            <ChefHat className="w-3.5 h-3.5" /> Cuesta hacerlo: <b className="tabular-nums">{dinero(costo)}</b>
          </span>
          {margen !== null && (
            <span className={`font-bold ${margen >= MARGEN_BUENO ? 'text-emerald-600' : margen >= MARGEN_JUSTO ? 'text-amber-600' : 'text-rose-600'}`}>
              Ganancia {Math.round(margen * 100)}%
            </span>
          )}
        </div>
      )}
      {faltanCostos && (
        <p className="text-[10px] text-amber-600">A algún insumo le falta el costo de compra: el costo real es mayor. Ponlo en ese producto.</p>
      )}
    </div>
  );
};
