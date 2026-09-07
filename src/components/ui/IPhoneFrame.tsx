import React, { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles, Bell } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import { useApp } from '../../context/AppContext';
import { useSocket, DueAppointment } from '../../hooks/useSocket';
import { tokenStore } from '../../services/api';

interface IPhoneFrameProps {
  children: React.ReactNode;
}

export const IPhoneFrame: React.FC<IPhoneFrameProps> = ({ children }) => {
  const { isDark } = useTheme();
  const { toast, dismissToast, updateAppointmentStatus } = useApp();
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
                  <Sparkles className="w-4 h-4" />
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
                  {new Date(appt.startsAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} · {appt.staffName}
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
