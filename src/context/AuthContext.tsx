import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ConfirmacionCorreo, UserProfile, UserRole } from '../types';
import { api, migrarSesionVieja, salirEnServidor, sesionLocal } from '../services/api';
import { enSoporte, salirDeSoporte } from '../services/soporte';
import { quickAuth } from '../services/quickAuth';
import { puedeCon, type ClavePermisoRol, type MapaPermisosRol } from '../services/permisos';

// ─── Permissions map by role ──────────────────────────────────────
const PERMISSIONS: Record<UserRole, UserProfile['permissions']> = {
  admin: { canViewMetrics: true, canManageBots: true, canEditConfig: true, canManageCalendar: true, canManageChats: true, canAccessSystemLogs: true },
  assistant: { canViewMetrics: false, canManageBots: false, canEditConfig: false, canManageCalendar: true, canManageChats: true, canAccessSystemLogs: false },
  super_admin: { canViewMetrics: true, canManageBots: true, canEditConfig: true, canManageCalendar: true, canManageChats: true, canAccessSystemLogs: true },
  support: { canViewMetrics: true, canManageBots: true, canEditConfig: true, canManageCalendar: false, canManageChats: false, canAccessSystemLogs: true },
  especialista: { canViewMetrics: false, canManageBots: false, canEditConfig: false, canManageCalendar: false, canManageChats: false, canAccessSystemLogs: false },
};

/** identificador = correo, usuario o teléfono */
interface LoginCredentials { identificador: string; password: string; }

interface AuthContextType {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Si la cuenta tiene dos pasos, devuelve el reto en vez de abrir la sesión */
  login: (credentials: LoginCredentials) => Promise<{ dosPasos?: RetoDosPasos }>;
  /** El segundo paso: el código de la app o el del correo */
  completarDosPasos: (pase: string, codigo: string, porCorreo?: boolean) => Promise<void>;
  /** Ya configuró los dos pasos: se quita la pantalla que la pide */
  dosPasosListo: () => void;
  loginWithQuickDevice: () => Promise<void>;
  logout: () => void;
  hasPermission: (permission: keyof UserProfile['permissions']) => boolean;
  /** ¿La dueña le dejó hacer esto? Administración puede todo */
  puede: (clave?: ClavePermisoRol) => boolean;
  /** Ya puso su clave: se quita la pantalla de cambio obligatorio */
  claveCambiada: () => void;
  /** Confirmó su correo (o lo dejó para después, si no era obligatorio) */
  correoListo: (correo?: string | null) => void;
  /** Aceptó los términos: se quita la pantalla de aceptarlos */
  terminosAceptados: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface ApiUser {
  id: string; name: string; email: string | null; role: UserRole;
  roleTitle?: string; avatar?: string; badgeColor?: string;
  debeCambiarClave?: boolean;
  usuario?: string | null; telefono?: string | null;
  confirmarCorreo?: ConfirmacionCorreo | null;
  aceptarTerminos?: string | null;
  soporte?: { negocio: string; soloLectura?: boolean; motivo?: string | null };
  locationId?: string | null;
  /** Solo la asistente: lo que la dueña le dejó hacer (null = todo) */
  permisos?: MapaPermisosRol | null;
  /** Super admin y soporte sin verificación en dos pasos: la app se la pide */
  configurarDosPasos?: boolean;
}

/** Tras la clave correcta, cuando falta el código de dos pasos */
export interface RetoDosPasos { pase: string; correo: string | null }

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
    correo: u.email ?? null,
    usuario: u.usuario ?? null,
    confirmarCorreo: u.confirmarCorreo ?? null,
    aceptarTerminos: u.aceptarTerminos ?? null,
    soporte: u.soporte,
    permissions: PERMISSIONS[u.role] ?? PERMISSIONS.assistant,
    permisos: u.permisos,
    configurarDosPasos: !!u.configurarDosPasos,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const restore = async () => {
      if (!sesionLocal.hay()) { setIsLoading(false); return; }
      try {
        // Una sesión de antes (tokens en localStorage) pasa a cookies httpOnly
        await migrarSesionVieja();
        const user = await api.get<ApiUser>('/auth/me');
        sesionLocal.guardar(user);
        setCurrentUser(buildProfile(user));
        try {
          localStorage.setItem('lalan_cached_user', JSON.stringify(user));
        } catch {}
      } catch (err: any) {
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        const isNetworkErr = err?.message?.includes('fetch') || err?.name === 'TypeError' || isOffline;
        const cachedRaw = localStorage.getItem('lalan_cached_user');

        if (cachedRaw && (isNetworkErr || isOffline)) {
          try {
            const cachedUser = JSON.parse(cachedRaw);
            setCurrentUser(buildProfile(cachedUser));
          } catch {}
        } else if (err?.message === 'Session expired') {
          sesionLocal.borrar();
          localStorage.removeItem('lalan_cached_user');
        } else if (cachedRaw) {
          // El servidor falló (un despliegue, un 500): eso no cierra la sesión
          try { setCurrentUser(buildProfile(JSON.parse(cachedRaw))); } catch {}
        }
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);

  // Listen for forced logout (token expired)
  useEffect(() => {
    // En soporte, una sesión caducada no cierra nada: se vuelve a la propia
    const handler = () => {
      if (enSoporte()) { salirDeSoporte(); return; }
      setCurrentUser(null);
      sesionLocal.borrar();
      try { localStorage.removeItem('lalan_cached_user'); } catch {}
    };
    window.addEventListener('lalan:logout', handler);
    return () => window.removeEventListener('lalan:logout', handler);
  }, []);

  const login = useCallback(async ({ identificador, password }: LoginCredentials) => {
    // La sesión llega en cookies httpOnly: el cuerpo ya no trae tokens
    const data = await api.post<{ user: ApiUser } | { dosPasos: RetoDosPasos }>(
      '/auth/login',
      { identificador, password },
    );
    if ('dosPasos' in data) return { dosPasos: data.dosPasos };
    abrir(data.user);
    return {};
  }, []);

  const completarDosPasos = useCallback(async (pase: string, codigo: string, porCorreo = false) => {
    const data = await api.post<{ user: ApiUser }>('/auth/dos-pasos', { pase, codigo, porCorreo });
    abrir(data.user);
  }, []);

  const dosPasosListo = useCallback(() => {
    setCurrentUser((u) => (u ? { ...u, configurarDosPasos: false } : u));
  }, []);

  /** Con la sesión ya abierta en cookies: la marca local y la persona */
  function abrir(user: ApiUser) {
    sesionLocal.guardar(user);
    setCurrentUser(buildProfile(user));
    try { localStorage.setItem('lalan_cached_user', JSON.stringify(user)); } catch {}
  }

  const loginWithQuickDevice = useCallback(async () => {
    const { user } = await quickAuth.loginWithDevice();
    sesionLocal.guardar(user);
    setCurrentUser(buildProfile(user));
    try {
      localStorage.setItem('lalan_cached_user', JSON.stringify(user));
    } catch {}
  }, []);

  const logout = useCallback(() => {
    if (enSoporte()) { salirDeSoporte(); return; }
    // Que el servidor también la cierre: así deja de salir en "Dónde está abierta tu sesión"
    salirEnServidor();
    sesionLocal.borrar();
    try {
      localStorage.removeItem('lalan_cached_user');
    } catch {}
    setCurrentUser(null);
  }, []);

  const claveCambiada = useCallback(() => {
    setCurrentUser((u) => (u ? { ...u, debeCambiarClave: false } : u));
  }, []);

  const correoListo = useCallback((correo?: string | null) => {
    setCurrentUser((u) => (u ? { ...u, confirmarCorreo: null, ...(correo !== undefined ? { correo } : {}) } : u));
  }, []);

  const terminosAceptados = useCallback(() => {
    setCurrentUser((u) => (u ? { ...u, aceptarTerminos: null } : u));
  }, []);

  const hasPermission = useCallback((permission: keyof UserProfile['permissions']): boolean => {
    if (!currentUser) return false;
    return !!currentUser.permissions[permission];
  }, [currentUser]);

  const puede = useCallback((clave?: ClavePermisoRol) => puedeCon(currentUser?.permisos, clave), [currentUser]);

  /* El inicio de sesión no trae los permisos de la asistente: se piden a
     /auth/me para no mostrarle lo que la dueña le apagó */
  const faltanPermisos = currentUser?.role === 'assistant' && currentUser.permisos === undefined;
  useEffect(() => {
    if (!faltanPermisos) return;
    api.get<ApiUser>('/auth/me')
      .then((u) => setCurrentUser((c) => (c ? { ...c, permisos: u.permisos ?? null } : c)))
      .catch(() => setCurrentUser((c) => (c ? { ...c, permisos: null } : c)));
  }, [faltanPermisos]);

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated: !!currentUser, isLoading, login, loginWithQuickDevice, logout, hasPermission, puede, completarDosPasos, dosPasosListo, claveCambiada, correoListo, terminosAceptados }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
