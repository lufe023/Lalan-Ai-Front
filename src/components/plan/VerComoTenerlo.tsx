import React from 'react';
import { Lock } from 'lucide-react';
import { usePlan } from '../../context/PlanContext';
import type { ClaveModulo } from '../../types/plataforma';

/**
 * «Ver cómo tenerlo»: el enlace que va al lado de un aviso de «no está en tu
 * plan». Abre la hoja del módulo (ejemplos, en qué plan viene, pedirlo aparte).
 * Solo sale para la dueña, que es quien puede subir el plan.
 */
export const VerComoTenerlo: React.FC<{ modulo: ClaveModulo; className?: string }> = ({ modulo, className = '' }) => {
  const { bloqueado, verModulo } = usePlan();
  if (!bloqueado(modulo)) return null;
  return (
    <button type="button" onClick={() => verModulo(modulo)} data-medir={`Ver cómo tenerlo: ${modulo}`}
      className={`font-bold text-[var(--primary)] hover:underline cursor-pointer ${className}`}>
      Ver cómo tenerlo
    </button>
  );
};

/**
 * Una fila con candado donde iría una sección que el plan no trae (en la
 * ficha de la clienta, por ejemplo). Solo para la dueña; si no, nada.
 */
export const SeccionConCandado: React.FC<{ modulo: ClaveModulo; titulo: string; texto: string }> = ({ modulo, titulo, texto }) => {
  const { bloqueado, verModulo } = usePlan();
  if (!bloqueado(modulo)) return null;
  return (
    <button type="button" onClick={() => verModulo(modulo)} data-medir={`Sección con candado: ${modulo}`}
      className="w-full text-left p-3 rounded-2xl border border-dashed border-slate-300 dark:border-neutral-700 flex items-center gap-2.5 cursor-pointer hover:border-[var(--primary)]/50 transition-colors">
      <Lock className="w-4 h-4 text-slate-400 shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block text-[0.8125rem] font-bold text-slate-700 dark:text-neutral-200">{titulo}</span>
        <span className="block text-[0.75rem] text-slate-500 dark:text-neutral-400">{texto}</span>
      </span>
      <span className="text-[0.75rem] font-bold text-[var(--primary)] shrink-0">Ver cómo tenerlo</span>
    </button>
  );
};
