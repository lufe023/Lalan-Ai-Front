import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, LifeBuoy, Loader2, UserPlus } from 'lucide-react';
import { api } from '../../services/api';
import { ClaveParaCompartir } from './ClaveParaCompartir';

interface Miembro { id: string; name: string; email: string; active: boolean; createdAt: string }

/**
 * El equipo de soporte de Lalan: entran a los salones de los clientes para
 * ayudarles. No ven estadísticas ni planes. Solo el super admin los maneja.
 */
export const EquipoSoporte: React.FC = () => {
  const [equipo, setEquipo] = useState<Miembro[] | null>(null);
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [clave, setClave] = useState<{ nombre: string; email: string; clave: string } | null>(null);

  const cargar = useCallback(() => {
    api.get<Miembro[]>('/plataforma/soporte').then(setEquipo).catch(e => setError(e?.message || 'No se pudo cargar'));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nombre.trim().length < 2 || !correo.includes('@')) { setError('Escribe el nombre y un correo válido.'); return; }
    setGuardando(true); setError('');
    try {
      const r = await api.post<{ usuario: Miembro; claveTemporal: string }>('/plataforma/soporte', { name: nombre.trim(), email: correo.trim() });
      setClave({ nombre: r.usuario.name, email: r.usuario.email, clave: r.claveTemporal });
      setNombre(''); setCorreo(''); cargar();
    } catch (err) {
      setError((err as Error)?.message || 'No se pudo crear');
    } finally {
      setGuardando(false);
    }
  };
  const alternar = async (m: Miembro) => { await api.patch(`/plataforma/soporte/${m.id}`, { active: !m.active }).catch(() => undefined); cargar(); };
  const nuevaClave = async (m: Miembro) => {
    const r = await api.post<{ claveTemporal?: string } | string>(`/plataforma/soporte/${m.id}/clave-temporal`, {}).catch(() => null);
    const c = typeof r === 'string' ? r : r?.claveTemporal;
    if (c) setClave({ nombre: m.name, email: m.email, clave: c });
  };

  return (
    <section className="space-y-4 text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]">
      <header>
        <h3 className="text-base font-bold flex items-center gap-2"><LifeBuoy className="w-4 h-4" /> Equipo de soporte</h3>
        <p className="text-xs text-slate-500 dark:text-neutral-400">Pueden ver la lista de clientes, entrar a un salón para ayudar y dar claves temporales a sus usuarios. No ven estadísticas, planes ni pueden crear o suspender clientes.</p>
      </header>

      {clave && <ClaveParaCompartir nombre={clave.nombre} email={clave.email} clave={clave.clave} onListo={() => setClave(null)} />}

      <form onSubmit={crear} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end rounded-2xl border border-slate-200 dark:border-neutral-800 p-3">
        <label className="text-[11px] font-bold">Nombre<input value={nombre} onChange={e => setNombre(e.target.value)} maxLength={80} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-sm font-normal" /></label>
        <label className="text-[11px] font-bold">Correo<input type="email" value={correo} onChange={e => setCorreo(e.target.value)} maxLength={120} className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-sm font-normal" /></label>
        <button type="submit" disabled={guardando} className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Agregar
        </button>
      </form>
      {error && <p className="text-xs text-rose-600">{error}</p>}

      {!equipo ? <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
        : equipo.length === 0 ? <p className="text-sm text-slate-500">Todavía no hay nadie en soporte.</p>
        : (
          <ul className="space-y-2">
            {equipo.map(m => (
              <li key={m.id} className="rounded-2xl border border-slate-200 dark:border-neutral-800 p-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0"><b className="text-sm">{m.name}</b><div className="text-xs text-slate-500 truncate">{m.email}</div></div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${m.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-neutral-800'}`}>{m.active ? 'Activo' : 'Apagado'}</span>
                <button type="button" onClick={() => void nuevaClave(m)} className="text-xs font-bold flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-neutral-800 cursor-pointer"><KeyRound className="w-3.5 h-3.5" /> Clave temporal</button>
                <button type="button" onClick={() => void alternar(m)} className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-neutral-800 cursor-pointer">{m.active ? 'Apagar' : 'Reactivar'}</button>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
};
