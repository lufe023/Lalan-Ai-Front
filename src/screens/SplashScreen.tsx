import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Flower2, Bot, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const SplashScreen: React.FC = () => {
  const { closeSplash } = useApp();
  const [progress, setProgress] = useState(15);
  const [loadingStep, setLoadingStep] = useState('Iniciando entorno Lalan AI...');

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setProgress(45);
      setLoadingStep('Conectando canales inteligentes (WhatsApp/IG)...');
    }, 500);

    const timer2 = setTimeout(() => {
      setProgress(85);
      setLoadingStep('Sincronizando agenda, logística y hospitalidad...');
    }, 1100);

    const timer3 = setTimeout(() => {
      setProgress(100);
      setLoadingStep('¡Todo listo! Bienvenido a Lalan AI');
    }, 1700);

    const timer4 = setTimeout(() => {
      closeSplash();
    }, 2200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [closeSplash]);

  return (
    <div
      id="splash-screen-container"
      className="absolute inset-0 z-50 flex flex-col items-center justify-between p-8 bg-gradient-to-b from-neutral-950 via-[#130d17] to-neutral-950 text-white select-none overflow-hidden"
    >
      {/* Decorative ambient glowing orbs */}
      <div className="absolute top-1/4 -left-20 w-64 h-64 rounded-full bg-[var(--primary)]/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 -right-20 w-72 h-72 rounded-full bg-purple-600/15 blur-3xl pointer-events-none" />

      {/* Top subtle badge */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="pt-6 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-[11px] font-medium tracking-wide text-neutral-200"
      >
        <Sparkles className="w-3 h-3 text-[var(--primary)] animate-spin" />
        <span>Live Assistant for Logistics, Appointments & Networks</span>
      </motion.div>

      {/* Central Animated Luxury Emblem */}
      <div className="flex flex-col items-center text-center my-auto">
        <motion.div
          initial={{ scale: 0.6, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 15, stiffness: 200 }}
          className="relative w-28 h-28 mb-6 rounded-3xl bg-gradient-to-tr from-[var(--primary)] via-indigo-500 to-amber-300 p-0.5 shadow-[0_0_50px_rgba(225,29,72,0.4)] flex items-center justify-center"
        >
          <div className="w-full h-full rounded-[22px] bg-neutral-950/90 backdrop-blur-xl flex items-center justify-center relative overflow-hidden">
            {/* Shimmer effect */}
            <motion.div
              animate={{ x: ['-100%', '200%'] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
              className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
            />
            <Bot className="w-14 h-14 text-[var(--primary)] stroke-[1.5]" />
          </div>
        </motion.div>

        {/* Brand Title */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-4xl font-display font-bold tracking-tight text-white mb-2"
        >
          Lalan AI
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-xs text-neutral-300 max-w-xs font-medium tracking-wide uppercase"
        >
          Logistics • Appointments • Hospitality • Networks
        </motion.p>
      </div>

      {/* Bottom Loading Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-xs flex flex-col items-center pb-6"
      >
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden mb-3 p-0.5 border border-white/5">
          <motion.div
            className="h-full bg-gradient-to-r from-[var(--primary)] to-rose-400 rounded-full"
            style={{ width: `${progress}%` }}
            transition={{ ease: 'easeOut', duration: 0.3 }}
          />
        </div>

        <span className="text-[11px] text-neutral-400 font-mono tracking-tight">
          {loadingStep}
        </span>

        {/* Quick Skip */}
        <button
          onClick={closeSplash}
          className="mt-4 text-[10px] text-neutral-500 hover:text-neutral-300 transition uppercase tracking-widest cursor-pointer"
        >
          Entrar directamente →
        </button>
      </motion.div>
    </div>
  );
};
