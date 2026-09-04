import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  Sparkles,
  ShieldCheck,
  UserCheck,
  Headphones,
  RotateCcw,
  LogOut,
  Palette,
} from 'lucide-react';
import { useAuth, PROFILES } from '../../context/AuthContext';
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
  const { currentUser, switchUser, logout } = useAuth();
  const { triggerSplash, showToast } = useApp();
  const { primaryColor, accentColor, tertiaryColor } = useTheme();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

  const getRoleIcon = (role?: UserRole) => {
    switch (role) {
      case 'admin':
        return <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />;
      case 'assistant':
        return <UserCheck className="w-3.5 h-3.5 text-sky-500" />;
      case 'support':
        return <Headphones className="w-3.5 h-3.5 text-purple-500" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-amber-500" />;
    }
  };

  return (
    <header id="ios-navigation-header" className="relative w-full shrink-0 z-30 pt-1 pb-2 px-4 select-none">
      {/* Top row with Back button / Brand / Profile Switcher */}
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
            <span className="text-xs font-bold tracking-tight text-slate-800 dark:text-neutral-200">
              Lalan AI
            </span>
            <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">
              • {currentUser?.roleTitle || 'Asistente'}
            </span>
          </div>
        )}

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {rightAction}

          {/* Minimalist Theme Palette Button */}
          <button
            id="ios-header-palette-button"
            onClick={() => setShowThemeModal(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-neutral-800/80 text-slate-600 dark:text-neutral-300 hover:text-[var(--primary)] transition ios-touch cursor-pointer shadow-2xs"
            title="Personalizar Tema & Colores"
          >
            <Palette className="w-4 h-4" />
          </button>

          {currentUser && (
            <div className="relative">
              <button
                id="ios-user-badge-button"
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className="w-8 h-8 rounded-full overflow-hidden border border-slate-300/80 dark:border-neutral-700/80 ios-touch cursor-pointer shadow-2xs hover:scale-105 transition"
                title={`Perfil: ${currentUser.name} (${currentUser.roleTitle})`}
              >
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-full h-full object-cover"
                />
              </button>

              {/* Quick Role Switcher Dropdown */}
              <AnimatePresence>
                {showRoleMenu && (
                  <motion.div
                    id="role-switch-dropdown"
                    initial={{ opacity: 0, scale: 0.9, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 5 }}
                    className="absolute right-0 top-9 w-60 p-2 rounded-2xl glass-ios shadow-2xl z-50 border border-slate-200/80 dark:border-neutral-700/80"
                  >
                    <div className="px-2 py-1.5 mb-1 border-b border-slate-200 dark:border-neutral-800 text-[10px] uppercase font-bold text-slate-400">
                      Cambiar de Perfil (Mock Login)
                    </div>

                    {(['admin', 'assistant', 'support'] as UserRole[]).map(roleKey => {
                      const profile = PROFILES[roleKey];
                      const isSelected = currentUser.role === roleKey;
                      return (
                        <button
                          key={roleKey}
                          onClick={() => {
                            switchUser(roleKey);
                            setShowRoleMenu(false);
                            showToast('Perfil Cambiado', `Ahora estás operando como ${profile.name} (${profile.roleTitle}).`, 'info');
                          }}
                          className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition ios-touch cursor-pointer text-xs font-medium mb-1 ${
                            isSelected
                              ? 'bg-[var(--primary)] text-white shadow-xs'
                              : 'hover:bg-slate-100 dark:hover:bg-neutral-800/70 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <img
                            src={profile.avatar}
                            alt={profile.name}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold flex items-center justify-between">
                              <span>{profile.name}</span>
                              {isSelected && <span className="text-[9px] bg-white/30 px-1.5 py-0.5 rounded">Activo</span>}
                            </div>
                            <div className={`text-[10px] truncate ${isSelected ? 'text-white/80' : 'text-slate-500 dark:text-neutral-400'}`}>
                              {profile.roleTitle}
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    <div className="pt-1.5 mt-1 border-t border-slate-200 dark:border-neutral-800 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setShowRoleMenu(false);
                          triggerSplash();
                        }}
                        className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1.5 rounded-lg"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Splash</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowRoleMenu(false);
                          logout();
                        }}
                        className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-600 font-semibold p-1.5 rounded-lg"
                      >
                        <LogOut className="w-3 h-3" />
                        <span>Salir</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Large Title Area (iOS 18 typography) */}
      {largeTitle && (
        <div className="mt-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center justify-between">
            <span>{title}</span>
          </h1>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              {subtitle}
            </p>
          )}
        </div>
      )}
      {/* Theme Customizer Modal Sheet */}
      <ThemeCustomizerModal
        isOpen={showThemeModal}
        onClose={() => setShowThemeModal(false)}
      />
    </header>
  );
};
