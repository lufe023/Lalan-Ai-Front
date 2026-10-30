import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useDragControls, PanInfo } from 'motion/react';
import { X } from 'lucide-react';

interface IOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  id?: string;
  /** Fija la altura del sheet para evitar saltos al cambiar contenido (default: true) */
  fixedHeight?: boolean;
  /** Altura CSS del sheet, e.g. "88%" o "560px" (default: "88%") */
  height?: string;
  /**
   * Fuera de la app (la Vitrina pública): la hoja va pegada a la pantalla y no
   * a la página, y la página de atrás no se mueve mientras está abierta.
   */
  fijo?: boolean;
  /** No desmontar lo de dentro al cerrar: lo que se escribió sigue ahí al volver a abrir */
  mantenerMontado?: boolean;
  /** Colores propios en vez de los de la app (la Vitrina usa los del salón) */
  apariencia?: { hoja?: string; titulo?: string; subtitulo?: string; borde?: string; cerrar?: string; asa?: string };
}

export const IOSModal: React.FC<IOSModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  id = 'ios-sheet-modal',
  fixedHeight = true,
  height = '88%',
  fijo = false,
  mantenerMontado = false,
  apariencia,
}) => {
  const dragControls = useDragControls();
  const touchStartY = useRef<number | null>(null);

  // Fija: la página de atrás no se desplaza mientras la hoja está abierta
  useEffect(() => {
    if (!fijo || !isOpen) return;
    const html = document.documentElement;
    const antes = [html.style.overflow, document.body.style.overflow];
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => { [html.style.overflow, document.body.style.overflow] = antes; };
  }, [fijo, isOpen]);

  // Prevent body scroll when open and handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Direct touch handlers as a secondary guarantee for mobile touch devices
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current !== null) {
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;
      if (deltaY > 60) {
        onClose();
      }
      touchStartY.current = null;
    }
  };

  return (
    <AnimatePresence>
      {(isOpen || mantenerMontado) && (
        <div id={id} className={`${fijo ? 'fixed' : 'absolute'} inset-0 z-50 flex flex-col justify-end ${isOpen ? '' : 'pointer-events-none'}`}
          inert={!isOpen} aria-hidden={!isOpen}>
          {/* Backdrop */}
          {/* Sin desenfoque: en iPhone, un fondo con backdrop-filter que cambia de opacidad se pinta negro un cuadro */}
          <motion.div
            initial={false}
            animate={{ opacity: isOpen ? 1 : 0 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={`${isOpen ? 'fondo-hoja' : ''} absolute inset-0 bg-black/60`}
          />

          {/* Bottom Sheet Modal with native drag-to-dismiss */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={false}
            animate={{ y: isOpen ? 0 : '100%' }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.65 }}
            onDragEnd={(_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
              // Si se arrastra hacia abajo más de 70px o con velocidad de swipe, cerrar
              if (info.offset.y > 70 || info.velocity.y > 350) {
                onClose();
              }
            }}
            className={`${isOpen ? 'subir-hoja' : ''} relative w-full ${apariencia?.hoja ?? 'bg-white dark:bg-neutral-900 border-white/20 dark:border-neutral-800'} rounded-t-[28px] shadow-2xl flex flex-col border-t z-10 overflow-hidden`}
            style={{ height: fixedHeight ? height : undefined, maxHeight: fixedHeight ? undefined : height }}
          >
            {/* Grabber Bar & Handle touch area (amplia área táctil para arrastrar hacia abajo) */}
            <div
              className="w-full flex flex-col items-center pt-3 pb-2 touch-none cursor-grab active:cursor-grabbing select-none shrink-0 group"
              onPointerDown={(e) => dragControls.start(e)}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              title="Arrastra hacia abajo para cerrar"
            >
              <div className={`w-12 h-1.5 rounded-full ${apariencia?.asa ?? 'bg-neutral-300 dark:bg-neutral-600 group-hover:bg-neutral-400 dark:group-hover:bg-neutral-500'} group-active:scale-95 transition-all`} />
            </div>

            {/* Header (también permite arrastrar tocando en el fondo del encabezado) */}
            <div
              onPointerDown={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('button, a, input, select, textarea')) return;
                dragControls.start(e);
              }}
              onTouchStart={(e) => {
                const target = e.target as HTMLElement;
                if (!target.closest('button, a, input, select, textarea')) {
                  handleTouchStart(e);
                }
              }}
              onTouchEnd={(e) => {
                const target = e.target as HTMLElement;
                if (!target.closest('button, a, input, select, textarea')) {
                  handleTouchEnd(e);
                }
              }}
              className={`px-5 pt-0.5 pb-3 flex items-center justify-between border-b ${apariencia?.borde ?? 'border-slate-100 dark:border-neutral-800/80'} touch-none select-none shrink-0 cursor-grab active:cursor-grabbing`}
            >
              <div className="pointer-events-none">
                <h3 className={`text-lg font-bold ${apariencia?.titulo ?? 'text-slate-900 dark:text-white'} tracking-tight`}>
                  {title}
                </h3>
                {subtitle && (
                  <p className={`text-xs ${apariencia?.subtitulo ?? 'text-slate-500 dark:text-neutral-400'} mt-0.5`}>
                    {subtitle}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className={`w-8 h-8 rounded-full ${apariencia?.cerrar ?? 'bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-neutral-700'} flex items-center justify-center transition ios-touch cursor-pointer`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content scrollable area. Con color de texto propio: lo que no dice su color no queda negro en modo oscuro */}
            <div className={`p-5 overflow-y-auto overscroll-contain hide-scrollbar flex-1 space-y-4 ${apariencia ? '' : 'text-slate-900 dark:text-neutral-100'}`}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
