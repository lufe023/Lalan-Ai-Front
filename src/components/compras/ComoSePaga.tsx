import React, { useEffect, useRef, useState } from 'react';
import { Banknote, CalendarClock, Check, ChevronDown, CreditCard, FileSignature, Landmark, PencilLine, Truck } from 'lucide-react';
import { campo } from './piezas';

const FORMAS: { texto: string; icono: React.ElementType; color: string }[] = [
  { texto: 'Contado', icono: Banknote, color: 'text-emerald-600 dark:text-emerald-400' },
  { texto: 'Transferencia', icono: Landmark, color: 'text-sky-600 dark:text-sky-400' },
  { texto: 'Contra entrega', icono: Truck, color: 'text-amber-600 dark:text-amber-400' },
  { texto: 'Crédito 15 días', icono: CalendarClock, color: 'text-violet-600 dark:text-violet-400' },
  { texto: 'Crédito 30 días', icono: CalendarClock, color: 'text-violet-600 dark:text-violet-400' },
  { texto: 'Crédito 45 días', icono: CalendarClock, color: 'text-violet-600 dark:text-violet-400' },
  { texto: 'Crédito 60 días', icono: CalendarClock, color: 'text-violet-600 dark:text-violet-400' },
  { texto: 'Cheque', icono: FileSignature, color: 'text-slate-600 dark:text-neutral-300' },
  { texto: 'Tarjeta', icono: CreditCard, color: 'text-rose-600 dark:text-rose-400' },
];

/**
 * Cómo se le paga al proveedor: una lista con iconos. Lo que no esté en la
 * lista se escribe en «Otra». Se guarda el texto (sale en la orden).
 */
export const ComoSePaga: React.FC<{ valor: string; onCambio: (v: string) => void }> = ({ valor, onCambio }) => {
  const [abierto, setAbierto] = useState(false);
  const [escribiendo, setEscribiendo] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const actual = FORMAS.find((f) => f.texto.toLowerCase() === valor.trim().toLowerCase());
  const otra = escribiendo || (!!valor.trim() && !actual);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierto]);

  const Icono = otra ? PencilLine : actual?.icono ?? Banknote;
  return (
    <div ref={caja} className="relative">
      {otra ? (
        <div className="flex gap-1.5">
          <input className={campo} autoFocus={escribiendo} placeholder="90 días, mitad y mitad…" value={valor} onChange={(e) => onCambio(e.target.value)} />
          <button type="button" onClick={() => setAbierto((a) => !a)} aria-label="Elegir de la lista" className="shrink-0 px-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-slate-500 dark:text-neutral-300 cursor-pointer"><ChevronDown className="w-4 h-4" /></button>
        </div>
      ) : (
        <button type="button" onClick={() => setAbierto((a) => !a)} aria-haspopup="listbox" aria-expanded={abierto} className={`${campo} flex items-center gap-2 text-left cursor-pointer`}>
          <Icono className={`w-4 h-4 shrink-0 ${actual?.color ?? 'text-slate-400'}`} />
          <span className={`flex-1 truncate ${actual ? '' : 'text-slate-400'}`}>{actual?.texto ?? 'Elegir…'}</span>
          <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition ${abierto ? 'rotate-180' : ''}`} />
        </button>
      )}
      {abierto && (
        <div role="listbox" aria-label="Cómo se le paga" className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg overflow-hidden max-h-72 overflow-y-auto">
          {FORMAS.map((f) => {
            const I = f.icono;
            const elegido = actual?.texto === f.texto && !otra;
            return (
              <button key={f.texto} type="button" role="option" aria-selected={elegido}
                onClick={() => { setEscribiendo(false); onCambio(f.texto); setAbierto(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[0.8125rem] text-slate-800 dark:text-neutral-100 cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800">
                <I className={`w-4 h-4 shrink-0 ${f.color}`} /> <span className="flex-1">{f.texto}</span>
                {elegido && <Check className="w-4 h-4 text-[var(--primary)]" />}
              </button>
            );
          })}
          <button type="button" role="option" aria-selected={otra}
            onClick={() => { if (!otra) onCambio(''); setEscribiendo(true); setAbierto(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[0.8125rem] text-slate-800 dark:text-neutral-100 cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800 border-t border-slate-100 dark:border-neutral-800">
            <PencilLine className="w-4 h-4 shrink-0 text-slate-400" /> <span className="flex-1">Otra…</span>
          </button>
        </div>
      )}
    </div>
  );
};
