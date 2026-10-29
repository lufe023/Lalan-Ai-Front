import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, RotateCcw, ShieldAlert, ShieldCheck, Trash2, X } from 'lucide-react';
import { api } from '../../services/api';
import { useConfirmar } from '../ui/ModalConfirmar';
import { FilaRol, Interruptores, VolverALista } from '../ajustes/PermisosEquipo';
import { ListaPermisos } from '../ajustes/EntradaEspecialista';
import type { ClavePermisoRol, DefinicionPermisoRol, MapaPermisosRol } from '../../services/permisos';
import type { CatalogoPermisos, ClavePermiso, MapaPermisos } from '../../services/especialistas';

interface RolPlataforma {
  clave: string;
  nombre: string;
  descripcion: string;
  /** Lo trae el código: no se borra, solo vuelve a como venía */
  deLalan: boolean;
  fabrica: MapaPermisosRol;
  deCodigo: MapaPermisosRol;
  personas: number;
  salonesConAjuste: number;
}

interface DatosRoles {
  modo: 'aplicar' | 'espejo';
  areas: { id: string; titulo: string }[];
  definiciones: DefinicionPermisoRol[];
  roles: RolPlataforma[];
  especialista: CatalogoPermisos & { fabrica: MapaPermisos; personas: number; salonesConAjuste: number };
  negados: { ruta: string; permiso: string; salones: number; ultima: string }[];
}

const tarjeta = 'p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs text-slate-900 dark:text-neutral-100 space-y-3';
const campo = 'w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
const botonChico = 'flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-neutral-700 text-[0.6875rem] font-bold text-slate-600 dark:text-neutral-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800';

const cambiadoEnPlataforma = (r: RolPlataforma) =>
  r.deLalan && Object.keys(r.deCodigo).some((c) => !!r.fabrica[c as ClavePermisoRol] !== !!r.deCodigo[c as ClavePermisoRol]);

const salonesTexto = (n: number) => `${n} ${n === 1 ? 'salón lo cambió' : 'salones lo cambiaron'}`;

/** Un rol del equipo: nombre, para qué es, y lo que trae para todos los salones */
const EditorRol: React.FC<{ rol: RolPlataforma; datos: DatosRoles; onCambio: () => Promise<unknown>; onVolver: () => void }> = ({ rol, datos, onCambio, onVolver }) => {
  const { confirmar, modalConfirmar } = useConfirmar();
  const [nombre, setNombre] = useState(rol.nombre);
  const [descripcion, setDescripcion] = useState(rol.descripcion);
  const [ocupada, setOcupada] = useState<ClavePermisoRol | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { setNombre(rol.nombre); setDescripcion(rol.descripcion); }, [rol.nombre, rol.descripcion]);
  const textosCambiados = nombre.trim() !== rol.nombre || descripcion.trim() !== rol.descripcion;

  const guardar = async (cuerpo: Record<string, unknown>, c?: ClavePermisoRol) => {
    setError(''); if (c) setOcupada(c);
    try { await api.put(`/plataforma/permisos/rol/${encodeURIComponent(rol.clave)}`, cuerpo); await onCambio(); }
    catch (e) { setError((e as Error).message); }
    finally { setOcupada(null); }
  };
  const quitar = async () => {
    const borrar = !rol.deLalan;
    if (!(await confirmar({
      titulo: borrar ? `¿Borrar el rol ${rol.nombre}?` : `¿${rol.nombre} vuelve a como viene en Lalan?`,
      mensaje: borrar
        ? 'Deja de salir en los salones. Solo se puede si nadie lo tiene.'
        : 'Vuelve a su nombre y a sus permisos de siempre. Lo que cambió cada salón se queda.',
      textoConfirmar: borrar ? 'Sí, borrar' : 'Sí, volver',
      tono: borrar ? 'peligro' : 'normal',
      icono: borrar ? <Trash2 className="w-7 h-7" aria-hidden="true" /> : <RotateCcw className="w-7 h-7" aria-hidden="true" />,
    }))) return;
    setError('');
    try { await api.delete(`/plataforma/permisos/rol/${encodeURIComponent(rol.clave)}`); await onCambio(); if (borrar) onVolver(); }
    catch (e) { setError((e as Error).message); }
  };

  return (
    <div className="space-y-3">
      {modalConfirmar}
      <VolverALista onVolver={onVolver} />
      <div className="grid sm:grid-cols-[1fr_2fr] gap-2">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} aria-label="Nombre del rol" className={`${campo} font-bold`} />
        <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={200} aria-label="Para qué es" placeholder="Para qué es este rol" className={campo} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {textosCambiados && (
          <button type="button" onClick={() => void guardar({ nombre: nombre.trim(), descripcion: descripcion.trim() })}
            className="px-3 py-1 rounded-lg bg-[var(--primary)] text-white text-[0.6875rem] font-bold cursor-pointer">Guardar nombre</button>
        )}
        <span className="text-[0.6875rem] text-slate-400">
          {rol.personas} {rol.personas === 1 ? 'persona' : 'personas'} · {salonesTexto(rol.salonesConAjuste)}
        </span>
        {(!rol.deLalan || cambiadoEnPlataforma(rol)) && (
          <button type="button" onClick={() => void quitar()} className={botonChico}>
            {rol.deLalan ? <><RotateCcw className="w-3 h-3" /> Volver a como viene</> : <><Trash2 className="w-3 h-3" /> Borrar rol</>}
          </button>
        )}
      </div>
      {error && <p className="text-rose-600 text-[0.8125rem]" role="alert">{error}</p>}
      <p className="text-[0.75rem] text-slate-500">Lo que marques aquí es lo que trae este rol en todos los salones. Cada salón lo puede cambiar y volver a esto.</p>
      <Interruptores
        areas={datos.areas}
        definiciones={datos.definiciones}
        valor={(c) => !!rol.fabrica[c]}
        marca={(c) => (rol.deLalan && !!rol.fabrica[c] !== !!rol.deCodigo[c] ? 'Cambiado en Plataforma' : null)}
        onVolver={(c) => void guardar({ permisos: { [c]: null } }, c)}
        ocupada={ocupada}
        onCambiar={(c, v) => void guardar({ permisos: { [c]: v } }, c)}
      />
    </div>
  );
};

/** Especialista: sus permisos son otros (los de su app), pero también trae los de Lalan */
const EditorEspecialista: React.FC<{ datos: DatosRoles; onCambio: () => Promise<unknown>; onVolver: () => void }> = ({ datos, onCambio, onVolver }) => {
  const [ocupada, setOcupada] = useState<ClavePermiso | null>(null);
  const [error, setError] = useState('');
  const e = datos.especialista;
  const cambiados = Object.fromEntries(e.permisos.filter((p) => e.fabrica[p.clave] !== p.porDefecto).map((p) => [p.clave, e.fabrica[p.clave]])) as Partial<MapaPermisos>;

  const cambiar = async (c: ClavePermiso, v: boolean) => {
    setOcupada(c); setError('');
    try { await api.put('/plataforma/permisos/especialista', { permisos: { [c]: v } }); await onCambio(); }
    catch (err) { setError((err as Error).message); }
    finally { setOcupada(null); }
  };
  const volver = async () => {
    try { await api.delete('/plataforma/permisos/especialista'); await onCambio(); }
    catch (err) { setError((err as Error).message); }
  };

  return (
    <div className="space-y-3">
      <VolverALista onVolver={onVolver} />
      <h3 className="text-base font-extrabold">Especialista</h3>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[0.6875rem] text-slate-400">{e.personas} con entrada · {salonesTexto(e.salonesConAjuste)}</span>
        {Object.keys(cambiados).length > 0 && (
          <button type="button" onClick={() => void volver()} className={botonChico}><RotateCcw className="w-3 h-3" /> Volver a como viene</button>
        )}
      </div>
      {error && <p className="text-rose-600 text-[0.8125rem]" role="alert">{error}</p>}
      <p className="text-[0.75rem] text-slate-500">Con lo que arranca cada especialista con entrada a Lalan, en todos los salones. Cada salón lo puede cambiar y volver a esto.</p>
      <ListaPermisos catalogo={e} valores={e.fabrica} propios={cambiados} textoMarca="Cambiado en Plataforma" ocupada={ocupada} onCambiar={(c, v) => void cambiar(c, v)} />
    </div>
  );
};

/** Crear un rol nuevo: nombre y de cuál copia los permisos */
const NuevoRol: React.FC<{ roles: RolPlataforma[]; onCreado: (clave: string) => void; onCancelar: () => void }> = ({ roles, onCreado, onCancelar }) => {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [desde, setDesde] = useState(roles[0]?.clave ?? 'assistant');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  const crear = async (ev: React.FormEvent) => {
    ev.preventDefault(); setOcupado(true); setError('');
    try {
      const r = await api.post<RolPlataforma>('/plataforma/permisos/rol', { nombre: nombre.trim(), descripcion: descripcion.trim(), desde });
      onCreado(r.clave);
    } catch (e) { setError((e as Error).message); }
    finally { setOcupado(false); }
  };

  return (
    <form onSubmit={crear} className="p-3 rounded-xl border border-[var(--primary)]/40 bg-[var(--primary)]/5 space-y-2.5">
      <div className="flex justify-between items-center">
        <b className="text-[0.8125rem]">Nuevo rol</b>
        <button type="button" onClick={onCancelar} className="cursor-pointer" aria-label="Cancelar"><X className="w-4 h-4 text-slate-400" /></button>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <input required minLength={2} maxLength={40} autoFocus placeholder="Nombre (ej.: Encargada de cabina)" value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} />
        <label className="flex items-center gap-2 text-[0.75rem] text-slate-500">
          <span className="shrink-0">Copia los permisos de</span>
          <select value={desde} onChange={(e) => setDesde(e.target.value)} className={campo}>
            {roles.map((r) => <option key={r.clave} value={r.clave}>{r.nombre}</option>)}
          </select>
        </label>
        <input maxLength={200} placeholder="Para qué es (lo lee la dueña al elegirlo)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={`${campo} sm:col-span-2`} />
      </div>
      {error && <p className="text-rose-600 text-[0.8125rem]" role="alert">{error}</p>}
      <button type="submit" disabled={ocupado || nombre.trim().length < 2}
        className="w-full py-2 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer">
        {ocupado && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Crear y ajustar sus permisos
      </button>
    </form>
  );
};

/**
 * Plataforma → Roles: la lista de roles de Lalan. Se entra a uno y se ajusta
 * lo que trae para todos los salones (en lo que la dueña no haya cambiado).
 * Solo Lalan crea roles; cada salón los ajusta y puede volver a esto.
 */
export const RolesPlataforma: React.FC = () => {
  const [d, setD] = useState<DatosRoles | null>(null);
  const [error, setError] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const cargar = useCallback(() => api.get<DatosRoles>('/plataforma/permisos').then(setD).catch((e) => setError((e as Error).message)), []);
  useEffect(() => { void cargar(); }, [cargar]);
  const nombre = (clave: string) => d?.definiciones.find((p) => p.clave === clave)?.puede ?? (clave === 'solo-administracion' ? 'Solo administración' : clave);

  if (!d) return <div className={tarjeta}>{error ? <p className="text-rose-600 text-[0.8125rem]">{error}</p> : <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}</div>;
  const rol = d.roles.find((r) => r.clave === abierto);

  return (
    <div className="space-y-3">
      <div className={tarjeta}>
        {abierto === 'admin' ? (
          <div className="space-y-3">
            <VolverALista onVolver={() => setAbierto(null)} />
            <h3 className="text-base font-extrabold">Administración</h3>
            <p className="text-[0.75rem] text-slate-500">La dueña y quien ella haga administradora. Puede todo y no se le quita nada.</p>
          </div>
        ) : abierto === 'especialista' ? (
          <EditorEspecialista datos={d} onCambio={cargar} onVolver={() => setAbierto(null)} />
        ) : rol ? (
          <EditorRol rol={rol} datos={d} onCambio={cargar} onVolver={() => setAbierto(null)} />
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[var(--primary)]" />
                <h2 className="text-xs font-bold uppercase tracking-wider">Roles de Lalan</h2>
              </div>
              {!creando && (
                <button type="button" onClick={() => setCreando(true)} className="px-3 py-1.5 rounded-xl bg-[var(--primary)] text-white text-[0.75rem] font-bold flex items-center gap-1 cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> Nuevo rol
                </button>
              )}
            </div>
            <p className="text-[0.75rem] text-slate-500 leading-relaxed">
              Los roles que ven todos los salones al dar de alta a alguien. Entra a uno para ajustar lo que trae; cada salón lo puede cambiar y volver a esto.
              Los salones no crean roles. {d.modo === 'aplicar'
                ? 'Los permisos se están aplicando: lo apagado se niega.'
                : 'Modo espejo: todavía no se niega nada, solo se anota lo que se habría negado (abajo). Se activa con PERMISOS_MODO=aplicar.'}
            </p>
            {creando && <NuevoRol roles={d.roles} onCancelar={() => setCreando(false)} onCreado={(clave) => { setCreando(false); void cargar().then(() => setAbierto(clave)); }} />}
            <div className="rounded-xl border border-slate-200 dark:border-neutral-700 divide-y divide-slate-200 dark:divide-neutral-800 overflow-hidden">
              <FilaRol nombre="Administración" descripcion="Puede todo, incluida la configuración y los usuarios." bloqueado onAbrir={() => setAbierto('admin')} />
              {d.roles.map((r) => (
                <FilaRol key={r.clave} nombre={r.nombre} descripcion={r.descripcion || 'Sin descripción'} personas={r.personas}
                  etiqueta={!r.deLalan ? { texto: 'Creado aquí', cambiado: true } : cambiadoEnPlataforma(r) ? { texto: 'Cambiado en Plataforma', cambiado: true } : null}
                  onAbrir={() => setAbierto(r.clave)} />
              ))}
              <FilaRol nombre="Especialista" descripcion="Entra a ver sus citas. No cuenta como usuario del plan." personas={d.especialista.personas} onAbrir={() => setAbierto('especialista')} />
            </div>
          </>
        )}
      </div>

      <div className={tarjeta}>
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider">{d.modo === 'aplicar' ? 'Negado esta semana' : 'Se habría negado esta semana'}</h2>
        </div>
        {!d.negados.length ? (
          <p className="text-[0.8125rem] text-slate-500">Nada. Nadie del equipo chocó con un permiso apagado en los últimos 7 días.</p>
        ) : (
          <>
            <p className="text-[0.75rem] text-slate-500">Si algo de esto es parte del trabajo normal de un rol, enciéndelo en ese rol antes de aplicar.</p>
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
