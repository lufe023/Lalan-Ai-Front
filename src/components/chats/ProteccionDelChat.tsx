import React, { useState } from 'react';
import { Ban, ShieldAlert } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import type { Conversation } from '../../types';

interface EstadoProteccion {
  bloqueada: boolean;
  bloqueadaPor: string | null;
  silenciadaHasta: string | null;
}

/**
 * Defensa contra quien inunda los chats. Si alguien escribe como una máquina,
 * la app pone su chat en pausa una hora: sus mensajes se guardan como texto,
 * sin archivos y sin que Lalan conteste. Desde aquí se quita la pausa (era
 * una clienta real) o se bloquea (no se guarda nada más de esa persona).
 */
export const ProteccionDelChat: React.FC<{ conversacion: Conversation; puedeBloquear: boolean }> = ({ conversacion, puedeBloquear }) => {
  const { showToast } = useApp();
  const [estado, setEstado] = useState<EstadoProteccion | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const bloqueada = estado ? estado.bloqueada : !!conversacion.bloqueada;
  const por = estado ? estado.bloqueadaPor : conversacion.bloqueadaPor ?? null;
  const hasta = estado ? estado.silenciadaHasta : conversacion.silenciadaHasta ?? null;
  const enPausa = !bloqueada && !!hasta && new Date(hasta).getTime() > Date.now();

  if (!bloqueada && !enPausa) return null;

  const llamar = async (ruta: string, cuerpo: object | undefined, titulo: string, detalle: string) => {
    setOcupado(true);
    try {
      const r = await api.post<Partial<EstadoProteccion>>(`/chat/panel/conversaciones/${conversacion.id}/${ruta}`, cuerpo ?? {});
      setEstado({ bloqueada: !!r.bloqueada, bloqueadaPor: r.bloqueadaPor ?? null, silenciadaHasta: r.silenciadaHasta ?? null });
      showToast(titulo, detalle, 'success');
    } catch (e: any) {
      showToast('No se pudo cambiar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally {
      setOcupado(false);
    }
  };

  const cuando = hasta ? new Date(hasta).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
  return (
    <div className={`px-4 py-1.5 flex items-center gap-2 text-[10.5px] border-t ${bloqueada
      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200/70 dark:border-rose-900 text-rose-800 dark:text-rose-200'
      : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/70 dark:border-amber-900 text-amber-800 dark:text-amber-200'}`}>
      {bloqueada ? <Ban className="w-3.5 h-3.5 shrink-0" /> : <ShieldAlert className="w-3.5 h-3.5 shrink-0" />}
      {bloqueada ? (
        <span className="flex-1 min-w-0">
          <span className="font-bold">Bloqueado</span>{por ? ` por ${por}` : ''}: lo que mande no se guarda.
        </span>
      ) : (
        <span className="flex-1 min-w-0">
          <span className="font-bold">En pausa por posible spam</span> hasta las {cuando}: Lalan no contesta y no se guardan sus archivos.
        </span>
      )}
      {enPausa && (
        <button type="button" disabled={ocupado} className="shrink-0 font-bold underline disabled:opacity-50 cursor-pointer"
          onClick={() => void llamar('quitar-pausa', undefined, 'Pausa quitada', 'Lalan vuelve a atender este chat.')}>
          Es una clienta
        </button>
      )}
      {puedeBloquear && (
        <button type="button" disabled={ocupado} className="shrink-0 font-bold underline disabled:opacity-50 cursor-pointer"
          onClick={() => void llamar('bloqueo', { bloquear: !bloqueada },
            bloqueada ? 'Desbloqueado' : 'Bloqueado',
            bloqueada ? 'Sus mensajes vuelven a entrar.' : 'No se guardará nada más de esta persona.')}>
          {bloqueada ? 'Desbloquear' : 'Bloquear'}
        </button>
      )}
    </div>
  );
};

/**
 * Bloquear a alguien que no está en pausa (insulta, manda cosas que no son
 * del salón). Pide confirmación con un segundo toque.
 */
export const BloquearChat: React.FC<{ conversacion: Conversation }> = ({ conversacion }) => {
  const { showToast } = useApp();
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  if (conversacion.bloqueada) return null;

  const bloquear = async () => {
    setOcupado(true);
    try {
      await api.post(`/chat/panel/conversaciones/${conversacion.id}/bloqueo`, { bloquear: true });
      // La app avisa por socket y la lista se refresca sola con el chat bloqueado
      showToast('Bloqueado', 'No se guardará nada más de esta persona.', 'success');
    } catch (e: any) {
      showToast('No se pudo bloquear', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally {
      setOcupado(false);
      setConfirmar(false);
    }
  };

  return confirmar ? (
    <span className="shrink-0 flex items-center gap-2">
      ¿Bloquear?
      <button type="button" disabled={ocupado} onClick={() => void bloquear()} className="font-bold underline text-rose-600 dark:text-rose-300 disabled:opacity-50 cursor-pointer">Sí</button>
      <button type="button" onClick={() => setConfirmar(false)} className="font-bold underline cursor-pointer">No</button>
    </span>
  ) : (
    <button type="button" onClick={() => setConfirmar(true)} className="shrink-0 font-bold underline text-slate-400 hover:text-rose-600 cursor-pointer">
      Bloquear
    </button>
  );
};
