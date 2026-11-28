import React from 'react';
import { Car, MapPin, Navigation, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useConfirmar } from '../ui/ModalConfirmar';
import { enlaceAlMapa, enlaceComoLlegar } from '../../services/domicilio';
import type { Client } from '../../types';

/**
 * Las direcciones de la clienta para ir a su casa. Las guardan solas Lalan
 * (cuando la clienta la da por chat o manda su ubicación), la Vitrina y la
 * agenda. La primera es la última que usó: Lalan le pregunta «¿en la misma
 * de siempre?» y la cita nueva ya la trae puesta.
 */
export const DireccionesClienta: React.FC<{ clienta: Client }> = ({ clienta }) => {
  const { updateClient, showToast } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const lista = clienta.direcciones ?? [];
  if (!lista.length) return null;

  const quitar = async (id: string, texto: string) => {
    const si = await confirmar({
      titulo: '¿Quitar esta dirección?',
      mensaje: `«${texto}». Las citas que ya tienen esta dirección no cambian.`,
      textoConfirmar: 'Quitar', tono: 'peligro',
    });
    if (!si) return;
    try {
      await updateClient(clienta.id, { direcciones: lista.filter(d => d.id !== id) });
    } catch (e: any) {
      showToast('No se pudo quitar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    }
  };

  return (
    <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/20 space-y-2">
      {modalConfirmar}
      <div className="flex items-center gap-1.5 font-bold text-[0.75rem] text-sky-700 dark:text-sky-300">
        <Car className="w-3.5 h-3.5" /> <span>A domicilio: dónde se la atiende</span>
      </div>
      {lista.map((d, i) => {
        const mapa = enlaceAlMapa(d);
        const llegar = enlaceComoLlegar(d);
        return (
          <div key={d.id} className="flex items-start gap-2 p-2 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200/70 dark:border-neutral-800">
            <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-sky-600" />
            <div className="min-w-0 flex-1">
              <p className="text-[0.8125rem] font-semibold text-slate-900 dark:text-white break-words">{d.direccion}</p>
              {d.referencia && <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 break-words">{d.referencia}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.6875rem] font-bold">
                {i === 0 && <span className="px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300">La última que usó</span>}
                {d.lat != null && <span className="text-slate-400">Con ubicación exacta</span>}
                {llegar && <a href={llegar} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[var(--primary)]"><Navigation className="w-3 h-3" /> Cómo llegar</a>}
                {mapa && <a href={mapa} target="_blank" rel="noreferrer" className="text-[var(--primary)]">Ver en el mapa</a>}
              </div>
            </div>
            <button type="button" onClick={() => void quitar(d.id, d.direccion)} aria-label={`Quitar ${d.direccion}`}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 ios-touch cursor-pointer">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
