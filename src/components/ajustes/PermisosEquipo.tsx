import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Minus, RotateCcw, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { IOSToggle } from '../ui/IOSToggle';
import {
  permisosApi, valorDelSalon,
  type CatalogoPermisosRol, type ClavePermisoRol, type MapaPermisosRol,
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
export const ResumenRol: React.FC<{ rol: 'admin' | 'assistant'; catalogo: CatalogoPermisosRol | null; valores?: MapaPermisosRol }> = ({ rol, catalogo, valores }) => {
  if (!catalogo) return null;
  if (rol === 'admin') {
    return (
      <div className="p-2.5 rounded-xl bg-white/70 dark:bg-neutral-900/70 border border-slate-200 dark:border-neutral-700 text-[0.75rem] text-slate-600 dark:text-neutral-300">
        <b className="text-slate-800 dark:text-white">Puede todo:</b> {catalogo.soloAdministracion.join(', ').toLowerCase()}, y todo lo del equipo.
      </div>
    );
  }
  const valor = (c: ClavePermisoRol) => valores?.[c] ?? valorDelSalon(catalogo.permisos.find((p) => p.clave === c)!);
  const si = catalogo.permisos.filter((p) => valor(p.clave));
  const no = catalogo.permisos.filter((p) => !valor(p.clave));
  return (
    <div className="grid sm:grid-cols-2 gap-2 text-[0.75rem]">
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

/** Los interruptores por área, como los define el servidor */
const Interruptores: React.FC<{
  catalogo: CatalogoPermisosRol;
  valor: (c: ClavePermisoRol) => boolean;
  /** Los que difieren de lo de arriba llevan su marca y un botón para volver */
  marca?: (c: ClavePermisoRol) => string | null;
  onVolver?: (c: ClavePermisoRol) => void;
  ocupada: ClavePermisoRol | null;
  onCambiar: (c: ClavePermisoRol, v: boolean) => void;
}> = ({ catalogo, valor, marca, onVolver, ocupada, onCambiar }) => (
  <div className="space-y-3">
    {catalogo.areas.map((a) => {
      const delArea = catalogo.permisos.filter((p) => p.area === a.id);
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

/** En la fila de una asistente: lo que puede ella, si la dueña quiere algo distinto al resto */
export const PermisosDePersona: React.FC<{ id: string; nombre: string; catalogo: CatalogoPermisosRol }> = ({ id, nombre, catalogo }) => {
  const { showToast } = useApp();
  const [datos, setDatos] = useState<{ propios: MapaPermisosRol; efectivos: MapaPermisosRol } | null>(null);
  const [ocupada, setOcupada] = useState<ClavePermisoRol | null>(null);
  useEffect(() => { permisosApi.dePersona(id).then(setDatos).catch(() => setDatos(null)); }, [id]);
  if (!datos) return <div className="flex items-center gap-2 text-[0.75rem] text-slate-400 mt-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando…</div>;

  const delSalon = (c: ClavePermisoRol) => valorDelSalon(catalogo.permisos.find((p) => p.clave === c)!);
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
        Lo que puede hacer {primerNombre}. Lo que cambies aquí es solo para esta persona; lo demás sigue lo que diga «Qué puede hacer una asistente».
      </p>
      <Interruptores
        catalogo={catalogo}
        valor={(c) => !!datos.efectivos[c]}
        marca={(c) => (datos.propios[c] !== undefined ? 'Solo para esta persona' : null)}
        onVolver={(c) => void guardar(c, null)}
        ocupada={ocupada}
        // Si queda igual que el resto del salón, no se guarda como excepción
        onCambiar={(c, v) => void guardar(c, v === delSalon(c) ? null : v)}
      />
    </div>
  );
};

/** Ajustes → Equipo: lo que puede hacer cualquier asistente del salón */
export const PlantillaAsistente: React.FC<{ catalogo: CatalogoPermisosRol | null; onCambio: () => void }> = ({ catalogo, onCambio }) => {
  const { showToast } = useApp();
  const [ocupada, setOcupada] = useState<ClavePermisoRol | null>(null);
  if (!catalogo) return null;

  const cambiar = async (c: ClavePermisoRol, v: boolean) => {
    const def = catalogo.permisos.find((p) => p.clave === c)!;
    setOcupada(c);
    // Igual que de fábrica: se quita el ajuste, así le llegan las mejoras de Lalan
    try { await permisosApi.guardarSalon({ [c]: v === def.fabrica ? null : v }); onCambio(); }
    catch (e) { showToast('No se guardó', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
    finally { setOcupada(null); }
  };

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3 text-slate-900 dark:text-neutral-100">
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="w-4 h-4 text-[var(--primary)]" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Qué puede hacer una asistente</h2>
      </div>
      <p className="text-[0.75rem] text-slate-400 leading-relaxed">
        Vale para todas las asistentes del salón, salvo lo que le cambies a una en su fila (el escudo). Administración puede todo, siempre.
      </p>
      <Interruptores
        catalogo={catalogo}
        valor={(c) => valorDelSalon(catalogo.permisos.find((p) => p.clave === c)!)}
        marca={(c) => {
          const p = catalogo.permisos.find((x) => x.clave === c)!;
          return p.salon !== null && p.salon !== p.fabrica ? 'Cambiado en tu salón' : null;
        }}
        onVolver={(c) => void cambiar(c, catalogo.permisos.find((p) => p.clave === c)!.fabrica)}
        ocupada={ocupada}
        onCambiar={(c, v) => void cambiar(c, v)}
      />
    </div>
  );
};
