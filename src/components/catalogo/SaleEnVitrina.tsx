import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import { usePlan } from '../../context/PlanContext';
import { IOSToggle } from '../ui/IOSToggle';

/**
 * Un interruptor de la tarjeta del catálogo: el ícono, qué es y cómo está
 * («La ofrece», «Pausada»), con el mismo interruptor animado del resto de la
 * app. Mientras guarda no se deja tocar.
 */
export const InterruptorDeCatalogo: React.FC<{
  icono: React.ReactNode;
  titulo: string;
  /** Lo que dice debajo: encendido y apagado */
  si: string;
  no: string;
  activo: boolean;
  /** El color encendido */
  color: string;
  cambiar: (v: boolean) => Promise<unknown> | void;
  guia?: string;
}> = ({ icono, titulo, si, no, activo, color, cambiar, guia }) => {
  const [ocupado, setOcupado] = useState(false);
  const alternar = async (v: boolean) => {
    setOcupado(true);
    try { await cambiar(v); } finally { setOcupado(false); }
  };
  return (
    <label data-guia={guia} className="flex items-center gap-2 min-w-0 cursor-pointer">
      <IOSToggle checked={activo} onChange={alternar} disabled={ocupado} activeColor={color} ariaLabel={titulo} />
      <span className="min-w-0 leading-tight">
        <span className="flex items-center gap-1 text-[0.75rem] font-bold text-slate-800 dark:text-neutral-100">
          <span className={activo ? '' : 'text-slate-400'} style={activo ? { color } : undefined}>{icono}</span>
          {titulo}
        </span>
        <span className={`block text-[0.6875rem] truncate ${activo ? 'text-slate-500 dark:text-neutral-400' : 'text-slate-400 dark:text-neutral-500'}`}>
          {activo ? si : no}
        </span>
      </span>
    </label>
  );
};

/**
 * El interruptor «Sale en la Vitrina» de un servicio o producto. Va al lado
 * del de la asistente porque es la misma pregunta: qué se publica. Sin la
 * Vitrina en el plan no aparece.
 */
export const SaleEnVitrina: React.FC<{ activo: boolean; cambiar: (v: boolean) => Promise<unknown> | void }> = ({ activo, cambiar }) => {
  const { tieneModulo } = usePlan();
  if (!tieneModulo('vitrina')) return null;
  return (
    <InterruptorDeCatalogo
      guia="sale-en-vitrina" icono={<Globe className="w-3.5 h-3.5" />} titulo="Vitrina"
      si="Publicado" no="Oculto" activo={activo} color={COLOR_VITRINA} cambiar={cambiar}
    />
  );
};

/** Los colores de los interruptores: morado la asistente, fucsia la Vitrina (los mismos de sus bloques) */
export const COLOR_ASISTENTE = '#a855f7';
export const COLOR_VITRINA = '#d946ef';

/** Cómo se ve el precio en la Vitrina: lo mismo que se elige para la asistente, pero aparte */
export type ModoPrecioVitrina = 'exacto' | 'desde' | 'consultar';

/**
 * Dentro del formulario de un servicio o producto, el bloque «Vitrina», hecho
 * igual que el de «Ofrecer con Bot IA»: si se publica y cómo se ve su precio.
 * Qué variantes se ven se marca en cada una, en la tabla de precios.
 */
export const VitrinaEnFormulario: React.FC<{
  activo: boolean;
  onActivo: (v: boolean) => void;
  modo: ModoPrecioVitrina;
  onModo: (m: ModoPrecioVitrina) => void;
  /** "servicio" o "producto": para los textos */
  que: 'servicio' | 'producto';
}> = ({ activo, onActivo, modo, onModo, que }) => {
  const { tieneModulo } = usePlan();
  if (!tieneModulo('vitrina')) return null;
  const opciones: { id: ModoPrecioVitrina; t: string; d: string }[] = [
    { id: 'exacto', t: 'Lo muestra', d: 'Cada precio que dejes ver' },
    { id: 'desde', t: 'Desde', d: '«Desde» el más bajo' },
    { id: 'consultar', t: 'No lo muestra', d: '«Precio en el salón»' },
  ];
  return (
    <div className="p-3.5 rounded-xl bg-fuchsia-500/8 dark:bg-fuchsia-500/10 border border-fuchsia-500/20 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400 flex items-center justify-center shrink-0">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-[0.8125rem] text-slate-900 dark:text-white block">Mostrar en la Vitrina</span>
            <span className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
              {activo ? `Tus clientas ven este ${que} en tu página y lo reservan` : `Este ${que} no sale en tu página`}
            </span>
          </div>
        </div>
        <button
          type="button" onClick={() => onActivo(!activo)} aria-pressed={activo} aria-label="Mostrar en la Vitrina"
          className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 focus:outline-none ${activo ? 'bg-fuchsia-500' : 'bg-slate-300 dark:bg-neutral-700'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${activo ? 'left-6' : 'left-0.5'}`} />
        </button>
      </div>
      {activo && (
        <div className="space-y-1.5">
          <div className="text-[0.6875rem] font-bold text-slate-700 dark:text-neutral-200">Cuando la Vitrina muestra el precio</div>
          <div className="grid grid-cols-3 gap-1.5">
            {opciones.map(o => (
              <button key={o.id} type="button" onClick={() => onModo(o.id)} aria-pressed={modo === o.id}
                className={`p-2 rounded-lg border text-left cursor-pointer ${modo === o.id
                  ? 'border-fuchsia-500 bg-fuchsia-500/10'
                  : 'border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900'}`}>
                <div className="text-[0.6875rem] font-bold text-slate-900 dark:text-white">{o.t}</div>
                <div className="text-[0.625rem] text-slate-500 dark:text-neutral-400 leading-tight">{o.d}</div>
              </button>
            ))}
          </div>
          {modo === 'exacto' && (
            <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">En la tabla de precios eliges cuáles se ven: desmarca «Se ve en la Vitrina» en los que quieras guardarte.</p>
          )}
        </div>
      )}
    </div>
  );
};
