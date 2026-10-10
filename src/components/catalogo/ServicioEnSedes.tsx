import React from 'react';
import { MapPin, Edit2 } from 'lucide-react';
import type { SalonService } from '../../types';
import type { SedeDelSalon } from '../../context/SedeActivaContext';

/**
 * Un servicio en "Todas las sedes": en qué sedes se ofrece y a qué precio.
 *
 * Sedes hermanas, no siamesas: la misma marca puede cobrar distinto en cada
 * sede (su copia del servicio) o no ofrecerlo. Antes la tarjeta mostraba solo
 * el precio del salón y parecía que todas cobraban eso.
 */

type Tier = { id: string; name: string; price: number; isDefault?: boolean };

function tiersDe(s: SalonService): Tier[] {
  const v = (s.priceTiers ?? []).filter((t: any) => t && typeof t === 'object' && !Array.isArray(t)) as Tier[];
  return v.length ? v : [{ id: '1', name: 'Precio Base', price: s.price, isDefault: true }];
}

/** Agrupa por nombre: la versión del salón (o la primera) y las copias de cada sede */
export function agruparPorSede(servicios: SalonService[]): { principal: SalonService; copias: SalonService[] }[] {
  const grupos = new Map<string, SalonService[]>();
  for (const s of servicios) {
    const k = s.name.trim().toLowerCase();
    grupos.set(k, [...(grupos.get(k) ?? []), s]);
  }
  return [...grupos.values()].map(g => {
    const principal = g.find(s => !s.locationId) ?? g[0];
    return { principal, copias: g.filter(s => s !== principal) };
  });
}

export const ServicioEnSedes: React.FC<{
  principal: SalonService;
  copias: SalonService[];
  sedes: SedeDelSalon[];
  precio: (n: number, moneda?: string) => string;
  onEditar: (s: SalonService) => void;
}> = ({ principal, copias, sedes, precio, onEditar }) => {
  const filas = sedes.map(sede => {
    const suya = copias.find(c => c.locationId === sede.id) ?? (principal.locationId === sede.id ? principal : null);
    if (suya) return { sede, servicio: suya, propio: true };
    const delSalon = !principal.locationId && !(principal.ocultoEn ?? []).includes(sede.id);
    return { sede, servicio: delSalon ? principal : null, propio: false };
  });

  return (
    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/60 dark:border-neutral-700/60 space-y-1.5">
      <div className="flex items-center gap-1 px-1 text-[0.6875rem] uppercase font-bold text-slate-400">
        <MapPin className="w-3 h-3 text-[var(--primary)]" /> Precio en cada sede
      </div>
      {filas.map(({ sede, servicio, propio }) => (
        <div key={sede.id} className="p-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200/50 dark:border-neutral-800">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[0.75rem] font-bold text-slate-800 dark:text-slate-100 truncate">{sede.name}</span>
            {servicio ? (
              <span className="flex items-center gap-1.5 shrink-0">
                <span className={`text-[0.6875rem] font-semibold px-1.5 rounded-full ${propio
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                  : 'bg-slate-100 dark:bg-neutral-800 text-slate-500'}`}>
                  {propio ? 'su precio' : 'precio del salón'}
                </span>
                {propio && (
                  <button type="button" onClick={() => onEditar(servicio)} title={`Editar el precio de ${sede.name}`}
                    className="p-1 rounded-md text-slate-400 hover:text-[var(--primary)] cursor-pointer">
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </span>
            ) : (
              <span className="text-[0.6875rem] font-semibold text-slate-400 shrink-0">No se ofrece</span>
            )}
          </div>
          {servicio && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.6875rem] text-slate-500 dark:text-neutral-400">
              {tiersDe(servicio).map(t => (
                <span key={t.id}>
                  {t.name} <b className="text-slate-900 dark:text-white tabular-nums">{precio(t.price, servicio.currencyCode)}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
