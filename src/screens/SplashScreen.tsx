import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, WifiOff, RefreshCw, ArrowRight, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LogoLalan } from '../components/ui/LogoLalan';

export const SplashScreen: React.FC = () => {
  const { closeSplash } = useApp();
  const [progress, setProgress] = useState(25);
  const [loadingStep, setLoadingStep] = useState('Iniciando entorno Lalan AI...');
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [retrying, setRetrying] = useState(false);

  // Monitor connectivity state
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLoadingStep('¡Conexión restablecida! Cargando datos...');
      setProgress(85);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLoadingStep('Modo sin conexión detectado.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Standard boot animation sequence
  useEffect(() => {
    if (!isOnline) {
      setProgress(100);
      setLoadingStep('Modo sin conexión activo');
      return;
    }

    const timer1 = setTimeout(() => {
      setProgress(55);
      setLoadingStep('Conectando canales inteligentes (WhatsApp/IG)...');
    }, 250);

    const timer2 = setTimeout(() => {
      setProgress(85);
      setLoadingStep('Sincronizando agenda, logística y hospitalidad...');
    }, 550);

    const timer3 = setTimeout(() => {
      setProgress(100);
      setLoadingStep('¡Todo listo! Bienvenido a Lalan AI');
    }, 850);

    const timer4 = setTimeout(() => {
      closeSplash();
    }, 1200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [closeSplash, isOnline]);

  const handleRetry = useCallback(() => {
    setRetrying(true);
    setLoadingStep('Comprobando conexión...');
    setTimeout(() => {
      const onlineNow = typeof navigator !== 'undefined' ? navigator.onLine : true;
      setIsOnline(onlineNow);
      setRetrying(false);
      if (onlineNow) {
        setLoadingStep('¡Conectado! Entrando...');
        setTimeout(() => closeSplash(), 500);
      } else {
        setLoadingStep('Sin internet todavía · Modo sin conexión listo');
      }
    }, 1000);
  }, [closeSplash]);

  return (
    <div
      id="splash-screen-container"
      className="absolute inset-0 z-50 flex flex-col items-center justify-between p-6 bg-gradient-to-b from-neutral-950 via-[#130d17] to-neutral-950 text-white select-none overflow-hidden"
      style={{
        paddingTop: 'var(--header-safe-pt, max(calc(env(safe-area-inset-top, 0px) + 12px), 52px))',
        paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 16px), 24px)',
      }}
    >
      {/* Decorative ambient glowing orbs */}
      <div className="absolute top-1/4 -left-20 w-64 h-64 rounded-full bg-[var(--primary)]/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 -right-20 w-72 h-72 rounded-full bg-purple-600/15 blur-3xl pointer-events-none" />

      {/* Top subtle badge */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-[0.75rem] font-medium tracking-wide text-neutral-200"
      >
        <Sparkles className="w-3.5 h-3.5 text-[var(--primary)] animate-spin" />
        <span>Live Assistant for Logistics, Appointments & Networking</span>
      </motion.div>

      {/* Central Animated Luxury Emblem */}
      <div className="flex flex-col items-center text-center my-auto">
        <motion.div
          initial={{ scale: 0.6, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 15, stiffness: 200 }}
          className="relative w-24 h-24 mb-5 rounded-3xl bg-gradient-to-tr from-[var(--primary)] via-indigo-500 to-amber-300 p-0.5 shadow-[0_0_50px_rgba(225,29,72,0.4)] flex items-center justify-center"
        >
          <div className="w-full h-full rounded-[22px] bg-neutral-950/90 backdrop-blur-xl flex items-center justify-center relative overflow-hidden">
            {/* Shimmer effect */}
            <motion.div
              animate={{ x: ['-100%', '200%'] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
              className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
            />
            <LogoLalan className="w-12 h-12 text-[var(--primary)]" titulo="Lalan" />
          </div>
        </motion.div>

        {/* Brand Title */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-white mb-2"
        >
          Lalan AI
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-xs text-neutral-400 max-w-xs font-medium tracking-wide uppercase"
        >
          Logistics • Appointments • Hospitality • Networking
        </motion.p>
      </div>

      {/* Bottom Area: Progress or Offline Notice */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-sm flex flex-col items-center"
      >
        <AnimatePresence mode="wait">
          {!isOnline ? (
            /* ── Offline Notice Card ── */
            <motion.div
              key="offline-card"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full p-4 rounded-2xl bg-neutral-900/90 border border-amber-500/30 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center space-y-3"
            >
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                <WifiOff className="w-3.5 h-3.5 animate-pulse" />
                <span>Sin conexión a internet</span>
              </div>

              <p className="text-xs text-neutral-300 leading-relaxed px-1">
                La aplicación y tus datos locales están disponibles. Puedes continuar trabajando en modo sin conexión.
              </p>

              <div className="w-full grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={retrying}
                  className="py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
                  <span>{retrying ? 'Probando...' : 'Reintentar'}</span>
                </button>

                <button
                  type="button"
                  onClick={closeSplash}
                  className="py-2.5 px-3 rounded-xl bg-[var(--primary)] hover:opacity-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ) : (
            /* ── Normal Online Loading Progress ── */
            <motion.div
              key="online-loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col items-center"
            >
              <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden mb-3 p-0.5 border border-white/5">
                <motion.div
                  className="h-full bg-gradient-to-r from-[var(--primary)] to-rose-400 rounded-full"
                  style={{ width: `${progress}%` }}
                  transition={{ ease: 'easeOut', duration: 0.3 }}
                />
              </div>

              <span className="text-[0.75rem] text-neutral-400 font-mono tracking-tight text-center">
                {loadingStep}
              </span>

              {/* Quick Skip button */}
              <button
                type="button"
                onClick={closeSplash}
                className="mt-4 text-[0.6875rem] text-neutral-500 hover:text-neutral-300 transition uppercase tracking-widest cursor-pointer py-1 px-3"
              >
                Entrar directamente →
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
