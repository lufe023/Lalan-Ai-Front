import React, { useCallback, useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Loader2, Lock, Minus, RotateCcw, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { IOSToggle } from '../ui/IOSToggle';
import { useConfirmar } from '../ui/ModalConfirmar';
import { PlantillaPermisosEspecialista } from './EntradaEspecialista';
import {
  permisosApi, rolCambiado, rolDePersona, valorDelRol,
  type CatalogoPermisosRol, type ClavePermisoRol, type DefinicionPermisoRol, type MapaPermisosRol,
  type PermisosDePersonaDatos, type RolDelSalon,
} from '../../services/permisos';

/** El catálogo de permisos, una vez por pantalla */
export function useCatalogoPermisos() {
  const [catalogo, setCatalogo] = useState<CatalogoPermisosRol | null>(null);
  const recargar = useCallback(() => permisosApi.catalogo().then(setCatalogo).catch(() => setCatalogo(null)), []);
  useEffect(() => { void recargar(); }, [recargar]);
  return { catalogo, recargar };
}

/**
 * Al elegir el rol: lo que podrá hacer y lo que no verá, con las palabras
 * de la dueña. Antes decía "No cambia la configuración" y la asistente
 * podía cambiar precios.
 */
export const ResumenRol: React.FC<{ rol: 'admin' | RolDelSalon; catalogo: CatalogoPermisosRol | null; valores?: MapaPermisosRol }> = ({ rol, catalogo, valores }) => {
  if (!catalogo) return null;
  if (rol === 'admin') {
    return (
      <div className="p-2.5 rounded-xl bg-white/70 dark:bg-neutral-900/70 border border-slate-200 dark:border-neutral-700 text-[0.75rem] text-slate-600 dark:text-neutral-300 text-left">
        <b className="text-slate-800 dark:text-white">Puede todo:</b> {catalogo.soloAdministracion.join(', ').toLowerCase()}, y todo lo del equipo.
      </div>
    );
  }
  const valor = (c: ClavePermisoRol) => valores?.[c] ?? valorDelRol(rol, c);
  const si = catalogo.definiciones.filter((p) => valor(p.clave));
  const no = catalogo.definiciones.filter((p) => !valor(p.clave));
  return (
    <div className="grid sm:grid-cols-2 gap-2 text-[0.75rem] text-left">
      <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/70 dark:border-emerald-500/20">
        <div className="font-bold text-emerald-800 dark:text-emerald-300 mb-1">Lo que podrá hacer</div>
        <ul className="space-y-0.5 text-slate-700 dark:text-neutral-200">
          {si.map((p) => <li key={p.clave} className="flex gap-1.5"><Check className="w-3.5 h-3.5 mt-px shrink-0 text-emerald-600" aria-hidden="true" />{p.puede}</li>)}
        </ul>
      </div>
      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700">
        <div className="font-bold text-slate-700 dark:text-neutral-200 mb-1">Lo que no verá</div>
        <ul className="space-y-0.5 text-slate-500 dark:text-neutral-400">
          {no.map((p) => <li key={p.clave} className="flex gap-1.5"><Minus className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />{p.noPuede}</li>)}
          {catalogo.soloAdministracion.map((t) => <li key={t} className="flex gap-1.5"><Minus className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />{t}</li>)}
        </ul>
      </div>
    </div>
  );
};

/** Los interruptores por área, como los define el servidor (también en Plataforma → Roles) */
export const Interruptores: React.FC<{
  areas: { id: string; titulo: string }[];
  definiciones: DefinicionPermisoRol[];
  valor: (c: ClavePermisoRol) => boolean;
  /** Los que difieren de lo de arriba llevan su marca y un botón para volver */
  marca?: (c: ClavePermisoRol) => string | null;
  onVolver?: (c: ClavePermisoRol) => void;
  ocupada: ClavePermisoRol | null;
  onCambiar: (c: ClavePermisoRol, v: boolean) => void;
}> = ({ areas, definiciones, valor, marca, onVolver, ocupada, onCambiar }) => (
  <div className="space-y-3">
    {areas.map((a) => {
      const delArea = definiciones.filter((p) => p.area === a.id);
      if (!delArea.length) return null;
      return (
        <div key={a.id} className="space-y-1">
          <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">{a.titulo}</div>
          <div className="rounded-xl border border-slate-200 dark:border-neutral-700 divide-y divide-slate-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
            {delArea.map((p) => {
              const m = marca?.(p.clave);
              return (
                <div key={p.clave} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="text-[0.8125rem] text-slate-700 dark:text-neutral-200 leading-snug">
                    {valor(p.clave) ? p.puede : <span className="text-slate-400">{p.noPuede}</span>}
                    {m && (
                      <span className="ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] text-[0.625rem] font-bold align-middle">
                        {m}
                        {onVolver && (
                          <button type="button" onClick={() => onVolver(p.clave)} title="Volver a lo de siempre" aria-label={`${p.puede}: volver a lo de siempre`} className="cursor-pointer">
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {ocupada === p.clave && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                    <IOSToggle checked={valor(p.clave)} onChange={(v) => onCambiar(p.clave, v)} ariaLabel={p.puede} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    })}
  </div>
);

/** Una fila de la lista de roles: nombre, para qué es, cuántas personas y si se cambió */
export const FilaRol: React.FC<{
  nombre: string;
  descripcion: string;
  personas?: number;
  etiqueta?: { texto: string; cambiado: boolean } | null;
  bloqueado?: boolean;
  onAbrir: () => void;
}> = ({ nombre, descripcion, personas, etiqueta, bloqueado, onAbrir }) => (
  <button type="button" onClick={onAbrir} className="w-full flex items-center gap-3 px-3 py-3 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800/60">
    <span className="flex-1 min-w-0">
      <span className="flex flex-wrap items-center gap-1.5">
        <b className="text-[0.8125rem] text-slate-900 dark:text-white">{nombre}</b>
        {bloqueado && <Lock className="w-3 h-3 text-slate-400" aria-label="No se cambia" />}
        {etiqueta && (
          <span className={`px-1.5 py-0.5 rounded text-[0.625rem] font-bold ${etiqueta.cambiado ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>
            {etiqueta.texto}
          </span>
        )}
      </span>
      <span className="block text-[0.75rem] text-slate-500 dark:text-neutral-400 leading-snug mt-0.5">{descripcion}</span>
    </span>
    {personas !== undefined && (
      <span className="text-[0.6875rem] text-slate-400 shrink-0">{personas} {personas === 1 ? 'persona' : 'personas'}</span>
    )}
    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" aria-hidden="true" />
  </button>
);

/** Arriba del detalle de un rol: volver a la lista */
export const VolverALista: React.FC<{ onVolver: () => void }> = ({ onVolver }) => (
  <button type="button" onClick={onVolver} className="flex items-center gap-1 text-[0.75rem] font-bold text-[var(--primary)] cursor-pointer">
    <ChevronLeft className="w-4 h-4" /> Todos los roles
  </button>
);

/** En la fila de una persona: lo que puede ella, si la dueña quiere algo distinto al resto de su rol */
export const PermisosDePersona: React.FC<{ id: string; nombre: string; catalogo: CatalogoPermisosRol }> = ({ id, nombre, catalogo }) => {
  const { showToast } = useApp();
  const [datos, setDatos] = useState<PermisosDePersonaDatos | null>(null);
  const [ocupada, setOcupada] = useState<ClavePermisoRol | null>(null);
  useEffect(() => { permisosApi.dePersona(id).then(setDatos).catch(() => setDatos(null)); }, [id]);
  if (!datos) return <div className="flex items-center gap-2 text-[0.75rem] text-slate-400 mt-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando…</div>;

  const rol = rolDePersona(catalogo, datos.rol);
  const guardar = async (c: ClavePermisoRol, v: boolean | null) => {
    setOcupada(c);
    try { setDatos(await permisosApi.guardarPersona(id, { [c]: v })); }
    catch (e) { showToast('No se guardó', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
    finally { setOcupada(null); }
  };
  const primerNombre = nombre.split(' ')[0];

  return (
    <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/50 border border-slate-200 dark:border-neutral-700 space-y-2.5">
      <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 leading-relaxed">
        Lo que puede hacer {primerNombre}. Lo que cambies aquí es solo para esta persona; lo demás sigue lo que diga el rol {rol.nombre}.
      </p>
      <Interruptores
        areas={catalogo.areas}
        definiciones={catalogo.definiciones}
        valor={(c) => !!datos.efectivos[c]}
        marca={(c) => (datos.propios[c] !== undefined ? 'Solo para esta persona' : null)}
        onVolver={(c) => void guardar(c, null)}
        ocupada={ocupada}
        // Si queda igual que el resto de su rol, no se guarda como excepción
        onCambiar={(c, v) => void guardar(c, v === valorDelRol(rol, c) ? null : v)}
      />
    </div>
  );
};

const tarjeta = 'p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3 text-slate-900 dark:text-neutral-100';

/** El detalle de un rol en el salón: sus interruptores y volver a como lo trae Lalan */
const RolEnSalon: React.FC<{ rol: RolDelSalon; catalogo: CatalogoPermisosRol; onCambio: () => Promise<unknown>; onVolver: () => void }> = ({ rol, catalogo, onCambio, onVolver }) => {
  const { showToast } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [ocupada, setOcupada] = useState<ClavePermisoRol | null>(null);
  const cambiado = rolCambiado(rol);

  const cambiar = async (c: ClavePermisoRol, v: boolean) => {
    setOcupada(c);
    // Igual que lo de Lalan: se quita el ajuste, así le llegan las mejoras de Lalan
    try { await permisosApi.guardarRol(rol.clave, { [c]: v === !!rol.fabrica[c] ? null : v }); await onCambio(); }
    catch (e) { showToast('No se guardó', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
    finally { setOcupada(null); }
  };
  const volverTodo = async () => {
    if (!(await confirmar({
      titulo: `¿${rol.nombre} vuelve a como lo trae Lalan?`,
      mensaje: 'Se quitan los cambios que le hiciste a este rol en tu salón. Lo que le cambiaste a una persona en su fila se queda.',
      textoConfirmar: 'Sí, volver',
      icono: <RotateCcw className="w-7 h-7" aria-hidden="true" />,
    }))) return;
    try { await permisosApi.volverRol(rol.clave); await onCambio(); showToast('Listo', `${rol.nombre} quedó como lo trae Lalan.`, 'success'); }
    catch (e) { showToast('No se pudo', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
  };

  return (
    <div className="space-y-3">
      {modalConfirmar}
      <VolverALista onVolver={onVolver} />
      <div>
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{rol.nombre}</h3>
        <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">
          {rol.descripcion} {rol.personas ? `${rol.personas} ${rol.personas === 1 ? 'persona tiene' : 'personas tienen'} este rol.` : 'Nadie tiene este rol todavía.'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2 py-1 rounded-lg text-[0.6875rem] font-bold ${cambiado ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>
          {cambiado ? 'Cambiado en tu salón' : 'Como lo trae Lalan'}
        </span>
        {cambiado && (
          <button type="button" onClick={() => void volverTodo()} className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-neutral-700 text-[0.6875rem] font-bold text-slate-600 dark:text-neutral-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800">
            <RotateCcw className="w-3 h-3" /> Volver a como lo trae Lalan
          </button>
        )}
      </div>
      <Interruptores
        areas={catalogo.areas}
        definiciones={catalogo.definiciones}
        valor={(c) => valorDelRol(rol, c)}
        marca={(c) => (rol.salon[c] !== undefined && rol.salon[c] !== !!rol.fabrica[c] ? 'Cambiado en tu salón' : null)}
        onVolver={(c) => void cambiar(c, !!rol.fabrica[c])}
        ocupada={ocupada}
        onCambiar={(c, v) => void cambiar(c, v)}
      />
    </div>
  );
};

/**
 * Ajustes → Equipo → Roles: la lista de roles de Lalan. Se entra a uno y se
 * cambia para este salón; siempre se puede volver a como lo trae Lalan. Los
 * roles los crea Lalan: el salón no crea roles nuevos.
 */
export const RolesDelSalon: React.FC<{ catalogo: CatalogoPermisosRol | null; onCambio: () => Promise<unknown> }> = ({ catalogo, onCambio }) => {
  const [abierto, setAbierto] = useState<string | null>(null);
  if (!catalogo) return null;
  const rol = catalogo.roles.find((r) => r.clave === abierto);

  return (
    <div className={tarjeta} id="roles-del-salon">
      {abierto === 'admin' ? (
        <div className="space-y-3">
          <VolverALista onVolver={() => setAbierto(null)} />
          <h3 className="text-base font-extrabold">Administración</h3>
          <p className="text-[0.75rem] text-slate-500">La dueña y quien ella haga administradora. No se le quita nada.</p>
          <ResumenRol rol="admin" catalogo={catalogo} />
        </div>
      ) : abierto === 'especialista' ? (
        <div className="space-y-3">
          <VolverALista onVolver={() => setAbierto(null)} />
          <PlantillaPermisosEspecialista sinMarco />
        </div>
      ) : rol ? (
        <RolEnSalon rol={rol} catalogo={catalogo} onCambio={onCambio} onVolver={() => setAbierto(null)} />
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[var(--primary)]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Roles</h2>
          </div>
          <p className="text-[0.75rem] text-slate-400 leading-relaxed">
            Qué puede hacer cada rol en tu salón. Entra a uno para cambiarlo; siempre puedes volver a como lo trae Lalan.
            A una persona en concreto le cambias algo con el escudo de su fila.
          </p>
          <div className="rounded-xl border border-slate-200 dark:border-neutral-700 divide-y divide-slate-200 dark:divide-neutral-800 overflow-hidden">
            <FilaRol nombre="Administración" descripcion="Puede todo, incluida la configuración y los usuarios." bloqueado onAbrir={() => setAbierto('admin')} />
            {catalogo.roles.map((r) => {
              const cambiado = rolCambiado(r);
              return (
                <FilaRol key={r.clave} nombre={r.nombre} descripcion={r.descripcion} personas={r.personas}
                  etiqueta={{ texto: cambiado ? 'Cambiado en tu salón' : 'Como lo trae Lalan', cambiado }}
                  onAbrir={() => setAbierto(r.clave)} />
              );
            })}
            <FilaRol nombre="Especialista" descripcion="Entra a ver sus citas. No cuenta como usuario de tu plan; se le da entrada desde su ficha."
              onAbrir={() => setAbierto('especialista')} />
          </div>
        </>
      )}
    </div>
  );
};
