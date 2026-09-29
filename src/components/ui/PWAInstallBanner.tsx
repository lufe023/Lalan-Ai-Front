import React, { useEffect, useState } from 'react';
import { Download, Share, X, Smartphone, PlusSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Verificar si ya está corriendo instalada (standalone)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);

    // Verificar si es iOS (iPhone / iPad / iPod)
    const ua = window.navigator.userAgent.toLowerCase();
    const isApple = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isApple);

    const handleBeforePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforePrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforePrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  // Si ya está instalada o fue descartada, no mostrar nada
  if (isInstalled || dismissed) {
    return null;
  }

  // Solo mostrar en dispositivos móviles (o cuando el navegador soporta instalación)
  if (!isIOS && !deferredPrompt) {
    return null;
  }

  return (
    <>
      <div className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary)]/90 text-white px-3 py-2 text-xs flex items-center justify-between shadow-sm shrink-0 z-40 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
            <Smartphone className="w-3.5 h-3.5" />
          </div>
          <span className="truncate font-medium">
            {isIOS ? 'Instala Lalan en tu iPhone para abrir a pantalla completa' : 'Instala la app en tu teléfono'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <button
            onClick={handleInstallClick}
            className="px-2.5 py-1 rounded-md bg-white text-[var(--primary)] font-bold text-[11px] shadow-xs hover:bg-slate-50 transition cursor-pointer"
          >
            {isIOS ? 'Cómo instalar' : 'Instalar'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-white/80 hover:text-white transition cursor-pointer"
            title="Cerrar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Modal instructivo para iOS Safari */}
      <AnimatePresence>
        {showIOSModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
            onClick={() => setShowIOSModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-900 p-5 shadow-2xl text-slate-800 dark:text-neutral-100 border border-slate-200 dark:border-neutral-800"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[var(--primary)] flex items-center justify-center text-white">
                    <Download className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-sm">Instalar en tu iPhone</h3>
                </div>
                <button
                  onClick={() => setShowIOSModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-neutral-400 mb-4 leading-relaxed">
                Safari no descarga instaladores pesados: guarda la app directamente en tu pantalla de inicio en 2 pasos:
              </p>

              <div className="space-y-3 mb-5 text-xs">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-100 dark:border-neutral-700/40">
                  <div className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0 mt-0.5">
                    <Share className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 dark:text-neutral-200">1. Toca Compartir</span>
                    <p className="text-slate-500 dark:text-neutral-400 text-[11px] mt-0.5">
                      En la barra inferior de Safari, toca el botón con el cuadrado y la flecha hacia arriba.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-100 dark:border-neutral-700/40">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                    <PlusSquare className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 dark:text-neutral-200">2. Elige "Agregar al inicio"</span>
                    <p className="text-slate-500 dark:text-neutral-400 text-[11px] mt-0.5">
                      Desliza hacia abajo en el menú y selecciona <strong>"Agregar al inicio"</strong> (o <em>Add to Home Screen</em>).
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSModal(false)}
                className="w-full py-2.5 rounded-xl bg-[var(--primary)] text-white text-xs font-bold shadow-sm hover:opacity-95 transition"
              >
                Entendido
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
