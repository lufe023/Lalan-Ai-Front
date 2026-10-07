import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Eye, EyeOff, KeyRound, Laptop, Loader2, LogOut, ShieldCheck, Smartphone, Tablet } from 'lucide-react';
import { api } from '../../services/api';
import { quickAuth } from '../../services/quickAuth';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

/** Largo mínimo: el mismo que exige el servidor */
const LARGO_MINIMO = 8;

interface Sesion {
  id: string;
  aparato: string | null;
  ip: string | null;
  desde: string;
  ultimoUso: string;
  actual: boolean;
}

/** "Chrome en Windows", "iPhone · app instalada"… a partir del User-Agent */
export function nombreDeAparato(ua: string | null): { nombre: string; tipo: 'telefono' | 'tableta' | 'computadora' } {
  if (!ua) return { nombre: 'Aparato desconocido (entró antes de que Lalan lo anotara)', tipo: 'computadora' };
  const sistema = /iPhone/i.test(ua) ? 'iPhone'
    : /iPad/i.test(ua) ? 'iPad'
    : /Android/i.test(ua) ? (/Mobile/i.test(ua) ? 'Android' : 'Tableta Android')
    : /Windows/i.test(ua) ? 'Windows'
    : /Macintosh|Mac OS X/i.test(ua) ? 'Mac'
    : /CrOS/i.test(ua) ? 'Chromebook'
    : /Linux/i.test(ua) ? 'Linux'
    : 'otro aparato';
  const navegador = /EdgA?\//i.test(ua) ? 'Edge'
    : /OPR\//i.test(ua) ? 'Opera'
    : /SamsungBrowser/i.test(ua) ? 'Samsung Internet'
    : /CriOS|Chrome\//i.test(ua) ? 'Chrome'
    : /FxiOS|Firefox\//i.test(ua) ? 'Firefox'
    : /Safari\//i.test(ua) ? 'Safari'
    : null;
  const tipo = /iPad|Tableta/i.test(sistema) ? 'tableta' : /iPhone|Android/i.test(sistema) ? 'telefono' : 'computadora';
  return { nombre: navegador ? `${navegador} en ${sistema}` : sistema, tipo };
}

/** "hace 5 min", "ayer", "3 oct" */
function cuando(iso: string): string {
  const t = new Date(iso).getTime();
  const min = Math.round((Date.now() - t) / 60_000);
  if (min < 2) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  if (h < 48) return 'ayer';
  return new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' });
}

const ICONO = { telefono: Smartphone, tableta: Tablet, computadora: Laptop } as const;

/**
 * Mi cuenta → Seguridad: cambiar la contraseña y ver dónde está abierta la
 * sesión (con el botón de cerrarla en un aparato perdido o prestado).
 */
export const SeguridadCuenta: React.FC = () => {
  const { showToast } = useApp();
  const { logout } = useAuth();

  // ── Cambiar contraseña ──
  const [abierto, setAbierto] = useState(false);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  // ── Sesiones ──
  const [sesiones, setSesiones] = useState<Sesion[] | null>(null);
  const [cerrando, setCerrando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try { setSesiones(await api.get<Sesion[]>('/auth/sesiones')); } catch { setSesiones([]); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const cambiar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (nueva.length < LARGO_MINIMO) { setError(`La contraseña nueva debe tener al menos ${LARGO_MINIMO} caracteres.`); return; }
    if (nueva !== repetir) { setError('Las dos contraseñas nuevas no coinciden.'); return; }
    setGuardando(true);
    try {
      await api.post('/auth/cambiar-clave', { actual, nueva });
      // El servidor apaga el "1 toque" en todos los aparatos: en ESTE se vuelve a activar solo
      const reg = quickAuth.getRegistration();
      if (reg.isRegistered && reg.user) await quickAuth.registerDevice(reg.user).catch(() => undefined);
      setActual(''); setNueva(''); setRepetir(''); setAbierto(false);
      showToast('Contraseña cambiada', 'Se cerró tu sesión en los demás aparatos. Aquí sigues dentro.', 'success');
      void cargar();
    } catch (err) {
      setError((err as Error).message || 'No se pudo cambiar la contraseña');
    } finally {
      setGuardando(false);
    }
  };

  const cerrar = async (s: Sesion) => {
    if (s.actual) { logout(); return; }
    setCerrando(s.id);
    try {
      await api.delete(`/auth/sesiones/${s.id}`);
      showToast('Sesión cerrada', `${nombreDeAparato(s.aparato).nombre} tendrá que volver a entrar con tu contraseña.`, 'info');
    } catch (e: any) {
      showToast('No se pudo cerrar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally {
      setCerrando(null);
      void cargar();
    }
  };

  const cerrarOtras = async () => {
    setCerrando('otras');
    try {
      const r = await api.post<{ cerradas: number }>('/auth/sesiones/cerrar-otras', {});
      showToast('Listo', r.cerradas ? 'Se cerró tu sesión en los demás aparatos.' : 'No había otras sesiones abiertas.', 'success');
    } catch (e: any) {
      showToast('No se pudo cerrar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally {
      setCerrando(null);
      void cargar();
    }
  };

  const campo = 'w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
  const otras = (sesiones ?? []).filter((s) => !s.actual);

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-4">
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="w-4 h-4 text-[var(--primary)]" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">Seguridad</span>
      </div>

      {/* Cambiar contraseña */}
      <div className="rounded-xl bg-slate-50 dark:bg-neutral-800/60">
        <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}
          className="w-full flex items-center gap-3 p-3 text-left cursor-pointer">
          <KeyRound className="w-4 h-4 text-slate-500 dark:text-neutral-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-slate-900 dark:text-white">Cambiar contraseña</div>
            <div className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">Al cambiarla se cierra tu sesión en los demás aparatos</div>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} />
        </button>
        {abierto && (
          <form onSubmit={cambiar} className="px-3 pb-3 space-y-2.5">
            <input type={ver ? 'text' : 'password'} value={actual} onChange={(e) => setActual(e.target.value)}
              placeholder="Contraseña actual" autoComplete="current-password" required className={campo} />
            <input type={ver ? 'text' : 'password'} value={nueva} onChange={(e) => setNueva(e.target.value)}
              placeholder={`Contraseña nueva (mínimo ${LARGO_MINIMO})`} autoComplete="new-password" required minLength={LARGO_MINIMO} className={campo} />
            <input type={ver ? 'text' : 'password'} value={repetir} onChange={(e) => setRepetir(e.target.value)}
              placeholder="Repite la nueva" autoComplete="new-password" required className={campo} />
            <button type="button" onClick={() => setVer((v) => !v)} className="flex items-center gap-1.5 text-[0.6875rem] text-slate-500 dark:text-neutral-400 cursor-pointer">
              {ver ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} {ver ? 'Ocultar' : 'Ver'} las contraseñas
            </button>
            {error && <p className="text-[0.75rem] text-rose-600 dark:text-rose-400">{error}</p>}
            <button type="submit" disabled={guardando}
              className="w-full py-2.5 rounded-xl bg-[var(--primary)] text-white text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer">
              {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar contraseña nueva
            </button>
          </form>
        )}
      </div>

      {/* Dónde está abierta la sesión */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-900 dark:text-white">Dónde está abierta tu sesión</span>
          {otras.length > 0 && (
            <button type="button" onClick={() => void cerrarOtras()} disabled={cerrando === 'otras'}
              className="text-[0.6875rem] font-bold text-rose-600 dark:text-rose-400 disabled:opacity-50 cursor-pointer">
              Cerrar todas las demás
            </button>
          )}
        </div>
        {sesiones === null && <p className="text-[0.75rem] text-slate-400 py-2">Cargando…</p>}
        {sesiones?.length === 0 && <p className="text-[0.75rem] text-slate-400 py-2">No se pudieron leer las sesiones.</p>}
        {sesiones?.map((s) => {
          const { nombre, tipo } = nombreDeAparato(s.aparato);
          const Icono = ICONO[tipo];
          return (
            <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-neutral-800">
              <Icono className="w-5 h-5 text-slate-500 dark:text-neutral-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{nombre}</div>
                <div className="text-[0.6875rem] text-slate-500 dark:text-neutral-400 truncate">
                  {s.actual ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Este aparato</span> : `Último uso: ${cuando(s.ultimoUso)}`}
                  {' · '}entró el {new Date(s.desde).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}
                  {s.ip ? ` · ${s.ip}` : ''}
                </div>
              </div>
              <button type="button" onClick={() => void cerrar(s)} disabled={cerrando === s.id}
                title={s.actual ? 'Cerrar sesión aquí' : 'Cerrar la sesión en ese aparato'}
                className="shrink-0 w-8 h-8 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center disabled:opacity-50 cursor-pointer">
                {cerrando === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              </button>
            </div>
          );
        })}
        <p className="text-[0.6875rem] text-slate-400 leading-relaxed">
          ¿Ves un aparato que no reconoces? Ciérralo y cambia tu contraseña.
        </p>
      </div>
    </div>
  );
};
