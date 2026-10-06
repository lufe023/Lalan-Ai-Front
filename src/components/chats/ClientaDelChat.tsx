import React, { useEffect, useState } from 'react';
import { Link2, Search, X } from 'lucide-react';
import { api, urlDeFoto } from '../../services/api';
import { useApp } from '../../context/AppContext';
import type { Conversation } from '../../types';

/** Cuántas clientas se muestran al buscar */
const RESULTADOS = 6;
/** Espera mientras escribe antes de buscar */
const ESPERA_BUSQUEDA_MS = 250;

interface Encontrada { id: string; name: string; phone: string | null; avatar: string | null }

/**
 * "Este chat es de…": unir el chat a la ficha de una clienta.
 *
 * Instagram y Messenger no dicen el número, así que una clienta que ya
 * venía por WhatsApp aparece como alguien nuevo. Lalan le pide el número y
 * los une sola; si no lo da, aquí lo hace el equipo. Si el chat tenía una
 * ficha sin número, las dos se funden en una (queda la de WhatsApp).
 */
export const ClientaDelChat: React.FC<{ conversacion: Conversation }> = ({ conversacion }) => {
  const { showToast } = useApp();
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');
  const [lista, setLista] = useState<Encontrada[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    const t = window.setTimeout(() => {
      const params = new URLSearchParams({ limit: String(RESULTADOS), ...(q.trim() ? { q: q.trim() } : {}) });
      api.get<{ items: Encontrada[] }>(`/clients?${params}`)
        .then(r => setLista(r.items.filter(c => c.id !== conversacion.clientId)))
        .catch(() => setLista([]));
    }, ESPERA_BUSQUEDA_MS);
    return () => window.clearTimeout(t);
  }, [abierto, q, conversacion.clientId]);

  const unir = async (c: Encontrada) => {
    setOcupado(c.id);
    try {
      await api.patch(`/conversations/${conversacion.id}/clienta`, { clientId: c.id });
      showToast('Chat unido', `Ahora este chat es de ${c.name}: Lalan ve su ficha, sus citas y sus gustos.`, 'success');
      setAbierto(false); setQ('');
    } catch (e: any) {
      showToast('No se pudo unir', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="border-t border-slate-100 dark:border-neutral-900 bg-white dark:bg-neutral-950 text-[0.75rem] text-slate-500 dark:text-neutral-400">
      <div className="px-4 py-1.5 flex items-center gap-2">
        <Link2 className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 min-w-0 truncate">
          {conversacion.clientId ? 'Tiene ficha en el salón' : 'Todavía sin ficha'}
          {!conversacion.clientPhone && conversacion.channel !== 'whatsapp' ? ' · sin número' : ''}
        </span>
        <button type="button" onClick={() => setAbierto(a => !a)} className="shrink-0 font-bold underline cursor-pointer">
          {abierto ? 'Cerrar' : 'Es la clienta…'}
        </button>
      </div>
      {abierto && (
        <div className="px-4 pb-2 space-y-1.5">
          <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-neutral-900">
            <Search className="w-3.5 h-3.5 shrink-0" />
            <input
              autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="Busca por nombre o teléfono"
              className="flex-1 min-w-0 bg-transparent outline-none text-slate-900 dark:text-white"
            />
            {q && <button type="button" aria-label="Borrar" onClick={() => setQ('')} className="cursor-pointer"><X className="w-3.5 h-3.5" /></button>}
          </label>
          {lista.map(c => (
            <button
              key={c.id} type="button" disabled={!!ocupado} onClick={() => void unir(c)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-900 text-left disabled:opacity-50 cursor-pointer"
            >
              <img
                src={urlDeFoto(c.avatar) || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=e2e8f0&color=475569`}
                alt="" className="w-7 h-7 rounded-full object-cover shrink-0"
              />
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-slate-900 dark:text-white truncate">{c.name}</span>
                <span className="block truncate">{c.phone || 'Sin teléfono'}</span>
              </span>
              {ocupado === c.id && <span className="shrink-0">Uniendo…</span>}
            </button>
          ))}
          {!lista.length && <p className="px-2 py-1">No encontré a nadie con eso.</p>}
        </div>
      )}
    </div>
  );
};
