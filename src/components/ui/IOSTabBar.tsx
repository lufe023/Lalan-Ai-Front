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
  Tag,
  Receipt,
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
    // Cola de YouTube: si está activa, el mini reproductor muestra el video
    // incrustado aquí en vez de la portada de la radio.
    ytQueue, ytIndex, ytPlaying, ytToggle, ytNext,
  } = useApp();
  const { currentUser } = useAuth();

  const unreadChats = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const pendingApts = appointments.filter(a => a.status === 'confirmed_by_ai' || a.status === 'pending').length;

  const tabs: { id: ScreenName; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { id: 'calendar', label: 'Agenda', icon: Calendar, badge: pendingApts > 0 ? pendingApts : undefined },
    { id: 'clients', label: 'Clientas', icon: Users },
    { id: 'lounge', label: 'Lounge', icon: Music },
    { id: 'caja', label: 'Caja', icon: Receipt },
    { id: 'chats', label: 'Chats', icon: MessageSquareText, badge: unreadChats > 0 ? unreadChats : undefined },
    { id: 'catalog', label: 'Catálogo', icon: Sparkles },
    { id: 'dashboard', label: 'Métricas', icon: LayoutDashboard },
    { id: 'settings', label: 'Ajustes', icon: Sliders },
    { id: 'price-lists', label: 'Precios', icon: Tag },
  ];

  const ytTrack = ytQueue[ytIndex];
  const ytActive = !!ytTrack;

  /**
   * Mini reproductor de YouTube: el <div> con ref es el ancla donde
   * <GlobalYouTubePlayer /> posiciona el iframe. Así el video queda incrustado
   * aquí —fuera del camino de los botones— en vez de flotar sobre la barra.
   */
  /* OJO: función que devuelve JSX, NO un componente.
     Si fuera `const YtMiniPlayer = () => ...` y se usara como <YtMiniPlayer />,
     React lo trataría como un tipo nuevo en cada render, remontaría el subárbol
     y el `ref` del ancla se dispararía con null→elemento en cada pasada,
     actualizando el contexto en bucle ("Maximum update depth exceeded").
     Al invocarla, su JSX se integra en el árbol de IOSTabBar y el ref es estable. */
  const renderYtMini = (compact: boolean) => (
    <div
      onClick={() => navigateTo('lounge')}
      className={`cursor-pointer ${compact
        ? 'px-2 pb-1'
        : 'mx-2 mb-2 p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700'
      }`}
    >
      <div className={compact
        ? 'px-2.5 py-1.5 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-lg border border-slate-200/80 dark:border-neutral-800 shadow-md flex items-center gap-2.5'
        : 'flex items-center gap-2.5'
      }>
        {/* Miniatura, no el video.
            Un iframe de YouTube a 68x38 no alcanza el tamaño mínimo que el
            player necesita y se pinta negro. Aquí mostramos la carátula —igual
            que el mini reproductor de la radio— y el video se queda en el
            Lounge, que es donde tiene espacio real. El audio no se interrumpe:
            fuera del Lounge el iframe sigue vivo, solo aparcado fuera de vista. */}
        <div className="w-[68px] h-[38px] rounded-lg overflow-hidden bg-slate-200 dark:bg-neutral-700 shrink-0 relative">
          {ytTrack?.thumbnail ? (
            <img
              src={ytTrack.thumbnail}
              alt={ytTrack.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[13px]">▶</div>
          )}
          {ytPlaying && (
            <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
            {ytTrack?.title}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-neutral-400 truncate">
            {ytTrack?.channel || 'YouTube'}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={ytToggle}
            className="w-7 h-7 rounded-full bg-white dark:bg-neutral-700 hover:bg-[var(--primary)] hover:text-white text-slate-700 dark:text-white flex items-center justify-center transition cursor-pointer"
            title={ytPlaying ? 'Pausar' : 'Reproducir'}
          >
            {ytPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
          </button>
          <button
            onClick={ytNext}
            className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
            title="Siguiente"
          >
            <SkipForward className="w-3 h-3 fill-current" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderMiniPlayer = (compact: boolean) => {
    // YouTube manda: si hay cola, el mini reproductor es el suyo. Se mantiene
    // visible incluso dentro del Lounge, porque cuando la tarjeta grande
    // muestra la portada el video necesita seguir teniendo dónde vivir.
    if (ytActive) return renderYtMini(compact);
    if (!currentTrack || !isPlayingLounge || currentScreen === 'lounge') return null;
    return (
      <div
        onClick={() => navigateTo('lounge')}
        className={`cursor-pointer ${compact
          ? 'px-2 pb-1'
          : 'mx-2 mb-2 p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700'
        }`}
      >
        {compact ? (
          <div className="px-3 py-1.5 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-lg border border-slate-200/80 dark:border-neutral-800 shadow-md flex items-center justify-between gap-3 hover:border-[var(--primary)]/50 transition group">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <img src={currentTrack.coverUrl} alt={currentTrack.title} className="w-8 h-8 rounded-lg object-cover" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white dark:border-black animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentTrack.title}</div>
                <div className="text-[10px] text-slate-500 dark:text-neutral-400 truncate flex items-center gap-1">
                  <span>{currentTrack.artist}</span>
                  {activeLoungeClient && (
                    <span className="text-[9px] px-1.5 rounded-sm bg-amber-500/10 text-amber-600 font-semibold">
                      Para {activeLoungeClient.name.split(' ')[0]}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
              <button onClick={togglePlayLounge} className="w-7 h-7 rounded-full bg-slate-100 dark:bg-neutral-800 hover:bg-[var(--primary)] hover:text-white text-slate-800 dark:text-white flex items-center justify-center transition cursor-pointer" title={isPlayingLounge ? 'Pausar' : 'Reproducir'}>
                {isPlayingLounge ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
              </button>
              <button onClick={nextLoungeTrack} className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition cursor-pointer" title="Siguiente">
                <SkipForward className="w-3.5 h-3.5 fill-current" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <img src={currentTrack.coverUrl} alt={currentTrack.title} className="w-8 h-8 rounded-lg object-cover shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate text-slate-900 dark:text-white">{currentTrack.title}</div>
                <div className="text-[10px] text-slate-400 dark:text-neutral-400 truncate">{currentTrack.artist}</div>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-800 animate-pulse shrink-0" />
            </div>
            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
              <button onClick={togglePlayLounge} className="w-7 h-7 rounded-full bg-white dark:bg-neutral-700 hover:bg-[var(--primary)] hover:text-white text-slate-700 dark:text-white flex items-center justify-center transition cursor-pointer">
                {isPlayingLounge ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
              </button>
              <button onClick={nextLoungeTrack} className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center transition cursor-pointer">
                <SkipForward className="w-3 h-3 fill-current" />
              </button>
              <span className="text-[10px] text-slate-400 dark:text-neutral-500 ml-auto">Reproduciendo</span>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    // On mobile: w-full shrink-0 at bottom of flex-col
    // On desktop: lg:order-first moves it LEFT in flex-row, fixed sidebar width
    <div className="w-full shrink-0 z-30 flex flex-col select-none lg:order-first lg:w-64 xl:w-72 lg:h-full">

      {/* ═══════════════════════════════════════
          DESKTOP SIDEBAR — hidden on mobile
      ═══════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col w-full h-full border-r border-slate-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl">

        {/* Brand */}
        <div className="px-4 pt-5 pb-4 border-b border-slate-100 dark:border-neutral-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary)] flex items-center justify-center shadow-sm shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Lalan AI</div>
              <div className="text-[10px] text-slate-400 dark:text-neutral-500 font-medium tracking-wide uppercase">Studio & Lounge</div>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto hide-scrollbar px-2 py-3 flex flex-col gap-0.5">
          {tabs.map(tab => {
            const isActive = currentScreen === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => navigateTo(tab.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all w-full text-left cursor-pointer ios-touch group
                  ${isActive
                    ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                    : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800/60 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                <Icon className={`w-5 h-5 shrink-0 transition-transform ${isActive ? 'stroke-[2.2] scale-110' : 'stroke-[1.8]'}`} />
                <span className="text-sm font-medium flex-1 truncate">{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--primary)] text-white text-[9px] font-extrabold flex items-center justify-center shrink-0">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Mini player in sidebar */}
        <AnimatePresence>
          {(ytActive || (currentScreen !== 'lounge' && currentTrack && isPlayingLounge)) && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
              {renderMiniPlayer(false)}
            </motion.div>
          )}
        </AnimatePresence>

        {/* User footer */}
        {currentUser && (
          <div className="px-3 py-3 border-t border-slate-100 dark:border-neutral-800/80 flex items-center gap-2.5 shrink-0">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-[var(--primary)]/20"
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-800 dark:text-white truncate">{currentUser.name}</div>
              <div className="text-[10px] text-slate-400 dark:text-neutral-500 truncate">{currentUser.roleTitle}</div>
            </div>
            <div
              className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
              title="En línea"
            />
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════
          MOBILE TAB BAR — hidden on desktop
      ═══════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col">
        {/* Floating Mini-Player */}
        <AnimatePresence>
          {(ytActive || (currentScreen !== 'lounge' && currentTrack && isPlayingLounge)) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              {renderMiniPlayer(true)}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab bar */}
        <div
          id="ios-bottom-tab-bar"
          className="w-full px-2 pt-1.5 pb-safe-tab glass-nav border-t border-slate-200/70 dark:border-neutral-800/80"
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

    </div>
  );
};
