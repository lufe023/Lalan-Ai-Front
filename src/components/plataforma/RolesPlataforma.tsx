import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { api } from '../../services/api';
import { IOSToggle } from '../ui/IOSToggle';
import type { ClavePermisoRol } from '../../services/permisos';

interface DatosRoles {
  modo: 'aplicar' | 'espejo';
  areas: { id: string; titulo: string }[];
  permisos: { clave: ClavePermisoRol; area: string; puede: string; noPuede: string; asistente: boolean; fabrica: boolean }[];
  salonesConAjuste: number;
  asistentes: number;
  negados: { ruta: string; permiso: string; salones: number; ultima: string }[];
}

const tarjeta = 'p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs text-slate-900 dark:text-neutral-100 space-y-3';

/**
 * Plataforma → Roles: con qué arranca una asistente en cualquier salón (lo
 * que el salón no haya cambiado), y qué se negó esta semana. En modo espejo
 * se ve qué se habría negado antes de cerrarlo de verdad.
 */
export const RolesPlataforma: React.FC = () => {
  const [d, setD] = useState<DatosRoles | null>(null);
  const [error, setError] = useState('');
  const [ocupada, setOcupada] = useState<string | null>(null);
  const cargar = useCallback(() => api.get<DatosRoles>('/plataforma/permisos').then(setD).catch((e) => setError((e as Error).message)), []);
  useEffect(() => { void cargar(); }, [cargar]);

  const cambiar = async (clave: ClavePermisoRol, v: boolean, deCodigo: boolean) => {
    setOcupada(clave); setError('');
    // Igual que lo que trae el código: se quita el ajuste
    try { await api.put('/plataforma/permisos', { assistant: { [clave]: v === deCodigo ? null : v } }); await cargar(); }
    catch (e) { setError((e as Error).message); }
    finally { setOcupada(null); }
  };
  const nombre = (clave: string) => d?.permisos.find((p) => p.clave === clave)?.puede ?? (clave === 'solo-administracion' ? 'Solo administración' : clave);

  if (!d) return <div className={tarjeta}>{error ? <p className="text-rose-600 text-[0.8125rem]">{error}</p> : <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}</div>;
  return (
    <div className="space-y-3">
      <div className={tarjeta}>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[var(--primary)]" />
          <h2 className="text-xs font-bold uppercase tracking-wider">Asistente: lo que trae de fábrica</h2>
        </div>
        <p className="text-[0.75rem] text-slate-500 leading-relaxed">
          Vale para todos los salones en lo que la dueña no haya cambiado ({d.salonesConAjuste} {d.salonesConAjuste === 1 ? 'salón cambió' : 'salones cambiaron'} algo · {d.asistentes} asistentes activas).
          Administración puede todo. {d.modo === 'aplicar'
            ? 'Los permisos se están aplicando: lo apagado se niega.'
            : 'Modo espejo: todavía no se niega nada, solo se anota lo que se habría negado (abajo). Se activa con PERMISOS_MODO=aplicar.'}
        </p>
        {error && <p className="text-rose-600 text-[0.8125rem]" role="alert">{error}</p>}
        {d.areas.map((a) => {
          const delArea = d.permisos.filter((p) => p.area === a.id);
          if (!delArea.length) return null;
          return (
            <div key={a.id} className="space-y-1">
              <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">{a.titulo}</div>
              <div className="rounded-xl border border-slate-200 dark:border-neutral-700 divide-y divide-slate-200 dark:divide-neutral-800">
                {delArea.map((p) => (
                  <div key={p.clave} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="text-[0.8125rem] leading-snug">
                      {p.fabrica ? p.puede : <span className="text-slate-400">{p.noPuede}</span>}
                      {p.fabrica !== p.asistente && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[0.625rem] font-bold align-middle">Cambiado en Plataforma</span>}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {ocupada === p.clave && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                      <IOSToggle checked={p.fabrica} onChange={(v) => void cambiar(p.clave, v, p.asistente)} ariaLabel={p.puede} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className={tarjeta}>
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider">{d.modo === 'aplicar' ? 'Negado esta semana' : 'Se habría negado esta semana'}</h2>
        </div>
        {!d.negados.length ? (
          <p className="text-[0.8125rem] text-slate-500">Nada. Ninguna asistente chocó con un permiso apagado en los últimos 7 días.</p>
        ) : (
          <>
            <p className="text-[0.75rem] text-slate-500">Si algo de esto es parte del trabajo normal de una asistente, enciéndelo arriba antes de aplicar.</p>
            <ul className="divide-y divide-slate-100 dark:divide-neutral-800">
              {d.negados.map((n) => (
                <li key={`${n.ruta}|${n.permiso}`} className="py-2 text-[0.8125rem]">
                  <div className="font-semibold">{nombre(n.permiso)}</div>
                  <div className="text-[0.75rem] text-slate-400"><code>{n.ruta}</code> · {n.salones} {n.salones === 1 ? 'salón' : 'salones'}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};
