import React from 'react';
import { Ban, IdCard, Link2, X } from 'lucide-react';
import { CarrilHorizontal } from '../ui/CarrilHorizontal';
import { ClientaDelChat } from './ClientaDelChat';
import { SedeDelChat } from './SedeDelChat';
import { EspecialistaDelChat, PanelEspecialista } from './EspecialistaDelChat';
import { PanelTurnoEspecial, TurnoEspecialChip } from './TurnoEspecial';
import { BloquearChat } from './ProteccionDelChat';
import { CHIP_ABIERTO, CHIP_AMBAR, CHIP_CHAT, CHIP_NEUTRO, type HerramientaDelChat } from './chipsDelChat';
import type { Conversation } from '../../types';

const TITULO: Record<HerramientaDelChat, string> = {
  ficha: 'Su ficha',
  especialista: 'Especialista',
  turno: 'Turno fuera de horario',
  bloquear: 'Bloquear',
};

interface Props {
  conversacion: Conversation;
  puedeAutorizar: boolean;
  ventanaCerrada: boolean;
  abierta: HerramientaDelChat | null;
  onAbrir: (h: HerramientaDelChat | null) => void;
  onAbrirFicha: () => void;
}

/**
 * Las herramientas del chat que se usan de vez en cuando (su ficha, la sede,
 * la especialista, el turno fuera de horario, bloquear), en una fila de chips
 * debajo del nombre. Se ven siempre, pero ocupan una línea: lo de cada una se
 * abre debajo al tocarla. Lo que no puede esperar (24 horas, spam, Lalan pausó
 * a la especialista) sigue abajo, siempre a la vista.
 */
export const HerramientasDelChat: React.FC<Props> = ({ conversacion, puedeAutorizar, ventanaCerrada, abierta, onAbrir, onAbrirFicha }) => {
  const alternar = (h: HerramientaDelChat) => (abrir: boolean) => onAbrir(abrir ? h : null);
  const cerrar = () => onAbrir(null);
  const tieneFicha = !!conversacion.clientId;

  return (
    <div className="shrink-0 border-b border-slate-200/70 dark:border-neutral-800/80 bg-white/80 dark:bg-neutral-950/80">
      <CarrilHorizontal etiqueta="Herramientas del chat" className="gap-1.5 px-3 py-1.5">
        <button type="button" aria-expanded={abierta === 'ficha'} onClick={() => onAbrir(abierta === 'ficha' ? null : 'ficha')}
          className={`${CHIP_CHAT} ${abierta === 'ficha' ? CHIP_ABIERTO : tieneFicha ? CHIP_NEUTRO : CHIP_AMBAR}`}>
          {tieneFicha ? <IdCard className="w-3.5 h-3.5 shrink-0" /> : <Link2 className="w-3.5 h-3.5 shrink-0" />}
          {tieneFicha ? 'Ficha' : 'Sin ficha · unir'}
        </button>
        <SedeDelChat conversacion={conversacion} />
        <EspecialistaDelChat conversacion={conversacion} modo="chip" abierta={abierta === 'especialista'} onAbrir={alternar('especialista')} />
        <TurnoEspecialChip conversacion={conversacion} puedeAutorizar={puedeAutorizar} abierta={abierta === 'turno'} onAbrir={alternar('turno')} />
        {puedeAutorizar && !conversacion.bloqueada && (
          <button type="button" aria-expanded={abierta === 'bloquear'} onClick={() => onAbrir(abierta === 'bloquear' ? null : 'bloquear')}
            className={`${CHIP_CHAT} ${abierta === 'bloquear' ? CHIP_ABIERTO : CHIP_NEUTRO}`}>
            <Ban className="w-3.5 h-3.5 shrink-0" /> Bloquear
          </button>
        )}
      </CarrilHorizontal>

      {abierta && (
        <div role="region" aria-label={TITULO[abierta]} className="px-4 pb-3 pt-1 max-h-[45vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[0.6875rem] font-extrabold uppercase tracking-wide text-slate-400">{TITULO[abierta]}</span>
            <button type="button" aria-label="Cerrar" onClick={cerrar} className="p-1 -mr-1 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-400 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          {abierta === 'ficha' && <ClientaDelChat conversacion={conversacion} onAbrirFicha={onAbrirFicha} onListo={cerrar} />}
          {abierta === 'especialista' && <PanelEspecialista conversacion={conversacion} />}
          {abierta === 'turno' && <PanelTurnoEspecial conversacion={conversacion} puedeAutorizar={puedeAutorizar} ventanaCerrada={ventanaCerrada} onListo={cerrar} />}
          {abierta === 'bloquear' && <BloquearChat conversacion={conversacion} onListo={cerrar} />}
        </div>
      )}
    </div>
  );
};
