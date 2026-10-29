import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, ShieldCheck, RotateCcw, UserX, Smartphone } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { IOSToggle } from '../ui/IOSToggle';
import { useConfirmar } from '../ui/ModalConfirmar';
import { ClaveParaCompartir } from '../plataforma/ClaveParaCompartir';
import { entradaApi, type CatalogoPermisos, type ClavePermiso, type EntradaDeEspecialista, type MapaPermisos, type PlantillaPermisos } from '../../services/especialistas';

const campo = 'w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';

/** Los interruptores, agrupados como los define el servidor */
export const ListaPermisos: React.FC<{
  catalogo: CatalogoPermisos;
  valores: MapaPermisos;
  /** Las que difieren de la plantilla del salón: llevan la marca "Solo ella" */
  propios?: Partial<MapaPermisos>;
  /** El texto de esa marca (en la plantilla: "Cambiado en tu salón") */
  textoMarca?: string;
  ocupada?: ClavePermiso | null;
  onCambiar: (clave: ClavePermiso, valor: boolean) => void;
}> = ({ catalogo, valores, propios, textoMarca = 'Solo ella', ocupada, onCambiar }) => (
  <div className="space-y-3">
    {catalogo.grupos.map(g => {
      const delGrupo = catalogo.permisos.filter(p => p.grupo === g.id);
      if (!delGrupo.length) return null;
      return (
        <div key={g.id} className="space-y-1">
          <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">{g.descripcion}</div>
          <div className="rounded-xl border border-slate-200 dark:border-neutral-700 divide-y divide-slate-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
            {delGrupo.map(p => (
              <label key={p.clave} className="flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer">
                <span className="text-[0.8125rem] text-slate-700 dark:text-neutral-200 leading-snug">
                  {p.descripcion}
                  {propios && propios[p.clave] !== undefined && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] text-[0.625rem] font-bold align-middle">{textoMarca}</span>
                  )}
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {ocupada === p.clave && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                  <IOSToggle checked={!!valores[p.clave]} onChange={v => onCambiar(p.clave, v)} ariaLabel={p.descripcion} />
                </span>
              </label>
            ))}
          </div>
        </div>
      );
    })}
  </div>
);

/**
 * En la ficha de una especialista: su entrada a Lalan y lo que puede hacer.
 * La maneja la dueña o una asistente. La especialista no cuenta como
 * usuario del plan.
 */
export const EntradaEspecialista: React.FC<{ staffId: string; nombre: string; telefono?: string | null; activa: boolean }> = ({ staffId, nombre, telefono, activa }) => {
  const { showToast } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [datos, setDatos] = useState<EntradaDeEspecialista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [ocupada, setOcupada] = useState<ClavePermiso | null>(null);
  const [usuario, setUsuario] = useState('');
  const [tel, setTel] = useState(telefono ?? '');
  const [clave, setClave] = useState<{ clave: string; entraCon: string[] } | null>(null);
  const nombreCorto = nombre.split(' ')[0];

  const cargar = useCallback(async () => {
    try { setDatos(await entradaApi.estado(staffId)); setError(null); }
    catch (e) { setError((e as Error)?.message || 'No se pudo cargar.'); }
  }, [staffId]);
  useEffect(() => { void cargar(); }, [cargar]);

  const darEntrada = async () => {
    setOcupado(true);
    try {
      const r = await entradaApi.dar(staffId, { ...(usuario.trim() ? { usuario: usuario.trim() } : {}), ...(tel.trim() ? { telefono: tel.trim() } : {}) });
      setDatos(r);
      if (r.claveTemporal) setClave({ clave: r.claveTemporal, entraCon: r.entraCon ?? [] });
    } catch (e) { showToast('No se pudo dar la entrada', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
    finally { setOcupado(false); }
  };

  const cambiar = async (c: ClavePermiso, v: boolean) => {
    if (!datos) return;
    setOcupada(c);
    // Se ve al instante; si el servidor dice que no, se vuelve atrás
    setDatos({ ...datos, valores: { ...datos.valores, [c]: v } });
    try { setDatos(await entradaApi.permisos(staffId, { [c]: v })); }
    catch (e) { showToast('No se guardó', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); void cargar(); }
    finally { setOcupada(null); }
  };

  const aPlantilla = async () => {
    setOcupado(true);
    try { setDatos(await entradaApi.aPlantilla(staffId)); showToast('Listo', `${nombreCorto} vuelve a tener los permisos del salón.`, 'success'); }
    catch (e) { showToast('No se pudo', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
    finally { setOcupado(false); }
  };

  const nuevaClave = async () => {
    if (!(await confirmar({ titulo: `¿Clave nueva para ${nombreCorto}?`, mensaje: 'Se cierran sus sesiones abiertas y tendrá que entrar con la clave temporal.', textoConfirmar: 'Dar clave nueva' }))) return;
    setOcupado(true);
    try { const r = await entradaApi.nuevaClave(staffId); setClave({ clave: r.claveTemporal, entraCon: r.entraCon }); }
    catch (e) { showToast('No se pudo', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
    finally { setOcupado(false); }
  };

  const quitar = async () => {
    if (!(await confirmar({ titulo: `¿Quitarle la entrada a ${nombreCorto}?`, mensaje: 'Se cierra su sesión en todos sus aparatos. Sus citas siguen igual. Puedes volver a darle entrada cuando quieras.', textoConfirmar: 'Quitar entrada', tono: 'peligro' }))) return;
    setOcupado(true);
    try { setDatos(await entradaApi.quitar(staffId)); setClave(null); }
    catch (e) { showToast('No se pudo', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
    finally { setOcupado(false); }
  };

  if (error) return <p className="text-[0.75rem] text-rose-500">{error}</p>;
  if (!datos) return <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>;

  const tiene = !!datos.entrada?.activa;
  const hayPropios = Object.keys(datos.propios ?? {}).length > 0;

  return (
    <div className="space-y-3">
      {modalConfirmar}
      {clave && <ClaveParaCompartir nombre={nombre} entraCon={clave.entraCon} clave={clave.clave} telefono={telefono ?? null} onListo={() => setClave(null)} />}

      <div className="flex items-start gap-2">
        <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center ${tiene ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 dark:bg-neutral-800 text-slate-400'}`}>
          <KeyRound className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[0.8125rem] font-bold text-slate-900 dark:text-white">
            {tiene ? `${nombreCorto} entra a Lalan` : `${nombreCorto} todavía no entra a Lalan`}
          </div>
          <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 leading-relaxed">
            {tiene
              ? <>Entra con <b>{datos.entrada!.entraCon.join(' o ')}</b>{datos.entrada!.debeCambiarClave ? ' · todavía no pone su clave' : ''}. Ve sus citas y lo que enciendas abajo. No ocupa un usuario de tu plan.</>
              : 'Con entrada ve sus citas en su teléfono, le llega un aviso de cada cita nueva y solo puede hacer lo que tú le permitas. No ocupa un usuario de tu plan.'}
          </p>
        </div>
      </div>

      {!tiene && (
        activa ? (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="Usuario (opcional, se crea solo)" autoCapitalize="none" className={campo} />
              <input value={tel} onChange={e => setTel(e.target.value)} placeholder="Teléfono para entrar (opcional)" inputMode="tel" className={campo} />
            </div>
            <button type="button" onClick={darEntrada} disabled={ocupado}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold flex items-center justify-center gap-1.5 hover:brightness-110 transition disabled:opacity-60 cursor-pointer">
              {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Darle entrada a Lalan
            </button>
          </div>
        ) : (
          <p className="text-[0.75rem] text-slate-400">Activa a {nombreCorto} para darle entrada.</p>
        )
      )}

      {tiene && (
        <>
          <ListaPermisos catalogo={datos} valores={datos.valores} propios={datos.propios} ocupada={ocupada} onCambiar={cambiar} />
          <p className="text-[0.6875rem] text-slate-400 leading-relaxed flex items-start gap-1">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px" />
            Siempre ve sus citas, sus servicios y el nombre de la clienta. Nunca ve el teléfono de la clienta, la caja, los reportes ni las citas de otras.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {hayPropios && (
              <button type="button" onClick={aPlantilla} disabled={ocupado}
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 text-[0.75rem] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-60">
                <RotateCcw className="w-3.5 h-3.5" /> Volver a los permisos del salón
              </button>
            )}
            <button type="button" onClick={nuevaClave} disabled={ocupado}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 text-[0.75rem] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-60">
              <Smartphone className="w-3.5 h-3.5" /> Clave nueva
            </button>
            <button type="button" onClick={quitar} disabled={ocupado}
              className="px-3 py-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[0.75rem] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-60">
              <UserX className="w-3.5 h-3.5" /> Quitar entrada
            </button>
          </div>
        </>
      )}
    </div>
  );
};

/** Con qué permisos arranca cada especialista a la que se le da entrada (Ajustes → El salón, y Equipo → Roles) */
export const PlantillaPermisosEspecialista: React.FC<{ sinMarco?: boolean }> = ({ sinMarco }) => {
  const { showToast } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [datos, setDatos] = useState<PlantillaPermisos | null>(null);
  const [ocupada, setOcupada] = useState<ClavePermiso | null>(null);
  useEffect(() => { entradaApi.plantilla().then(setDatos).catch(() => setDatos(null)); }, []);
  if (!datos) return null;

  // Lo que el salón cambió y quedó distinto de lo que trae Lalan
  const cambiados = datos.fabrica && datos.salon
    ? Object.fromEntries(Object.entries(datos.salon).filter(([c, v]) => v !== datos.fabrica![c as ClavePermiso])) as Partial<MapaPermisos>
    : {};
  const cambiado = Object.keys(cambiados).length > 0;

  const cambiar = async (c: ClavePermiso, v: boolean) => {
    setOcupada(c);
    setDatos({ ...datos, valores: { ...datos.valores, [c]: v } });
    try { setDatos(await entradaApi.guardarPlantilla({ [c]: v })); }
    catch (e) { showToast('No se guardó', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); entradaApi.plantilla().then(setDatos).catch(() => undefined); }
    finally { setOcupada(null); }
  };
  const volver = async () => {
    if (!(await confirmar({
      titulo: '¿Especialista vuelve a como lo trae Lalan?',
      mensaje: 'Se quitan los cambios que le hiciste a este rol en tu salón. Lo que le cambiaste a una especialista en su ficha se queda.',
      textoConfirmar: 'Sí, volver',
      icono: <RotateCcw className="w-7 h-7" aria-hidden="true" />,
    }))) return;
    try { setDatos(await entradaApi.volverPlantilla()); showToast('Listo', 'Especialista quedó como lo trae Lalan.', 'success'); }
    catch (e) { showToast('No se pudo', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
  };

  return (
    <div className={sinMarco ? 'space-y-3' : 'p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3'}>
      {modalConfirmar}
      {sinMarco ? (
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Especialista</h3>
      ) : (
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[var(--primary)]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Permisos de las especialistas</h2>
        </div>
      )}
      <p className="text-[0.75rem] text-slate-400 leading-relaxed">
        Lo que puede hacer cada especialista con entrada a Lalan, salvo que le cambies algo en su ficha (la llave en su fila).
      </p>
      {datos.fabrica && (
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2 py-1 rounded-lg text-[0.6875rem] font-bold ${cambiado ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400'}`}>
            {cambiado ? 'Cambiado en tu salón' : 'Como lo trae Lalan'}
          </span>
          {cambiado && (
            <button type="button" onClick={() => void volver()} className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-neutral-700 text-[0.6875rem] font-bold text-slate-600 dark:text-neutral-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800">
              <RotateCcw className="w-3 h-3" /> Volver a como lo trae Lalan
            </button>
          )}
        </div>
      )}
      <ListaPermisos catalogo={datos} valores={datos.valores} propios={cambiados} textoMarca="Cambiado en tu salón" ocupada={ocupada} onCambiar={cambiar} />
    </div>
  );
};
