import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Los números que se muestran: 1 … 4 5 6 … 12 */
function numeros(pagina: number, paginas: number): (number | '…')[] {
  if (paginas <= 7) return Array.from({ length: paginas }, (_, i) => i + 1);
  const r: (number | '…')[] = [1];
  const desde = Math.max(2, pagina - 1);
  const hasta = Math.min(paginas - 1, pagina + 1);
  if (desde > 2) r.push('…');
  for (let i = desde; i <= hasta; i++) r.push(i);
  if (hasta < paginas - 1) r.push('…');
  r.push(paginas);
  return r;
}

interface Props {
  pagina: number;
  paginas: number;
  total: number;
  porPagina: number;
  onIr: (pagina: number) => void;
}

/** "1 a 25 de 132" y los botones de página. Con una sola página no se muestra nada */
export const Paginas: React.FC<Props> = ({ pagina, paginas, total, porPagina, onIr }) => {
  if (paginas <= 1) return null;
  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(total, pagina * porPagina);
  const base = 'min-w-[36px] h-9 px-2 rounded-xl text-[0.8125rem] font-semibold flex items-center justify-center transition';
  return (
    <nav aria-label="Páginas" className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 dark:border-neutral-800">
      <span className="text-[0.75rem] text-slate-500 dark:text-neutral-400">{desde} a {hasta} de {total}</span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onIr(pagina - 1)} disabled={pagina <= 1} aria-label="Página anterior"
          className={`${base} border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 disabled:opacity-40 cursor-pointer disabled:cursor-default`}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        {numeros(pagina, paginas).map((n, i) => n === '…'
          ? <span key={`p${i}`} className="px-1 text-slate-400" aria-hidden="true">…</span>
          : (
            <button key={n} type="button" onClick={() => onIr(n)} aria-current={n === pagina ? 'page' : undefined}
              className={`${base} hidden sm:flex ${n === pagina ? '!flex bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 cursor-pointer'}`}>
              {n}
            </button>
          ))}
        <button type="button" onClick={() => onIr(pagina + 1)} disabled={pagina >= paginas} aria-label="Página siguiente"
          className={`${base} border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 disabled:opacity-40 cursor-pointer disabled:cursor-default`}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
};
