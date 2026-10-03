import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, MailCheck, Pencil } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface RespuestaEnvio { resultado: 'enviado' | 'sin_correo' | 'demasiados' | 'no_configurado' | 'fallo'; mensaje: string; correo: string | null; confirmado: boolean }

/** "Ahora no" (solo si no es obligatorio): no se le vuelve a pedir en este aparato */
const CLAVE_OMITIDA = 'lalan_correo_omitido_';
export function confirmacionOmitida(userId?: string): boolean {
  try { return !!userId && localStorage.getItem(CLAVE_OMITIDA + userId) === '1'; } catch { return false; }
}
function omitirConfirmacion(userId?: string) {
  try { if (userId) localStorage.setItem(CLAVE_OMITIDA + userId, '1'); } catch { /* sin almacenamiento: se volverá a pedir */ }
}

const campo = 'w-full px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';

/**
 * Confirmar que el correo es suyo: un código de 6 números, sin enlaces.
 * Para la dueña es obligatorio (ahí le llegan los informes y los códigos para
 * cambiar la clave); para el equipo, opcional. Si el correo está mal escrito,
 * lo corrige aquí mismo.
 */
export const ConfirmarCorreoScreen: React.FC = () => {
  const { currentUser, correoListo, logout } = useAuth();
  const obligatoria = currentUser?.confirmarCorreo === 'obligatoria';
  const [correo, setCorreo] = useState(currentUser?.correo ?? '');
  const [editando, setEditando] = useState(false);
  const [nuevo, setNuevo] = useState(currentUser?.correo ?? '');
  const [codigo, setCodigo] = useState('');
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [listo, setListo] = useState(false);
  const pedido = useRef(false);

  const tomar = (r: RespuestaEnvio) => {
    if (r.correo) setCorreo(r.correo);
    if (r.confirmado) { correoListo(r.correo); return; }
    // La app no puede mandar correos todavía: no se bloquea a nadie
    if (r.resultado === 'no_configurado') { correoListo(); return; }
    setAviso(r.mensaje);
  };

  const pedir = async () => {
    setError(''); setOcupado(true);
    try { tomar(await api.post<RespuestaEnvio>('/auth/correo/codigo', {})); }
    catch (e) { setError((e as Error).message); } finally { setOcupado(false); }
  };

  // El primer código se pide solo al llegar a esta pantalla
  useEffect(() => {
    if (pedido.current) return;
    pedido.current = true;
    void pedir();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!/^\d{6}$/.test(codigo.trim())) { setError('El código son 6 números.'); return; }
    setOcupado(true);
    try {
      const r = await api.post<{ correo: string }>('/auth/correo/confirmar', { codigo: codigo.trim() });
      setListo(true);
      setTimeout(() => correoListo(r.correo), 1200);
    } catch (err) { setError((err as Error).message); } finally { setOcupado(false); }
  };

  const corregir = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    setOcupado(true);
    try {
      const r = await api.patch<RespuestaEnvio>('/auth/correo', { email: nuevo.trim() || null });
      setEditando(false); setCodigo('');
      if (!r.correo) { correoListo(null); return; }
      tomar(r);
    } catch (err) { setError((err as Error).message); } finally { setOcupado(false); }
  };

  const Error = error ? <p className="text-[0.8125rem] font-semibold text-rose-600" role="alert">{error}</p> : null;

  return (
    <div
      className="flex-1 w-full h-full flex items-center justify-center p-6 bg-[#f8fafc] dark:bg-[#09090b] pt-safe-top pb-safe"
      style={{ paddingTop: 'var(--header-safe-pt, max(calc(env(safe-area-inset-top, 0px) + 16px), 54px))' }}
    >
      <div className="w-full max-w-sm p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-sm space-y-4">
        {listo ? (
          <div className="space-y-3 text-center py-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">¡Correo confirmado!</h1>
            <p className="text-[0.875rem] text-slate-500 dark:text-neutral-400">Ya puedes recibir tus informes y cambiar tu clave tú misma si la olvidas.</p>
          </div>
        ) : editando ? (
          <form onSubmit={corregir} className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center"><Pencil className="w-6 h-6" /></div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">Corrige tu correo</h1>
              <p className="text-[0.875rem] text-slate-500 dark:text-neutral-400 mt-1">Te mandamos un código nuevo a la dirección que escribas.</p>
            </div>
            <input type="email" value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="tu@correo.com" autoComplete="email" autoCapitalize="none" className={campo} />
            {Error}
            <button type="submit" disabled={ocupado} className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
              {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} Guardar y enviarme el código
            </button>
            <button type="button" onClick={() => { setEditando(false); setError(''); }} className="w-full text-[0.8125rem] text-slate-400 hover:text-slate-600 cursor-pointer">Cancelar</button>
          </form>
        ) : (
          <form onSubmit={confirmar} className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center"><MailCheck className="w-6 h-6" /></div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">Confirma tu correo</h1>
              <p className="text-[0.875rem] text-slate-500 dark:text-neutral-400 mt-1">
                Te mandamos un código de 6 números a <b className="text-slate-700 dark:text-neutral-200 break-all">{correo}</b>.
                {obligatoria ? ' Ahí te llegan los informes y los códigos para cambiar tu clave.' : ' Así podrás cambiar tu clave tú misma si la olvidas.'}
              </p>
            </div>
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              placeholder="Código de 6 números" className={`${campo} text-center text-xl tracking-[.4em] font-bold`} />
            {aviso && !error && <p className="text-[0.8125rem] text-slate-500 dark:text-neutral-400">{aviso}</p>}
            {Error}
            <button type="submit" disabled={ocupado} className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
              {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar
            </button>
            <div className="flex items-center justify-between text-[0.8125rem]">
              <button type="button" onClick={() => void pedir()} disabled={ocupado} className="text-slate-500 hover:text-[var(--primary)] cursor-pointer">Enviar otro código</button>
              <button type="button" onClick={() => { setNuevo(correo); setEditando(true); setError(''); }} className="text-slate-500 hover:text-[var(--primary)] cursor-pointer">El correo está mal</button>
            </div>
            {obligatoria ? (
              <button type="button" onClick={logout} className="w-full text-[0.8125rem] text-slate-400 hover:text-slate-600 cursor-pointer">Salir</button>
            ) : (
              <button type="button" onClick={() => { omitirConfirmacion(currentUser?.id); correoListo(); }} className="w-full text-[0.8125rem] text-slate-400 hover:text-slate-600 cursor-pointer">Ahora no</button>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
