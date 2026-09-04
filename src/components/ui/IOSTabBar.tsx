import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Sparkles,
  MessageSquareText,
  Sliders,
  Music,
  Play,
  Pause,
  SkipForward,
} from 'lucide-react';
import { useApp, ScreenName } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

export const IOSTabBar: React.FC = () => {
  const {
    currentScreen,
    navigateTo,
    conversations,
    appointments,
    clients,
    currentTrack,
    isPlayingLounge,
    togglePlayLounge,
    nextLoungeTrack,
    activeLoungeClient,
  } = useApp();
  const { currentUser } = useAuth();

  // Count active/unread items
  const unreadChats = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const pendingApts = appointments.filter(a => a.status === 'confirmed_by_ai' || a.status === 'pending').length;

  const tabs: { id: ScreenName; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    {
      id: 'calendar',
      label: 'Agenda',
      icon: Calendar,
      badge: pendingApts > 0 ? pendingApts : undefined,
    },
    {
      id: 'clients',
      label: 'Clientas',
      icon: Users,
    },
    {
      id: 'lounge',
      label: 'Lounge',
      icon: Music,
    },
    {
      id: 'chats',
      label: 'Chats',
      icon: MessageSquareText,
      badge: unreadChats > 0 ? unreadChats : undefined,
    },
    {
      id: 'catalog',
      label: 'Catálogo',
      icon: Sparkles,
    },
    {
      id: 'dashboard',
      label: 'Métricas',
      icon: LayoutDashboard,
    },
    {
      id: 'settings',
      label: 'Ajustes',
      icon: Sliders,
    },
  ];

  return (
    <div className="w-full shrink-0 z-30 flex flex-col select-none">
      {/* iOS Floating Mini-Player (Shows when playing and not on Lounge screen) */}
      <AnimatePresence>
        {currentScreen !== 'lounge' && currentTrack && isPlayingLounge && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-2 pb-1"
          >
            <div
              onClick={() => navigateTo('lounge')}
              className="px-3 py-1.5 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-lg border border-slate-200/80 dark:border-neutral-800 shadow-md flex items-center justify-between gap-3 cursor-pointer hover:border-[var(--primary)]/50 transition group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={currentTrack.coverUrl}
                    alt={currentTrack.title}
                    className="w-8 h-8 rounded-lg object-cover"
                  />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white dark:border-black animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {currentTrack.title}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-neutral-400 truncate flex items-center gap-1">
                    <span>{currentTrack.artist}</span>
                    {activeLoungeClient && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-sm bg-amber-500/10 text-amber-600 font-semibold">
                        Para {activeLoungeClient.name.split(' ')[0]}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Mini Controls */}
              <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                <button
                  onClick={togglePlayLounge}
                  className="w-7 h-7 rounded-full bg-slate-100 dark:bg-neutral-800 hover:bg-[var(--primary)] hover:text-white text-slate-800 dark:text-white flex items-center justify-center transition cursor-pointer"
                  title={isPlayingLounge ? 'Pausar' : 'Reproducir'}
                >
                  {isPlayingLounge ? (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  )}
                </button>
                <button
                  onClick={nextLoungeTrack}
                  className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
                  title="Siguiente pista"
                >
                  <SkipForward className="w-3.5 h-3.5 fill-current" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        id="ios-bottom-tab-bar"
        className="w-full px-2 pb-1 pt-1.5 glass-nav border-t border-slate-200/70 dark:border-neutral-800/80"
      >
        <div className="flex items-center justify-between max-w-md mx-auto">
          {tabs.map(tab => {
            const isActive = currentScreen === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                onClick={() => navigateTo(tab.id)}
                className="relative flex flex-col items-center justify-center flex-1 py-0.5 group ios-touch cursor-pointer"
              >
                {/* Active Tab Spring Highlight Indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute -top-1 w-8 h-1 rounded-full bg-[var(--primary)] shadow-[0_0_12px_var(--primary)]"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}

                <div className="relative">
                  <Icon
                    className={`w-4.5 h-4.5 transition-transform duration-200 ${
                      isActive
                        ? 'text-[var(--primary)] scale-110 stroke-[2.4]'
                        : 'text-slate-500 dark:text-slate-400 stroke-[1.8] group-hover:text-slate-800 dark:group-hover:text-white'
                    }`}
                  />

                  {/* Badge Indicator */}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span
                      style={{ fontSize: tab.id === 'chats' ? '7px' : tab.id === 'calendar' ? '7.5px' : undefined }}
                      className="absolute -top-1.5 -right-2 min-w-[15px] h-3.5 px-1 rounded-full bg-[var(--primary)] text-white text-[8.5px] font-extrabold flex items-center justify-center border border-white dark:border-neutral-900 shadow-xs"
                    >
                      {tab.badge}
                    </span>
                  )}
                </div>

                <span
                  className={`text-[9px] font-semibold mt-0.5 tracking-tight transition-colors ${
                    isActive
                      ? 'text-[var(--primary)] font-bold'
                      : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
