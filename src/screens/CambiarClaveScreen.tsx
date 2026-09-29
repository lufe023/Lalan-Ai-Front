import React, { useState } from 'react';
import { KeyRound, Loader2, Eye, EyeOff } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

/** Largo mínimo: el mismo que exige el servidor */
const LARGO_MINIMO = 8;

/**
 * Primera vez con una clave temporal: antes de ver el salón, se pone la suya.
 * La temporal viajó por WhatsApp; dejarla puesta es dejar la puerta abierta.
 */
export const CambiarClaveScreen: React.FC = () => {
  const { currentUser, claveCambiada, logout } = useAuth();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (nueva.length < LARGO_MINIMO) { setError(`La clave nueva debe tener al menos ${LARGO_MINIMO} caracteres.`); return; }
    if (nueva !== repetir) { setError('Las dos claves nuevas no coinciden.'); return; }
    setGuardando(true);
    try {
      await api.post('/auth/cambiar-clave', { actual, nueva });
      claveCambiada();
    } catch (err) {
      setError((err as Error).message || 'No se pudo cambiar la clave');
    } finally {
      setGuardando(false);
    }
  };

  const campo = 'w-full px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';

  return (
    <div
      className="flex-1 w-full h-full flex items-center justify-center p-6 bg-[#f8fafc] dark:bg-[#09090b] pt-safe-top pb-safe"
      style={{ paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 16px), 24px)' }}
    >
      <form onSubmit={enviar} className="w-full max-w-sm p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-sm space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center"><KeyRound className="w-6 h-6" /></div>
        <div>
          <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">Hola{currentUser ? `, ${currentUser.name.split(' ')[0]}` : ''} 👋</h1>
          <p className="text-[13px] text-slate-500 dark:text-neutral-400 mt-1">Entraste con una clave temporal. Pon una tuya para seguir; solo tú la sabrás.</p>
        </div>
        <label className="block text-[12px] font-semibold text-slate-600 dark:text-neutral-300 space-y-1.5">
          <span>Clave temporal (la que te enviamos)</span>
          <input type={ver ? 'text' : 'password'} value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" required className={campo} />
        </label>
        <label className="block text-[12px] font-semibold text-slate-600 dark:text-neutral-300 space-y-1.5">
          <span>Tu clave nueva</span>
          <input type={ver ? 'text' : 'password'} value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" required minLength={LARGO_MINIMO} className={campo} />
        </label>
        <label className="block text-[12px] font-semibold text-slate-600 dark:text-neutral-300 space-y-1.5">
          <span>Repítela</span>
          <input type={ver ? 'text' : 'password'} value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" required className={campo} />
        </label>
        <button type="button" onClick={() => setVer((v) => !v)} className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 cursor-pointer">
          {ver ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}{ver ? 'Ocultar claves' : 'Ver claves'}
        </button>
        {error && <p className="text-[12px] font-semibold text-rose-600" role="alert">{error}</p>}
        <button type="submit" disabled={guardando} className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
          {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar y entrar
        </button>
        <button type="button" onClick={logout} className="w-full text-[12px] text-slate-400 hover:text-slate-600 cursor-pointer">Salir</button>
      </form>
    </div>
  );
};
