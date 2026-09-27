import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import type { ClaveModulo, MiPlan } from '../types/plataforma';

interface PlanContextType {
  miPlan: MiPlan | null;
  /** Mientras carga se asume que SÍ (para no esconder y luego mostrar de golpe) */
  tieneModulo: (m: ClaveModulo) => boolean;
  recargarPlan: () => Promise<void>;
}

const PlanContext = createContext<PlanContextType>({ miPlan: null, tieneModulo: () => true, recargarPlan: async () => {} });

/** Qué incluye el plan del salón: la app esconde lo que no está incluido */
export const PlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, currentUser } = useAuth();
  const [miPlan, setMiPlan] = useState<MiPlan | null>(null);

  const recargarPlan = useCallback(async () => {
    try { setMiPlan(await api.get<MiPlan>('/mi-plan')); } catch { /* sin servidor: se queda como estaba */ }
  }, []);

  useEffect(() => {
    if (isAuthenticated) void recargarPlan(); else setMiPlan(null);
  }, [isAuthenticated, recargarPlan]);

  const tieneModulo = useCallback((m: ClaveModulo) => {
    if (currentUser?.role === 'super_admin') return true;
    return miPlan ? miPlan.modulos.includes(m) : true;
  }, [miPlan, currentUser?.role]);

  return <PlanContext.Provider value={{ miPlan, tieneModulo, recargarPlan }}>{children}</PlanContext.Provider>;
};

export const usePlan = () => useContext(PlanContext);
