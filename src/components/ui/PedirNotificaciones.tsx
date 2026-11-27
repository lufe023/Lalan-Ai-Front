import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BellOff, BellRing, CalendarCheck, Loader2, MessageCircle, Smartphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { bienvenidaEstaAbierta } from '../../services/bienvenida';
import {
  activarNotificaciones, estadoNotificaciones, olvidarRecienEntro, pedirAvisosPospuesto, posponerPedirAvisos, probarNotificacion, recienEntro,
  type EstadoNotificaciones,
} from '../../services/notificaciones';
import { VerComo } from '../minitutoriales/VerComo';
import { BotonInstalar } from './InstalarApp';

/** «Ahora no»: cuántos días sin pedirlo solo (al iniciar sesión se pide igual) */
const DIAS_SIN_PEDIR = 3;
/** Bloqueadas: se recuerda cómo desbloquearlas solo al entrar, y no más de una vez cada dos semanas */
const DIAS_BLOQUEADAS = 14;
/** Se espera un momento: que la Bienvenida decida si se abre (ella trae su propio paso) */
const ESPERA_MS = 1800;

type Pedir = Extract<EstadoNotificaciones, 'apagadas' | 'instalar' | 'bloqueadas'>;

/**
 * Pide los avisos del teléfono al entrar. Sin ellos la dueña no se entera de
 * que una clienta la necesita, de lo que Lalan agendó ni de lo que falta
 * (conectar su WhatsApp). El permiso solo se puede pedir con un toque: por
 * eso es una hoja con el botón, nunca la ventana del navegador de una vez.
 *
 * - Al iniciar sesión o crear la cuenta: siempre, si están apagadas.
 * - Al abrir la app ya con sesión: si están apagadas y no dijo «Ahora no»
 *   en los últimos días.
 * - iPhone en Safari: primero hay que instalarla (es la única forma de que
 *   lleguen), así que la hoja enseña a instalar.
 * - Bloqueadas: solo al entrar, con «Ver cómo desbloquearlas».
 * - Con la Bienvenida abierta no sale: ella tiene su paso «Tu teléfono».
 */
export const PedirNotificaciones: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useApp();
  const [pedir, setPedir] = useState<Pedir | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [verComo, setVerComo] = useState(false);
  const especialista = currentUser?.role === 'especialista';
  const fuera = !currentUser || !!currentUser.soporte || currentUser.role === 'support';

  useEffect(() => {
    if (fuera) return;
    let vivo = true;
    const recien = recienEntro();
    const t = setTimeout(() => {
      olvidarRecienEntro();
      if (bienvenidaEstaAbierta()) return;
      void estadoNotificaciones().then((e) => {
        if (!vivo) return;
        if (e === 'apagadas' || e === 'instalar') {
          if (recien || !pedirAvisosPospuesto()) setPedir(e);
        } else if (e === 'bloqueadas' && recien && !pedirAvisosPospuesto()) {
          setPedir(e);
        }
      }).catch(() => undefined);
    }, ESPERA_MS);
    return () => { vivo = false; clearTimeout(t); };
  }, [fuera, currentUser?.id]);

  const ahoraNo = () => { posponerPedirAvisos(pedir === 'bloqueadas' ? DIAS_BLOQUEADAS : DIAS_SIN_PEDIR); setPedir(null); };

  const activar = async () => {
    setOcupado(true);
    try {
      const e = await activarNotificaciones();
      if (e === 'activas') {
        setPedir(null);
        const r = await probarNotificacion().catch(() => ({ llegaron: 0 }));
        showToast('Avisos activos', r.llegaron ? 'Te mandé uno de prueba.' : 'Listo: ya te llegan en este aparato.', 'success');
      } else if (e === 'bloqueadas') {
        setPedir('bloqueadas');
      } else if (e === 'apagadas') {
        // Cerró la ventana del teléfono sin elegir: se queda la hoja para volver a intentar
        showToast('No se activaron', 'Toca «Activar avisos» y elige «Permitir».', 'warning');
      } else {
        setPedir(null);
      }
    } catch (err) {
      showToast('No se pudieron activar', (err as Error)?.message || 'Inténtalo de nuevo.', 'warning');
    } finally {
      setOcupado(false);
    }
  };

  const razones = especialista
    ? [
      { icono: CalendarCheck, texto: 'Cuando te agendan una cita o te la cambian' },
      { icono: MessageCircle, texto: 'Cuando una clienta te escribe' },
    ]
    : [
      { icono: MessageCircle, texto: 'Cuando una clienta necesita que la atiendas tú' },
      { icono: CalendarCheck, texto: 'Cada cita que Lalan agenda por ti' },
      { icono: Smartphone, texto: 'Lo que falta para que Lalan atienda sola, como conectar tu WhatsApp' },
    ];

  return (
    <>
      <AnimatePresence>
        {pedir && (
          <motion.div key="pedir-avisos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              role="dialog" aria-modal="true" aria-label="Avisos de Lalan"
              className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-white dark:bg-neutral-900 text-slate-800 dark:text-neutral-100 shadow-2xl border border-slate-200 dark:border-neutral-800 p-5 space-y-4"
              style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
              <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
                {pedir === 'bloqueadas' ? <BellOff className="w-6 h-6" /> : pedir === 'instalar' ? <Smartphone className="w-6 h-6" /> : <BellRing className="w-6 h-6" />}
              </div>
              <div className="space-y-1">
                <h2 className="text-[1.25rem] font-extrabold leading-tight">
                  {pedir === 'bloqueadas' ? 'Tus avisos están bloqueados' : pedir === 'instalar' ? 'Instala Lalan para recibir avisos' : 'Activa los avisos de Lalan'}
                </h2>
                <p className="text-[0.875rem] text-slate-500 dark:text-neutral-400 leading-snug">
                  {pedir === 'bloqueadas'
                    ? 'En este aparato dijiste que no. Así no te enteras de nada hasta que abras la app. Se desbloquean en los ajustes del teléfono o del navegador.'
                    : pedir === 'instalar'
                      ? 'En iPhone los avisos solo llegan con Lalan en tu pantalla de inicio. Después la abres desde el ícono y los activas con un toque.'
                      : 'Te llegan como los de cualquier app, aunque Lalan esté cerrada. Así te enteras:'}
                </p>
              </div>
              {pedir === 'apagadas' && (
                <ul className="space-y-2">
                  {razones.map(({ icono: Icono, texto }) => (
                    <li key={texto} className="flex items-center gap-2.5 text-[0.875rem]">
                      <Icono className="w-4 h-4 text-[var(--primary)] shrink-0" /> {texto}
                    </li>
                  ))}
                </ul>
              )}
              <div className="space-y-2 pt-1">
                {pedir === 'apagadas' && (
                  <button type="button" disabled={ocupado} onClick={() => void activar()}
                    className="w-full min-h-[48px] rounded-xl bg-[var(--primary)] text-white text-[0.9375rem] font-bold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
                    {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />} Activar avisos
                  </button>
                )}
                {pedir === 'instalar' && <BotonInstalar className="w-full min-h-[48px]" />}
                {pedir === 'bloqueadas' && (
                  <button type="button" onClick={() => setVerComo(true)}
                    className="w-full min-h-[48px] rounded-xl bg-[var(--primary)] text-white text-[0.9375rem] font-bold cursor-pointer">
                    Ver cómo desbloquearlos
                  </button>
                )}
                <button type="button" onClick={ahoraNo} className="w-full min-h-[44px] rounded-xl text-[0.875rem] font-semibold text-slate-500 cursor-pointer">
                  Ahora no
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <VerComo tema={verComo ? 'permiso-notificaciones' : null} onCerrar={() => setVerComo(false)} />
    </>
  );
};
