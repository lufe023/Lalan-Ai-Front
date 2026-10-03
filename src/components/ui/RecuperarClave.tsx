import React, { useState } from 'react';
import { ArrowLeft, Loader2, MailCheck, CheckCircle2, MessageCircle } from 'lucide-react';
import { api } from '../../services/api';

const LARGO_MINIMO = 8;
const WHATSAPP_LALAN = '18092299444';

type Paso = 'correo' | 'codigo' | 'listo' | 'sin-correo';

const campo = 'w-full px-3.5 py-3 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40';

/** ¿Olvidaste tu clave? Un código al correo y una clave nueva, sin llamar a nadie */
export const RecuperarClave: React.FC<{ emailInicial?: string; onVolver: (email?: string) => void }> = ({ emailInicial = '', onVolver }) => {
  const [paso, setPaso] = useState<Paso>('correo');
  const [email, setEmail] = useState(emailInicial);
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const pedir = async (e?: React.FormEvent) => {
    e?.preventDefault(); setError('');
    if (email.trim().length < 3) { setError('Escribe tu correo, usuario o teléfono.'); return; }
    setOcupado(true);
    try {
      const r = await api.post<{ ok: boolean; correoConfigurado: boolean }>('/auth/recuperar', { identificador: email.trim() });
      setPaso(r.correoConfigurado ? 'codigo' : 'sin-correo');
    } catch (err) { setError((err as Error).message); } finally { setOcupado(false); }
  };

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!/^\d{6}$/.test(codigo.trim())) { setError('El código son 6 números.'); return; }
    if (nueva.length < LARGO_MINIMO) { setError(`La clave nueva debe tener al menos ${LARGO_MINIMO} caracteres.`); return; }
    setOcupado(true);
    try { await api.post('/auth/recuperar/confirmar', { identificador: email.trim(), codigo: codigo.trim(), nueva }); setPaso('listo'); }
    catch (err) { setError((err as Error).message); } finally { setOcupado(false); }
  };

  const Error = error ? <p className="text-[0.8125rem] font-semibold text-rose-600" role="alert">{error}</p> : null;

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => onVolver()} className="flex items-center gap-1 text-[0.8125rem] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer">
        <ArrowLeft className="w-3.5 h-3.5" /> Volver a iniciar sesión
      </button>

      {paso === 'correo' && (
        <form onSubmit={pedir} className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">¿Olvidaste tu clave?</h2>
          <p className="text-[0.875rem] text-slate-500 dark:text-neutral-400">Te mandamos un código de 6 números a tu correo confirmado para que pongas una clave nueva.</p>
          <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo, usuario o teléfono" autoComplete="username" autoCapitalize="none" className={campo} />
          {Error}
          <button type="submit" disabled={ocupado} className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer">
            {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} Enviarme el código
          </button>
        </form>
      )}

      {paso === 'codigo' && (
        <form onSubmit={confirmar} className="space-y-3">
          <div className="flex items-center gap-2 text-[var(--primary)]"><MailCheck className="w-5 h-5" /><h2 className="text-lg font-bold text-slate-900 dark:text-white">Revisa tu correo</h2></div>
          <p className="text-[0.875rem] text-slate-500 dark:text-neutral-400">Si <b>{email}</b> tiene cuenta en Lalan con un correo confirmado, te llegó un código ahí. Vence en 15 minutos; mira también en correo no deseado.</p>
          <p className="text-[0.8125rem] text-slate-400">¿No tienes correo o no lo confirmaste? Pide a quien administra tu salón una clave temporal desde Ajustes → Usuarios.</p>
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} placeholder="Código de 6 números"
            className={`${campo} text-center text-xl tracking-[.4em] font-bold`} />
          <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder={`Clave nueva (mínimo ${LARGO_MINIMO})`} autoComplete="new-password" className={campo} />
          {Error}
          <button type="submit" disabled={ocupado} className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer">
            {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} Guardar mi clave nueva
          </button>
          <button type="button" onClick={() => void pedir()} disabled={ocupado} className="w-full text-[0.8125rem] text-slate-500 hover:text-[var(--primary)] cursor-pointer">No me llegó: enviar otro código</button>
        </form>
      )}

      {paso === 'listo' && (
        <div className="space-y-3 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">¡Listo! Ya tienes clave nueva</h2>
          <p className="text-[0.875rem] text-slate-500 dark:text-neutral-400">Por seguridad cerramos las sesiones que tenías abiertas en otros aparatos.</p>
          <button type="button" onClick={() => onVolver(email)} className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-semibold text-sm cursor-pointer">Iniciar sesión</button>
        </div>
      )}

      {paso === 'sin-correo' && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Te ayudamos por otra vía</h2>
          <p className="text-[0.875rem] text-slate-500 dark:text-neutral-400">Pide a quien administra tu salón que te dé una clave temporal desde Ajustes → Usuarios. Si eres la dueña, escríbenos y te la damos.</p>
          <a href={`https://wa.me/${WHATSAPP_LALAN}?text=${encodeURIComponent(`Hola, olvidé mi clave de Lalan. Entro con: ${email}.`)}`} target="_blank" rel="noopener"
            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2"><MessageCircle className="w-4 h-4" /> Escribir a Lalan por WhatsApp</a>
        </div>
      )}
    </div>
  );
};
