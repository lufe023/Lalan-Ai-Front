import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { ThemeProvider } from './theme/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { IPhoneFrame } from './components/ui/IPhoneFrame';
import { IOSTabBar } from './components/ui/IOSTabBar';
import { GlobalYouTubePlayer } from './components/ui/GlobalYouTubePlayer';
import { SplashScreen } from './screens/SplashScreen';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { ClientsScreen } from './screens/ClientsScreen';
import { CatalogScreen } from './screens/CatalogScreen';
import { ChatsScreen } from './screens/ChatsScreen';
import { BotsControlScreen } from './screens/BotsControlScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { LoungePlayerScreen } from './screens/LoungePlayerScreen';
import { CajaScreen } from './screens/CajaScreen';
import { SalaScreen } from './screens/SalaScreen';
import { CitasReportScreen } from './screens/CitasReportScreen';
import { PriceListsScreen } from './screens/PriceListsScreen';
import { GananciasScreen } from './screens/GananciasScreen';
import { PantallaTurnos } from './screens/PantallaTurnos';
import { conectarComoUsuario, desconectar } from './services/socket';

const CURRENT_YEAR = new Date().getFullYear();

const MainAppContent: React.FC = () => {
  const { currentScreen, showSplash, activeConversationId } = useApp();
  const { isAuthenticated, isLoading } = useAuth();

  /**
   * El socket se ata a la sesión, no al arranque de la aplicación: antes de
   * iniciar sesión no hay token que mandar, y al cerrarla hay que soltarlo o
   * el servidor seguiría empujando avisos a alguien que ya se fue.
   */
  React.useEffect(() => {
    if (isAuthenticated) conectarComoUsuario();
    else desconectar();
    return () => { if (!isAuthenticated) desconectar(); };
  }, [isAuthenticated]);

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'dashboard': return <DashboardScreen key="dashboard" />;
      case 'calendar':  return <CalendarScreen  key="calendar"  />;
      case 'clients':   return <ClientsScreen   key="clients"   />;
      case 'lounge':    return <LoungePlayerScreen key="lounge" />;
      case 'catalog':   return <CatalogScreen   key="catalog"   />;
      case 'chats':     return <ChatsScreen     key="chats"     />;
      case 'bots':      return <BotsControlScreen key="bots"    />;
      case 'settings':  return <SettingsScreen  key="settings"  />;
      case 'caja':      return <CajaScreen      key="caja"      />;
      case 'sala':      return <SalaScreen      key="sala"      />;
      case 'citas-report': return <CitasReportScreen key="citas-report" />;
      case 'price-lists': return <PriceListsScreen key="price-lists" />;
      case 'ganancias':   return <GananciasScreen   key="ganancias"   />;
      default:          return <DashboardScreen key="default"   />;
    }
  };

  return (
    <IPhoneFrame>
      {/* ── Splash overlay ─────────────────────────────── */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="splash-overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
            className="absolute inset-0 z-50"
          >
            <SplashScreen />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Session restore loading ─────────────────────── */}
      <AnimatePresence>
        {isLoading && !showSplash && (
          <motion.div
            key="auth-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-[#09090b] dark:bg-[#09090b] bg-[#f8fafc]"
          >
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" />
              <span className="text-xs text-slate-500 dark:text-neutral-400 font-medium tracking-wide">
                Restaurando sesión…
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Login vs Authenticated ──────────────────────── */}
      {!isLoading && (
        !isAuthenticated ? (
          <motion.div
            key="login-view"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 w-full h-full flex flex-col"
          >
            <LoginScreen />
          </motion.div>
        ) : (
          // On mobile  → flex-col  (sidebar at bottom = tab bar)
          // On desktop → flex-row  (sidebar on left via lg:order-first)
          <div className="flex-1 w-full h-full flex flex-col lg:flex-row overflow-hidden relative">

            {/* ── Main content column ── */}
            <div className="flex-1 overflow-hidden flex flex-col relative min-w-0">

              {/* Screen transitions */}
              <div className="flex-1 overflow-hidden flex flex-col relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentScreen}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                    className="w-full flex-1 min-h-0 flex flex-col"
                  >
                    {renderCurrentScreen()}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* ── Desktop footer (hidden on mobile) ── */}
              <footer className="hidden lg:flex shrink-0 items-center justify-between px-8 py-2.5 border-t border-slate-200/60 dark:border-neutral-800/60 bg-white/50 dark:bg-neutral-900/50">
                <span className="text-[11px] font-medium text-slate-400 dark:text-neutral-600 tracking-wide">
                  © {CURRENT_YEAR} Gomez Santana Solutions Group SRL
                </span>
                <span className="text-[11px] text-slate-300 dark:text-neutral-700">
                  Lalan AI Studio & Lounge
                </span>
              </footer>
            </div>

            {/* ── Sidebar / Tab bar (IOSTabBar handles both via lg:order-first) ── */}
            {!activeConversationId && <IOSTabBar />}

            {/* ── Reproductor YouTube persistente (fuera del switch de pantallas) ── */}
            <GlobalYouTubePlayer />
          </div>
        )
      )}
    </IPhoneFrame>
  );
};

/**
 * La pantalla de pared, si la URL la pide.
 *
 * Se mira ANTES de montar AuthProvider y AppProvider: el televisor no tiene
 * sesión ni debe tenerla, y montar el contexto entero significaría que la
 * pantalla pública arrastra el estado y las llamadas con token de toda la
 * aplicación. Aquí solo hay un fetch público y nada más.
 *
 * Se usa el hash (#/pantalla/…) y no una ruta normal para que funcione en
 * cualquier hosting estático sin configurar reescrituras.
 */
function tokenDePantalla(): string | null {
  const m = /^#\/pantalla\/([A-Za-z0-9_-]{8,})$/.exec(window.location.hash || '');
  return m ? m[1] : null;
}

export default function App() {
  // Se lee una vez y se escucha el cambio de hash: si alguien pega la URL de
  // la pantalla en la misma pestaña, cambia sin recargar.
  const [tokenPantalla, setTokenPantalla] = React.useState<string | null>(tokenDePantalla);
  React.useEffect(() => {
    const alCambiar = () => setTokenPantalla(tokenDePantalla());
    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  }, []);

  if (tokenPantalla) {
    return (
      <ThemeProvider>
        <PantallaTurnos token={tokenPantalla} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <MainAppContent />
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
