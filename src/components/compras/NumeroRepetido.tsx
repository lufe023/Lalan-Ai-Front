import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { comprasApi, type DuenoDeNumero } from '../../services/compras';

/** Cuánto se espera después de la última tecla antes de preguntar */
const ESPERA_MS = 500;

/**
 * Al escribir un WhatsApp de proveedor: si ya está en otro, lo dice ahí
 * mismo (en cuál y de quién) con el botón para abrir esa ficha. No lo
 * prohíbe, porque el mismo vendedor puede llevar dos empresas: sus
 * mensajes van al proveedor que tenga un pedido abierto con él.
 */
export const NumeroRepetido: React.FC<{ whatsapp: string; excepto?: string | null; onAbrir?: (proveedorId: string) => void }> = ({ whatsapp, excepto, onAbrir }) => {
  const [duenos, setDuenos] = useState<DuenoDeNumero[]>([]);
  useEffect(() => {
    const limpio = whatsapp.replace(/\D/g, '');
    if (limpio.length < 7) { setDuenos([]); return; }
    let vivo = true;
    const t = setTimeout(() => {
      comprasApi.quienTieneNumero(limpio, excepto ?? null).then((d) => { if (vivo) setDuenos(d); }).catch(() => { if (vivo) setDuenos([]); });
    }, ESPERA_MS);
    return () => { vivo = false; clearTimeout(t); };
  }, [whatsapp, excepto]);

  if (!duenos.length) return null;
  return (
    <div className="mt-1 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-[0.75rem] space-y-1">
      <p className="flex items-start gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Este WhatsApp ya está en {duenos.map((d) => `${d.proveedor}${d.contacto ? ` (${d.contacto})` : ''}`).join(' y ')}.
          {' '}Si es la misma persona que vende para los dos, déjalo: lo que escriba va al que tenga un pedido abierto con ella. Si no, corrígelo aquí o en esa ficha.
        </span>
      </p>
      {onAbrir && (
        <div className="flex flex-wrap gap-2 pl-5">
          {[...new Map(duenos.map((d) => [d.proveedorId, d])).values()].map((d) => (
            <button key={d.proveedorId} type="button" onClick={() => onAbrir(d.proveedorId)} className="font-bold underline cursor-pointer">Abrir {d.proveedor}</button>
          ))}
        </div>
      )}
    </div>
  );
};
