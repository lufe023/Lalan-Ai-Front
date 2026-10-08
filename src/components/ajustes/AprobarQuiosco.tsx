import React, { useEffect, useState } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { usePlan } from '../../context/PlanContext';
import { IOSModal } from '../ui/IOSModal';

const RUTA = /^#\/quiosco-aprobar\/(\d{6})$/;

/**
 * Se escaneó el QR que muestra un quiosco sin activar: el teléfono abre la
 * app en #/quiosco-aprobar/123456 y aquí se aprueba con un toque. Si no
 * había sesión, primero se entra y la dirección sigue esperando.
 */
export const AprobarQuiosco: React.FC = () => {
  const { showToast } = useApp();
  const { tieneModulo } = usePlan();
  const [codigo, setCodigo] = useState<string | null>(() => RUTA.exec(window.location.hash)?.[1] ?? null);
  const [sedes, setSedes] = useState<{ id: string; name: string }[]>([]);
  const [sede, setSede] = useState('');
  const [nombre, setNombre] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const alCambiar = () => setCodigo(RUTA.exec(window.location.hash)?.[1] ?? null);
    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  }, []);

  useEffect(() => {
    if (!codigo) return;
    api.get<{ sedes: { id: string; name: string }[] }>('/quiosco')
      .then((r) => { setSedes(r.sedes); setSede(r.sedes[0]?.id ?? ''); })
      .catch(() => undefined);
  }, [codigo]);

  const cerrar = () => {
    setCodigo(null);
    // Se quita de la dirección para que no vuelva a salir al recargar
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  };

  const aprobar = async () => {
    if (!codigo) return;
    setEnviando(true);
    try {
      const r = await api.post<{ nombre: string }>('/quiosco/aprobar', { codigo, locationId: sede || undefined, nombre: nombre.trim() || undefined });
      showToast('Quiosco activado', `${r.nombre} ya está recibiendo clientas.`, 'success');
      cerrar();
    } catch (e: any) {
      showToast('No se pudo activar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally {
      setEnviando(false);
    }
  };

  if (!codigo) return null;
  const incluido = tieneModulo('quiosco');

  return (
    <IOSModal isOpen onClose={cerrar} title="Activar quiosco" subtitle={`Código ${codigo}`} fixedHeight={false}>
      <div className="space-y-4 text-xs">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--primary)]/10">
          <MonitorSmartphone className="w-6 h-6 text-[var(--primary)] shrink-0" />
          <p className="text-[0.8125rem] text-slate-700 dark:text-neutral-200 leading-snug">
            {incluido
              ? 'La tablet que muestra este código quedará como quiosco de tu salón: tus clientas se anotan solas al llegar y pasan a la pizarra.'
              : 'El quiosco no está incluido en tu plan. Escríbenos para activarlo.'}
          </p>
        </div>
        {incluido && (
          <>
            <label className="block space-y-1.5">
              <span className="font-semibold text-slate-600 dark:text-neutral-300">Nombre (opcional)</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} placeholder="Ej.: Tablet de la entrada"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.875rem] text-slate-900 dark:text-white" />
            </label>
            {sedes.length > 1 && (
              <label className="block space-y-1.5">
                <span className="font-semibold text-slate-600 dark:text-neutral-300">Sede</span>
                <select value={sede} onChange={(e) => setSede(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.875rem] text-slate-900 dark:text-white">
                  {sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            )}
            <button type="button" onClick={() => void aprobar()} disabled={enviando}
              className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-bold text-[0.875rem] disabled:opacity-60 cursor-pointer">
              {enviando ? 'Activando…' : 'Activar este quiosco'}
            </button>
          </>
        )}
        <button type="button" onClick={cerrar} className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 font-semibold cursor-pointer">Cancelar</button>
      </div>
    </IOSModal>
  );
};
