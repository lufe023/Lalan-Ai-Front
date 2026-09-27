import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, UserRole } from '../types';
import { api, tokenStore } from '../services/api';
import { enSoporte, salirDeSoporte } from '../services/soporte';

// ─── Permissions map by role ──────────────────────────────────────
const PERMISSIONS: Record<UserRole, UserProfile['permissions']> = {
  admin: { canViewMetrics: true, canManageBots: true, canEditConfig: true, canManageCalendar: true, canManageChats: true, canAccessSystemLogs: true },
  assistant: { canViewMetrics: false, canManageBots: false, canEditConfig: false, canManageCalendar: true, canManageChats: true, canAccessSystemLogs: false },
  super_admin: { canViewMetrics: true, canManageBots: true, canEditConfig: true, canManageCalendar: true, canManageChats: true, canAccessSystemLogs: true },
  support: { canViewMetrics: true, canManageBots: true, canEditConfig: true, canManageCalendar: false, canManageChats: false, canAccessSystemLogs: true },
};

interface LoginCredentials { email: string; password: string; }

interface AuthContextType {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: keyof UserProfile['permissions']) => boolean;
  /** Ya puso su clave: se quita la pantalla de cambio obligatorio */
  claveCambiada: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface ApiUser {
  id: string; name: string; email: string; role: UserRole;
  roleTitle?: string; avatar?: string; badgeColor?: string;
  debeCambiarClave?: boolean;
  soporte?: { negocio: string };
}

function buildProfile(u: ApiUser): UserProfile {
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    roleTitle: u.roleTitle ?? u.role,
    avatar: u.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`,
    badgeColor: u.badgeColor ?? '#6366f1',
    description: '',
    debeCambiarClave: !!u.debeCambiarClave,
    soporte: u.soporte,
    permissions: PERMISSIONS[u.role] ?? PERMISSIONS.assistant,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const restore = async () => {
      if (!tokenStore.get()) { setIsLoading(false); return; }
      try {
        const user = await api.get<ApiUser>('/auth/me');
        setCurrentUser(buildProfile(user));
      } catch {
        tokenStore.clear();
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);

  // Listen for forced logout (token expired)
  useEffect(() => {
    // En soporte, una sesión caducada no cierra nada: se vuelve a la propia
    const handler = () => { if (enSoporte()) { salirDeSoporte(); return; } setCurrentUser(null); tokenStore.clear(); };
    window.addEventListener('lalan:logout', handler);
    return () => window.removeEventListener('lalan:logout', handler);
  }, []);

  const login = useCallback(async ({ email, password }: LoginCredentials) => {
    const data = await api.post<{ accessToken: string; refreshToken: string; user: ApiUser }>(
      '/auth/login',
      { email, password },
    );
    tokenStore.set(data.accessToken);
    tokenStore.setRefresh(data.refreshToken);
    setCurrentUser(buildProfile(data.user));
  }, []);

  const logout = useCallback(() => {
    if (enSoporte()) { salirDeSoporte(); return; }
    tokenStore.clear();
    setCurrentUser(null);
  }, []);

  const claveCambiada = useCallback(() => {
    setCurrentUser((u) => (u ? { ...u, debeCambiarClave: false } : u));
  }, []);

  const hasPermission = useCallback((permission: keyof UserProfile['permissions']): boolean => {
    if (!currentUser) return false;
    return !!currentUser.permissions[permission];
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated: !!currentUser, isLoading, login, logout, hasPermission, claveCambiada }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
