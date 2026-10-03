import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, ChevronDown, Loader2, Smartphone } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface Grupo { id: string; descripcion: string; detalle: string }
interface Aviso { id: string; grupo: string; descripcion: string }
interface Persona {
  id: string; nombre: string; rol: string; cargo: string | null; locationId: string | null;
  esDireccion: boolean; aparatos: number; recibe: Record<string, boolean>;
}
interface Reparto { grupos: Grupo[]; avisos: Aviso[]; personas: Persona[] }

/** Un interruptor de los de la app */
const Interruptor: React.FC<{ encendido: boolean; mixto?: boolean; onCambio: () => void; etiqueta: string }> = ({ encendido, mixto, onCambio, etiqueta }) => (
  <button type="button" role="switch" aria-checked={mixto ? 'mixed' : encendido} aria-label={etiqueta} onClick={onCambio}
    className={`relative w-9 h-5 rounded-full shrink-0 transition-colors cursor-pointer ${encendido ? 'bg-[var(--primary)]' : mixto ? 'bg-[var(--primary)]/40' : 'bg-slate-300 dark:bg-neutral-700'}`}>
    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${encendido ? 'left-[18px]' : mixto ? 'left-[10px]' : 'left-0.5'}`} />
  </button>
);

/**
 * Ajustes → Avisos: la dueña decide quién de su equipo recibe en el teléfono
 * cada aviso (una clienta necesita a una persona, mandó una foto, citas…).
 * Si nadie de los elegidos tiene las notificaciones activadas, el aviso le
 * llega igual a la administración: ninguno se queda sin dueño.
 */
export const AvisosEquipo: React.FC = () => {
  const { currentUser } = useAuth();
  const [datos, setDatos] = useState<Reparto | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try { setDatos(await api.get<Reparto>('/push/avisos')); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const cambiar = async (p: Persona, cambios: Record<string, boolean>) => {
    setError(''); setGuardando(p.id);
    // Se ve el cambio al instante; si falla, se recarga lo que de verdad quedó
    setDatos((d) => d && ({ ...d, personas: d.personas.map((x) => (x.id === p.id ? { ...x, recibe: { ...x.recibe, ...cambios } } : x)) }));
    try { await api.patch(`/push/avisos/${p.id}`, { recibe: cambios }); }
    catch (e) { setError((e as Error).message); void cargar(); }
    finally { setGuardando(null); }
  };

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3 text-slate-900 dark:text-neutral-100">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center"><BellRing className="w-4 h-4" /></div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">Avisos al teléfono</h3>
          <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">Quién de tu equipo se entera de cada cosa. Cada persona tiene que activar las notificaciones en su teléfono.</p>
        </div>
      </div>
      {error && <p className="text-[0.75rem] font-semibold text-rose-600" role="alert">{error}</p>}

      {!datos ? <div className="flex items-center gap-2 text-[0.75rem] text-slate-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando…</div> : (
        <div className="divide-y divide-slate-100 dark:divide-neutral-800">
          {datos.personas.map((p) => {
            const yo = p.id === currentUser?.id;
            const detalle = abierta === p.id;
            return (
              <div key={p.id} className="py-2.5 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.8125rem] font-bold">{p.nombre}{yo && <span className="text-slate-400 font-normal"> · tú</span>}</div>
                    <div className={`text-[0.6875rem] flex items-center gap-1 ${p.aparatos ? 'text-emerald-600' : 'text-amber-600'}`}>
                      <Smartphone className="w-3 h-3" />
                      {p.aparatos ? `Notificaciones activadas en ${p.aparatos === 1 ? 'un aparato' : `${p.aparatos} aparatos`}` : 'No ha activado las notificaciones: no le llegará nada'}
                    </div>
                  </div>
                  {guardando === p.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {datos.grupos.map((g) => {
                    const delGrupo = datos.avisos.filter((a) => a.grupo === g.id);
                    const encendidos = delGrupo.filter((a) => p.recibe[a.id]).length;
                    const todos = encendidos === delGrupo.length;
                    return (
                      <div key={g.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-[0.8125rem] font-semibold">{g.descripcion}</div>
                          <div className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">{g.detalle}</div>
                        </div>
                        <Interruptor etiqueta={`${g.descripcion} para ${p.nombre}`} encendido={todos} mixto={!todos && encendidos > 0}
                          onCambio={() => void cambiar(p, Object.fromEntries(delGrupo.map((a) => [a.id, !todos])))} />
                      </div>
                    );
                  })}
                </div>
                <button type="button" onClick={() => setAbierta(detalle ? null : p.id)}
                  className="text-[0.75rem] font-semibold text-slate-500 hover:text-[var(--primary)] flex items-center gap-1 cursor-pointer">
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${detalle ? 'rotate-180' : ''}`} /> Elegir aviso por aviso
                </button>
                {detalle && (
                  <div className="space-y-1.5 pl-1">
                    {datos.avisos.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 text-[0.8125rem]">
                        <Interruptor etiqueta={a.descripcion} encendido={!!p.recibe[a.id]} onCambio={() => void cambiar(p, { [a.id]: !p.recibe[a.id] })} />
                        <span>{a.descripcion}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
