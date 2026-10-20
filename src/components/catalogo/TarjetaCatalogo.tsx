import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Aparecer } from '../ui/movimiento';
import type { PriceTier } from '../../types';

/**
 * Un servicio o producto en la lista del catálogo, como una tarjeta chica que
 * se entiende de un vistazo: su foto, su nombre, lo que es y lo que cuesta.
 * Tocar la foto o el nombre abre su editor; ahí está la tabla completa de
 * precios. Abajo, los interruptores de la asistente y de la Vitrina.
 */
export const TarjetaCatalogo: React.FC<{
  indice: number;
  foto: React.ReactNode;
  nombre: string;
  onEditar: () => void;
  /** Los botones chiquitos de arriba a la derecha (BotonDeTarjeta) */
  acciones: React.ReactNode;
  /** La sede y otras marcas, debajo del nombre */
  etiquetas?: React.ReactNode;
  /** Categoría, minutos o existencias */
  datos: React.ReactNode;
  /** El precio, grande */
  precio: React.ReactNode;
  /** Lo que se despliega bajo el precio (las opciones, el precio en cada sede) */
  detalle?: { titulo: string; contenido: React.ReactNode } | null;
  /** Los interruptores */
  interruptores: React.ReactNode;
  /** Lo que va al final (copiar a otra sede) */
  pie?: React.ReactNode;
}> = ({ indice, foto, nombre, onEditar, acciones, etiquetas, datos, precio, detalle, interruptores, pie }) => (
  <Aparecer
    indice={indice}
    className="flex flex-col gap-2.5 p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs transition hover:border-[var(--primary)]/40"
  >
    <div className="flex gap-3">
      <button type="button" onClick={onEditar} aria-label={`Editar ${nombre}`} className="shrink-0 self-start rounded-2xl ios-touch cursor-pointer">
        {foto}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-1.5">
          <button type="button" onClick={onEditar} className="min-w-0 text-left cursor-pointer">
            <h4 className="font-bold text-[0.8125rem] leading-snug text-slate-900 dark:text-white line-clamp-2 hover:text-[var(--primary)] transition">
              {nombre}
            </h4>
          </button>
          <div className="flex items-center gap-0.5 shrink-0 -mt-0.5 -mr-1">{acciones}</div>
        </div>
        {etiquetas && <div className="flex flex-wrap items-center gap-1 mt-0.5">{etiquetas}</div>}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-[0.6875rem] text-slate-500 dark:text-neutral-400">{datos}</div>
        <div className="mt-1.5">{precio}</div>
      </div>
    </div>

    {detalle && <Desplegable titulo={detalle.titulo}>{detalle.contenido}</Desplegable>}

    <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-100 dark:border-neutral-800/60">{interruptores}</div>
    {pie}
  </Aparecer>
);

/** Un botón chiquito de la tarjeta: solo el ícono, con su nombre al pasar encima */
export const BotonDeTarjeta: React.FC<{
  titulo: string;
  onClick: () => void;
  peligro?: boolean;
  children: React.ReactNode;
}> = ({ titulo, onClick, peligro, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={titulo}
    aria-label={titulo}
    className={`grid place-items-center size-7 rounded-full text-slate-400 dark:text-neutral-500 transition ios-touch cursor-pointer hover:bg-slate-100 dark:hover:bg-neutral-800 ${peligro ? 'hover:text-rose-500' : 'hover:text-[var(--primary)]'}`}
  >
    {children}
  </button>
);

/** Lo que se abre y se cierra dentro de la tarjeta, para que la lista quede corta */
const Desplegable: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => {
  const [abierto, setAbierto] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setAbierto(a => !a)}
        aria-expanded={abierto}
        className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-slate-500 dark:text-neutral-400 hover:text-[var(--primary)] cursor-pointer"
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${abierto ? 'rotate-180' : ''}`} />
        {titulo}
      </button>
      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-1.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/** Las opciones de precio que valen de un artículo; sin ninguna, una con su precio base */
export function opcionesDe(lista: PriceTier[] | undefined, nombreBase: string, precioBase: number): PriceTier[] {
  const v = (lista ?? []).filter((t: any) => t && typeof t === 'object' && !Array.isArray(t));
  return v.length > 0 ? v : [{ id: '1', name: nombreBase, price: precioBase, isDefault: true }];
}

/** El precio grande de la tarjeta: «desde» con varias opciones, lo que vale en la moneda del salón y una nota */
export const PrecioDeTarjeta: React.FC<{
  desde: boolean;
  precio: string;
  /** Lo mismo en la moneda base, si el precio está en otra */
  aproximado?: string | null;
  nota?: string | null;
  extra?: React.ReactNode;
}> = ({ desde, precio, aproximado, nota, extra }) => (
  <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
    {desde && <span className="text-[0.6875rem] text-slate-400">desde</span>}
    <span className="text-[0.9375rem] font-black tabular-nums text-slate-900 dark:text-white">{precio}</span>
    {aproximado && <span className="text-[0.6875rem] text-slate-400 tabular-nums">≈ {aproximado}</span>}
    {extra}
    {nota && <span className="basis-full text-[0.6875rem] text-slate-400 dark:text-neutral-500">{nota}</span>}
  </div>
);

/** La lista corta de opciones de precio, dentro del desplegable de la tarjeta */
export const OpcionesDeTarjeta: React.FC<{
  opciones: { id: string; nombre: string; detalle?: string; marca?: string | null; precio: string }[];
}> = ({ opciones }) => (
  <ul className="p-1.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 divide-y divide-slate-200/60 dark:divide-neutral-700/60">
    {opciones.map(o => (
      <li key={o.id} className="flex items-center justify-between gap-2 px-1.5 py-1">
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-slate-800 dark:text-neutral-100">
            <span className="truncate">{o.nombre}</span>
            {o.marca && (
              <span className="shrink-0 text-[0.625rem] font-bold px-1.5 rounded-full bg-slate-200 dark:bg-neutral-700 text-slate-600 dark:text-neutral-300">{o.marca}</span>
            )}
          </span>
          {o.detalle && <span className="block text-[0.6875rem] text-slate-400 truncate">{o.detalle}</span>}
        </span>
        <span className="shrink-0 text-[0.75rem] font-bold tabular-nums text-slate-900 dark:text-white">{o.precio}</span>
      </li>
    ))}
  </ul>
);
