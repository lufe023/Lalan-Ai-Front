import React, { useState } from 'react';
import { PauseCircle, PlayCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useSedes } from '../../hooks/useSedes';
import { SelectorSede } from '../ui/SelectorSede';
import { IOSToggle } from '../ui/IOSToggle';
import { CommunicationChannel } from '../../types';

/**
 * El interruptor de Lalan, a la vista donde se leen los chats: un toque y
 * deja de contestar en ese canal (o en todos) de esta sede, al momento.
 * Los mensajes siguen llegando aquí y suenan en el teléfono para que los
 * conteste el equipo. Es el mismo interruptor de Configuración → Lalan en
 * los chats (el mismo dato), solo que no hay que ir a buscarlo.
 */
export const InterruptorLalan: React.FC = () => {
  const { botConfigs, toggleBotChannel, sedeBots, elegirSedeBots, settings, showToast } = useApp();
  const sedes = useSedes();
  const [cambiando, setCambiando] = useState(false);
  const agente = settings.aiAgentName || 'Lalan';
  const conectados = botConfigs.filter(b => b.channelIdentifier);
  if (!conectados.length) return null;

  const encendidos = conectados.filter(b => b.enabled);
  const todoEnPausa = encendidos.length === 0;
  /** Una cuenta conectada en otra sede que atiende todas: apagarla las apaga todas */
  const deTodas = (b: (typeof conectados)[number]) => sedes.length > 1 && b.todasLasSedes;

  const cambiar = async (canales: CommunicationChannel[], encender: boolean) => {
    setCambiando(true);
    try {
      for (const c of canales) await toggleBotChannel(c, encender);
      const donde = canales.length === 1 ? (conectados.find(b => b.id === canales[0])?.name ?? '') : 'todos los canales';
      showToast(
        encender ? `${agente} vuelve a contestar` : `${agente} en pausa`,
        encender
          ? `Contesta sola otra vez en ${donde}.`
          : `Ya no contesta en ${donde}. Los mensajes te llegan aquí y al teléfono para que respondas tú.`,
        'success',
      );
    } catch (e: any) {
      showToast('No se pudo cambiar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally {
      setCambiando(false);
    }
  };

  return (
    <div
      className={`p-3 rounded-2xl border space-y-2.5 ${todoEnPausa
        ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
        : 'bg-white dark:bg-neutral-900 border-slate-200/80 dark:border-neutral-800'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-bold text-slate-900 dark:text-white">
            {todoEnPausa ? `${agente} está en pausa` : `${agente} contesta sola`}
          </div>
          <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 leading-snug">
            {todoEnPausa
              ? 'Los mensajes te llegan a ti. Enciéndela cuando quieras que vuelva a contestar.'
              : 'Si quieres contestar tú, ponla en pausa con un toque.'}
          </p>
        </div>
        <SelectorSede sedes={sedes} value={sedeBots} onChange={s => void elegirSedeBots(s).catch(() => undefined)} />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {conectados.map(b => (
          <label key={b.id} className="flex items-center gap-2 text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-200">
            <IOSToggle
              id={`pausa-${b.id}`}
              checked={b.enabled}
              disabled={cambiando}
              ariaLabel={`${agente} en ${b.name}`}
              onChange={v => void cambiar([b.id], v)}
              activeColor="#22c55e"
            />
            {b.name}{deTodas(b) && <span className="font-normal text-slate-400">(todas las sedes)</span>}
          </label>
        ))}
      </div>

      {conectados.length > 1 && (
        <button
          type="button"
          disabled={cambiando}
          onClick={() => void cambiar(conectados.filter(b => b.enabled !== todoEnPausa).map(b => b.id), todoEnPausa)}
          className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 ${todoEnPausa
            ? 'bg-emerald-600 text-white'
            : 'bg-slate-100 dark:bg-neutral-800 text-slate-800 dark:text-neutral-100'}`}
        >
          {todoEnPausa
            ? <><PlayCircle className="w-4 h-4" aria-hidden="true" /> Encender a {agente} en todos</>
            : <><PauseCircle className="w-4 h-4" aria-hidden="true" /> Pausar a {agente} en todos</>}
        </button>
      )}
    </div>
  );
};
