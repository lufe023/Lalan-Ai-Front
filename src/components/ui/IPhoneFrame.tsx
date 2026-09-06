import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import { useApp } from '../../context/AppContext';

interface IPhoneFrameProps {
  children: React.ReactNode;
}

export const IPhoneFrame: React.FC<IPhoneFrameProps> = ({ children }) => {
  const { isDark } = useTheme();
  const { toast, dismissToast } = useApp();

  return (
    <div
      className={`h-dvh w-full overflow-hidden transition-colors duration-300 ${
        isDark ? 'bg-neutral-950' : 'bg-slate-100'
      }`}
    >
      {/* Mobile: centered narrow container. Desktop (lg+): full-width, no cap */}
      <div
        className={`relative w-full h-full max-w-[520px] mx-auto lg:max-w-none flex flex-col ${
          isDark ? 'bg-[#09090b]' : 'bg-[#f8fafc]'
        }`}
      >
        {/* Toast — bottom-center on mobile, bottom-right on desktop */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ y: 60, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              onClick={dismissToast}
              className="absolute bottom-20 left-4 right-4 lg:bottom-6 lg:left-auto lg:right-6 lg:w-96 z-50 p-3 rounded-2xl bg-neutral-900/95 text-white backdrop-blur-xl border border-white/15 shadow-2xl flex items-center justify-between gap-3 cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center text-white shrink-0 shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{toast.title}</div>
                  <div className="text-[11px] text-neutral-300 truncate">{toast.message}</div>
                </div>
              </div>
              <span className="text-[10px] text-neutral-400 shrink-0">Toca para cerrar</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Screen content fills available height */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
};
