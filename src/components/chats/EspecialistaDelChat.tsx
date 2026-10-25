import React, { useEffect, useState } from 'react';
import { ShieldAlert, UserCog } from 'lucide-react';
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
export const EspecialistaDelChat: React.FC<{ conversacion: Conversation }> = ({ conversacion }) => {
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

  return (
    <>
      {modalConfirmar}
      {esp && conversacion.especialistaPausadaAt ? (
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
      ) : (
        <div className="border-t border-slate-100 dark:border-neutral-900 bg-white dark:bg-neutral-950 text-[0.75rem] text-slate-500 dark:text-neutral-400">
          <div className="px-4 py-1.5 flex items-center gap-2">
            <UserCog className={`w-3.5 h-3.5 shrink-0 ${esp ? 'text-violet-600 dark:text-violet-400' : ''}`} />
            <span className="flex-1 min-w-0 truncate">
              {esp
                ? <>Lo atiende <strong className="text-violet-700 dark:text-violet-300">{esp.nombre}</strong>{conversacion.especialistaPor ? ` · se lo pasó ${conversacion.especialistaPor.split(' ')[0]}` : ' · lo abrió desde su cita'}</>
                : 'Ninguna especialista en este chat'}
            </span>
            {otras.length > 0 && (
              <select
                value="" disabled={ocupado} onChange={e => void pasar(e.target.value)}
                aria-label="Pasar el chat a una especialista"
                className="shrink-0 font-bold underline bg-transparent border-0 cursor-pointer max-w-[9rem]"
              >
                <option value="">{esp ? 'Pasar a…' : 'Pasar a especialista…'}</option>
                {otras.map(x => <option key={x.staffId} value={x.staffId}>{x.nombre}</option>)}
              </select>
            )}
            {esp && (
              <button type="button" disabled={ocupado} onClick={() => void tomar()} className="shrink-0 font-bold text-rose-600 dark:text-rose-400 underline disabled:opacity-50 cursor-pointer">
                Tomar
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
