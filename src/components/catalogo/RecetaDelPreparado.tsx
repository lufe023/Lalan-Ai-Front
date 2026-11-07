import React, { useMemo, useState } from 'react';
import { ChefHat, Plus, Trash2 } from 'lucide-react';
import { LineaDeReceta, SalonProduct } from '../../types';
import { useDinero } from '../../hooks/useDinero';
import { UNIDAD_POR_PIEZA, aUnidadDeStock } from '../../utils/unidades';
import { COLOR_DE_NIVEL, nivelDeGanancia } from '../../utils/ganancia';

const UNIDADES = [
  { id: 'g', label: 'g' },
  { id: 'ml', label: 'ml' },
  { id: 'oz', label: 'oz' },
  { id: 'unit', label: 'piezas' },
];

const NOMBRE_UNIDAD: Record<string, string> = { ml: 'ml', g: 'g', oz: 'oz', L: 'L', l: 'L', unit: 'piezas' };
const cifra = (n: number) => (Math.round(n * 100) / 100).toLocaleString('es-DO');

/** Lo que cuesta una línea de la receta, en la moneda del salón (null si el insumo no tiene costo) */
export function costoDeLinea(
  l: LineaDeReceta, productos: SalonProduct[], enBase: (m: number, c?: string | null) => number | null,
): number | null {
  const insumo = productos.find(p => p.id === l.ingredientId);
  if (insumo?.costPrice == null) return null;
  // Todo en la moneda del salón: el insumo pudo comprarse en otra
  const linea = aUnidadDeStock(l.quantity, l.unit, insumo) * insumo.costPrice;
  return enBase(linea, insumo.currencyCode) ?? linea;
}

/** Lo que cuesta UNA porción: sus insumos más «otros por porción» */
export function costoDePorcion(
  receta: LineaDeReceta[], productos: SalonProduct[], enBase: (m: number, c?: string | null) => number | null, otros: number,
) {
  const insumos = receta.reduce((s, l) => s + (costoDeLinea(l, productos, enBase) ?? 0), 0);
  const faltanCostos = receta.filter(l => productos.find(p => p.id === l.ingredientId)?.costPrice == null)
    .map(l => productos.find(p => p.id === l.ingredientId)?.name ?? l.nombre ?? 'un insumo');
  return { insumos, otros, total: insumos + otros, faltanCostos };
}

/**
 * La receta de un preparado: qué insumos lleva UNA porción. Con eso, al
 * servirlo se descuentan los insumos y se sabe lo que costó hacerlo.
 * Cada línea enseña su cuenta, para que un dato mal puesto (una botella de
 * litro guardada como de 750) se vea solo.
 */
export const RecetaDelPreparado: React.FC<{
  productoId: string | null;
  receta: LineaDeReceta[];
  onChange: (r: LineaDeReceta[]) => void;
  /** «Otros por porción» (hielo, servilleta), en la moneda del salón; '' = nada */
  otros: string;
  onOtros: (v: string) => void;
  precio: number;
  /** Moneda del precio del preparado */
  moneda?: string;
  productos: SalonProduct[];
  /** Abre el insumo para corregir su costo o su contenido */
  onAbrirInsumo?: (p: SalonProduct) => void;
}> = ({ productoId, receta, onChange, otros, onOtros, precio, moneda, productos, onAbrirInsumo }) => {
  const { dinero, enBase, base } = useDinero();
  // Lo que puede ir en una receta: todo lo que no es otro preparado (primero los insumos)
  const candidatos = useMemo(
    () => productos
      .filter(p => !p.preparedToOrder && p.id !== productoId)
      .sort((a, b) => Number(!!b.supplyOnly) - Number(!!a.supplyOnly) || a.name.localeCompare(b.name)),
    [productos, productoId],
  );
  const [nuevo, setNuevo] = useState('');

  const costo = costoDePorcion(receta, productos, enBase, Number(otros) || 0);
  const precioEnBase = enBase(precio, moneda) ?? precio;
  const margen = precioEnBase > 0 && receta.length > 0 ? (precioEnBase - costo.total) / precioEnBase : null;

  const cambiar = (i: number, cambio: Partial<LineaDeReceta>) => onChange(receta.map((l, j) => (j === i ? { ...l, ...cambio } : l)));
  const agregar = () => {
    const insumo = candidatos.find(p => p.id === nuevo);
    if (!insumo || receta.some(l => l.ingredientId === insumo.id)) return;
    // Por defecto en la unidad de su contenido (paquete de 500 g → gramos)
    const unidad = insumo.unit === UNIDAD_POR_PIEZA && insumo.unitQty ? (insumo.unitQtyUnit === 'L' ? 'ml' : insumo.unitQtyUnit ?? 'g') : insumo.unit;
    onChange([...receta, { ingredientId: insumo.id, nombre: insumo.name, quantity: 1, unit: unidad }]);
    setNuevo('');
  };

  /** "50 ml de una botella de 750 ml (RD$1,500) = RD$100" */
  const cuenta = (l: LineaDeReceta, insumo: SalonProduct | undefined) => {
    if (!insumo) return null;
    const lineaCosto = costoDeLinea(l, productos, enBase);
    const pedido = `${cifra(l.quantity)} ${NOMBRE_UNIDAD[l.unit] ?? l.unit}`;
    if (insumo.costPrice == null) {
      return <span className="text-amber-600 dark:text-amber-400">{pedido}: a este insumo le falta el costo de compra.</span>;
    }
    const pieza = insumo.unit === UNIDAD_POR_PIEZA && insumo.unitQty
      ? `de un envase de ${cifra(insumo.unitQty)} ${insumo.unitQtyUnit ? NOMBRE_UNIDAD[insumo.unitQtyUnit] ?? insumo.unitQtyUnit : ''}`.trim()
      : insumo.unit === UNIDAD_POR_PIEZA ? 'de 1 pieza' : `a ${dinero(insumo.costPrice, insumo.currencyCode)} el ${NOMBRE_UNIDAD[insumo.unit] ?? insumo.unit}`;
    const precioPieza = insumo.unit === UNIDAD_POR_PIEZA ? ` (${dinero(insumo.costPrice, insumo.currencyCode)})` : '';
    // Sin la unidad del contenido una receta en oz no se puede pasar a la botella
    const sinUnidad = insumo.unit === UNIDAD_POR_PIEZA && !!insumo.unitQty && !insumo.unitQtyUnit && l.unit !== UNIDAD_POR_PIEZA;
    return (
      <>
        {pedido} {pieza}{precioPieza} = <b className="text-slate-600 dark:text-neutral-300">{dinero(lineaCosto ?? 0)}</b>
        {sinUnidad && <span className="block text-amber-600 dark:text-amber-400">Dile a este insumo si su contenido es en ml o en g, para hacer bien la cuenta.</span>}
      </>
    );
  };

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-[0.6875rem] text-slate-600 dark:text-neutral-300 leading-relaxed">
        <b className="text-amber-700 dark:text-amber-400">Una porción lleva…</b> Al servirlo salen estos insumos del inventario.
        Cada 1 o 2 semanas cuenta los insumos de verdad y ajusta: la diferencia es la merma.
      </div>

      {receta.length === 0 && (
        <p className="text-[0.75rem] text-slate-400 text-center py-2">Sin ingredientes todavía.</p>
      )}
      {receta.map((l, i) => {
        const insumo = productos.find(p => p.id === l.ingredientId);
        return (
          <div key={l.ingredientId} className="flex items-center gap-2">
            <span className="flex-1 min-w-0 text-[0.8125rem] font-semibold text-slate-800 dark:text-slate-200">
              {insumo && onAbrirInsumo ? (
                <button type="button" onClick={() => onAbrirInsumo(insumo)} title="Abrir este insumo para corregir su costo o su contenido"
                  className="block max-w-full truncate text-left hover:text-[var(--primary)] cursor-pointer">
                  {insumo.name}
                </button>
              ) : (
                <span className="block truncate">{insumo?.name ?? l.nombre ?? 'Insumo'}</span>
              )}
              <span className="block text-[0.6875rem] font-normal text-slate-400 leading-snug">{cuenta(l, insumo)}</span>
            </span>
            <input type="number" min="0" step="0.001" value={l.quantity} aria-label="Cantidad por porción"
              onChange={e => cambiar(i, { quantity: Number(e.target.value) })}
              className="w-20 px-2 py-2 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-right font-bold text-[0.8125rem] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            <select value={l.unit} onChange={e => cambiar(i, { unit: e.target.value })} aria-label="Unidad"
              className="px-2 py-2 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-semibold">
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
          className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem]">
          <option value="">Elegir insumo…</option>
          {candidatos.filter(p => !receta.some(l => l.ingredientId === p.id)).map(p => (
            <option key={p.id} value={p.id}>{p.name}{p.supplyOnly ? '' : ' (también se vende)'}</option>
          ))}
        </select>
        <button type="button" disabled={!nuevo} onClick={agregar}
          className="px-3 py-2.5 rounded-xl bg-[var(--primary)] text-white text-[0.75rem] font-bold disabled:opacity-40 flex items-center gap-1 cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> Agregar
        </button>
      </div>
      {candidatos.length === 0 && (
        <p className="text-[0.6875rem] text-slate-400">Primero crea los insumos (por ejemplo "Salchichón de lomo") como productos de tipo <b>Insumo</b>.</p>
      )}

      {/* Lo que no se cuenta en el inventario pero sí cuesta */}
      <div className="flex items-center gap-2">
        <span className="flex-1 min-w-0 text-[0.8125rem] font-semibold text-slate-800 dark:text-slate-200">
          Otros por porción <span className="font-normal text-slate-400">(opcional)</span>
          <span className="block text-[0.6875rem] font-normal text-slate-400 leading-snug">
            Lo que gastas y no cuentas: hielo, servilleta, gas. Lo que compras y cuentas (el limón) ponlo arriba como insumo.
          </span>
        </span>
        <div className="w-32 flex items-center gap-1 px-2 py-2 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 focus-within:ring-2 focus-within:ring-[var(--primary)]">
          <span className="text-[0.6875rem] font-semibold text-slate-400">{base}</span>
          <input type="number" min="0" step="0.01" value={otros} placeholder="0" aria-label="Otros por porción"
            onChange={e => onOtros(e.target.value)}
            className="w-full min-w-0 bg-transparent text-right font-bold text-[0.8125rem] focus:outline-none" />
        </div>
      </div>

      {receta.length > 0 && (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 text-[0.75rem]">
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-neutral-300">
            <ChefHat className="w-3.5 h-3.5" /> Cada porción te cuesta: <b className="tabular-nums">{dinero(costo.total)}</b>
          </span>
          {margen !== null && (
            <span className={`font-bold ${COLOR_DE_NIVEL[nivelDeGanancia(margen, true)]}`}>
              Ganancia {Math.round(margen * 100)}%
            </span>
          )}
        </div>
      )}
      {costo.faltanCostos.length > 0 && (
        <p className="text-[0.6875rem] text-amber-600">
          Le falta el costo de compra a {costo.faltanCostos.join(', ')}: el costo real es mayor. Ponlo en ese insumo.
        </p>
      )}
    </div>
  );
};
