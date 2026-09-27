import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { useDinero } from '../../hooks/useDinero';

interface Resumen {
  base: string;
  simbolo: string;
  monedas: { moneda: string; tasa: number | null; servicios: number; productos: number; ejemplos: { nombre: string; antes: number; despues: number | null }[] }[];
}

/**
 * Si el catálogo quedó en otra moneda (el salón empezó con precios en US$),
 * aquí se ve y se puede pasar todo a la moneda base de un toque. No es
 * obligatorio: con la tasa registrada, el sistema ya convierte al cobrar,
 * al hablar con las clientas y en los informes.
 */
export const CatalogoEnOtraMoneda: React.FC = () => {
  const { currencies, recargarCatalogo, showToast } = useApp();
  const { enSuMoneda } = useDinero();
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [pasando, setPasando] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);

  const cargar = useCallback(() => {
    api.get<Resumen>('/currencies/catalogo-en-otra-moneda').then(setResumen).catch(() => setResumen(null));
  }, []);
  // Se recalcula cuando cambian las monedas o sus tasas
  useEffect(cargar, [cargar, currencies]);

  const pasar = async (moneda: string) => {
    setPasando(moneda);
    try {
      const r = await api.post<{ servicios: number; productos: number }>('/currencies/pasar-catalogo', { desde: moneda });
      await recargarCatalogo();
      showToast('Catálogo actualizado', `${r.servicios} servicios y ${r.productos} productos ahora en ${resumen?.base}`, 'success');
      setConfirmar(null);
      cargar();
    } catch (e: any) {
      showToast('No se pudo pasar', e?.message ?? 'Intenta de nuevo', 'warning');
    } finally {
      setPasando(null);
    }
  };

  if (!resumen?.monedas.length) return null;
  return (
    <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/20 space-y-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
        <ArrowRightLeft className="w-3.5 h-3.5" /> Parte del catálogo tiene precios en otra moneda
      </div>
      {resumen.monedas.map(m => (
        <div key={m.moneda} className="space-y-1.5 text-[11px] text-slate-600 dark:text-neutral-300">
          <p>
            <b>{m.servicios} servicios</b> y <b>{m.productos} productos</b> tienen el precio en <b>{m.moneda}</b>.
            {m.tasa == null
              ? ` ${m.moneda} no está en tus monedas: agrégala con su tasa y el sistema convertirá solo.`
              : ` Se cobran en ${resumen.base} con la tasa del día; si prefieres, pásalos ya a ${resumen.base}.`}
          </p>
          {m.tasa != null && (
            <>
              <ul className="text-[10px] text-slate-500 dark:text-neutral-400">
                {m.ejemplos.map(e => (
                  <li key={e.nombre}>{e.nombre}: {enSuMoneda(e.antes, m.moneda)} → {e.despues == null ? '—' : enSuMoneda(e.despues, resumen.base)}</li>
                ))}
              </ul>
              {confirmar === m.moneda ? (
                <div className="flex gap-2 items-center">
                  <span className="text-[10px] text-slate-500">Se convierten precio, variantes y costo de compra, redondeados. Las citas y ventas ya hechas no cambian.</span>
                  <button type="button" onClick={() => setConfirmar(null)} className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-slate-500 cursor-pointer">Cancelar</button>
                  <button type="button" disabled={!!pasando} onClick={() => void pasar(m.moneda)}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-600 text-white text-[10px] font-bold disabled:opacity-50 cursor-pointer shrink-0">
                    {pasando ? 'Pasando…' : `Sí, pasar a ${resumen.base}`}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmar(m.moneda)}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-amber-300 dark:border-amber-800 text-[10px] font-bold text-amber-800 dark:text-amber-300 cursor-pointer">
                  Pasar el catálogo de {m.moneda} a {resumen.base} (tasa {m.tasa.toLocaleString('es-DO', { maximumFractionDigits: 4 })})
                </button>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
};
