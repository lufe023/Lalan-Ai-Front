import React from 'react';
import { MapPin } from 'lucide-react';
import { useDinero } from '../../hooks/useDinero';
import { COLOR_DE_NIVEL, RANGO_TEXTO, TEXTO_DE_NIVEL, nivelDeGanancia } from '../../utils/ganancia';

export interface PrecioDeSede { id: string; nombre: string | null; precio: number }

/**
 * Lo que gana la dueña con un preparado, al lado de lo que cobra: el costo
 * sale solo de la receta (más «otros por porción»), no se escribe a mano.
 * Con varias sedes, una fila por sede, porque cada una puede cobrar distinto.
 */
export const GananciaDelPreparado: React.FC<{
  costo: number;
  /** Insumos o «otros» que forman el costo, para decirlo en una línea */
  insumos: number;
  otros: number;
  faltanCostos: string[];
  sinReceta: boolean;
  moneda: string;
  precios: PrecioDeSede[];
  minStock: string;
  onMinStock: (v: string) => void;
}> = ({ costo, insumos, otros, faltanCostos, sinReceta, moneda, precios, minStock, onMinStock }) => {
  const { dinero, enBase } = useDinero();

  return (
    <div className="space-y-3">
      {sinReceta ? (
        <p className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-[0.75rem] text-amber-700 dark:text-amber-300">
          Ponle la receta arriba y aquí te digo cuánto te cuesta cada porción y cuánto te queda.
        </p>
      ) : (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700 space-y-2">
          <p className="text-[0.8125rem] text-slate-700 dark:text-neutral-200">
            Cada porción te cuesta <b className="tabular-nums">{dinero(costo)}</b>
            <span className="text-slate-400 text-[0.6875rem]">
              {otros > 0 ? ` (receta ${dinero(insumos)} + otros ${dinero(otros)})` : ' según su receta'}
            </span>
          </p>
          {precios.map(p => {
            const precio = enBase(p.precio, moneda) ?? p.precio;
            const queda = precio - costo;
            const margen = precio > 0 ? queda / precio : null;
            const nivel = margen != null ? nivelDeGanancia(margen, true) : null;
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[0.75rem]">
                <span className="text-slate-600 dark:text-neutral-300 min-w-0">
                  {p.nombre && <span className="inline-flex items-center gap-1 font-semibold mr-1"><MapPin className="w-3 h-3" />{p.nombre}:</span>}
                  la vendes a <b className="tabular-nums">{dinero(p.precio, moneda)}</b> y te quedan <b className="tabular-nums">{dinero(queda)}</b>
                </span>
                {margen != null && nivel && (
                  <span className={`font-bold ${COLOR_DE_NIVEL[nivel]}`}>{Math.round(margen * 100)}% · {TEXTO_DE_NIVEL[nivel]}</span>
                )}
              </div>
            );
          })}
          <p className="text-[0.6875rem] text-slate-400 leading-relaxed">{RANGO_TEXTO.preparado}</p>
          {faltanCostos.length > 0 && (
            <p className="text-[0.6875rem] text-amber-600">
              Le falta el costo de compra a {faltanCostos.join(', ')}: la ganancia real es menor.
            </p>
          )}
        </div>
      )}

      <div>
        <label className="block text-[0.6875rem] font-semibold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wide">
          Avísame cuando alcance para menos de
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number" min="0" step="1" placeholder="ej: 5" value={minStock}
            onChange={e => onMinStock(e.target.value)}
            className="w-28 px-3 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.875rem] font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
          />
          <span className="text-[0.75rem] text-slate-500 dark:text-neutral-400">porciones (Lalan cuenta lo que queda de sus insumos)</span>
        </div>
      </div>
    </div>
  );
};
