import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wifi,
  Battery,
  Smartphone,
  Maximize2,
  Minimize2,
  Sparkles,
  Sun,
  Moon,
  Volume2,
} from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import { useApp } from '../../context/AppContext';

interface IPhoneFrameProps {
  children: React.ReactNode;
}

export const IPhoneFrame: React.FC<IPhoneFrameProps> = ({ children }) => {
  const { isDark, themeMode, setThemeMode } = useTheme();
  const { isPhoneFrame, setIsPhoneFrame, toast, dismissToast } = useApp();
  const [time, setTime] = useState('9:41');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      id="app-viewport-container"
      className={`min-h-screen w-full flex flex-col items-center justify-center p-0 sm:p-4 md:p-6 transition-colors duration-300 ${
        isDark ? 'bg-neutral-950 text-slate-100' : 'bg-slate-100 text-slate-800'
      }`}
    >
      {/* Top Floating Control Bar for Demo / Developer Testing */}
      <div
        id="viewport-top-controls"
        className="w-full max-w-5xl mb-3 px-4 py-2 hidden sm:flex items-center justify-between rounded-2xl glass-ios shadow-sm text-xs font-medium"
      >
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold tracking-wide flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" />
            Lalan AI • Logistics, Appointments & Networks
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400">
            Expo Router / React Native Architecture
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Theme Toggle */}
          <button
            id="theme-quick-toggle-btn"
            onClick={() => setThemeMode(isDark ? 'light' : 'dark')}
            className="px-3 py-1.5 rounded-xl flex items-center gap-1.5 bg-slate-100 dark:bg-neutral-800 hover:opacity-80 transition ios-touch cursor-pointer"
            title="Cambiar tema claro/oscuro"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-500" />}
            <span>{isDark ? 'Modo Oscuro' : 'Modo Claro'}</span>
          </button>

          {/* Toggle Device Frame / Fullscreen view */}
          <button
            id="device-frame-toggle-btn"
            onClick={() => setIsPhoneFrame(!isPhoneFrame)}
            className="px-3 py-1.5 rounded-xl flex items-center gap-1.5 bg-[var(--primary)] text-white hover:opacity-90 transition ios-touch cursor-pointer font-semibold shadow-sm"
          >
            {isPhoneFrame ? (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Expandir Pantalla</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5" />
                <span>Marco iPhone iOS</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div
        id="iphone-wrapper"
        className={`relative transition-all duration-300 flex flex-col ${
          isPhoneFrame
            ? 'w-full sm:w-[412px] h-screen sm:h-[860px] sm:max-h-[92vh] sm:rounded-[50px] sm:border-[10px] sm:border-neutral-900 sm:dark:border-neutral-800 sm:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] overflow-hidden ring-1 ring-white/20'
            : 'w-full max-w-2xl h-screen sm:h-[90vh] sm:rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-neutral-800'
        } ${isDark ? 'bg-[#09090b]' : 'bg-[#f8fafc]'}`}
      >
        {/* Dynamic Island / iOS Status Bar */}
        <div
          id="ios-status-bar"
          className="w-full pt-2 pb-1 px-6 flex items-center justify-between text-xs font-semibold z-40 select-none shrink-0"
        >
          {/* Time */}
          <span className="w-16 tracking-tight text-center">{time}</span>

          {/* Dynamic Island Pill (Interactive) */}
          <div
            id="dynamic-island"
            className="h-6 px-4 bg-black rounded-full flex items-center justify-center gap-2 shadow-inner border border-neutral-800 text-white text-[10px]"
          >
            <div className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" />
            <span className="font-mono text-[9px] text-neutral-300">Meta Webhook Live</span>
          </div>

          {/* Right Status Icons */}
          <div className="w-16 flex items-center justify-end gap-1.5 opacity-90">
            <span className="text-[10px] font-bold">5G</span>
            <Wifi className="w-3.5 h-3.5" />
            <Battery className="w-4 h-4 fill-current" />
          </div>
        </div>

        {/* Dynamic Island Expanded Banner / Toast Alerts */}
        <AnimatePresence>
          {toast && (
            <motion.div
              id="ios-toast-alert"
              initial={{ y: -60, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -60, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              onClick={dismissToast}
              className="absolute top-11 left-4 right-4 z-50 p-3 rounded-2xl bg-neutral-900/95 text-white backdrop-blur-xl border border-white/15 shadow-2xl flex items-center justify-between gap-3 cursor-pointer"
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

        {/* Body Content / Screen Viewport */}
        <div id="screen-viewport" className="flex-1 w-full overflow-hidden flex flex-col relative">
          {children}
        </div>

        {/* iOS Home Indicator Bar */}
        <div
          id="ios-home-indicator-bar"
          className="w-full h-5 flex items-center justify-center shrink-0 z-40 bg-transparent"
        >
          <div className="w-32 h-1 rounded-full bg-neutral-400/40 dark:bg-neutral-600/50" />
        </div>
      </div>
    </div>
  );
};
