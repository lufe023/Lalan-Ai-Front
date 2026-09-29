import React, { useEffect, useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const PWAUpdateNotification: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // Verificar actualizaciones periódicamente (cada 15 minutos)
    const interval = setInterval(() => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) reg.update().catch(() => {});
      });
    }, 15 * 60 * 1000);

    // Verificar actualizaciones cada vez que el usuario vuelve a la app (desbloquea el teléfono o cambia de app)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (reg) reg.update().catch(() => {});
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Detectar si el Service Worker descargó una nueva versión
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;

      // Si ya hay un worker en espera de activación
      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
        setUpdateAvailable(true);
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setUpdateAvailable(true);
          }
        });
      });
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
    // Pequeño retardo de seguridad o recarga directa si controllerchange no dispara de inmediato
    setTimeout(() => {
      window.location.reload();
    }, 200);
  };

  return (
    <AnimatePresence>
      {updateAvailable && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="fixed left-1/2 -translate-x-1/2 z-[250] flex items-center gap-3 bg-neutral-900/95 dark:bg-white/95 text-white dark:text-neutral-900 px-4 py-2 rounded-2xl shadow-2xl border border-white/10 dark:border-black/10 backdrop-blur-md text-xs select-none top-safe-offset"
          style={{ top: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 16px)' }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="font-medium">Nueva versión disponible</span>
          </div>
          <button
            type="button"
            onClick={handleUpdate}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[var(--primary)] text-white font-bold text-[11px] shadow-sm hover:opacity-90 active:scale-95 transition cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Actualizar</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
