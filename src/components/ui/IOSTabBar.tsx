import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  Armchair,
  Globe2,
  BarChart3,
  Search,
  X,
  LayoutGrid,
  CalendarRange,
  ShoppingCart,
} from 'lucide-react';
import { abrirBuscador, ATAJO_BUSCADOR } from './BuscadorOpciones';
import { IOSModal } from './IOSModal';
import { RESORTE } from './movimiento';
import { LogoLalan } from './LogoLalan';
import { abrirLalan, puedeHablarConLalan } from '../lalan/PantallaLalan';
import { EsferaLalan } from '../lalan/EsferaLalan';
import { useApp, ScreenName } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { PERMISO_DE_PANTALLA } from '../../services/permisos';
import { useNombreSede } from './ListaSedes';
import { useAplicacionesNuevas } from '../../hooks/useAplicacionesNuevas';
import { usePlan } from '../../context/PlanContext';
import { citasPendientes } from '../agenda/CitasPendientes';
import type { ClaveModulo } from '../../types/plataforma';

/** El número de una insignia: hasta 9, después "9+" (como el teléfono; no rompe el círculo) */
const insignia = (n: number) => (n > 9 ? '9+' : String(n));

/** Las pestañas que son de un módulo: si el plan no lo incluye, no aparecen */
const MODULO_DE_PESTANA: Partial<Record<ScreenName, ClaveModulo>> = {
  sala: 'sala_turnos',
  lounge: 'lounge_musica',
  caja: 'caja',
  'price-lists': 'listas_precios',
  compras: 'compras',
};

/**
 * Las que van fijas en la barra del teléfono, en este orden: lo que se toca
 * veinte veces al día. Todo lo demás vive en el cajón «Más». Si el plan no
 * trae alguna (un salón sin Sala), su hueco lo ocupa la siguiente del menú,
 * así la barra no se queda con tres botones y un vacío.
 */
const FIJAS_EN_MOVIL: ScreenName[] = ['calendar', 'chats', 'sala', 'caja'];
const CUANTAS_FIJAS = FIJAS_EN_MOVIL.length;

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
    openFolios,
  } = useApp();
  const { currentUser, puede } = useAuth();
  const nombreSede = useNombreSede();
  const { tieneModulo } = usePlan();
  const aplicacionesNuevas = useAplicacionesNuevas(currentUser?.role === 'super_admin');

  const unreadChats = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  /* Citas pendientes: el mismo número que el botón "Pendientes" de la Agenda
     (las que pasaron y nadie cerró, y las que vienen sin confirmar). Una
     pendiente vieja es justo la que más se olvida. */
  const pendingApts = citasPendientes(appointments).total;

  /**
   * Comandas sin cobrar. Mismo criterio que la pestaña de Caja: una cuenta
   * en cero no es un descuido, y si contara, el número nunca bajaría a cero
   * — un contador que siempre tiene algo es un contador que nadie mira.
   *
   * Va en el menú porque el olvido no ocurre estando en Caja: ocurre estando
   * en la Agenda o en el Lounge, mientras la clienta se va por la puerta.
   */
  const comandasPendientes = (openFolios ?? []).filter(
    (f: any) => Number(f.total ?? 0) - Number(f.paidTotal ?? 0) > 0.009,
  ).length;

  const todasLasPestanas: {
    id: ScreenName; label: string; icon: React.FC<{ className?: string }>;
    badge?: number;
    /** En rojo: no es una notificación, es plata que se puede ir por la puerta */
    urgente?: boolean;
  }[] = [
    { id: 'dashboard', label: 'Métricas', icon: LayoutDashboard },
    { id: 'informes', label: 'Informes', icon: BarChart3 },
    { id: 'calendar', label: 'Agenda', icon: Calendar, badge: pendingApts > 0 ? pendingApts : undefined },
    { id: 'mi-semana', label: 'Mi semana', icon: CalendarRange },
    { id: 'compras', label: 'Compras', icon: ShoppingCart },
    { id: 'sala', label: 'Sala', icon: Armchair },
    { id: 'clients', label: 'Clientas', icon: Users },
    { id: 'lounge', label: 'Lounge', icon: Music },
    {
      id: 'caja', label: 'Caja', icon: Receipt,
      badge: comandasPendientes > 0 ? comandasPendientes : undefined,
      urgente: true,
    },
    { id: 'chats', label: 'Chats', icon: MessageSquareText, badge: unreadChats > 0 ? unreadChats : undefined },
    { id: 'catalog', label: 'Catálogo', icon: Sparkles },
    { id: 'settings', label: 'Ajustes', icon: Sliders },
    { id: 'price-lists', label: 'Precios', icon: Tag },
    // Solo el dueño de la plataforma: la landing y el libro del piloto
    ...(currentUser?.role === 'super_admin' || currentUser?.role === 'support'
      ? [{ id: 'plataforma' as ScreenName, label: currentUser?.role === 'support' ? 'Clientes' : 'Plataforma', icon: Globe2, badge: aplicacionesNuevas > 0 ? aplicacionesNuevas : undefined }]
      : []),
  ];
  // Fuera lo que el plan no trae y lo que la dueña le apagó a la asistente
  const tabs = todasLasPestanas.filter((t) => { const m = MODULO_DE_PESTANA[t.id]; return (!m || tieneModulo(m)) && puede(PERMISO_DE_PANTALLA[t.id]); });

  /* El teléfono: cuatro fijas y «Más». En la computadora el menú lateral
     sigue mostrando todas. */
  const fijas = [
    ...FIJAS_EN_MOVIL.map((id) => tabs.find((t) => t.id === id)).filter((t): t is typeof tabs[number] => !!t),
    ...tabs.filter((t) => !FIJAS_EN_MOVIL.includes(t.id)),
  ].slice(0, CUANTAS_FIJAS);
  const enElCajon = tabs.filter((t) => !fijas.includes(t));
  const [cajonAbierto, setCajonAbierto] = useState(false);
  /* «Más» se marca cuando la pantalla abierta está dentro del cajón, y lleva
     la suma de lo que espera adentro: si no, un aviso en Plataforma quedaría
     escondido detrás de una puerta cerrada. */
  const masActivo = enElCajon.some((t) => t.id === currentScreen);
  const avisosEnCajon = enElCajon.reduce((n, t) => n + (t.badge ?? 0), 0);
  const cajonUrgente = enElCajon.some((t) => t.urgente && (t.badge ?? 0) > 0);
  // Si otra cosa cambia de pantalla (un aviso, Lalan, el buscador), el cajón no se queda abierto encima
  useEffect(() => { setCajonAbierto(false); }, [currentScreen]);

  const ytTrack = ytQueue[ytIndex];
  const ytActive = !!ytTrack;
  /* El mini reproductor sale cuando de verdad sonó algo (elegir una clienta
     arma su lista, pero eso no es motivo para taparle la pantalla) y se
     puede cerrar con la ✕: pausa y se esconde hasta que vuelva a sonar. */
  const [yaSono, setYaSono] = useState(false);
  const [miniCerrado, setMiniCerrado] = useState(false);
  useEffect(() => {
    if (ytPlaying) { setYaSono(true); setMiniCerrado(false); }
  }, [ytPlaying]);
  const ytVisible = ytActive && yaSono && !miniCerrado;
  const cerrarMini = () => {
    if (ytPlaying) ytToggle();
    if (isPlayingLounge) togglePlayLounge();
    setMiniCerrado(true);
  };
  const botonCerrarMini = (
    <button
      onClick={(e) => { e.stopPropagation(); cerrarMini(); }}
      className="w-7 h-7 rounded-full text-slate-400 hover:text-rose-500 flex items-center justify-center transition cursor-pointer"
      title="Cerrar el reproductor" aria-label="Cerrar el reproductor"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  );

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
            <div className="absolute inset-0 flex items-center justify-center text-[0.875rem]">▶</div>
          )}
          {ytPlaying && (
            <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[0.75rem] font-bold text-slate-900 dark:text-white truncate">
            {ytTrack?.title}
          </div>
          <div className="text-[0.6875rem] text-slate-500 dark:text-neutral-400 truncate">
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
          {botonCerrarMini}
        </div>
      </div>
    </div>
  );

  const renderMiniPlayer = (compact: boolean) => {
    // YouTube manda: si hay cola, el mini reproductor es el suyo. Se mantiene
    // visible incluso dentro del Lounge, porque cuando la tarjeta grande
    // muestra la portada el video necesita seguir teniendo dónde vivir.
    if (ytVisible) return renderYtMini(compact);
    if (ytActive) return null;
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
                <div className="text-[0.6875rem] text-slate-500 dark:text-neutral-400 truncate flex items-center gap-1">
                  <span>{currentTrack.artist}</span>
                  {activeLoungeClient && (
                    <span className="text-[0.6875rem] px-1.5 rounded-sm bg-amber-500/10 text-amber-600 font-semibold">
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
              {botonCerrarMini}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <img src={currentTrack.coverUrl} alt={currentTrack.title} className="w-8 h-8 rounded-lg object-cover shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate text-slate-900 dark:text-white">{currentTrack.title}</div>
                <div className="text-[0.6875rem] text-slate-400 dark:text-neutral-400 truncate">{currentTrack.artist}</div>
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
              <span className="text-[0.6875rem] text-slate-400 dark:text-neutral-500 ml-auto">Reproduciendo</span>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    // On mobile: w-full shrink-0 at bottom of flex-col
    // On desktop: lg:order-first moves it LEFT in flex-row, fixed sidebar width
    <div data-menu className="w-full shrink-0 z-30 flex flex-col select-none lg:order-first lg:w-64 xl:w-72 lg:h-full">

      {/* ═══════════════════════════════════════
          DESKTOP SIDEBAR — hidden on mobile
      ═══════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col w-full h-full border-r border-slate-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl">

        {/* Brand */}
        <div className="px-4 pt-5 pb-4 border-b border-slate-100 dark:border-neutral-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary)] flex items-center justify-center shadow-sm shrink-0">
              <LogoLalan className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Lalan AI</div>
              <div className="text-[0.6875rem] text-slate-400 dark:text-neutral-500 font-medium tracking-wide uppercase">Studio & Lounge</div>
            </div>
          </div>
          {puedeHablarConLalan(currentUser?.role) && (
            <button type="button" onClick={abrirLalan} data-medir="Abrir Lalan"
              className="mt-3 w-full flex items-center gap-2.5 px-2 py-1.5 rounded-2xl bg-[var(--primary)]/8 hover:bg-[var(--primary)]/15 text-left cursor-pointer ios-touch">
              <EsferaLalan modo="reposo" tamano={34} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-slate-900 dark:text-white leading-tight">Habla con Lalan</span>
                <span className="block text-[0.6875rem] text-slate-500 dark:text-neutral-400 truncate">Tu día, tus chats, tus informes</span>
              </span>
            </button>
          )}
          {/* El buscador de opciones: lo mismo que Ctrl+K, para quien no sabe el atajo */}
          <button type="button" onClick={abrirBuscador} data-medir="Abrir buscador"
            className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800/70 hover:bg-slate-200/70 dark:hover:bg-neutral-800 text-slate-500 dark:text-neutral-400 text-left cursor-pointer ios-touch">
            <Search className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-[0.8125rem]">Buscar opción…</span>
            <kbd className="px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[0.6875rem] font-semibold">{ATAJO_BUSCADOR}</kbd>
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto hide-scrollbar px-2 py-3 flex flex-col gap-0.5">
          {tabs.map(tab => {
            const isActive = currentScreen === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                  data-medir={`Menú: ${tab.label}`}
                onClick={() => navigateTo(tab.id)}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors w-full text-left cursor-pointer ios-touch group
                  ${isActive
                    ? 'text-[var(--primary)]'
                    : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800/60 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                {/* El fondo de la elegida se desliza de una opción a otra */}
                {isActive && (
                  <motion.span
                    layoutId="menuLateralActivo"
                    className="absolute inset-0 rounded-xl bg-[var(--primary)]/10"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <Icon className={`relative w-5 h-5 shrink-0 transition-transform ${isActive ? 'stroke-[2.2] scale-110' : 'stroke-[1.8]'}`} />
                <span className="relative text-sm font-medium flex-1 truncate">{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`relative min-w-[18px] h-[18px] px-1 rounded-full text-white text-[0.6875rem] font-extrabold flex items-center justify-center shrink-0 tabular-nums ${
                    tab.urgente ? 'bg-red-500' : 'bg-[var(--primary)]'
                  }`}>
                    {insignia(tab.badge)}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Mini player in sidebar */}
        <AnimatePresence>
          {(ytVisible || (!ytActive && currentScreen !== 'lounge' && currentTrack && isPlayingLounge)) && (
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
              <div className="text-[0.6875rem] text-slate-400 dark:text-neutral-500 truncate">
                {currentUser.roleTitle}{nombreSede ? <> · <span className="text-[var(--primary)] font-semibold">{nombreSede}</span></> : null}
              </div>
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
          {(ytVisible || (!ytActive && currentScreen !== 'lounge' && currentTrack && isPlayingLounge)) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              {renderMiniPlayer(true)}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab bar: cinco botones que caben enteros, sin desplazar */}
        <nav
          id="ios-bottom-tab-bar"
          aria-label="Menú principal"
          className="w-full pt-1.5 pb-safe-tab glass-nav border-t border-slate-200/70 dark:border-neutral-800/80"
        >
          <div className="flex items-center justify-between gap-1 px-2">
            {fijas.map(tab => (
              <BotonBarra
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                medir={`Menú: ${tab.label}`}
                label={tab.label}
                icon={tab.icon}
                activo={currentScreen === tab.id}
                badge={tab.badge}
                urgente={tab.urgente}
                onClick={() => navigateTo(tab.id)}
              />
            ))}
            {enElCajon.length > 0 && (
              <BotonBarra
                id="tab-btn-mas"
                medir="Menú: Más"
                label="Más"
                icon={LayoutGrid}
                activo={masActivo || cajonAbierto}
                badge={avisosEnCajon > 0 ? avisosEnCajon : undefined}
                urgente={cajonUrgente}
                onClick={() => setCajonAbierto(true)}
                aria-haspopup="dialog"
                aria-expanded={cajonAbierto}
              />
            )}
          </div>
        </nav>
      </div>

      {/* El cajón «Más»: la misma hoja que sube desde abajo en el resto de la
          app. Va colgada del <body> porque dentro del menú quedaría por debajo
          de la esfera de Lalan (el menú tiene su propia capa, z-30). */}
      {createPortal(<div className="lg:hidden">
        <IOSModal
          fijo
          id="cajon-mas"
          isOpen={cajonAbierto}
          onClose={() => setCajonAbierto(false)}
          title="Más opciones"
          subtitle="Todo lo que no cabe en la barra"
          fixedHeight={false}
          height="80%"
        >
          <div className="grid grid-cols-3 gap-2.5">
            {enElCajon.map((tab, i) => {
              const isActive = currentScreen === tab.id;
              const Icon = tab.icon;
              return (
                <motion.button
                  key={tab.id}
                  type="button"
                  data-medir={`Menú: ${tab.label}`}
                  id={`tab-btn-${tab.id}`}
                  onClick={() => { setCajonAbierto(false); navigateTo(tab.id); }}
                  initial={false}
                  whileTap={{ scale: 0.95 }}
                  aria-current={isActive ? 'page' : undefined}
                  style={{ animationDelay: `${0.08 + i * 0.03}s`, ['--entrar-y' as string]: '10px' }}
                  className={`entrar-suave relative flex flex-col items-center justify-center gap-1.5 min-h-[84px] px-1 py-3 rounded-2xl border cursor-pointer ios-touch transition-colors ${
                    isActive
                      ? 'bg-[var(--primary)]/10 border-[var(--primary)]/40 text-[var(--primary)]'
                      : 'bg-slate-50 dark:bg-neutral-800/60 border-slate-200/80 dark:border-neutral-800 text-slate-700 dark:text-neutral-200 active:bg-slate-100 dark:active:bg-neutral-800'
                  }`}
                >
                  <span className="relative">
                    <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className={`absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[0.6875rem] font-extrabold flex items-center justify-center border border-white dark:border-neutral-900 tabular-nums ${
                        tab.urgente ? 'bg-red-500' : 'bg-[var(--primary)]'
                      }`}>
                        {insignia(tab.badge)}
                      </span>
                    )}
                  </span>
                  <span className={`text-[0.8125rem] leading-tight text-center ${isActive ? 'font-bold' : 'font-semibold'}`}>{tab.label}</span>
                </motion.button>
              );
            })}
          </div>
        </IOSModal>
      </div>, document.body)}

    </div>
  );
};

/** Un botón de la barra del teléfono: icono, nombre, insignia y la rayita de la elegida */
const BotonBarra: React.FC<{
  id: string;
  medir: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  activo: boolean;
  badge?: number;
  urgente?: boolean;
  onClick: () => void;
} & Pick<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-haspopup' | 'aria-expanded'>> = ({
  id, medir, label, icon: Icon, activo, badge, urgente, onClick, ...aria
}) => (
  <button
    type="button"
    data-medir={medir}
    id={id}
    onClick={onClick}
    aria-current={activo && !aria['aria-haspopup'] ? 'page' : undefined}
    {...aria}
    className="relative flex flex-col items-center justify-center flex-1 min-w-0 min-h-[44px] rounded-xl py-1 group ios-touch cursor-pointer active:bg-slate-100 dark:active:bg-neutral-800/60 transition-colors"
  >
    {activo && (
      <motion.div
        layoutId="activeTabIndicator"
        className="absolute -top-1 w-8 h-1 rounded-full bg-[var(--primary)] shadow-[0_0_12px_var(--primary)]"
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      />
    )}
    <div className="relative">
      <Icon
        className={`w-[22px] h-[22px] transition-transform duration-200 ${
          activo
            ? 'text-[var(--primary)] scale-110 stroke-[2.4]'
            : 'text-slate-500 dark:text-slate-400 stroke-[1.8] group-hover:text-slate-800 dark:group-hover:text-white'
        }`}
      />
      {badge !== undefined && badge > 0 && (
        <span
          className={`absolute -top-1.5 -right-2 min-w-[15px] h-3.5 px-1 rounded-full text-white text-[0.6875rem] font-extrabold flex items-center justify-center border border-white dark:border-neutral-900 shadow-xs tabular-nums ${
            urgente ? 'bg-red-500' : 'bg-[var(--primary)]'
          }`}
        >
          {insignia(badge)}
        </span>
      )}
    </div>
    <span
      className={`text-[0.6875rem] font-semibold mt-1 tracking-tight truncate max-w-full transition-colors ${
        activo
          ? 'text-[var(--primary)] font-bold'
          : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200'
      }`}
    >
      {label}
    </span>
  </button>
);
