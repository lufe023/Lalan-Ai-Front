import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ThemeProvider } from './theme/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { IPhoneFrame } from './components/ui/IPhoneFrame';
import { IOSTabBar } from './components/ui/IOSTabBar';
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

const MainAppContent: React.FC = () => {
  const { currentScreen, showSplash, activeConversationId } = useApp();
  const { isAuthenticated } = useAuth();

  // Screen selector helper
  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return <DashboardScreen key="dashboard" />;
      case 'calendar':
        return <CalendarScreen key="calendar" />;
      case 'clients':
        return <ClientsScreen key="clients" />;
      case 'lounge':
        return <LoungePlayerScreen key="lounge" />;
      case 'catalog':
        return <CatalogScreen key="catalog" />;
      case 'chats':
        return <ChatsScreen key="chats" />;
      case 'bots':
        return <BotsControlScreen key="bots" />;
      case 'settings':
        return <SettingsScreen key="settings" />;
      default:
        return <DashboardScreen key="default" />;
    }
  };

  return (
    <IPhoneFrame>
      {/* 1. Splash Screen Animation */}
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

      {/* 2. Login Screen vs Authenticated Screens */}
      {!isAuthenticated ? (
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
        <div className="flex-1 w-full h-full flex flex-col overflow-hidden relative">
          {/* Main active screen view with iOS slide & fade transitions */}
          <div className="flex-1 w-full overflow-hidden flex flex-col relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentScreen}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                className="w-full h-full flex flex-col"
              >
                {renderCurrentScreen()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* iOS Bottom Tab Bar (hidden only when in deep full-screen conversation detail if desired, but kept accessible) */}
          {!activeConversationId && <IOSTabBar />}
        </div>
      )}
    </IPhoneFrame>
  );
};

export default function App() {
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
