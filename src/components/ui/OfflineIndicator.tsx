import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-amber-600/90 text-white px-3.5 py-1.5 rounded-full text-xs font-medium shadow-lg backdrop-blur-sm pointer-events-none select-none top-safe-offset"
          style={{ top: 'var(--banner-safe-top, max(calc(env(safe-area-inset-top, 0px) + 8px), 52px))' }}
        >
          <WifiOff className="w-3.5 h-3.5 shrink-0 animate-pulse" />
          <span>Modo sin conexión · Interfaz activa en memoria</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
