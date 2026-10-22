import React, { useState } from 'react';
import { FileCheck2, Loader2, ExternalLink } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

/** Los dos textos que se aceptan: son páginas fuera de la app */
const DOCUMENTOS = [
  { href: '/terminos.html', nombre: 'Términos de uso', detalle: 'El servicio, tus datos y los de tus clientas, la asistente.' },
  { href: '/condiciones-planes.html', nombre: 'Condiciones de los planes', detalle: 'Los 2 meses gratis, el Plan Gratis, adelantar respuestas, pagos.' },
];

/**
 * La administración del salón acepta los términos antes de entrar: la primera
 * vez y cada vez que cambian (la versión es la fecha del texto). Acepta una
 * persona por todo el salón; el resto del equipo nunca ve esta pantalla.
 */
export const AceptarTerminosScreen: React.FC<{ version: string }> = ({ version }) => {
  const { currentUser, terminosAceptados, logout } = useAuth();
  const [acepto, setAcepto] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acepto) return;
    setError('');
    setGuardando(true);
    try {
      await api.post('/auth/aceptar-terminos', { version });
      terminosAceptados();
    } catch (err) {
      setError((err as Error).message || 'No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      className="flex-1 w-full h-full flex items-center justify-center p-6 bg-[#f8fafc] dark:bg-[#09090b] pt-safe-top pb-safe text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]"
      style={{ paddingTop: 'var(--header-safe-pt, max(calc(env(safe-area-inset-top, 0px) + 16px), 54px))' }}
    >
      <form onSubmit={enviar} className="w-full max-w-sm p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-sm space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center"><FileCheck2 className="w-6 h-6" /></div>
        <div>
          <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">Antes de seguir{currentUser ? `, ${currentUser.name.split(' ')[0]}` : ''}</h1>
          <p className="text-[0.875rem] text-slate-500 dark:text-neutral-400 mt-1">Lee y acepta las condiciones de Lalan. Las aceptas una vez por todo tu salón, y te las volvemos a pedir solo si cambian.</p>
        </div>
        <div className="space-y-2">
          {DOCUMENTOS.map((d) => (
            <a key={d.href} href={d.href} target="_blank" rel="noopener"
              className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 dark:border-neutral-800 hover:border-[var(--primary)] transition-colors">
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-slate-900 dark:text-white">{d.nombre}</span>
                <span className="block text-[0.8125rem] text-slate-500 dark:text-neutral-400">{d.detalle}</span>
              </span>
              <ExternalLink className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
            </a>
          ))}
        </div>
        <label className="flex items-start gap-3 text-[0.8125rem] text-slate-600 dark:text-neutral-300 cursor-pointer">
          <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)}
            className="mt-0.5 w-5 h-5 shrink-0 rounded accent-[var(--primary)] cursor-pointer" />
          <span>Leí y acepto los Términos de uso y las Condiciones de los planes en nombre de mi salón.</span>
        </label>
        {error && <p className="text-[0.8125rem] font-semibold text-rose-600" role="alert">{error}</p>}
        <button type="submit" disabled={!acepto || guardando} className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed">
          {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Aceptar y entrar
        </button>
        <button type="button" onClick={logout} className="w-full text-[0.8125rem] text-slate-400 hover:text-slate-600 cursor-pointer">Salir</button>
      </form>
    </div>
  );
};
