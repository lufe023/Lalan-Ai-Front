import React, { useCallback, useEffect, useState } from 'react';
import { Users, UserPlus, KeyRound, Loader2, X } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { usePlan } from '../../context/PlanContext';
import { ClaveParaCompartir } from '../plataforma/ClaveParaCompartir';
import type { UsuarioSalon } from '../../types/plataforma';

const ROLES: { id: UsuarioSalon['role']; label: string; ayuda: string }[] = [
  { id: 'assistant', label: 'Asistente', ayuda: 'Agenda, chats, clientas, sala y caja. No cambia la configuración.' },
  { id: 'admin', label: 'Administración', ayuda: 'Todo, incluida la configuración y los usuarios.' },
];

interface Sede { id: string; name: string }
interface ClaveNueva { nombre: string; email: string; clave: string }

const campo = 'w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[12px] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';

/** En Ajustes (solo administración): quién entra a la app del salón */
export const UsuariosSalon: React.FC = () => {
  const { currentUser } = useAuth();
  const { miPlan, recargarPlan } = usePlan();
  const [lista, setLista] = useState<UsuarioSalon[] | null>(null);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'assistant' as UsuarioSalon['role'], roleTitle: '', locationId: '' });
  const [clave, setClave] = useState<ClaveNueva | null>(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [u, s] = await Promise.all([api.get<UsuarioSalon[]>('/users'), api.get<Sede[]>('/users/sedes')]);
      setLista(u); setSedes(s);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setOcupado(true);
    try {
      const r = await api.post<{ usuario: UsuarioSalon; claveTemporal: string }>('/users', {
        name: form.name, email: form.email, role: form.role, roleTitle: form.roleTitle || undefined, locationId: form.locationId || null,
      });
      setClave({ nombre: r.usuario.name, email: r.usuario.email, clave: r.claveTemporal });
      setCreando(false); setForm({ name: '', email: '', role: 'assistant', roleTitle: '', locationId: '' });
      await cargar(); void recargarPlan();
    } catch (err) { setError((err as Error).message); } finally { setOcupado(false); }
  };

  const editar = async (u: UsuarioSalon, cambio: Partial<UsuarioSalon>) => {
    setError('');
    try { await api.patch(`/users/${u.id}`, cambio); await cargar(); void recargarPlan(); }
    catch (err) { setError((err as Error).message); }
  };

  const nuevaClave = async (u: UsuarioSalon) => {
    if (!window.confirm(`¿Darle una clave temporal nueva a ${u.name}? Se le cerrará la sesión y tendrá que entrar con la nueva.`)) return;
    try { const r = await api.post<{ claveTemporal: string }>(`/users/${u.id}/clave-temporal`, {}); setClave({ nombre: u.name, email: u.email, clave: r.claveTemporal }); }
    catch (err) { setError((err as Error).message); }
  };

  const tope = miPlan?.limites.usuarios ?? null;
  const activos = lista?.filter((u) => u.active).length ?? 0;
  const lleno = tope !== null && activos >= tope;

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3 text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center"><Users className="w-4 h-4" /></div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">Usuarios</h3>
            <p className="text-[10px] text-slate-500 dark:text-neutral-400">Quién entra a la app del salón{tope !== null ? ` · ${activos} de ${tope} en tu plan` : ''}</p>
          </div>
        </div>
        {!creando && (
          <button type="button" disabled={lleno} onClick={() => setCreando(true)} title={lleno ? 'Tu plan no permite más usuarios' : undefined}
            className="px-3 py-1.5 rounded-xl bg-[var(--primary)] text-white text-[11px] font-bold flex items-center gap-1 disabled:opacity-40 cursor-pointer">
            <UserPlus className="w-3.5 h-3.5" /> Agregar
          </button>
        )}
      </div>

      {clave && <ClaveParaCompartir nombre={clave.nombre} email={clave.email} clave={clave.clave} onListo={() => setClave(null)} />}
      {error && <p className="text-[11px] font-semibold text-rose-600" role="alert">{error}</p>}

      {creando && (
        <form onSubmit={crear} className="p-3 rounded-xl border border-[var(--primary)]/40 bg-[var(--primary)]/5 space-y-2.5">
          <div className="flex justify-between items-center"><b className="text-[12px]">Nuevo usuario</b><button type="button" onClick={() => setCreando(false)} className="cursor-pointer" aria-label="Cancelar"><X className="w-4 h-4 text-slate-400" /></button></div>
          <div className="grid sm:grid-cols-2 gap-2">
            <input required minLength={2} placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={campo} />
            <input required type="email" placeholder="Correo (con él entra)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={campo} />
            <input placeholder="Cargo (ej.: Recepción)" value={form.roleTitle} onChange={(e) => setForm({ ...form, roleTitle: e.target.value })} className={campo} />
            {sedes.length > 1 && (
              <select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} className={campo}>
                <option value="">Todas las sedes</option>
                {sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <button key={r.id} type="button" onClick={() => setForm({ ...form, role: r.id })}
                className={`p-2.5 rounded-xl border text-left cursor-pointer ${form.role === r.id ? 'border-[var(--primary)] bg-white dark:bg-neutral-900' : 'border-slate-200 dark:border-neutral-700'}`}>
                <b className="text-[12px]">{r.label}</b><span className="block text-[10px] text-slate-500 mt-0.5">{r.ayuda}</span>
              </button>
            ))}
          </div>
          <button type="submit" disabled={ocupado} className="w-full py-2.5 rounded-xl bg-[var(--primary)] text-white text-[12px] font-bold disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer">
            {ocupado && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Crear y generar su clave temporal
          </button>
        </form>
      )}

      {!lista ? <div className="flex items-center gap-2 text-[11px] text-slate-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando…</div> : (
        <div className="divide-y divide-slate-100 dark:divide-neutral-800">
          {lista.map((u) => {
            const yo = u.id === currentUser?.id;
            return (
              <div key={u.id} className={`py-2.5 flex flex-wrap items-center gap-2 ${u.active ? '' : 'opacity-50'}`}>
                <div className="flex-1 min-w-[160px]">
                  <div className="text-[12px] font-bold text-slate-900 dark:text-white">{u.name}{yo && <span className="text-slate-400 font-normal"> · tú</span>}</div>
                  <div className="text-[11px] text-slate-500">{u.email}{u.debeCambiarClave && <span className="text-amber-600"> · aún no entra</span>}</div>
                </div>
                <select value={u.role} disabled={yo} onChange={(e) => void editar(u, { role: e.target.value as UsuarioSalon['role'] })}
                  className="text-[11px] rounded-lg px-2 py-1.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700" aria-label="Rol">
                  {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
                {sedes.length > 1 && (
                  <select value={u.locationId ?? ''} onChange={(e) => void editar(u, { locationId: e.target.value || null })}
                    className="text-[11px] rounded-lg px-2 py-1.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700" aria-label="Sede">
                    <option value="">Todas las sedes</option>
                    {sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
                <button type="button" onClick={() => void nuevaClave(u)} title="Clave temporal nueva" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer"><KeyRound className="w-3.5 h-3.5" /></button>
                {!yo && (
                  <button type="button" onClick={() => void editar(u, { active: !u.active })}
                    className="text-[11px] font-semibold px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer">
                    {u.active ? 'Desactivar' : 'Activar'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
