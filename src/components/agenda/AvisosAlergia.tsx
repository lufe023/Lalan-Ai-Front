import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Tag } from 'lucide-react';
import { saberProductosApi, type AvisoAlergia } from '../../services/saberProductos';

const fechaHora = (iso: string) => new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * Los avisos de alergia de una cita: el producto de la receta lleva (o puede
 * llevar) algo que le hace daño a la clienta. Solo los ve el equipo; a la
 * clienta no se le dice nada. "Revisé la etiqueta" queda anotado con quién y
 * cuándo. Nunca frena la cita.
 */
export const ListaAvisosAlergia: React.FC<{
  avisos: AvisoAlergia[];
  onRevisar?: (productId: string) => Promise<unknown>;
}> = ({ avisos, onRevisar }) => {
  const [revisando, setRevisando] = useState<string | null>(null);
  if (!avisos.length) return null;
  const revisar = async (productId: string) => {
    if (!onRevisar) return;
    setRevisando(productId);
    try { await onRevisar(productId); } finally { setRevisando(null); }
  };
  return (
    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-slate-800 dark:text-amber-100 space-y-2.5">
      <div className="flex items-center gap-1.5 font-bold text-[0.75rem] text-amber-700 dark:text-amber-300">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
        <span>Cuidado con los productos de este servicio</span>
      </div>
      {avisos.map((a) => (
        <div key={`${a.productId}-${a.grupo ?? ''}`} className="space-y-1.5">
          <p className="text-[0.8125rem] leading-relaxed">{a.texto}</p>
          {a.revisado ? (
            <p className="text-[0.75rem] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {a.revisado.por} revisó la etiqueta · {fechaHora(a.revisado.en)}
            </p>
          ) : onRevisar ? (
            <button type="button" disabled={revisando === a.productId} onClick={() => void revisar(a.productId)}
              className="min-h-[36px] px-3 rounded-xl bg-white dark:bg-neutral-900 border border-amber-500/40 text-[0.75rem] font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-60">
              {revisando === a.productId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
              Revisé la etiqueta
            </button>
          ) : null}
        </div>
      ))}
      <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">Es una guía: no sustituye una prueba de alergia.</p>
    </div>
  );
};

/** Los avisos de una cita, cargados para la agenda del salón */
export const AvisosAlergiaCita: React.FC<{ citaId: string }> = ({ citaId }) => {
  const [avisos, setAvisos] = useState<AvisoAlergia[]>([]);
  const cargar = useCallback(() => {
    saberProductosApi.avisosDeCita(citaId).then((r) => setAvisos(r.avisos)).catch(() => setAvisos([]));
  }, [citaId]);
  useEffect(() => { cargar(); }, [cargar]);
  return <ListaAvisosAlergia avisos={avisos} onRevisar={(p) => saberProductosApi.revisado(citaId, p).then(cargar)} />;
};
