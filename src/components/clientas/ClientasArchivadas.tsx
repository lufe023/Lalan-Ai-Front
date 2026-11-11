import React, { useEffect, useState } from 'react';
import { Archive, ArchiveRestore, ChevronRight, Loader2, Phone } from 'lucide-react';
import { api } from '../../services/api';
import { mapApiClient, useApp } from '../../context/AppContext';
import { useConfirmar } from '../ui/ModalConfirmar';
import { FotoClienta } from '../ui/FotoClienta';
import { ItemAnimado, ListaAnimada } from '../ui/movimiento';
import type { Client } from '../../types';

/** La fecha de archivo, como la dice una persona */
const fechaCorta = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/**
 * El filtro «Archivadas» del directorio. Archivar no borra: sus citas,
 * ventas, fiao, fotos y chats siguen enteros. Si la clienta vuelve sola
 * (escribe, reserva, llega al quiosco), sale del archivo sin hacer nada.
 */
export const ClientasArchivadas: React.FC<{
  /** Lo escrito en el buscador del directorio */
  busqueda: string;
  /** Abre su ficha (con su historial) */
  onAbrir: (c: Client) => void;
}> = ({ busqueda, onAbrir }) => {
  const { restaurarClienta, showToast } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [lista, setLista] = useState<Client[] | null>(null);
  const [error, setError] = useState('');
  const [restaurando, setRestaurando] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    const q = busqueda.trim();
    // Un respiro al escribir: no se pide al servidor una vez por letra
    const t = setTimeout(() => {
      api.get<any>(`/clients?archivadas=1&limit=100${q ? `&q=${encodeURIComponent(q)}` : ''}`)
        .then(r => { if (vigente) { setLista((r?.items ?? []).map(mapApiClient)); setError(''); } })
        .catch(() => { if (vigente) { setLista([]); setError('No se pudieron cargar las archivadas. Revisa tu conexión.'); } });
    }, q ? 300 : 0);
    return () => { vigente = false; clearTimeout(t); };
  }, [busqueda]);

  const restaurar = async (c: Client) => {
    const ok = await confirmar({
      titulo: `¿Restaurar a ${c.name}?`,
      mensaje: 'Vuelve al directorio con todo lo suyo: citas, ventas, notas, fotos y chats.',
      textoConfirmar: 'Restaurar',
      icono: <ArchiveRestore className="w-7 h-7" aria-hidden="true" />,
    });
    if (!ok) return;
    setRestaurando(c.id);
    try {
      await restaurarClienta(c.id);
      setLista(l => (l ?? []).filter(x => x.id !== c.id));
      showToast('Restaurada', `${c.name} volvió al directorio`, 'success');
    } catch (e: any) {
      showToast('No se pudo restaurar', e?.message || 'Intenta de nuevo.', 'warning');
    } finally {
      setRestaurando(null);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 flex items-start gap-2.5 text-[0.6875rem] text-slate-600 dark:text-neutral-400">
        <Archive className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
        <p>
          Las archivadas no salen en el directorio ni en las búsquedas, pero sus citas, ventas, fotos y chats se guardan enteros.
          Si una vuelve a escribir o reservar, sale del archivo sola.
        </p>
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      {lista === null ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : lista.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center p-6 bg-white dark:bg-neutral-900 rounded-2xl border border-dashed border-slate-300 dark:border-neutral-800">
          <Archive className="w-10 h-10 text-slate-300 dark:text-neutral-700 mb-2" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {busqueda.trim() ? 'Ninguna archivada con ese nombre' : 'No hay clientas archivadas'}
          </h4>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 max-w-xs">
            Cuando archives una clienta desde su ficha, aparece aquí para restaurarla.
          </p>
        </div>
      ) : (
        <ListaAnimada className="space-y-2.5">
          {lista.map((c, i) => (
            <ItemAnimado
              key={c.id}
              indice={i}
              onClick={() => onAbrir(c)}
              className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs cursor-pointer ios-touch flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FotoClienta foto={c.avatar} nombre={c.name} className="w-12 h-12 text-base border border-slate-200 dark:border-neutral-700 opacity-70 grayscale" />
                <div className="min-w-0">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">{c.name}</h4>
                  {c.phone && (
                    <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 truncate flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-slate-400" /><span>{c.phone}</span>
                    </p>
                  )}
                  <p className="text-[0.6875rem] text-slate-400 mt-0.5">
                    Archivada el {fechaCorta(c.archivadaEn)} · {c.totalVisits} {c.totalVisits === 1 ? 'visita' : 'visitas'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); void restaurar(c); }}
                  disabled={restaurando === c.id}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[var(--primary)] text-white text-[0.75rem] font-bold ios-touch cursor-pointer hover:opacity-90 disabled:opacity-60"
                >
                  {restaurando === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArchiveRestore className="w-3.5 h-3.5" />}
                  Restaurar
                </button>
                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-neutral-600" />
              </div>
            </ItemAnimado>
          ))}
        </ListaAnimada>
      )}
      {modalConfirmar}
    </div>
  );
};
