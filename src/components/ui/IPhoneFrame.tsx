import React, { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles, Bell, AlertTriangle, BellRing, Coffee, Music2, HeartHandshake, X } from 'lucide-react';
import { LogoLalan } from './LogoLalan';
import { useTheme } from '../../theme/ThemeContext';
import { useDinero } from '../../hooks/useDinero';
import { useApp } from '../../context/AppContext';
import { useSocket, DueAppointment } from '../../hooks/useSocket';
import { tokenStore } from '../../services/api';

interface IPhoneFrameProps {
  children: React.ReactNode;
}

export const IPhoneFrame: React.FC<IPhoneFrameProps> = ({ children }) => {
  const { dinero } = useDinero();
  const { isDark } = useTheme();
  const {
    toast, dismissToast, updateAppointmentStatus, avisosAtencion, abrirConversacion, descartarAviso, navigateTo,
    bienvenida, cerrarBienvenida, addSaleItem, showToast, consulta,
  } = useApp();
  const [servidos, setServidos] = useState<string[]>([]);
  const servir = async (p: { productoId: string; nombre: string; precio: number; cortesia: boolean }) => {
    await addSaleItem(p.cortesia
      ? { kind: 'courtesy', productId: p.productoId, label: p.nombre, quantity: 1 }
      : { kind: 'product', productId: p.productoId, quantity: 1 });
    setServidos(s => [...s, p.productoId]);
    showToast(`${p.nombre} en camino`, `Anotado en la comanda de ${bienvenida?.nombre.split(' ')[0] ?? 'la clienta'}.`, 'success');
  };
  /* Permiso para avisar con la app en segundo plano: se pide desde el propio
     aviso, con un toque de la persona, que es cuando el navegador lo deja */
  const [permisoAvisos, setPermisoAvisos] = useState<string>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  const pedirPermisoAvisos = async () => {
    try { setPermisoAvisos(await Notification.requestPermission()); } catch { /* noop */ }
  };
  const [dueAppointments, setDueAppointments] = useState<DueAppointment[]>([]);
  const token = tokenStore.get();

  const handleAppointmentDue = useCallback((appt: DueAppointment) => {
    setDueAppointments(prev => {
      if (prev.some(a => a.id === appt.id)) return prev; // dedup
      return [...prev, appt];
    });
  }, []);

  useSocket({ token, onAppointmentDue: handleAppointmentDue });

  const dismissDue = (id: string) => setDueAppointments(prev => prev.filter(a => a.id !== id));

  const handleDueAction = (appt: DueAppointment, status: 'attending' | 'completed') => {
    const completedAt = status === 'completed' ? new Date().toISOString() : undefined;
    updateAppointmentStatus(appt.id, status, completedAt);
    dismissDue(appt.id);
  };

  return (
    <div
      className={`h-dvh w-full overflow-hidden transition-colors duration-300 ${
        isDark ? 'bg-neutral-950' : 'bg-slate-100'
      }`}
    >
      {/* Mobile: centered narrow container. Desktop (lg+): full-width, no cap */}
      <div
        className={`relative w-full h-full max-w-[520px] mx-auto lg:max-w-none flex flex-col ${
          isDark ? 'bg-[#09090b]' : 'bg-[#f8fafc]'
        }`}
      >
        {/* Toast — top-right, always above modals */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ y: -70, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -70, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              onClick={dismissToast}
              className="absolute top-4 right-4 left-4 lg:left-auto lg:w-96 z-[200] p-3 rounded-2xl bg-neutral-900/95 text-white backdrop-blur-xl border border-white/15 shadow-2xl flex items-center justify-between gap-3 cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center text-white shrink-0 shadow-sm">
                  <LogoLalan className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{toast.title}</div>
                  <div className="text-[11px] text-neutral-300 truncate">{toast.message}</div>
                </div>
              </div>
              <span className="text-[10px] text-neutral-400 shrink-0">Toca para cerrar</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Preguntas de la app (reprogramar una llegada, cita duplicada…) ── */}
        <AnimatePresence>
          {consulta && (
            <motion.div
              key="consulta"
              className="absolute inset-0 z-[450] flex items-center justify-center bg-black/50 backdrop-blur-sm px-5"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => consulta.responder(null)}
            >
              <motion.div
                role="alertdialog"
                aria-label={consulta.titulo}
                onClick={e => e.stopPropagation()}
                initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 16 }}
                className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-3xl p-5 shadow-2xl border border-white/10 space-y-3"
              >
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{consulta.titulo}</h3>
                <p className="text-sm text-slate-600 dark:text-neutral-300 leading-relaxed">{consulta.mensaje}</p>
                <div className="flex flex-col gap-2 pt-1">
                  {consulta.opciones.map(o => (
                    <button
                      key={o.id}
                      onClick={() => consulta.responder(o.id)}
                      className={`w-full py-2.5 rounded-xl text-sm font-bold cursor-pointer transition ${
                        o.principal
                          ? 'bg-[var(--primary)] text-white hover:opacity-90'
                          : 'bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 hover:bg-slate-200 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {o.texto}
                    </button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bienvenida: llegó una clienta y quien la recibe ve lo suyo ── */}
        <AnimatePresence>
          {bienvenida && (
            <motion.div
              key={bienvenida.clienteId}
              className="absolute inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm px-5"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { cerrarBienvenida(); setServidos([]); }}
            >
              <motion.div
                role="dialog"
                aria-label={`Llegó ${bienvenida.nombre}`}
                onClick={e => e.stopPropagation()}
                initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
                className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl p-5 shadow-2xl border border-white/10 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-[var(--primary)]/15 flex items-center justify-center shrink-0">
                    <HeartHandshake className="w-6 h-6 text-[var(--primary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--primary)]">
                      {bienvenida.primeraVez ? 'Primera visita' : `Visita n.º ${bienvenida.visitas + 1}`}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Llegó {bienvenida.nombre}</h3>
                    {bienvenida.servicio && (
                      <p className="text-xs text-slate-500 dark:text-neutral-400">
                        {bienvenida.servicio}{bienvenida.especialista ? ` · con ${bienvenida.especialista}` : ''}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => { cerrarBienvenida(); setServidos([]); }}
                    aria-label="Cerrar"
                    className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                {bienvenida.alergias && (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 flex gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span><span className="font-bold">Alergias y cuidados:</span> {bienvenida.alergias}</span>
                  </div>
                )}

                <div className="space-y-1.5 text-xs">
                  <div className="flex gap-2 text-slate-700 dark:text-neutral-200">
                    <Coffee className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>
                      {bienvenida.bebidas.length || bienvenida.comida.length
                        ? <>Le gusta tomar: <span className="font-semibold">{[...bienvenida.bebidas, ...bienvenida.comida].join(', ')}</span></>
                        : 'Todavía no sabemos qué le gusta tomar: pregúntaselo y anótalo en su ficha.'}
                    </span>
                  </div>
                  <div className="flex gap-2 text-slate-700 dark:text-neutral-200">
                    <Music2 className="w-4 h-4 shrink-0 text-purple-600" />
                    <span>
                      {bienvenida.musica.length
                        ? <>Ya suena su música: <span className="font-semibold">{bienvenida.musica.join(', ')}</span></>
                        : 'Sin gustos musicales guardados todavía.'}
                    </span>
                  </div>
                  {bienvenida.notas && (
                    <p className="text-[11px] text-slate-500 dark:text-neutral-400 pl-6">Notas: {bienvenida.notas}</p>
                  )}
                </div>

                {bienvenida.paraServir.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Para recibirla</div>
                    <div className="flex flex-wrap gap-2">
                      {bienvenida.paraServir.map(p => {
                        const hecho = servidos.includes(p.productoId);
                        return (
                          <button
                            key={p.productoId}
                            disabled={hecho}
                            onClick={() => void servir(p)}
                            className="px-3 py-2 rounded-xl bg-[var(--primary)] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                          >
                            {hecho ? `✓ ${p.nombre}` : `Servir ${p.nombre}`}
                            <span className="ml-1 font-normal opacity-80">{p.cortesia ? '· cortesía' : `· ${dinero(p.precio)}`}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => { cerrarBienvenida(); setServidos([]); navigateTo('lounge'); }}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-xs font-bold text-slate-700 dark:text-neutral-200 cursor-pointer"
                  >
                    Ir al Lounge
                  </button>
                  <button
                    onClick={() => { cerrarBienvenida(); setServidos([]); }}
                    className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-xs font-bold text-white dark:text-slate-900 cursor-pointer"
                  >
                    Listo
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Conversaciones que piden a una persona ── */}
        <div className="absolute top-20 right-4 left-4 lg:left-auto lg:w-96 z-[190] space-y-2 pointer-events-none">
          <AnimatePresence>
            {avisosAtencion.map(a => (
              <motion.div
                key={a.conversacionId}
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 40, opacity: 0 }}
                className="pointer-events-auto p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 shadow-xl"
                role="alert"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-amber-900 dark:text-amber-100">
                      {a.tipo === 'cita' ? `Cita de ${a.cliente} sin especialista` : `${a.cliente} necesita a una persona`}
                    </div>
                    <div className="text-[11px] text-amber-800/90 dark:text-amber-200/90 line-clamp-2">{a.motivo}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => {
                          if (a.tipo === 'cita') { descartarAviso(a.conversacionId); navigateTo('calendar'); }
                          else abrirConversacion(a.conversacionId);
                        }}
                        className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold cursor-pointer"
                      >
                        {a.tipo === 'cita' ? 'Ver en la agenda' : 'Abrir chat'}
                      </button>
                      <button
                        onClick={() => descartarAviso(a.conversacionId)}
                        className="px-2 py-1 rounded-lg text-amber-800 dark:text-amber-200 text-[11px] font-semibold hover:bg-amber-100 dark:hover:bg-amber-900 cursor-pointer"
                      >
                        Luego
                      </button>
                      {permisoAvisos === 'default' && (
                        <button
                          onClick={pedirPermisoAvisos}
                          className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-amber-800 dark:text-amber-200 underline cursor-pointer"
                        >
                          <BellRing className="w-3 h-3" /> Avisarme también fuera de la app
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* ── Appointment Due Notifications ── */}
        <AnimatePresence>
          {dueAppointments.length > 0 && dueAppointments.map((appt, idx) => (
            <motion.div
              key={appt.id}
              className="absolute inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ zIndex: 400 + idx }}
            >
              <motion.div
                className="bg-white dark:bg-neutral-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-white/10"
                initial={{ scale: 0.88, y: 24, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.88, y: 24, opacity: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 280 }}
              >
                {/* Pulse icon */}
                <div className="flex items-center justify-center mb-4">
                  <motion.div
                    className="w-14 h-14 rounded-full bg-[var(--primary)]/15 flex items-center justify-center"
                    animate={{ scale: [1, 1.12, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Bell className="w-6 h-6 text-[var(--primary)]" />
                  </motion.div>
                </div>

                <div className="text-center mb-1">
                  <span className="text-xs font-bold uppercase tracking-widest text-[var(--primary)]">Cita ahora</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-neutral-100 text-center mb-0.5">
                  {appt.clientName}
                </h3>
                <p className="text-sm text-slate-500 dark:text-neutral-400 text-center mb-1">
                  {appt.serviceName}
                </p>
                <p className="text-xs text-slate-400 dark:text-neutral-500 text-center mb-5">
                  {new Date(appt.startsAt).toLocaleTimeString('es-MX', { hour: 'numeric', hour12: true, minute: '2-digit' })} · {appt.staffName}
                </p>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleDueAction(appt, 'attending')}
                    className="w-full py-3 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/30 ios-touch cursor-pointer hover:bg-amber-500/25 text-sm"
                  >
                    💆‍♀️ Marcar en Atención
                  </button>
                  <button
                    onClick={() => handleDueAction(appt, 'completed')}
                    className="w-full py-3 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-500/30 ios-touch cursor-pointer hover:bg-emerald-500/25 text-sm"
                  >
                    ✓ Completar ahora
                  </button>
                  <button
                    onClick={() => dismissDue(appt.id)}
                    className="w-full py-2.5 rounded-xl text-slate-500 dark:text-neutral-400 text-sm font-medium ios-touch cursor-pointer hover:bg-slate-100 dark:hover:bg-neutral-800"
                  >
                    Recordar después
                  </button>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Screen content fills available height */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
};
