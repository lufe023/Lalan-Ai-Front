import React, { useEffect, useState } from 'react';
import { CalendarClock, Check, Clock, Sparkles, X } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { pedirSeccionAjustes } from '../ajustes/MenuAjustes';
import { CHIP_ABIERTO, CHIP_CHAT, CHIP_NEUTRO, CHIP_VIOLETA } from './chipsDelChat';
import type { Conversation } from '../../types';

/**
 * Turno fuera de horario para ESTA clienta (una emergencia, "solo puedo a
 * las 7:30").
 *
 * Lalan nunca agenda fuera del horario por su cuenta: si la clienta lo pide
 * y ninguna hora le sirve, le pregunta a la dueña. Lo que pidió llega aquí
 * arriba, en una tarjeta con dos botones: «Sí, dale ese turno» (Lalan se lo
 * agenda y se lo confirma) o «No puedo» (Lalan se lo dice con cariño y le
 * ofrece otra hora). Sin pedido, el permiso a mano (24 horas) es un chip de la
 * fila de herramientas de arriba del chat.
 * Solo la dueña o la administración deciden; el resto del equipo lo ve.
 */

/** Un pedido viejo ya no se ofrece: la clienta ya resolvió por otro lado */
const PEDIDO_VIGENTE_MS = 48 * 60 * 60 * 1000;

interface Estado { hasta: string | null; por: string | null; pedido: string | null }
type Respuesta = {
  fueraDeHorarioHasta: string | null; fueraDeHorarioPor: string | null; aviso?: string | null;
  /** Un backend sin `aviso` dice así que la ventana de 24 h está cerrada */
  lalanLeEscribe?: boolean; motivo?: string;
};

/**
 * Lo que la dueña decide en una tarjeta se avisa a la otra (la de arriba y la
 * de abajo del mismo chat), sin esperar a que el chat se vuelva a cargar.
 */
const EVENTO_TURNO = 'lalan:turno-especial';
const avisarDecision = (id: string, estado: Estado) =>
  window.dispatchEvent(new CustomEvent(EVENTO_TURNO, { detail: { id, estado } }));

/** El estado del turno especial de un chat, con lo que la dueña acaba de decidir encima */
function useTurnoEspecial(conversacion: Conversation) {
  const { showToast } = useApp();
  const [estado, setEstado] = useState<Estado | null>(null);
  useEffect(() => {
    const oir = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; estado: Estado }>).detail;
      if (d?.id === conversacion.id) setEstado(d.estado);
    };
    window.addEventListener(EVENTO_TURNO, oir);
    return () => window.removeEventListener(EVENTO_TURNO, oir);
  }, [conversacion.id]);
  const [ocupado, setOcupado] = useState<'si' | 'no' | null>(null);
  const hasta = estado ? estado.hasta : conversacion.fueraDeHorarioHasta ?? null;
  const por = estado ? estado.por : conversacion.fueraDeHorarioPor ?? null;
  const vigente = !!hasta && new Date(hasta).getTime() > Date.now();
  const pedidoEn = conversacion.fueraDeHorarioPedidoEn ? new Date(conversacion.fueraDeHorarioPedidoEn).getTime() : 0;
  const pedido = estado ? estado.pedido
    : conversacion.fueraDeHorarioPedido && Date.now() - pedidoEn < PEDIDO_VIGENTE_MS ? conversacion.fueraDeHorarioPedido : null;
  const nombre = conversacion.clientName.split(' ')[0] || conversacion.clientName;

  const decidir = async (autorizar: boolean) => {
    setOcupado(autorizar ? 'si' : 'no');
    try {
      const r = await api.post<Respuesta>(`/chat/panel/conversaciones/${conversacion.id}/fuera-de-horario`, { autorizar });
      avisarDecision(conversacion.id, { hasta: r.fueraDeHorarioHasta, por: r.fueraDeHorarioPor, pedido: null });
      const aviso = r.aviso ?? (r.lalanLeEscribe === false ? r.motivo ?? null : null);
      if (aviso) {
        // Quedó decidido, pero Lalan no pudo escribirle (más de 24 h, canal apagado o sin conectar)
        showToast(autorizar ? 'Turno autorizado' : 'Listo', /escr[ií]bele t[uú]/i.test(aviso) ? aviso : `${aviso} Escríbele tú a ${nombre}.`, 'warning');
      } else if (autorizar) {
        showToast('Turno autorizado', pedido ? `Lalan le agenda ese turno a ${nombre} y se lo confirma.` : `Lalan le pregunta a ${nombre} qué día y hora le conviene.`, 'success');
      } else {
        showToast(pedido ? 'Le avisamos que no' : 'Autorización quitada',
          pedido ? `Lalan se lo dice a ${nombre} con cariño y le ofrece la hora libre más cercana.` : 'Lalan vuelve a agendar solo dentro del horario.', 'success');
      }
    } catch (e: any) {
      showToast('No se pudo cambiar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally {
      setOcupado(null);
    }
  };

  return { hasta, por, vigente, pedido, nombre, ocupado, decidir };
}

/**
 * Arriba del chat, donde se ve al entrar: lo que pidió la clienta y los dos
 * botones para decidir. Es lo que abre el aviso del teléfono.
 */
export const PedidoFueraDeHorario: React.FC<{ conversacion: Conversation; puedeAutorizar: boolean; ventanaCerrada?: boolean }> = ({ conversacion, puedeAutorizar, ventanaCerrada = false }) => {
  const { navigateTo } = useApp();
  const t = useTurnoEspecial(conversacion);
  if (!t.pedido || t.vigente) return null;

  const irAlHorarioExtra = () => {
    pedirSeccionAjustes('salon');
    navigateTo('settings');
    // Que caiga justo en la tarjeta del horario extra
    window.setTimeout(() => document.getElementById('horario-extra')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 450);
  };

  return (
    <div role="region" aria-label="Turno fuera de horario por decidir"
      className="shrink-0 mx-3 mt-2 p-3 rounded-2xl border border-violet-200 dark:border-violet-900 bg-violet-50 dark:bg-violet-950/50 text-violet-900 dark:text-violet-100 shadow-sm">
      <div className="flex items-start gap-2.5">
        <span className="w-8 h-8 shrink-0 rounded-xl bg-violet-600 text-white flex items-center justify-center">
          <Clock className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[0.8125rem] font-bold leading-snug">{t.nombre} quiere un turno fuera de horario</p>
          <p className="mt-0.5 text-[0.8125rem] leading-snug">{t.pedido}</p>
        </div>
      </div>
      {puedeAutorizar ? (
        <>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button type="button" disabled={!!t.ocupado} onClick={() => void t.decidir(true)}
              className="h-10 rounded-xl bg-violet-600 text-white text-[0.8125rem] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60 ios-touch cursor-pointer shadow-sm">
              <Check className="w-4 h-4" /> {t.ocupado === 'si' ? 'Un momento…' : 'Sí, dale ese turno'}
            </button>
            <button type="button" disabled={!!t.ocupado} onClick={() => void t.decidir(false)}
              className="h-10 rounded-xl bg-white dark:bg-neutral-900 border border-violet-200 dark:border-violet-800 text-[0.8125rem] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60 ios-touch cursor-pointer">
              <X className="w-4 h-4" /> {t.ocupado === 'no' ? 'Un momento…' : 'No puedo'}
            </button>
          </div>
          <p className="mt-2 text-[0.6875rem] text-violet-700/80 dark:text-violet-300/80 leading-snug">
            {ventanaCerrada
              ? `Pasaron más de 24 horas: Lalan no puede escribirle ahora. Con el sí, se lo ofrece cuando ${t.nombre} vuelva a escribir.`
              : 'Con el sí, Lalan se lo agenda y se lo confirma. Con el no, se lo dice con cariño y le ofrece otra hora.'}{' '}
            <button type="button" onClick={irAlHorarioExtra} className="font-bold underline cursor-pointer">
              ¿Te pasa seguido? Abre un horario extra
            </button>
          </p>
        </>
      ) : (
        <p className="mt-2 text-[0.75rem] text-violet-700/80 dark:text-violet-300/80">Esperando que la dueña o la administración decidan.</p>
      )}
    </div>
  );
};

/**
 * En la fila de herramientas de arriba del chat: el turno autorizado (y
 * quitarlo), o darle permiso a mano cuando la clienta lo pidió hablando con
 * una persona. Es un chip; lo de decidir se abre debajo (PanelTurnoEspecial).
 */
export const TurnoEspecialChip: React.FC<{ conversacion: Conversation; puedeAutorizar: boolean; abierta: boolean; onAbrir: (abrir: boolean) => void }> = ({ conversacion, puedeAutorizar, abierta, onAbrir }) => {
  const t = useTurnoEspecial(conversacion);
  // Con un pedido por decidir, la tarjeta de arriba ya tiene los botones
  const porDecidir = !!t.pedido && !t.vigente;
  if (!t.vigente && (!puedeAutorizar || porDecidir)) return null;
  const cuando = t.hasta ? new Date(t.hasta).toLocaleString('es-DO', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : '';
  return (
    <button type="button" aria-expanded={abierta} onClick={() => onAbrir(!abierta)}
      className={`${CHIP_CHAT} ${abierta ? CHIP_ABIERTO : t.vigente ? CHIP_VIOLETA : CHIP_NEUTRO}`}>
      {t.vigente ? <Sparkles className="w-3.5 h-3.5 shrink-0" /> : <CalendarClock className="w-3.5 h-3.5 shrink-0" />}
      {t.vigente ? `Turno extra hasta ${cuando}` : 'Turno fuera de horario'}
    </button>
  );
};

export const PanelTurnoEspecial: React.FC<{ conversacion: Conversation; puedeAutorizar: boolean; ventanaCerrada?: boolean; onListo: () => void }> = ({ conversacion, puedeAutorizar, ventanaCerrada = false, onListo }) => {
  const t = useTurnoEspecial(conversacion);
  const cuando = t.hasta ? new Date(t.hasta).toLocaleString('es-DO', { weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: true }) : '';
  const decidir = async (autorizar: boolean) => { await t.decidir(autorizar); onListo(); };
  return (
    <div className="space-y-2 text-[0.75rem] text-slate-500 dark:text-neutral-400">
      {t.vigente ? (
        <>
          <p>
            <span className="font-bold text-violet-700 dark:text-violet-300">Lalan puede darle a {t.nombre} un turno fuera de horario</span>
            {t.por ? ` (lo permitió ${t.por})` : ''} hasta el {cuando}.
          </p>
          {puedeAutorizar && (
            <button type="button" disabled={!!t.ocupado} onClick={() => void decidir(false)}
              className={`${CHIP_CHAT} ${CHIP_NEUTRO} disabled:opacity-50`}>
              <X className="w-3.5 h-3.5" /> {t.ocupado ? 'Un momento…' : 'Quitar el permiso'}
            </button>
          )}
        </>
      ) : (
        <>
          <p>
            ¿{t.nombre} solo puede venir fuera de tu horario? Dale permiso y, durante 24 horas, Lalan le ofrece horas fuera del horario.
            {ventanaCerrada ? ` Pasaron más de 24 horas desde su último mensaje: se lo ofrece cuando ${t.nombre} vuelva a escribir.` : ''}
          </p>
          <button type="button" disabled={!!t.ocupado} onClick={() => void decidir(true)}
            className="h-9 px-4 rounded-xl bg-violet-600 text-white text-[0.8125rem] font-bold flex items-center gap-1.5 disabled:opacity-50 ios-touch cursor-pointer shadow-sm">
            <Check className="w-4 h-4" /> {t.ocupado ? 'Un momento…' : 'Darle un turno'}
          </button>
        </>
      )}
    </div>
  );
};
