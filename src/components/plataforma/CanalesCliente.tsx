import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { horaDe } from '../../utils/hora';

type Estado = 'ok' | 'aviso' | 'caido' | 'sin_configurar';
interface Canal {
  id: string; sede: string; canal: string; identificador: string | null; encendido: boolean; estado: Estado;
  detalle: string; nombreEnMeta: string | null; calidad: string | null; ultimoMensaje: string | null;
}
const NOMBRE: Record<string, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger' };
const ICONO: Record<Estado, { i: React.FC<{ className?: string }>; c: string }> = {
  ok: { i: CheckCircle2, c: 'text-emerald-600 dark:text-emerald-400' },
  aviso: { i: AlertTriangle, c: 'text-amber-600 dark:text-amber-400' },
  caido: { i: XCircle, c: 'text-rose-600 dark:text-rose-400' },
  sin_configurar: { i: CircleDashed, c: 'text-slate-400' },
};

function hace(iso: string | null): string {
  if (!iso) return 'nunca';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 60) return `hace ${Math.max(1, min)} min`;
  if (min < 24 * 60) return `hace ${Math.round(min / 60)} h`;
  return `${new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' })}, ${horaDe(iso)}`;
}

/**
 * Los canales de un cliente, revisados en el momento con su propio token.
 * Es lo primero que se mira cuando la dueña llama diciendo "Lalan no me contesta".
 */
export const CanalesCliente: React.FC<{ negocioId: string }> = ({ negocioId }) => {
  const [canales, setCanales] = useState<Canal[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try { setCanales(await api.get<Canal[]>(`/plataforma/salud/canales/${negocioId}`)); }
    catch (e) { setError((e as Error)?.message || 'No se pudo revisar'); }
    finally { setCargando(false); }
  }, [negocioId]);
  useEffect(() => { void cargar(); }, [cargar]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-500">Canales</div>
        <button type="button" onClick={() => void cargar()} disabled={cargando} className="text-[0.75rem] font-bold flex items-center gap-1 text-[var(--primary)] disabled:opacity-50 cursor-pointer">
          <RefreshCw className={`w-3 h-3 ${cargando ? 'animate-spin' : ''}`} /> Revisar
        </button>
      </div>
      {error && <p className="text-[0.8125rem] text-rose-600">{error}</p>}
      {!canales && !error && <div className="flex items-center gap-2 text-[0.8125rem] text-slate-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Revisando con Meta…</div>}
      {canales && canales.length === 0 && <p className="text-[0.8125rem] text-slate-500">No tiene canales conectados.</p>}
      {canales?.map(c => {
        const v = ICONO[c.estado];
        return (
          <div key={c.id} className="rounded-xl border border-slate-200 dark:border-neutral-800 p-2.5 text-[0.8125rem] space-y-0.5">
            <div className="flex items-center gap-2">
              <v.i className={`w-4 h-4 shrink-0 ${v.c}`} />
              <b>{NOMBRE[c.canal] ?? c.canal}</b>
              <span className="text-slate-500 truncate">{c.nombreEnMeta ?? c.identificador ?? ''}{c.sede ? ` · ${c.sede}` : ''}</span>
              {!c.encendido && <span className="ml-auto px-1.5 rounded-full text-[0.6875rem] font-bold bg-slate-100 dark:bg-neutral-800 text-slate-500">Lalan apagada</span>}
            </div>
            <p className="text-slate-700 dark:text-neutral-200 pl-6">{c.detalle}</p>
            <p className="text-[0.6875rem] text-slate-400 pl-6">Último mensaje de una clienta: {hace(c.ultimoMensaje)}{c.calidad ? ` · calidad ${c.calidad === 'GREEN' ? 'verde' : c.calidad === 'YELLOW' ? 'amarilla' : c.calidad === 'RED' ? 'roja' : c.calidad}` : ''}</p>
          </div>
        );
      })}
    </div>
  );
};
