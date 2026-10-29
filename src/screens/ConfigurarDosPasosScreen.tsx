import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ConfigurarDosPasos } from '../components/ajustes/DosPasos';

/**
 * Super admin y soporte entran a los salones de otros: antes de seguir,
 * activan la verificación en dos pasos. Es una vez; después, cada vez que
 * entran con la clave, la app les pide el código.
 */
export const ConfigurarDosPasosScreen: React.FC = () => {
  const { currentUser, dosPasosListo, logout } = useAuth();
  return (
    <div
      className="flex-1 w-full h-full overflow-y-auto flex items-center justify-center p-6 bg-[#f8fafc] dark:bg-[#09090b] pt-safe-top pb-safe"
      style={{ paddingTop: 'var(--header-safe-pt, max(calc(env(safe-area-inset-top, 0px) + 16px), 54px))' }}
    >
      <div className="w-full max-w-sm p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-sm space-y-4 my-auto">
        <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center"><ShieldCheck className="w-6 h-6" /></div>
        <div>
          <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">Un paso más{currentUser ? `, ${currentUser.name.split(' ')[0]}` : ''}</h1>
          <p className="text-[0.875rem] text-slate-500 dark:text-neutral-400 mt-1">
            Tu cuenta entra a los salones de otros. Para que nadie lo haga con solo tu clave, activa un código de tu teléfono.
          </p>
        </div>
        <ConfigurarDosPasos onListo={dosPasosListo} />
        <button type="button" onClick={logout} className="w-full text-[0.8125rem] text-slate-400 hover:text-slate-600 cursor-pointer">Salir</button>
      </div>
    </div>
  );
};
