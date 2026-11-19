import React, { useEffect, useState } from 'react';
import { ChevronDown, ShieldAlert, UserCog } from 'lucide-react';
import { CHIP_ABIERTO, CHIP_CHAT, CHIP_NEUTRO, CHIP_VIOLETA } from './chipsDelChat';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useConfirmar } from '../ui/ModalConfirmar';
import { chatEspecialistaApi, EspecialistaConEntrada } from '../../services/especialistas';
import type { Conversation } from '../../types';

/** Las especialistas con entrada no cambian a cada rato: se piden una vez por sesión de la app */
let enMemoria: Promise<EspecialistaConEntrada[]> | null = null;
const conEntrada = () => (enMemoria ??= chatEspecialistaApi.conEntrada().catch(() => { enMemoria = null; return []; }));

/**
 * Quién atiende el chat cuando es una especialista, para la dirección
 * (dueña y asistentes): lo ve todo, se lo pasa a otra, lo toma o, si Lalan
 * la pausó por el trato con la clienta, decide si la deja seguir.
 */
export const EspecialistaDelChat: React.FC<{
  conversacion: Conversation;
  /** «chip»: en la fila de herramientas de arriba. «alerta»: abajo, solo si Lalan la pausó */
  modo: 'chip' | 'alerta';
  abierta?: boolean;
  onAbrir?: (abrir: boolean) => void;
}> = ({ conversacion, modo, abierta = false, onAbrir }) => {
  const { showToast, recargarConversaciones } = useApp();
  const { currentUser } = useAuth();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [lista, setLista] = useState<EspecialistaConEntrada[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const esDireccion = currentUser?.role === 'admin' || currentUser?.role === 'assistant' || currentUser?.role === 'super_admin';
  useEffect(() => { if (esDireccion) void conEntrada().then(setLista); }, [esDireccion]);

  const esp = conversacion.especialista;
  if (!esDireccion || (!esp && !lista.length)) return null;
  const nombre = esp?.nombre.split(' ')[0] ?? '';
  const clienta = conversacion.clientName.split(' ')[0] || conversacion.clientName;

  const hacer = async (accion: () => Promise<unknown>, titulo: string, detalle: string) => {
    setOcupado(true);
    try {
      await accion();
      await recargarConversaciones();
      showToast(titulo, detalle, 'success');
    } catch (e: any) {
      showToast('No se pudo', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally {
      setOcupado(false);
    }
  };

  const pasar = async (staffId: string) => {
    const otra = lista.find(x => x.staffId === staffId);
    if (!otra) return;
    const si = await confirmar({
      titulo: `¿Pasarle el chat de ${clienta} a ${otra.nombre.split(' ')[0]}?`,
      mensaje: esp
        ? `${nombre} deja de poder escribir aquí. Lalan se queda callada en este chat mientras lo tenga ${otra.nombre.split(' ')[0]}.`
        : `Le escribirá a ${clienta} por el número del salón, firmado con su nombre. Lalan se queda callada mientras lo tenga, y tú ves todo lo que se escriben.`,
      textoConfirmar: 'Sí, pasárselo',
    });
    if (si) await hacer(() => chatEspecialistaApi.asignar(conversacion.id, staffId), 'Chat pasado', `${otra.nombre} ya lo tiene en Mis chats.`);
  };

  const tomar = async () => {
    const si = await confirmar({
      titulo: `¿Tomar el chat de ${clienta}?`,
      mensaje: `${nombre} deja de poder escribirle. El chat queda contigo, con Lalan en pausa.`,
      textoConfirmar: 'Sí, lo tomo', tono: 'peligro',
    });
    if (si) await hacer(() => chatEspecialistaApi.tomar(conversacion.id), 'El chat es tuyo', `${nombre} ya no puede escribir aquí.`);
  };

  const reanudar = async () => {
    const si = await confirmar({
      titulo: `¿Dejar que ${nombre} siga?`,
      mensaje: 'Revisaste lo que escribió y está bien que siga hablando con la clienta. Lalan sigue mirando el chat.',
      textoConfirmar: 'Sí, que siga',
    });
    if (si) await hacer(() => chatEspecialistaApi.reanudar(conversacion.id), 'Puede seguir', `${nombre} ya puede escribir otra vez.`);
  };

  const otras = lista.filter(x => x.staffId !== esp?.staffId);

  const pausada = !!esp && !!conversacion.especialistaPausadaAt;

  // Abajo, siempre a la vista: Lalan pausó a la especialista y hay que decidir
  if (modo === 'alerta') {
    if (!pausada) return null;
    return (
      <>
        {modalConfirmar}
        <div role="alert" className="px-4 py-2 border-t border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 text-[0.75rem] text-rose-800 dark:text-rose-200">
          <div className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="flex-1 min-w-0">
              <strong>Lalan pausó a {nombre}</strong> y su último mensaje no salió.
              {conversacion.especialistaPausaMotivo ? ` ${conversacion.especialistaPausaMotivo}` : ''}
            </p>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5 pl-6">
            <button type="button" disabled={ocupado} onClick={() => void tomar()} className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold disabled:opacity-50 cursor-pointer">Tomar el chat</button>
            <button type="button" disabled={ocupado} onClick={() => void reanudar()} className="px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-rose-200 dark:border-rose-800 font-bold disabled:opacity-50 cursor-pointer">Dejarla seguir</button>
          </div>
        </div>
      </>
    );
  }

  // Arriba, en la fila de herramientas: con quién está el chat y pasarlo
  if (pausada) return null;
  if (!esp) {
    // Sin especialista: el chip es la lista misma, un toque y se elige
    return (
      <>
        {modalConfirmar}
        <label className={`${CHIP_CHAT} ${CHIP_NEUTRO} relative ${ocupado ? 'opacity-60' : ''}`}>
          <UserCog className="w-3.5 h-3.5 shrink-0" />
          Pasar a especialista
          <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
          <select value="" disabled={ocupado} onChange={e => void pasar(e.target.value)}
            aria-label="Pasar el chat a una especialista" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
            <option value="">Pasar a especialista…</option>
            {otras.map(x => <option key={x.staffId} value={x.staffId}>{x.nombre}</option>)}
          </select>
        </label>
      </>
    );
  }
  return (
    <>
      {modalConfirmar}
      <button type="button" aria-expanded={abierta} onClick={() => onAbrir?.(!abierta)}
        className={`${CHIP_CHAT} ${abierta ? CHIP_ABIERTO : CHIP_VIOLETA}`}>
        <UserCog className="w-3.5 h-3.5 shrink-0" /> Con {nombre}
      </button>
    </>
  );
};

/** Lo que se abre al tocar el chip «Con …»: quién lo tiene, pasarlo a otra o tomarlo */
export const PanelEspecialista: React.FC<{ conversacion: Conversation }> = ({ conversacion }) => {
  const { showToast, recargarConversaciones } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [lista, setLista] = useState<EspecialistaConEntrada[]>([]);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { void conEntrada().then(setLista); }, []);
  const esp = conversacion.especialista;
  if (!esp) return null;
  const nombre = esp.nombre.split(' ')[0];
  const clienta = conversacion.clientName.split(' ')[0] || conversacion.clientName;
  const otras = lista.filter(x => x.staffId !== esp.staffId);

  const hacer = async (accion: () => Promise<unknown>, titulo: string, detalle: string) => {
    setOcupado(true);
    try {
      await accion();
      await recargarConversaciones();
      showToast(titulo, detalle, 'success');
    } catch (e: any) {
      showToast('No se pudo', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally {
      setOcupado(false);
    }
  };
  const pasar = async (staffId: string) => {
    const otra = lista.find(x => x.staffId === staffId);
    if (!otra) return;
    const si = await confirmar({
      titulo: `¿Pasarle el chat de ${clienta} a ${otra.nombre.split(' ')[0]}?`,
      mensaje: `${nombre} deja de poder escribir aquí. Lalan se queda callada en este chat mientras lo tenga ${otra.nombre.split(' ')[0]}.`,
      textoConfirmar: 'Sí, pasárselo',
    });
    if (si) await hacer(() => chatEspecialistaApi.asignar(conversacion.id, staffId), 'Chat pasado', `${otra.nombre} ya lo tiene en Mis chats.`);
  };
  const tomar = async () => {
    const si = await confirmar({
      titulo: `¿Tomar el chat de ${clienta}?`,
      mensaje: `${nombre} deja de poder escribirle. El chat queda contigo, con Lalan en pausa.`,
      textoConfirmar: 'Sí, lo tomo', tono: 'peligro',
    });
    if (si) await hacer(() => chatEspecialistaApi.tomar(conversacion.id), 'El chat es tuyo', `${nombre} ya no puede escribir aquí.`);
  };

  return (
    <div className="space-y-2 text-[0.75rem] text-slate-500 dark:text-neutral-400">
      {modalConfirmar}
      <p>
        Lo atiende <strong className="text-violet-700 dark:text-violet-300">{esp.nombre}</strong>
        {conversacion.especialistaPor ? `: se lo pasó ${conversacion.especialistaPor.split(' ')[0]}.` : ': lo abrió desde su cita.'} Tú ves todo lo que se escriben.
      </p>
      <div className="flex flex-wrap gap-2">
        {otras.length > 0 && (
          <label className={`${CHIP_CHAT} ${CHIP_NEUTRO} relative ${ocupado ? 'opacity-60' : ''}`}>
            Pasárselo a otra <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            <select value="" disabled={ocupado} onChange={e => void pasar(e.target.value)}
              aria-label="Pasar el chat a otra especialista" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
              <option value="">Pasar a…</option>
              {otras.map(x => <option key={x.staffId} value={x.staffId}>{x.nombre}</option>)}
            </select>
          </label>
        )}
        <button type="button" disabled={ocupado} onClick={() => void tomar()}
          className={`${CHIP_CHAT} border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 disabled:opacity-50`}>
          Tomar el chat
        </button>
      </div>
    </div>
  );
};
