import React, { useEffect, useState } from 'react';
import { FotoClienta } from '../ui/FotoClienta';
import { IdCard, Link2, Search, X } from 'lucide-react';
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
 *
 * Va dentro de la herramienta «Ficha» de la fila de arriba del chat, con el
 * botón para abrir su ficha cuando ya la tiene.
 */
export const ClientaDelChat: React.FC<{ conversacion: Conversation; onAbrirFicha?: () => void; onListo: () => void }> = ({ conversacion, onAbrirFicha, onListo }) => {
  const { showToast } = useApp();
  const [q, setQ] = useState('');
  const [lista, setLista] = useState<Encontrada[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const nombre = conversacion.clientName.split(' ')[0] || conversacion.clientName;

  useEffect(() => {
    const t = window.setTimeout(() => {
      const params = new URLSearchParams({ limit: String(RESULTADOS), ...(q.trim() ? { q: q.trim() } : {}) });
      api.get<{ items: Encontrada[] }>(`/clients?${params}`)
        .then(r => setLista(r.items.filter(c => c.id !== conversacion.clientId)))
        .catch(() => setLista([]));
    }, ESPERA_BUSQUEDA_MS);
    return () => window.clearTimeout(t);
  }, [q, conversacion.clientId]);

  const unir = async (c: Encontrada) => {
    setOcupado(c.id);
    try {
      await api.patch(`/conversations/${conversacion.id}/clienta`, { clientId: c.id });
      showToast('Chat unido', `Ahora este chat es de ${c.name}: Lalan ve su ficha, sus citas y sus gustos.`, 'success');
      setQ('');
      onListo();
    } catch (e: any) {
      showToast('No se pudo unir', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="space-y-2 text-[0.75rem] text-slate-500 dark:text-neutral-400">
      {conversacion.clientId && onAbrirFicha ? (
        <button type="button" onClick={onAbrirFicha}
          className="w-full h-10 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold flex items-center justify-center gap-1.5 ios-touch cursor-pointer shadow-sm">
          <IdCard className="w-4 h-4" /> Abrir la ficha de {nombre}
        </button>
      ) : (
        <p className="flex items-start gap-1.5">
          <Link2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Todavía sin ficha{!conversacion.clientPhone && conversacion.channel !== 'whatsapp' ? ' y sin número' : ''}. Si ya es clienta, búscala y únela: Lalan verá sus citas y sus gustos.</span>
        </p>
      )}
      {conversacion.clientId && (
        <p>¿Ya era clienta con otro nombre o por WhatsApp{!conversacion.clientPhone && conversacion.channel !== 'whatsapp' ? ' (este chat no trae número)' : ''}? Búscala y se unen en una sola ficha.</p>
      )}
      <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-neutral-900">
        <Search className="w-3.5 h-3.5 shrink-0" />
        <input
          value={q} onChange={e => setQ(e.target.value)}
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
          <FotoClienta foto={urlDeFoto(c.avatar)} nombre={c.name} className="w-7 h-7 text-[0.6875rem]" />
          <span className="flex-1 min-w-0">
            <span className="block font-semibold text-slate-900 dark:text-white truncate">{c.name}</span>
            <span className="block truncate">{c.phone || 'Sin teléfono'}</span>
          </span>
          {ocupado === c.id ? <span className="shrink-0">Uniendo…</span> : <span className="shrink-0 font-bold underline">Es ella</span>}
        </button>
      ))}
      {!lista.length && q.trim() && <p className="px-2 py-1">No encontré a nadie con eso.</p>}
    </div>
  );
};
