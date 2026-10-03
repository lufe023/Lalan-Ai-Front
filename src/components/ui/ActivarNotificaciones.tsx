import React, { useEffect, useState } from 'react';
import { BellRing, BellOff, Loader2, Share } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { activarNotificaciones, apagarNotificaciones, estadoNotificaciones, probarNotificacion, type EstadoNotificaciones } from '../../services/notificaciones';

const TEXTO: Record<EstadoNotificaciones, string> = {
  activas: 'Activas en este aparato. Te llegan como las de cualquier app, aunque Lalan esté cerrada.',
  apagadas: 'Recibe en la pantalla del teléfono los chats que te esperan, las citas y tus informes. Es gratis.',
  bloqueadas: 'Las bloqueaste en este aparato. Para activarlas: Ajustes del teléfono → Notificaciones → Lalan.',
  instalar: 'En iPhone primero instala Lalan: toca Compartir y luego "Agregar a pantalla de inicio". Ábrela desde el ícono y vuelve aquí.',
  no_soportado: 'Este navegador no permite notificaciones. Prueba con la app instalada o con Chrome.',
  sin_servidor: 'Todavía no están configuradas en el servidor.',
  desarrollo: 'Se prueban con la app compilada (npm run movil); en modo desarrollo no hay notificaciones.',
};

/** Tarjeta para activar las notificaciones del teléfono (el permiso solo se puede pedir con un toque) */
export const ActivarNotificaciones: React.FC = () => {
  const { showToast } = useApp();
  const [estado, setEstado] = useState<EstadoNotificaciones | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { void estadoNotificaciones().then(setEstado); }, []);

  const activar = async () => {
    setOcupado(true);
    try {
      const e = await activarNotificaciones();
      setEstado(e);
      if (e === 'activas') {
        const r = await probarNotificacion();
        showToast('Notificaciones activas', r.llegaron ? 'Te mandé una de prueba.' : 'Listo. La prueba no salió; revisa que el servidor tenga las llaves.', r.llegaron ? 'success' : 'warning');
      }
    } catch (e) { showToast('No se pudieron activar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
    finally { setOcupado(false); }
  };
  const apagar = async () => {
    setOcupado(true);
    try { await apagarNotificaciones(); setEstado(await estadoNotificaciones()); } finally { setOcupado(false); }
  };

  if (!estado) return null;
  const activas = estado === 'activas';
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-2">
      <div className="flex items-center gap-2">
        {activas ? <BellRing className="w-4 h-4 text-emerald-500" /> : estado === 'instalar' ? <Share className="w-4 h-4 text-[var(--primary)]" /> : <BellOff className="w-4 h-4 text-slate-400" />}
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">Notificaciones en el teléfono</h3>
      </div>
      <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 leading-relaxed">{TEXTO[estado]}</p>
      {(estado === 'apagadas' || activas) && (
        <div className="flex gap-2">
          {!activas ? (
            <button type="button" disabled={ocupado} onClick={() => void activar()} className="min-h-[44px] px-4 rounded-xl bg-[var(--primary)] text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50 cursor-pointer">
              {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />} Activar notificaciones
            </button>
          ) : (<>
            <button type="button" disabled={ocupado} onClick={() => void probarNotificacion().then(r => showToast(r.llegaron ? 'Enviada' : 'No llegó', r.llegaron ? 'Mira la pantalla del teléfono.' : 'Vuelve a activarlas.', r.llegaron ? 'success' : 'warning'))}
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-neutral-700 text-[0.8125rem] font-bold cursor-pointer">Probar</button>
            <button type="button" disabled={ocupado} onClick={() => void apagar()} className="min-h-[40px] px-3 rounded-xl text-[0.8125rem] text-slate-500 cursor-pointer">Apagar en este aparato</button>
          </>)}
        </div>
      )}
    </div>
  );
};
