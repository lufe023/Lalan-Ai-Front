import React, { useState } from 'react';
import { MessageCircleWarning, X } from 'lucide-react';
import { usePlan } from '../../context/PlanContext';
import { useAuth } from '../../context/AuthContext';
import { NIVEL_MENSAJES } from '../../types/plataforma';

const TELEFONO_LALAN = '8092299444';
const CLAVE_CERRADO = 'lalan_aviso_mensajes_cerrado';

function leerCerrado(): string | null {
  try { return sessionStorage.getItem(CLAVE_CERRADO); } catch { return null; }
}

/**
 * Aviso a la dueña cuando Lalan pasa del 80 % de sus mensajes del mes, o
 * cuando ya los usó todos (los chats nuevos pasan a una persona del salón).
 */
export const AvisoMensajes: React.FC = () => {
  const { miPlan } = usePlan();
  const { currentUser } = useAuth();
  const [cerrado, setCerrado] = useState(leerCerrado);

  if (!miPlan || currentUser?.role !== 'admin' || currentUser?.soporte) return null;
  const nivel = miPlan.nivelMensajes;
  if (!nivel || nivel === NIVEL_MENSAJES.normal || cerrado === nivel) return null;

  const agotado = nivel === NIVEL_MENSAJES.agotado;
  const { mensajesMes: usados } = miPlan.uso;
  const tope = miPlan.limites.mensajesMes ?? 0;
  const cerrar = () => {
    try { sessionStorage.setItem(CLAVE_CERRADO, nivel); } catch { /* sin almacenamiento: se cierra solo por ahora */ }
    setCerrado(nivel);
  };

  return (
    <div
      role="status"
      className={`mx-3 mt-3 lg:mx-6 flex items-start gap-3 rounded-2xl px-4 py-3 text-[13px] leading-snug shadow-sm border ${
        agotado
          ? 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-100'
          : 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-100'
      }`}
    >
      <MessageCircleWarning className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="font-bold">
          {agotado ? 'Lalan usó los mensajes de tu plan este mes' : `Lalan ya usó ${usados} de sus ${tope} mensajes del mes`}
        </p>
        <p className="opacity-90">
          {agotado
            ? 'Los chats nuevos pasan a tu equipo con una nota para que ninguna clienta se quede sin respuesta. El día 1 Lalan vuelve a atender sola.'
            : 'Si llega al tope, los chats nuevos pasarán a tu equipo con una nota.'}{' '}
          <a
            href={`https://wa.me/1${TELEFONO_LALAN}?text=${encodeURIComponent('Hola, quiero subir de plan en Lalan AI')}`}
            target="_blank" rel="noreferrer"
            className="font-bold underline underline-offset-2"
            data-medir="Aviso de mensajes: subir de plan"
          >
            Subir de plan
          </a>
        </p>
      </div>
      <button type="button" onClick={cerrar} aria-label="Cerrar aviso" className="p-1 -m-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
