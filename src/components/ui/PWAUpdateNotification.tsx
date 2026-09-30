import React, { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

/** Si la versión nueva llega en estos primeros segundos, se instala sola: la persona aún no está trabajando */
const SEGUNDOS_ARRANQUE = 8;
/** Si el aviso no recarga la página en este tiempo, se recarga igual */
const ESPERA_RECARGA_MS = 3000;
const inicio = Date.now();

/**
 * Actualizaciones de la app sin estorbar:
 *  - Al abrirla (primeros segundos) o si está en segundo plano: se actualiza sola.
 *  - Si la persona está trabajando: aviso con un botón grande; y si no lo toca,
 *    se actualiza sola la próxima vez que salga de la app. Nunca recarga a
 *    mitad de lo que alguien está escribiendo.
 */
export const PWAUpdateNotification: React.FC = () => {
  const [estado, setEstado] = useState<'nada' | 'aviso' | 'actualizando'>('nada');
  const esperando = useRef<ServiceWorker | null>(null);
  const aplicado = useRef(false);

  const aplicar = (visible: boolean) => {
    if (aplicado.current || !esperando.current) return;
    aplicado.current = true;
    if (visible) setEstado('actualizando');
    esperando.current.postMessage({ type: 'SKIP_WAITING' });
    // La recarga la hace "controllerchange"; esto es por si no llega
    setTimeout(() => window.location.reload(), ESPERA_RECARGA_MS);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const hayNueva = (w: ServiceWorker) => {
      esperando.current = w;
      if (document.visibilityState === 'hidden') aplicar(false);
      else if (Date.now() - inicio < SEGUNDOS_ARRANQUE * 1000) aplicar(true);
      else setEstado((e) => (e === 'nada' ? 'aviso' : e));
    };
    const vigilar = (w: ServiceWorker) => {
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) hayNueva(w);
      });
    };

    const revisar = () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        if (reg.waiting && navigator.serviceWorker.controller) { hayNueva(reg.waiting); return; }
        if (reg.installing) vigilar(reg.installing);
        reg.update().catch(() => {});
      }).catch(() => {});
    };
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.addEventListener('updatefound', () => { if (reg.installing) vigilar(reg.installing); });
    }).catch(() => {});

    const alCambiarVisibilidad = () => {
      // Salió de la app con una versión esperando: se instala ahora, sin que lo note
      if (document.visibilityState === 'hidden') { if (esperando.current) aplicar(false); }
      else revisar();
    };

    let recargando = false;
    const alCambiarControl = () => { if (!recargando) { recargando = true; window.location.reload(); } };

    revisar();
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    navigator.serviceWorker.addEventListener('controllerchange', alCambiarControl);
    const cada = setInterval(revisar, 5 * 60 * 1000);
    return () => {
      clearInterval(cada);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      navigator.serviceWorker.removeEventListener('controllerchange', alCambiarControl);
    };
  }, []);

  return (
    <AnimatePresence>
      {estado !== 'nada' && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="fixed inset-x-3 z-[350] mx-auto max-w-md flex items-center gap-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 pl-4 pr-2 py-2 rounded-2xl shadow-2xl select-none"
          style={{ top: 'var(--banner-safe-top, max(calc(env(safe-area-inset-top, 0px) + 10px), 52px))' }}
          role="status"
        >
          {estado === 'actualizando' ? (
            <div className="flex items-center gap-2 py-2 text-sm font-semibold">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--primary)]" />
              Actualizando Lalan…
            </div>
          ) : (<>
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="flex-1 min-w-0 leading-tight">
              <div className="text-sm font-bold">Hay una versión nueva</div>
              <div className="text-[11px] opacity-70">Tarda un segundo. Si no, se pone sola al salir de la app.</div>
            </div>
            <button
              type="button"
              onClick={() => aplicar(true)}
              className="shrink-0 min-h-[44px] flex items-center gap-1.5 px-4 rounded-xl bg-[var(--primary)] text-white font-bold text-sm shadow-sm active:scale-95 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </button>
          </>)}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
