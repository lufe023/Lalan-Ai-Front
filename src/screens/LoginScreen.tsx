import React, { useState, useEffect } from 'react';
import { RecuperarClave } from '../components/ui/RecuperarClave';
import { ActivarAccesoRapidoModal } from '../components/ui/ActivarAccesoRapidoModal';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, AtSign as Mail, Lock, Loader2, AlertCircle, Zap, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';
import { LogoLalan } from '../components/ui/LogoLalan';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { quickAuth, QuickAuthRegistration } from '../services/quickAuth';

export const LoginScreen: React.FC = () => {
  const { login, loginWithQuickDevice } = useAuth();
  const { showToast, navigateTo } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recuperando, setRecuperando] = useState(false);
  const [showActivarModal, setShowActivarModal] = useState(false);

  // Consulta de registro de acceso rápido en este dispositivo
  const [registration, setRegistration] = useState<QuickAuthRegistration>(() => quickAuth.getRegistration());
  // Si el dispositivo ya está registrado, mostramos por defecto la vista de 1 solo toque
  const [modoManual, setModoManual] = useState<boolean>(() => !quickAuth.getRegistration().isRegistered);

  useEffect(() => {
    setRegistration(quickAuth.getRegistration());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Escribe tu correo, usuario o teléfono y tu contraseña.'); return; }
    setError('');
    setLoading(true);
    try {
      await login({ identificador: email.trim(), password });
      showToast('¡Bienvenida/o!', 'Sesión iniciada correctamente.', 'success');
      // Si este dispositivo aún no tiene configurado el acceso rápido, ofrecemos activarlo
      if (!quickAuth.getRegistration().isRegistered) {
        setShowActivarModal(true);
      } else {
        navigateTo('dashboard');
      }
    } catch (err: any) {
      setError(err?.message === 'Invalid credentials' ? 'Esos datos no coinciden.' : (err?.message ?? 'Error al iniciar sesión.'));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDeviceLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithQuickDevice();
      showToast('¡Bienvenida/o!', 'Acceso rápido autenticado en este dispositivo.', 'success');
      navigateTo('dashboard');
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo iniciar con acceso rápido. Prueba con tu clave.');
      setModoManual(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="login-screen"
      className="flex-1 w-full h-full overflow-y-auto hide-scrollbar flex flex-col items-center p-6 select-none pt-safe-top pb-safe"
      style={{ paddingTop: 'var(--header-safe-pt, max(calc(env(safe-area-inset-top, 0px) + 16px), 54px))' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className="w-full max-w-sm my-auto"
      >
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[var(--primary)] to-indigo-500 p-0.5 shadow-lg mb-4 flex items-center justify-center">
            <div className="w-full h-full rounded-[14px] bg-white dark:bg-neutral-900 flex items-center justify-center">
              <LogoLalan className="w-9 h-9 text-[var(--primary)]" titulo="Lalan AI" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Lalan AI</h1>
          <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">Studio & Lounge · Gestión inteligente</p>
        </div>

        {recuperando ? (
          <RecuperarClave emailInicial={email} onVolver={(e) => { setRecuperando(false); if (e) setEmail(e); setPassword(''); setError(''); }} />
        ) : !modoManual && registration.isRegistered && registration.user ? (
          /* ── MODO ACCESO RÁPIDO CON 1 TOQUE (Dispositivo reconocido) ── */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4"
          >
            {/* Card de usuario vinculado */}
            <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-sm flex flex-col items-center text-center">
              <div className="relative mb-3">
                <img
                  src={registration.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(registration.user.name)}&background=random`}
                  alt={registration.user.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-[var(--primary)] shadow-md"
                />
                <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900" title="Dispositivo verificado" />
              </div>

              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                ¡Hola, {registration.user.name}!
              </h2>
              <span className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>{registration.deviceName || 'Dispositivo autorizado'}</span>
              </span>

              {/* Botón de 1 toque */}
              <button
                type="button"
                onClick={handleQuickDeviceLogin}
                disabled={loading}
                className="w-full mt-5 py-3.5 rounded-xl bg-gradient-to-r from-[var(--primary)] to-rose-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[var(--primary)]/20 hover:opacity-95 active:scale-[0.98] transition cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Verificando dispositivo...</>
                ) : (
                  <><Zap className="w-4 h-4 fill-white" /> Entrar con 1 toque</>
                )}
              </button>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 text-xs"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Alternar a login manual */}
            <button
              type="button"
              onClick={() => { setError(''); setModoManual(true); }}
              className="w-full text-center py-2 text-xs font-semibold text-slate-500 dark:text-neutral-400 hover:text-[var(--primary)] transition cursor-pointer"
            >
              Iniciar sesión con otra cuenta o contraseña →
            </button>
          </motion.div>
        ) : (
          /* ── MODO MANUAL (Correo y Contraseña) ── */
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-400 mb-1.5">
                  Correo, usuario o teléfono
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    placeholder="tu@correo.com · maria.bella · 809-555-1234"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 transition"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-400 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 transition"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 text-xs"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </motion.div>
              )}

              {/* Submit */}
              <button
                id="login-submit-button"
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-90 active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Iniciando sesión...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Iniciar sesión</>
                )}
              </button>
            </form>

            <div className="flex items-center justify-between mt-3">
              <button type="button" onClick={() => setRecuperando(true)} className="text-[12px] font-semibold text-slate-500 dark:text-neutral-400 hover:text-[var(--primary)] cursor-pointer">
                ¿Olvidaste tu clave?
              </button>

              {registration.isRegistered && (
                <button
                  type="button"
                  onClick={() => { setError(''); setModoManual(false); }}
                  className="text-[12px] font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Zap className="w-3 h-3 fill-current" />
                  <span>Volver a Acceso Rápido</span>
                </button>
              )}
            </div>

          </>
        )}

        <p className="text-center text-[11px] text-slate-400 dark:text-neutral-600 mt-5">
          Gomez Santana Solutions Group SRL · Lalan AI v2.0 · <a href="/privacidad.html" target="_blank" rel="noopener" className="underline">Privacidad</a> · <a href="/terminos.html" target="_blank" rel="noopener" className="underline">Términos</a>
        </p>
      </motion.div>

      {/* Modal para ofrecer activar el acceso rápido tras loguearse */}
      <ActivarAccesoRapidoModal
        isOpen={showActivarModal}
        onClose={() => {
          setShowActivarModal(false);
          navigateTo('dashboard');
        }}
      />
    </div>
  );
};
