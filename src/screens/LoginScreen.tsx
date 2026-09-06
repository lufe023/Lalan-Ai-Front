import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Flower2, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const { showToast, navigateTo } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Ingresa tu correo y contraseña.'); return; }
    setError('');
    setLoading(true);
    try {
      await login({ email, password });
      showToast('¡Bienvenida/o!', 'Sesión iniciada correctamente.', 'success');
      navigateTo('dashboard');
    } catch (err: any) {
      setError(err?.message === 'Invalid credentials' ? 'Credenciales incorrectas.' : (err?.message ?? 'Error al iniciar sesión.'));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login({ email: 'admin@lalan.ai', password: 'Admin1234!' });
      showToast('¡Bienvenida/o!', 'Sesión iniciada correctamente.', 'success');
      navigateTo('dashboard');
    } catch (err: any) {
      setError(err?.message ?? 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="login-screen"
      className="flex-1 w-full h-full overflow-y-auto hide-scrollbar flex flex-col items-center justify-center p-6 select-none"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className="w-full max-w-sm"
      >
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[var(--primary)] to-indigo-500 p-0.5 shadow-lg mb-4 flex items-center justify-center">
            <div className="w-full h-full rounded-[14px] bg-white dark:bg-neutral-900 flex items-center justify-center">
              <Flower2 className="w-7 h-7 text-[var(--primary)]" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Lalan AI</h1>
          <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">Studio & Lounge · Gestión inteligente</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-400 mb-1.5">
              Correo electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="tu@correo.com"
                autoComplete="email"
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

        {/* Dev quick-login */}
        <button
          type="button"
          onClick={handleQuickLogin}
          disabled={loading}
          className="w-full mt-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-neutral-700 text-[11px] text-slate-400 dark:text-neutral-500 hover:border-[var(--primary)] hover:text-[var(--primary)] transition disabled:opacity-40 cursor-pointer"
        >
          ⚡ Admin rápido
        </button>

        <p className="text-center text-[11px] text-slate-400 dark:text-neutral-600 mt-4">
          Gomez Santana Solutions Group SRL · Lalan AI v2.0
        </p>
      </motion.div>
    </div>
  );
};
