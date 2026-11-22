import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCarrilHorizontal } from '../../hooks/useCarrilHorizontal';

interface Props {
  children: React.ReactNode;
  /** Clases de la fila que corre (separación, márgenes) */
  className?: string;
  /** Nombre para lectores de pantalla */
  etiqueta?: string;
}

const flecha = 'absolute top-1/2 -translate-y-1/2 z-[1] w-8 h-8 rounded-full bg-white/95 dark:bg-neutral-800/95 border border-slate-200/80 dark:border-white/10 shadow-md text-slate-600 dark:text-neutral-200 items-center justify-center cursor-pointer hidden [@media(pointer:fine)]:flex';

/**
 * Fila de botones que corre de lado. Con el dedo se desliza; con el mouse se
 * arrastra, corre con la ruedita y tiene flechas a los lados cuando hay más.
 */
export const CarrilHorizontal: React.FC<Props> = ({ children, className = '', etiqueta }) => {
  const { ref, puede, correr } = useCarrilHorizontal<HTMLDivElement>();
  return (
    <div className="relative min-w-0">
      {puede.izquierda && (
        <button type="button" onClick={() => correr(-1)} aria-label="Ver los anteriores" className={`${flecha} left-0`}>
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      <div ref={ref} role={etiqueta ? 'group' : undefined} aria-label={etiqueta}
        className={`flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none ${className}`}
        style={{
          // Donde sigue habiendo más, el borde se desvanece
          WebkitMaskImage: `linear-gradient(to right, ${puede.izquierda ? 'transparent 0, #000 40px' : '#000 0'}, ${puede.derecha ? '#000 calc(100% - 40px), transparent 100%' : '#000 100%'})`,
          maskImage: `linear-gradient(to right, ${puede.izquierda ? 'transparent 0, #000 40px' : '#000 0'}, ${puede.derecha ? '#000 calc(100% - 40px), transparent 100%' : '#000 100%'})`,
        }}>
        {children}
      </div>
      {puede.derecha && (
        <button type="button" onClick={() => correr(1)} aria-label="Ver más" className={`${flecha} right-0`}>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
