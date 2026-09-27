import React from 'react';
import { useApp } from '../../context/AppContext';
import { useDinero } from '../../hooks/useDinero';

/**
 * En qué moneda están los precios de este servicio o producto. Lo normal es
 * la del salón; si un precio se piensa en dólares, se deja en US$ y el
 * sistema lo convierte con la tasa del día al cobrarlo, al decírselo a una
 * clienta y en los informes.
 */
export const MonedaDelPrecio: React.FC<{ value: string; onChange: (codigo: string) => void; ejemplo: number }> = ({ value, onChange, ejemplo }) => {
  const { currencies } = useApp();
  const { base, dinero, enSuMoneda, esExtranjera } = useDinero();
  const activas = currencies.filter(c => c.active);
  const actual = (value || base).toUpperCase();
  return (
    <div className="flex items-center gap-2 flex-wrap text-[10px]">
      <span className="text-slate-500 dark:text-neutral-400 font-semibold">Precios en</span>
      <select value={actual} onChange={e => onChange(e.target.value)} aria-label="Moneda de los precios"
        className="px-2 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 font-bold text-slate-800 dark:text-white">
        {/* Si el precio está en una moneda que ya no está activa, se enseña igual para no perderla */}
        {!activas.some(c => c.code === actual) && <option value={actual}>{actual}</option>}
        {activas.map(c => <option key={c.code} value={c.code}>{c.code}{c.isBase ? ' (la del salón)' : ''}</option>)}
      </select>
      {esExtranjera(actual) && (
        <span className="text-amber-600 dark:text-amber-400">
          Se cobra en {base} con la tasa del día: {enSuMoneda(ejemplo, actual)} ≈ {dinero(ejemplo, actual)}
        </span>
      )}
    </div>
  );
};
