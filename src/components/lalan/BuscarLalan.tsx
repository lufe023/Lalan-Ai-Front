import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, Search, Sparkles, X } from 'lucide-react';
import { api } from '../../services/api';

export interface ResultadoBusqueda {
  id: string;
  deLalan: boolean;
  dia: string;
  creadoEn: string;
  texto: string;
}

interface Props {
  hoy: string;
  onCerrar: () => void;
  /** Eligió un mensaje: se abre su día y se lleva la vista hasta él */
  onElegir: (r: ResultadoBusqueda) => void;
}

const aFecha = (dia: string) => {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a, m - 1, d, 12);
};

function nombreDia(dia: string, hoy: string) {
  const dif = Math.round((aFecha(hoy).getTime() - aFecha(dia).getTime()) / 86_400_000);
  if (dif === 0) return 'Hoy';
  if (dif === 1) return 'Ayer';
  const t = new Intl.DateTimeFormat('es-DO', { weekday: 'long', day: 'numeric', month: 'long', ...(dia.slice(0, 4) !== hoy.slice(0, 4) ? { year: 'numeric' } : {}) }).format(aFecha(dia)).replace(',', '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Lo buscado, resaltado dentro del texto */
function Resaltado({ texto, q }: { texto: string; q: string }) {
  const i = q ? texto.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{texto}</>;
  return <>{texto.slice(0, i)}<mark className="bg-[var(--primary)]/20 text-inherit rounded px-0.5">{texto.slice(i, i + q.length)}</mark>{texto.slice(i + q.length)}</>;
}

/**
 * «Buscar en lo que hablamos»: escribe una palabra (un nombre, un producto,
 * «keratina») y salen los mensajes de cualquier día. Un toque abre ese día
 * justo en ese mensaje.
 */
export const BuscarLalan: React.FC<Props> = ({ hoy, onCerrar, onElegir }) => {
  const [q, setQ] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoBusqueda[] | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => { entrada.current?.focus(); }, []);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar]);

  // Busca mientras escribe (con una pausa corta)
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setResultados(null); setBuscando(false); return; }
    setBuscando(true);
    let vigente = true;
    const espera = setTimeout(() => {
      api.get<{ resultados: ResultadoBusqueda[] }>(`/asistente/buscar?q=${encodeURIComponent(t)}`)
        .then((r) => { if (vigente) setResultados(r.resultados); })
        .catch(() => { if (vigente) setResultados([]); })
        .finally(() => { if (vigente) setBuscando(false); });
    }, 300);
    return () => { vigente = false; clearTimeout(espera); };
  }, [q]);

  // Agrupados por día, del más reciente al más viejo
  const grupos: { dia: string; items: ResultadoBusqueda[] }[] = [];
  for (const r of resultados ?? []) {
    const g = grupos[grupos.length - 1];
    if (g?.dia === r.dia) g.items.push(r); else grupos.push({ dia: r.dia, items: [r] });
  }
  const t = q.trim();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
      className="absolute inset-0 z-20 flex flex-col bg-slate-50/97 dark:bg-neutral-950/97 backdrop-blur-xl" role="dialog" aria-label="Buscar en lo que hablamos">
      <div className="shrink-0 flex items-center gap-2 px-4 pt-4 pb-3">
        <div className="flex-1 flex items-center gap-2 h-11 px-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-white/10 shadow-sm focus-within:ring-2 focus-within:ring-[var(--primary)]">
          <Search className="w-4.5 h-4.5 text-slate-400 shrink-0" />
          <input ref={entrada} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en lo que hablamos…" enterKeyHint="search"
            className="flex-1 min-w-0 bg-transparent text-[0.9375rem] focus:outline-none" />
          {buscando && <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />}
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar la búsqueda"
          className="w-11 h-11 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200/60 dark:hover:bg-neutral-800 cursor-pointer shrink-0">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 space-y-4 [scrollbar-width:thin]">
        {!t && <p className="text-[0.875rem] text-slate-500 dark:text-neutral-400 px-1">Escribe un nombre, un producto o algo que le pediste a Lalán. Busca en todos los días.</p>}
        {t.length >= 2 && resultados && !resultados.length && !buscando && (
          <p className="text-[0.875rem] text-slate-500 dark:text-neutral-400 px-1">No encontré «{t}» en lo que hablamos.</p>
        )}
        {grupos.map((g) => (
          <section key={g.dia} className="space-y-1.5">
            <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400 px-1">{nombreDia(g.dia, hoy)}</p>
            {g.items.map((r) => (
              <button key={r.id} type="button" onClick={() => onElegir(r)}
                className="w-full text-left rounded-2xl bg-white/90 dark:bg-neutral-900/85 border border-white/80 dark:border-white/5 shadow-sm px-4 py-2.5 cursor-pointer hover:bg-white dark:hover:bg-neutral-900">
                <span className="flex items-center gap-1.5 text-[0.6875rem] font-semibold text-slate-400">
                  {r.deLalan ? <><Sparkles className="w-3 h-3 text-[var(--primary)]" /> Lalán</> : 'Tú'}
                  <span aria-hidden>·</span>
                  {new Date(r.creadoEn).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' })}
                </span>
                <span className="block text-[0.875rem] leading-snug text-slate-700 dark:text-neutral-200 mt-0.5"><Resaltado texto={r.texto} q={t} /></span>
              </button>
            ))}
          </section>
        ))}
      </div>
    </motion.div>
  );
};
