import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import type { CatalogoModulos, ClaveModulo, MiPlan } from '../types/plataforma';
import { HojaModuloBloqueado } from '../components/plan/HojaModuloBloqueado';

interface PlanContextType {
  miPlan: MiPlan | null;
  /** Mientras carga se asume que SÍ (para no esconder y luego mostrar de golpe) */
  tieneModulo: (m: ClaveModulo) => boolean;
  recargarPlan: () => Promise<void>;
  /** El catálogo de módulos y en qué plan viene cada uno (solo para la dueña) */
  catalogo: CatalogoModulos | null;
  /**
   * Lo que el plan no trae se enseña con candado en vez de esconderse (lo que
   * no se exhibe no se vende). Solo a la dueña: ella es quien sube el plan.
   */
  verBloqueados: boolean;
  /** Un módulo que se enseña con candado: el plan no lo trae y quien mira es la dueña */
  bloqueado: (m: ClaveModulo) => boolean;
  /** Abre la hoja que explica el módulo, enseña ejemplos y lleva a subir de plan o a pedirlo aparte */
  verModulo: (m: ClaveModulo) => void;
}

const PlanContext = createContext<PlanContextType>({
  miPlan: null, tieneModulo: () => true, recargarPlan: async () => {},
  catalogo: null, verBloqueados: false, bloqueado: () => false, verModulo: () => {},
});

/** Qué incluye el plan del salón: lo que no incluye, la dueña lo ve con candado; el resto del equipo no lo ve */
export const PlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, currentUser } = useAuth();
  const [miPlan, setMiPlan] = useState<MiPlan | null>(null);
  const [catalogo, setCatalogo] = useState<CatalogoModulos | null>(null);
  const [abierto, setAbierto] = useState<ClaveModulo | null>(null);
  const esDuena = currentUser?.role === 'admin';

  const recargarPlan = useCallback(async () => {
    try { setMiPlan(await api.get<MiPlan>('/mi-plan')); } catch { /* sin servidor: se queda como estaba */ }
  }, []);

  useEffect(() => {
    // La especialista no ve el plan del salón
    if (isAuthenticated && currentUser?.role !== 'especialista') void recargarPlan(); else setMiPlan(null);
  }, [isAuthenticated, currentUser?.role, recargarPlan]);

  useEffect(() => {
    if (!isAuthenticated || !esDuena) { setCatalogo(null); return; }
    api.get<CatalogoModulos>('/mi-plan/modulos').then(setCatalogo).catch(() => setCatalogo(null));
  }, [isAuthenticated, esDuena]);

  const tieneModulo = useCallback((m: ClaveModulo) => {
    if (currentUser?.role === 'super_admin') return true;
    return miPlan ? miPlan.modulos.includes(m) : true;
  }, [miPlan, currentUser?.role]);

  // Con el plan y el catálogo ya cargados: mientras no, nada sale con candado
  const verBloqueados = esDuena && !!miPlan && !!catalogo;
  const bloqueado = useCallback((m: ClaveModulo) => verBloqueados && !tieneModulo(m), [verBloqueados, tieneModulo]);
  const verModulo = useCallback((m: ClaveModulo) => setAbierto(m), []);

  return (
    <PlanContext.Provider value={{ miPlan, tieneModulo, recargarPlan, catalogo, verBloqueados, bloqueado, verModulo }}>
      {children}
      <HojaModuloBloqueado
        modulo={abierto}
        catalogo={catalogo}
        incluido={abierto ? tieneModulo(abierto) : false}
        planActual={miPlan?.plan?.nombre ?? null}
        tiene={tieneModulo}
        onClose={() => setAbierto(null)}
      />
    </PlanContext.Provider>
  );
};

export const usePlan = () => useContext(PlanContext);
