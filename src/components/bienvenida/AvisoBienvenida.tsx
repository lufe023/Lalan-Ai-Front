import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { abrirBienvenida, alCambiarBienvenida, bienvenidaApi } from '../../services/bienvenida';
import type { EstadoBienvenida } from '../../types/bienvenida';

/**
 * "Tu salón está al 70 % · Continuar": arriba de la app mientras la
 * Bienvenida no se termine. Es la forma de volver después de un "Ahora no".
 */
export const AvisoBienvenida: React.FC = () => {
  const { currentUser } = useAuth();
  const [estado, setEstado] = useState<EstadoBienvenida | null>(null);
  const esDuena = currentUser?.role === 'admin' && !currentUser?.soporte;

  const mirar = useCallback(() => { bienvenidaApi.estado().then(setEstado).catch(() => undefined); }, []);
  useEffect(() => {
    if (!esDuena) return;
    mirar();
    return alCambiarBienvenida(mirar);
  }, [esDuena, mirar]);

  if (!esDuena || !estado || estado.terminada) return null;

  return (
    <button
      type="button"
      onClick={abrirBienvenida}
      data-medir="Continuar bienvenida"
      className="mx-3 mt-3 lg:mx-6 flex items-center gap-3 rounded-2xl px-4 py-3 text-left bg-white dark:bg-neutral-900 border border-[var(--primary)]/30 shadow-sm cursor-pointer"
    >
      <Sparkles className="w-5 h-5 shrink-0 text-[var(--primary)]" />
      <span className="flex-1 min-w-0">
        <span className="block text-[0.875rem] font-bold text-slate-900 dark:text-white">Tu salón está al {estado.porcentaje} %</span>
        <span className="mt-1 block h-1.5 rounded-full bg-slate-200 dark:bg-neutral-800 overflow-hidden">
          <span className="block h-full bg-[var(--primary)]" style={{ width: `${estado.porcentaje}%` }} />
        </span>
      </span>
      <span className="text-[0.8125rem] font-bold text-[var(--primary)]">Continuar</span>
    </button>
  );
};
