import React, { useEffect, useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const PWAUpdateNotification: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const checkRegistration = () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;

        // Si ya hay un worker descargado en espera
        if (reg.waiting) {
          setWaitingWorker(reg.waiting);
          setUpdateAvailable(true);
          return;
        }

        // Si se está instalando uno nuevo en este momento
        if (reg.installing) {
          const installing = reg.installing;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(installing);
              setUpdateAvailable(true);
            }
          });
        }

        // Escuchar si encuentra una actualización
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

        // Forzar consulta al servidor
        reg.update().catch(() => {});
      }).catch(() => {});
    };

    // Chequeo inicial
    checkRegistration();

    // Chequear al reenfocar o volver de otra app / desbloquear iPhone
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkRegistration();
      }
    };
    window.addEventListener('focus', checkRegistration);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Chequeo periódico cada 5 minutos
    const interval = setInterval(checkRegistration, 5 * 60 * 1000);

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkRegistration);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
    // Breve pausa para que el worker tome control antes de recargar
    setTimeout(() => {
      window.location.reload();
    }, 250);
  };

  return (
    <AnimatePresence>
      {updateAvailable && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="fixed left-1/2 -translate-x-1/2 z-[350] flex items-center gap-3 bg-neutral-900/95 dark:bg-white/95 text-white dark:text-neutral-900 px-4 py-2.5 rounded-2xl shadow-2xl border border-white/10 dark:border-black/10 backdrop-blur-md text-xs select-none"
          style={{ top: 'var(--banner-safe-top, max(calc(env(safe-area-inset-top, 0px) + 10px), 52px))' }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="font-semibold">Nueva versión disponible</span>
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
