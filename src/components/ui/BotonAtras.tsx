import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useIrAtras } from '../../hooks/useIrAtras';

const TAMANOS = {
  chico: { boton: 'text-[0.75rem] gap-0.5', icono: 'w-4 h-4' },
  normal: { boton: 'text-sm gap-1', icono: 'w-5 h-5' },
  grande: { boton: 'text-lg gap-1', icono: 'w-6 h-6' },
} as const;

const TONOS = {
  primario: 'text-[var(--primary)]',
  suave: 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-white',
} as const;

interface BotonAtrasProps {
  /** Lo que hace el botón, y también el gesto y el clic derecho */
  onVolver: () => void;
  /** "Atrás" si no se dice otra cosa ("Pedidos", "Todos los roles"…). `null`: solo la flecha */
  texto?: React.ReactNode | null;
  /** En el teléfono, solo la flecha (el texto sale en la computadora) */
  textoSoloEnPc?: boolean;
  /**
   * Si hay a dónde volver. Con `false` el botón no se ve (guarda su lugar) y el
   * gesto y el clic derecho no hacen nada.
   */
  activo?: boolean;
  /** El "atrás" es de una ventana: el clic derecho dentro de ella también vuelve */
  enDialogo?: boolean;
  tamano?: keyof typeof TAMANOS;
  tono?: keyof typeof TONOS;
  /** Solo para acomodarlo (márgenes, `sm:hidden`…), no para cambiarle la cara */
  className?: string;
  id?: string;
  ariaLabel?: string;
}

/**
 * El botón de "atrás" de toda la app. Siempre se ve igual (la flecha y su
 * texto) y siempre trae lo mismo, sin que cada pantalla se acuerde:
 * - En el teléfono, deslizar desde el borde izquierdo, como en el iPhone.
 * - En la computadora, el clic derecho.
 *
 * Toda pantalla o ventana con un "atrás" usa este botón, no uno propio.
 */
export const BotonAtras: React.FC<BotonAtrasProps> = ({
  onVolver,
  texto = 'Atrás',
  textoSoloEnPc = false,
  activo = true,
  enDialogo = false,
  tamano = 'normal',
  tono = 'primario',
  className = '',
  id,
  ariaLabel,
}) => {
  useIrAtras(onVolver, activo, { enDialogo });
  const t = TAMANOS[tamano];
  const nombre = ariaLabel ?? (typeof texto === 'string' ? texto : 'Atrás');
  return (
    <button
      id={id}
      type="button"
      onClick={onVolver}
      disabled={!activo}
      aria-label={texto === null || textoSoloEnPc ? nombre : ariaLabel}
      className={`inline-flex items-center shrink-0 whitespace-nowrap font-semibold ios-touch cursor-pointer active:scale-95 transition-transform py-1 -ml-1 pr-2 ${t.boton} ${TONOS[tono]} ${activo ? '' : 'invisible'} ${className}`}
    >
      <ChevronLeft className={`${t.icono} stroke-[2.5] shrink-0`} aria-hidden="true" />
      {texto !== null && <span className={textoSoloEnPc ? 'hidden sm:inline' : ''}>{texto}</span>}
    </button>
  );
};
