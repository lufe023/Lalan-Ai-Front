import React, { useCallback, useEffect, useState } from 'react';
import { Eye, LifeBuoy, X } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { pedirSeccionAjustes } from '../ajustes/MenuAjustes';
import type { EntradaSoporte } from '../ajustes/TransparenciaSalon';

/**
 * A la dueña, mientras alguien de Lalan está dentro de su salón: quién y
 * para qué. Toca y abre el historial en Mi cuenta.
 */
export const AvisoSoporteDentro: React.FC = () => {
  const { navigateTo } = useApp();
  const [dentro, setDentro] = useState<EntradaSoporte | null>(null);
  const [cerrado, setCerrado] = useState<string | null>(null);

  const mirar = useCallback(() => {
    api.get<EntradaSoporte[]>('/bitacora/soporte')
      .then((l) => setDentro(l.find((e) => e.activa) ?? null))
      .catch(() => setDentro(null));
  }, []);
  useEffect(() => {
    mirar();
    const alVolver = () => { if (document.visibilityState === 'visible') mirar(); };
    document.addEventListener('visibilitychange', alVolver);
    const t = window.setInterval(mirar, 5 * 60_000);
    return () => { document.removeEventListener('visibilitychange', alVolver); window.clearInterval(t); };
  }, [mirar]);

  if (!dentro || cerrado === dentro.id) return null;
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 pl-3 pr-1 py-1 rounded-full bg-slate-900 text-white shadow-lg text-[0.8125rem] max-w-[92vw]"
      style={{ top: 'var(--banner-safe-top, max(calc(env(safe-area-inset-top, 0px) + 8px), 52px))' }}
      role="status"
    >
      {dentro.cambiar ? <LifeBuoy className="w-4 h-4 shrink-0 text-amber-400" /> : <Eye className="w-4 h-4 shrink-0 text-amber-400" />}
      <button type="button" onClick={() => { pedirSeccionAjustes('cuenta'); navigateTo('settings'); }} className="truncate text-left cursor-pointer">
        <b>{dentro.quien}, de Lalan,</b> {dentro.cambiar ? 'está ayudándote' : 'está mirando tu salón'}{dentro.motivo ? `: ${dentro.motivo}` : ''}
      </button>
      <button type="button" onClick={() => setCerrado(dentro.id)} aria-label="Ocultar" className="p-1.5 rounded-full hover:bg-white/15 cursor-pointer shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
