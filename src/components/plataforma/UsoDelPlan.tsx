import React from 'react';
import { NOMBRE_RECURSO, RECURSOS, type CupoDelMes, type Limites, type Uso } from '../../types/plataforma';

const cifra = (n: number) => n.toLocaleString('es-DO');

/** De dónde salen las respuestas del mes, si hay algo más que lo del plan */
function desglose(c: CupoDelMes): string | null {
  const partes = [
    c.acumulado ? `${cifra(c.acumulado)} que pasaron del mes pasado` : null,
    c.deuda ? `${cifra(c.deuda)} menos por lo adelantado el mes pasado` : null,
    c.extra ? `${cifra(c.extra)} de paquetes` : null,
    c.adelanto ? `${cifra(c.adelanto)} adelantadas del mes que viene` : null,
  ].filter(Boolean);
  return partes.length ? `Tu plan trae ${cifra(c.plan)}: ${partes.join(' · ')}` : null;
}

/**
 * Barras de "cuánto lleva de lo que su plan permite". En las respuestas, lo
 * adelantado del mes que viene va en naranja: se ve cuándo ya está gastando
 * de lo prestado.
 */
export const UsoDelPlan: React.FC<{ uso: Uso; limites: Limites; compacto?: boolean; cupo?: CupoDelMes | null }> = ({ uso, limites, compacto, cupo }) => (
  <div className={compacto ? 'space-y-1.5' : 'space-y-2.5'}>
    {RECURSOS.map((r) => {
      const tope = limites[r];
      const p = tope ? Math.min(100, Math.round((uso[r] / tope) * 100)) : 0;
      const adelanto = r === 'mensajesMes' && tope ? Math.min(cupo?.adelanto ?? 0, tope) : 0;
      // Dónde empieza lo adelantado, en % de la barra
      const propio = tope ? Math.round(((tope - adelanto) / tope) * 100) : 100;
      const enAdelanto = adelanto > 0 && uso[r] > tope! - adelanto;
      const color = !tope ? 'bg-slate-300 dark:bg-neutral-700' : p >= 100 ? 'bg-rose-500' : enAdelanto ? 'bg-orange-500' : p >= 80 ? 'bg-amber-500' : 'bg-[var(--primary)]';
      const detalle = r === 'mensajesMes' && cupo && !compacto ? desglose(cupo) : null;
      return (
        <div key={r}>
          <div className="flex justify-between text-[0.75rem]">
            <span className="text-slate-600 dark:text-neutral-300">{NOMBRE_RECURSO[r]}</span>
            <span className="tabular-nums font-semibold text-slate-900 dark:text-white">
              {cifra(uso[r])} {tope !== null ? <span className="text-slate-400 font-normal">de {cifra(tope)}</span> : <span className="text-slate-400 font-normal">· sin límite</span>}
            </span>
          </div>
          {!compacto && (
            <div className="relative h-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 mt-1 overflow-hidden">
              {adelanto > 0 && <div className="absolute inset-y-0 right-0 bg-orange-200 dark:bg-orange-900/60" style={{ left: `${propio}%` }} aria-hidden="true" />}
              <div className={`relative h-full rounded-full ${color}`} style={{ width: `${tope ? p : 100}%`, opacity: tope ? 1 : 0.35 }} />
            </div>
          )}
          {detalle && <p className={`text-[0.6875rem] mt-1 ${enAdelanto ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400'}`}>{detalle}{enAdelanto ? '. Ya estás usando las adelantadas.' : ''}</p>}
        </div>
      );
    })}
  </div>
);
