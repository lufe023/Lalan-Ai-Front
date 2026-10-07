import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import type { PlanLalan } from '../../types/plataforma';

interface ResumenCosto {
  dias: number; desde: string | null; hasta: string | null;
  gastoUsd: number; respuestas: number; preguntas: number; landing: number;
  porInteraccionUsd: number | null; porInteraccionPesos: number | null; cienRespuestasPesos: number | null;
  tasa: number;
  /** Lo que OpenRouter dijo que costó cada llamada (exacto, por salón) */
  exacto?: {
    totalUsd: number; porFuente: Record<string, number>; respuestas: number;
    porRespuestaUsd: number | null; porRespuestaPesos: number | null;
    salones: { tenantId: string; nombre: string; costoUsd: number; costoPesos: number; respuestas: number; porRespuestaPesos: number | null }[];
  };
}

const FUENTES: Record<string, string> = {
  chat: 'Chats con clientas', pantalla: 'Pantalla de la dueña', informes: 'Informes', senales: 'Señales de los chats',
  fotos: 'Fotos', landing: 'Landing (IA y voz)', plataforma: 'Análisis de Plataforma', voz: 'Voz de Lalan (Cloudflare)',
};

/** El precio ya lleva todo (ITBIS 18 % y la comisión de la tarjeta, ~4 %): esto es lo que de verdad entra */
const ITBIS = 1.18;
const TARJETA = 0.96;
const neto = (precio: number) => (precio / ITBIS) * TARJETA;
const pesos = (n: number) => `${Math.round(n).toLocaleString('es-DO')} pesos`;

/**
 * Cuánto cuesta DE VERDAD cada respuesta de la IA: el gasto de OpenRouter de
 * cada día entre lo que hizo la IA ese día. Con eso, cuánto queda de cada
 * plan si el salón usa todas sus respuestas. No incluye el servidor ni tu
 * tiempo de soporte: lo que queda tiene que cubrir eso también.
 */
export const CostoRealIa: React.FC<{ planes: PlanLalan[] }> = ({ planes }) => {
  const [r, setR] = useState<ResumenCosto | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get<ResumenCosto>('/plataforma/planes/costo-ia?dias=30').then(setR).catch((e) => setError((e as Error).message)); }, []);

  const caja = 'p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800';
  if (error) return <div className={`${caja} text-[0.75rem] text-rose-600`}>{error}</div>;
  if (!r) return <div className={`${caja} flex items-center gap-2 text-[0.75rem] text-slate-400`}><Loader2 className="w-4 h-4 animate-spin" /> Midiendo el costo real…</div>;

  const interacciones = r.respuestas + r.preguntas + r.landing;
  // El exacto manda; si el chat todavía no pasa por el puente, se usa la estimación por fotos diarias
  const exactoPorRespuesta = r.exacto?.porRespuestaPesos ?? null;
  const porRespuesta = exactoPorRespuesta ?? r.porInteraccionPesos;
  return (
    <div className={`${caja} space-y-3`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[0.875rem] font-bold">Costo real de la IA</h3>
        <span className="text-[0.6875rem] text-slate-400">{r.dias ? `${r.desde} a ${r.hasta} · ${r.dias} días` : 'Empieza a medir hoy'} · 1 dólar = {r.tasa} pesos</span>
      </div>
      {r.exacto && r.exacto.totalUsd > 0 && (
        <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 space-y-2">
          <div className="text-[0.75rem] font-bold text-emerald-800 dark:text-emerald-300">
            Exacto (lo que OpenRouter cobró): US$ {r.exacto.totalUsd.toFixed(4)} · {pesos(r.exacto.totalUsd * r.tasa)}
            {exactoPorRespuesta !== null && <> · <b>{exactoPorRespuesta.toFixed(2)} pesos por respuesta</b> a clientas</>}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] text-slate-600 dark:text-neutral-300 tabular-nums">
            {Object.entries(r.exacto.porFuente).sort((a, b) => b[1] - a[1]).map(([f, usd]) => <span key={f}>{FUENTES[f] ?? f}: {pesos(usd * r.tasa)}</span>)}
          </div>
          {!!r.exacto.salones.length && (
            <table className="w-full text-[0.6875rem] tabular-nums">
              <thead><tr className="text-left text-slate-500"><th className="pr-3 font-semibold">Salón</th><th className="pr-3 font-semibold">Gastó en IA</th><th className="pr-3 font-semibold">Respuestas</th><th className="font-semibold">Por respuesta</th></tr></thead>
              <tbody>{r.exacto.salones.map((s) => (
                <tr key={s.tenantId}><td className="pr-3">{s.nombre}</td><td className="pr-3">{pesos(s.costoPesos)}</td><td className="pr-3">{s.respuestas}</td><td>{s.porRespuestaPesos === null ? '—' : `${s.porRespuestaPesos.toFixed(2)} pesos`}</td></tr>
              ))}</tbody>
            </table>
          )}
          {exactoPorRespuesta === null && <p className="text-[0.6875rem] text-slate-500">Los chats con clientas todavía no pasan por el puente: falta apuntar la credencial de OpenRouter de n8n al backend. Mientras, la tabla de abajo usa la estimación.</p>}
        </div>
      )}
      {porRespuesta === null ? (
        <p className="text-[0.8125rem] text-slate-500">Cada día se toma una foto del gasto de OpenRouter. En 2 o 3 días aquí vas a ver cuánto cuesta de verdad cada respuesta y cuánto te queda de cada plan.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
            <div><div className="text-lg font-bold">US$ {r.gastoUsd.toFixed(2)}</div><div className="text-[0.6875rem] text-slate-500">gastado en IA ({pesos(r.gastoUsd * r.tasa)})</div></div>
            <div><div className="text-lg font-bold">{interacciones.toLocaleString('es-DO')}</div><div className="text-[0.6875rem] text-slate-500">{r.respuestas} respuestas · {r.preguntas} preguntas · {r.landing} landing</div></div>
            <div><div className="text-lg font-bold">{(r.porInteraccionPesos ?? 0).toFixed(2)} pesos</div><div className="text-[0.6875rem] text-slate-500">por interacción, estimado por fotos diarias</div></div>
            <div><div className="text-lg font-bold">{pesos(r.cienRespuestasPesos ?? 0)}</div><div className="text-[0.6875rem] text-slate-500">cada 100 respuestas</div></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[0.75rem] tabular-nums">
              <thead><tr className="text-left text-slate-500">
                <th className="py-1 pr-3 font-semibold">Plan</th><th className="py-1 pr-3 font-semibold">Precio</th><th className="py-1 pr-3 font-semibold">Entra (sin ITBIS ni tarjeta)</th>
                <th className="py-1 pr-3 font-semibold">IA si usa todo</th><th className="py-1 font-semibold">Queda</th>
              </tr></thead>
              <tbody>
                {planes.filter((p) => p.activo && p.precioMensual > 0).map((p) => {
                  const entra = neto(p.precioMensual);
                  const ia = (p.limites.mensajesMes ?? 0) * (porRespuesta ?? 0);
                  const queda = entra - ia;
                  const pct = entra > 0 ? Math.round((queda / entra) * 100) : 0;
                  return (
                    <tr key={p.id} className="border-t border-slate-100 dark:border-neutral-800">
                      <td className="py-1.5 pr-3 font-semibold">{p.nombre}</td>
                      <td className="py-1.5 pr-3">{pesos(p.precioMensual)}</td>
                      <td className="py-1.5 pr-3">{pesos(entra)}</td>
                      <td className="py-1.5 pr-3">{p.limites.mensajesMes === null ? 'sin tope' : pesos(ia)}</td>
                      <td className={`py-1.5 font-bold ${pct < 30 ? 'text-rose-600' : pct < 50 ? 'text-amber-600' : 'text-emerald-600'}`}>{pesos(queda)} ({pct} %)</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[0.6875rem] text-slate-400">Lo que queda tiene que pagar el servidor y tu tiempo de soporte. Incluye el gasto de los informes y de la landing, así que el costo por respuesta sale un poco alto (mejor así). Verde: más de la mitad queda.</p>
        </>
      )}
    </div>
  );
};
