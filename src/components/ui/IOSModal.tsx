import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
}) => {
  // Prevent body scroll when open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div id={id} className="absolute inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />

          {/* Bottom Sheet Modal */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className="relative w-full bg-white dark:bg-neutral-900 rounded-t-[28px] shadow-2xl flex flex-col border-t border-white/20 dark:border-neutral-800 z-10 overflow-hidden"
            style={{ height: fixedHeight ? height : undefined, maxHeight: fixedHeight ? undefined : height }}
          >
            {/* Grabber Bar */}
            <div className="w-full flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            </div>

            {/* Header */}
            <div className="px-5 pt-2 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-neutral-800/80">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-neutral-700 transition ios-touch cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content scrollable area */}
            <div className="p-5 overflow-y-auto hide-scrollbar flex-1 space-y-4">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
