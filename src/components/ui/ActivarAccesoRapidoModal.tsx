import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, Zap, ShieldCheck, X, Check } from 'lucide-react';
import { quickAuth, getFriendlyDeviceName } from '../../services/quickAuth';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ActivarAccesoRapidoModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const { showToast } = useApp();
  const [loading, setLoading] = useState(false);
  const deviceName = getFriendlyDeviceName();

  if (!isOpen || !currentUser) return null;

  const handleActivar = async () => {
    setLoading(true);
    try {
      await quickAuth.registerDevice({
        id: currentUser.id,
        name: currentUser.name,
        email: (currentUser as any).email ?? '',
        role: currentUser.role,
        avatar: currentUser.avatar,
      });
      showToast(
        '¡Acceso Rápido activado!',
        `La próxima vez podrás entrar a Lalan con 1 solo toque desde tu ${deviceName}.`,
        'success'
      );
      onClose();
    } catch (err: any) {
      // No se guardó nada: se dice la verdad (antes decía "guardado" aunque fallara)
      showToast('No se pudo activar el acceso rápido', err?.message || 'Inténtalo de nuevo desde Configuración.', 'warning');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-sm rounded-[28px] bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 p-6 shadow-2xl overflow-hidden"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon Badge */}
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4 border border-amber-500/20 shadow-xs">
            <Zap className="w-7 h-7 fill-amber-500 text-amber-500" />
          </div>

          <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight mb-1.5">
            ¿Activar Acceso Rápido?
          </h3>

          <p className="text-xs text-slate-500 dark:text-neutral-400 leading-relaxed mb-4">
            Podrás entrar a <strong className="text-slate-800 dark:text-neutral-200">Lalan AI</strong> con <span className="text-amber-500 font-semibold">1 solo toque</span> desde este <strong className="text-slate-800 dark:text-neutral-200">{deviceName}</strong>, sin escribir correo ni contraseñas.
          </p>

          {/* Security guarantee pill */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/60 dark:border-neutral-700/60 flex items-start gap-2.5 mb-5">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-600 dark:text-neutral-300 leading-tight">
              <span className="font-semibold text-slate-800 dark:text-white block mb-0.5">Seguridad vinculada al dispositivo</span>
              El acceso solo funciona en este equipo físico. No puede ser utilizado desde ningún otro teléfono o computadora.
            </div>
          </div>

          {/* Buttons */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleActivar}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[var(--primary)] hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
              <span>{loading ? 'Vinculando...' : `Activar en este ${deviceName}`}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 transition cursor-pointer"
            >
              Ahora no
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
