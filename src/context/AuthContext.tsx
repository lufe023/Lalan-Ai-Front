import React, { createContext, useContext, useState } from 'react';
import { UserProfile, UserRole } from '../types';

export const PROFILES: Record<UserRole, UserProfile> = {
  admin: {
    id: 'user_alanny',
    name: 'Alanny',
    role: 'admin',
    roleTitle: 'Administradora General',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    badgeColor: '#e11d48',
    description: 'Acceso total a métricas de facturación, configuración global del salón y orquestación de bots.',
    permissions: {
      canViewMetrics: true,
      canManageBots: true,
      canEditConfig: true,
      canManageCalendar: true,
      canManageChats: true,
      canAccessSystemLogs: true,
    },
  },
  assistant: {
    id: 'user_alan',
    name: 'Alan',
    role: 'assistant',
    roleTitle: 'Asistente de Salón',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    badgeColor: '#0284c7',
    description: 'Enfocado en la agenda diaria, confirmación de citas y atención directa de chats de clientes.',
    permissions: {
      canViewMetrics: false,
      canManageBots: false,
      canEditConfig: false,
      canManageCalendar: true,
      canManageChats: true,
      canAccessSystemLogs: false,
    },
  },
  support: {
    id: 'user_lufe',
    name: 'Lufe',
    role: 'support',
    roleTitle: 'Soporte Técnico & DevOps',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    badgeColor: '#8b5cf6',
    description: 'Acceso a configuraciones avanzadas del sistema, estado de Meta Graph API, webhooks y telemetría de bots.',
    permissions: {
      canViewMetrics: true,
      canManageBots: true,
      canEditConfig: true,
      canManageCalendar: false,
      canManageChats: false,
      canAccessSystemLogs: true,
    },
  },
};

interface AuthContextType {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  loginAs: (role: UserRole) => void;
  logout: () => void;
  switchUser: (role: UserRole) => void;
  hasPermission: (permission: keyof UserProfile['permissions']) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const savedRole = localStorage.getItem('aura_active_role') as UserRole;
    return savedRole && PROFILES[savedRole] ? PROFILES[savedRole] : null;
  });

  const loginAs = (role: UserRole) => {
    const profile = PROFILES[role];
    setCurrentUser(profile);
    localStorage.setItem('aura_active_role', role);
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('aura_active_role');
  };

  const switchUser = (role: UserRole) => {
    loginAs(role);
  };

  const hasPermission = (permission: keyof UserProfile['permissions']): boolean => {
    if (!currentUser) return false;
    return !!currentUser.permissions[permission];
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        loginAs,
        logout,
        switchUser,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
