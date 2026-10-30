import React from 'react';
import { CalendarDays, FileText, MapPin, MessageSquareText, ShoppingCart, UserRound, Wallet } from 'lucide-react';
import { botonDe, horaDe, type Aviso, type GrupoAviso } from '../../services/avisos';

/** Icono y color de cada grupo (los mismos en la campana y en la pantalla Avisos) */
export const ICONO_GRUPO: Record<GrupoAviso, { icono: React.ElementType; color: string }> = {
  chats:    { icono: MessageSquareText, color: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  agenda:   { icono: CalendarDays,      color: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
  compras:  { icono: ShoppingCart,      color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  caja:     { icono: Wallet,            color: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' },
  informes: { icono: FileText,          color: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' },
  cuenta:   { icono: UserRound,         color: 'bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300' },
};

interface Props {
  aviso: Aviso;
  /** Tocar el botón (o la fila): marcar leído y llevar a donde dice */
  onAbrir: (a: Aviso) => void;
  /** Marcar solo este como leído, sin ir a ningún lado */
  onLeer?: (a: Aviso) => void;
  /** Con varias sedes se dice de cuál es cada aviso */
  conSede?: boolean;
}

/**
 * Un aviso: qué pasó con el dato concreto, cuándo, de qué sede y el botón
 * que lleva a resolverlo (Abrir chat, Ver cita, Revisar pedido).
 */
export const FilaAviso: React.FC<Props> = ({ aviso: a, onAbrir, onLeer, conSede }) => {
  const g = ICONO_GRUPO[a.grupo] ?? ICONO_GRUPO.cuenta;
  const Icono = g.icono;
  return (
    <div className={`relative flex gap-3 px-4 py-3 ${a.leida ? '' : 'bg-[var(--primary)]/[0.06]'}`}>
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${g.color}`} aria-hidden="true">
        <Icono className="w-[18px] h-[18px]" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-[0.8125rem] leading-snug text-slate-900 dark:text-white ${a.leida ? 'font-medium' : 'font-bold'}`}>{a.titulo}</p>
          <span className="text-[0.6875rem] text-slate-500 dark:text-neutral-400 whitespace-nowrap shrink-0 mt-0.5">{horaDe(a.creadoEn)}</span>
        </div>
        <p className="text-[0.75rem] text-slate-600 dark:text-neutral-400 mt-0.5 line-clamp-2">{a.cuerpo}</p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <button
            type="button"
            onClick={() => onAbrir(a)}
            className="min-h-[32px] px-3 rounded-xl bg-[var(--primary)] text-white text-[0.75rem] font-bold cursor-pointer hover:opacity-90 transition"
          >
            {botonDe(a.ir, a.aviso)}
          </button>
          {!a.leida && onLeer && (
            <button
              type="button"
              onClick={() => onLeer(a)}
              className="min-h-[32px] px-2.5 rounded-xl text-[0.75rem] font-semibold text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer transition"
            >
              Marcar leído
            </button>
          )}
          {conSede && a.sede?.nombre && (
            <span className="inline-flex items-center gap-1 text-[0.6875rem] text-slate-500 dark:text-neutral-400">
              <MapPin className="w-3 h-3" aria-hidden="true" />{a.sede.nombre}
            </span>
          )}
        </div>
      </div>
      {!a.leida && <span className="absolute left-1.5 top-[1.6rem] w-1.5 h-1.5 rounded-full bg-rose-600" role="img" aria-label="Sin leer" />}
    </div>
  );
};
