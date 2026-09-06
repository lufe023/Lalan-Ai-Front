import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sun,
  Moon,
  ChevronLeft,
  Sparkles,
  ShieldCheck,
  UserCheck,
  Headphones,
  RotateCcw,
  LogOut,
  Palette,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../theme/ThemeContext';
import { UserRole } from '../../types';
import { ThemeCustomizerModal } from './ThemeCustomizerModal';

interface IOSHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  largeTitle?: boolean;
}

export const IOSHeader: React.FC<IOSHeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  largeTitle = true,
}) => {
  const { currentUser, logout } = useAuth();
  const { triggerSplash } = useApp();
  const { isDark, setThemeMode } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

  const getRoleIcon = (role?: UserRole) => {
    switch (role) {
      case 'admin':     return <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />;
      case 'assistant': return <UserCheck   className="w-3.5 h-3.5 text-sky-500"  />;
      case 'support':   return <Headphones  className="w-3.5 h-3.5 text-purple-500" />;
      default:          return <Sparkles    className="w-3.5 h-3.5 text-amber-500" />;
    }
  };

  const roleLabel: Record<UserRole, string> = {
    admin:     'Administradora',
    assistant: 'Asistente',
    support:   'Soporte',
  };

  return (
    <header id="ios-navigation-header" className="relative w-full shrink-0 z-30 pt-1 pb-2 px-4 select-none">
      <div className="flex items-center justify-between min-h-[40px]">
        {showBack ? (
          <button
            id="ios-header-back-btn"
            onClick={onBack}
            className="flex items-center gap-1 text-[var(--primary)] font-medium text-sm ios-touch cursor-pointer py-1 -ml-1 pr-2"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            <span>Atrás</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[var(--primary)]" />
            <span className="text-xs font-bold tracking-tight text-slate-800 dark:text-neutral-200">Lalan AI</span>
            <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">
              • {currentUser?.roleTitle || 'Asistente'}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {rightAction}

          {/* Dark / Light toggle */}
          <button
            id="ios-header-theme-toggle"
            onClick={() => setThemeMode(isDark ? 'light' : 'dark')}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-neutral-800/80 text-slate-600 dark:text-neutral-300 hover:text-[var(--primary)] transition ios-touch cursor-pointer shadow-2xs"
            title="Cambiar tema"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          </button>

          {/* Theme palette */}
          <button
            id="ios-header-palette-button"
            onClick={() => setShowThemeModal(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-neutral-800/80 text-slate-600 dark:text-neutral-300 hover:text-[var(--primary)] transition ios-touch cursor-pointer shadow-2xs"
            title="Personalizar Tema & Colores"
          >
            <Palette className="w-4 h-4" />
          </button>

          {/* User avatar + menu */}
          {currentUser && (
            <div className="relative">
              <button
                id="ios-user-badge-button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-8 h-8 rounded-full overflow-hidden border border-slate-300/80 dark:border-neutral-700/80 ios-touch cursor-pointer shadow-2xs hover:scale-105 transition"
                title={`${currentUser.name} — ${currentUser.roleTitle}`}
              >
                {currentUser.avatar ? (
                  <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[var(--primary)] text-white">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    id="user-menu-dropdown"
                    initial={{ opacity: 0, scale: 0.9, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 5 }}
                    className="absolute right-0 top-9 w-56 p-2 rounded-2xl glass-ios shadow-2xl z-50 border border-slate-200/80 dark:border-neutral-700/80"
                  >
                    {/* Profile card */}
                    <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
                      <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-neutral-700">
                        {currentUser.avatar ? (
                          <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[var(--primary)] text-white">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 dark:text-white truncate">{currentUser.name}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {getRoleIcon(currentUser.role)}
                          <span className="text-[10px] text-slate-500 dark:text-neutral-400">
                            {currentUser.roleTitle || roleLabel[currentUser.role] || currentUser.role}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 dark:border-neutral-800 pt-1.5 mt-0.5 flex items-center justify-between">
                      <button
                        onClick={() => { setShowUserMenu(false); triggerSplash(); }}
                        className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1.5 rounded-lg transition"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Splash</span>
                      </button>
                      <button
                        onClick={() => { setShowUserMenu(false); logout(); }}
                        className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-600 font-semibold p-1.5 rounded-lg transition"
                      >
                        <LogOut className="w-3 h-3" />
                        <span>Cerrar sesión</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {largeTitle && (
        <div className="mt-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{subtitle}</p>
          )}
        </div>
      )}

      <ThemeCustomizerModal isOpen={showThemeModal} onClose={() => setShowThemeModal(false)} />
    </header>
  );
};
