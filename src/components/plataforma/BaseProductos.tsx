import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, FlaskConical, Loader2, Pencil, Plus, Search, Trash2, Undo2 } from 'lucide-react';
import { IOSSegmentedControl } from '../ui/IOSSegmentedControl';
import { useConfirmar } from '../ui/ModalConfirmar';
import {
  baseProductosApi, NOMBRE_NIVEL, NOMBRE_PRESENCIA, NOMBRE_RIESGO,
  type BaseProductos as Base, type Componente, type DatosComponente, type DatosComposicion, type DatosGenerico,
  type FilaComposicion, type NivelRiesgo, type PorReconocer, type Presencia, type ProductoConocido, type Riesgo, type TipoRiesgo,
} from '../../services/saberProductos';

const tarjeta = 'rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3';
const campo = 'mt-1 w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-sm font-normal';
const etiqueta = 'text-[0.75rem] font-bold';
const botonPrimario = 'px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer';
const botonChico = 'text-xs font-bold flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-neutral-800 cursor-pointer';
const lista = (t: string) => t.split(',').map((x) => x.trim()).filter(Boolean);
const NIVELES: NivelRiesgo[] = ['precaucion', 'cuidado', 'evitar'];
const TIPOS: TipoRiesgo[] = ['irritacion', 'alergia', 'respiratorio', 'quemadura', 'inflamable'];

const sitio = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
const Fuente: React.FC<{ url: string | null }> = ({ url }) => url ? (
  <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-[var(--primary)] hover:underline break-all">
    <ExternalLink className="w-3 h-3 shrink-0" /> {sitio(url)}
  </a>
) : <span className="text-[0.75rem] text-rose-600">Sin fuente</span>;

// ── Formularios ─────────────────────────────────────────────

const FormGenerico: React.FC<{ inicial?: ProductoConocido | null; nombreSugerido?: string; onGuardar: (d: DatosGenerico) => Promise<void>; onCancelar: () => void }> = ({ inicial, nombreSugerido, onGuardar, onCancelar }) => {
  const [nombre, setNombre] = useState(inicial?.nombre ?? nombreSugerido ?? '');
  const [categoria, setCategoria] = useState(inicial?.categoria ?? '');
  const [alias, setAlias] = useState((inicial?.alias ?? []).join(', '));
  const [marcas, setMarcas] = useState((inicial?.marcas ?? []).join(', '));
  const [nota, setNota] = useState(inicial?.nota ?? '');
  const [guardando, setGuardando] = useState(false);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nombre.trim().length < 2) return;
    setGuardando(true);
    try { await onGuardar({ nombre, categoria: categoria || null, alias: lista(alias), marcas: lista(marcas), nota: nota || null }); } finally { setGuardando(false); }
  };
  return (
    <form onSubmit={enviar} className={`${tarjeta} grid sm:grid-cols-2 gap-2`}>
      <label className={etiqueta}>Nombre genérico<input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} placeholder="Acetona para uñas" className={campo} /></label>
      <label className={etiqueta}>Categoría<input value={categoria} onChange={(e) => setCategoria(e.target.value)} maxLength={60} placeholder="Uñas" className={campo} /></label>
      <label className={`${etiqueta} sm:col-span-2`}>Cómo lo llaman los salones <span className="font-normal text-slate-400">(separados por coma)</span>
        <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="acetona, quitaesmalte, removedor" className={campo} /></label>
      <label className={`${etiqueta} sm:col-span-2`}>Marcas conocidas <span className="font-normal text-slate-400">(para sacarlas del nombre; separadas por coma)</span>
        <input value={marcas} onChange={(e) => setMarcas(e.target.value)} placeholder="Cutex, OPI" className={campo} /></label>
      <label className={`${etiqueta} sm:col-span-2`}>Nota<input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={400} className={campo} /></label>
      <div className="sm:col-span-2 flex gap-2 justify-end">
        <button type="button" onClick={onCancelar} className={botonChico}>Cancelar</button>
        <button type="submit" disabled={guardando} className={botonPrimario}>{guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar</button>
      </div>
    </form>
  );
};

const FormComposicion: React.FC<{ generico: ProductoConocido; componentes: Componente[]; inicial?: FilaComposicion | null; onGuardar: (d: DatosComposicion) => Promise<void>; onCancelar: () => void }> = ({ generico, componentes, inicial, onGuardar, onCancelar }) => {
  const [componenteId, setComponenteId] = useState(inicial?.componenteId ?? '');
  const [presencia, setPresencia] = useState<Presencia>(inicial?.presencia ?? 'siempre');
  const [marca, setMarca] = useState(inicial?.marca ?? '');
  const [nota, setNota] = useState(inicial?.nota ?? '');
  const [fuente, setFuente] = useState(inicial?.fuente ?? '');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!componenteId) { setError('Elige el componente.'); return; }
    if (!/^https?:\/\/\S+$/.test(fuente.trim())) { setError('Pon el enlace de la fuente: sin fuente no entra nada a la base.'); return; }
    if (presencia === 'marca' && !marca.trim()) { setError('Escribe qué marca lo lleva.'); return; }
    setGuardando(true); setError('');
    try {
      await onGuardar({ productoConocidoId: generico.id, componenteId, presencia, marca: presencia === 'marca' ? marca : null, nota: nota || null, fuente: fuente.trim() });
    } catch (err) { setError((err as Error)?.message || 'No se pudo guardar'); } finally { setGuardando(false); }
  };
  return (
    <form onSubmit={enviar} className="rounded-xl border border-dashed border-slate-300 dark:border-neutral-700 p-2.5 grid sm:grid-cols-2 gap-2">
      <label className={etiqueta}>Componente
        <select value={componenteId} onChange={(e) => setComponenteId(e.target.value)} className={campo}>
          <option value="">Elige…</option>
          {componentes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </label>
      <label className={etiqueta}>Lo lleva
        <select value={presencia} onChange={(e) => setPresencia(e.target.value as Presencia)} className={campo}>
          {(Object.keys(NOMBRE_PRESENCIA) as Presencia[]).map((p) => <option key={p} value={p}>{NOMBRE_PRESENCIA[p]}</option>)}
        </select>
      </label>
      {presencia === 'marca' && <label className={etiqueta}>Marca<input value={marca} onChange={(e) => setMarca(e.target.value)} maxLength={80} className={campo} /></label>}
      <label className={`${etiqueta} ${presencia === 'marca' ? '' : 'sm:col-span-2'}`}>Fuente (enlace)<input value={fuente} onChange={(e) => setFuente(e.target.value)} maxLength={500} placeholder="https://…" className={campo} /></label>
      <label className={`${etiqueta} sm:col-span-2`}>Nota<input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={400} placeholder='Aunque la etiqueta diga "sin formol"' className={campo} /></label>
      {error && <p className="sm:col-span-2 text-xs text-rose-600">{error}</p>}
      <p className="sm:col-span-2 text-[0.6875rem] text-slate-500">Entra como borrador: no avisa a nadie hasta que la publiques después de leer la fuente.</p>
      <div className="sm:col-span-2 flex gap-2 justify-end">
        <button type="button" onClick={onCancelar} className={botonChico}>Cancelar</button>
        <button type="submit" disabled={guardando} className={botonPrimario}>{guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar</button>
      </div>
    </form>
  );
};

const FormComponente: React.FC<{ grupos: Base['grupos']; inicial?: Componente | null; onGuardar: (d: DatosComponente) => Promise<void>; onCancelar: () => void }> = ({ grupos, inicial, onGuardar, onCancelar }) => {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [grupo, setGrupo] = useState(inicial?.grupo ?? grupos[0]?.clave ?? '');
  const [sinonimos, setSinonimos] = useState((inicial?.sinonimos ?? []).join(', '));
  const [cas, setCas] = useState(inicial?.cas ?? '');
  const [fuente, setFuente] = useState(inicial?.fuente ?? '');
  const [riesgos, setRiesgos] = useState<Riesgo[]>(inicial?.riesgos ?? []);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const cambiar = (i: number, r: Partial<Riesgo>) => setRiesgos((l) => l.map((x, j) => (j === i ? { ...x, ...r } : x)));
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nombre.trim().length < 2) { setError('Escribe el nombre.'); return; }
    setGuardando(true); setError('');
    try {
      await onGuardar({ nombre, grupo, sinonimos: lista(sinonimos), cas: cas || null, fuente: fuente.trim() || null, riesgos: riesgos.filter((r) => r.texto.trim()) });
    } catch (err) { setError((err as Error)?.message || 'No se pudo guardar'); } finally { setGuardando(false); }
  };
  return (
    <form onSubmit={enviar} className={`${tarjeta} grid sm:grid-cols-2 gap-2`}>
      <label className={etiqueta}>Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} placeholder="Amoniaco" className={campo} /></label>
      <label className={etiqueta}>Grupo de alergia
        <select value={grupo} onChange={(e) => setGrupo(e.target.value)} className={campo}>
          {grupos.map((g) => <option key={g.clave} value={g.clave}>{g.nombre}</option>)}
        </select>
      </label>
      <label className={`${etiqueta} sm:col-span-2`}>Otros nombres e INCI <span className="font-normal text-slate-400">(separados por coma)</span><input value={sinonimos} onChange={(e) => setSinonimos(e.target.value)} className={campo} /></label>
      <label className={etiqueta}>CAS<input value={cas} onChange={(e) => setCas(e.target.value)} maxLength={20} className={campo} /></label>
      <label className={etiqueta}>Fuente (enlace)<input value={fuente} onChange={(e) => setFuente(e.target.value)} maxLength={500} placeholder="https://…" className={campo} /></label>
      <div className="sm:col-span-2 space-y-2">
        <div className="text-[0.75rem] font-bold">Riesgos</div>
        {riesgos.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] sm:grid-cols-[9rem_8rem_1fr_auto] gap-2 items-start">
            <select value={r.tipo} onChange={(e) => cambiar(i, { tipo: e.target.value as TipoRiesgo })} className={campo}>{TIPOS.map((t) => <option key={t} value={t}>{NOMBRE_RIESGO[t]}</option>)}</select>
            <select value={r.nivel} onChange={(e) => cambiar(i, { nivel: e.target.value as NivelRiesgo })} className={campo}>{NIVELES.map((n) => <option key={n} value={n}>{NOMBRE_NIVEL[n]}</option>)}</select>
            <input value={r.texto} onChange={(e) => cambiar(i, { texto: e.target.value })} maxLength={300} placeholder="Qué puede pasar" className={`${campo} col-span-2 sm:col-span-1 row-start-2 sm:row-start-auto`} />
            <button type="button" aria-label="Quitar riesgo" onClick={() => setRiesgos((l) => l.filter((_, j) => j !== i))} className="mt-1 p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        <button type="button" onClick={() => setRiesgos((l) => [...l, { tipo: 'irritacion', nivel: 'cuidado', texto: '' }])} className={botonChico}><Plus className="w-3.5 h-3.5" /> Riesgo</button>
      </div>
      {error && <p className="sm:col-span-2 text-xs text-rose-600">{error}</p>}
      <div className="sm:col-span-2 flex gap-2 justify-end">
        <button type="button" onClick={onCancelar} className={botonChico}>Cancelar</button>
        <button type="submit" disabled={guardando} className={botonPrimario}>{guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar</button>
      </div>
    </form>
  );
};

// ── La pantalla ─────────────────────────────────────────────

type Vista = 'productos' | 'componentes' | 'reconocer';

/**
 * La base de productos de Lalan: genéricos ("Acetona para uñas"), sus
 * componentes y riesgos, y qué lleva cada uno. Cada fila de composición entra
 * como borrador y solo avisa al equipo de los salones cuando se publica
 * después de leer su fuente. "Por reconocer" junta los nombres que usan los
 * salones y no están en la base, para que crezca con lo que de verdad se usa.
 */
export const BaseProductos: React.FC = () => {
  const [vista, setVista] = useState<Vista>('productos');
  const [base, setBase] = useState<Base | null>(null);
  const [porReconocer, setPorReconocer] = useState<PorReconocer[] | null>(null);
  const [error, setError] = useState('');
  const [buscar, setBuscar] = useState('');
  const [editando, setEditando] = useState<string | null>(null); // 'nuevo' | id de genérico | 'c:'+id | 'f:'+id | 'nf:'+idGenerico
  const [nombreSugerido, setNombreSugerido] = useState('');
  const { confirmar, modalConfirmar } = useConfirmar();

  const cargar = useCallback(() => {
    baseProductosApi.base().then(setBase).catch((e) => setError(e?.message || 'No se pudo cargar'));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (vista === 'reconocer' && !porReconocer) baseProductosApi.porReconocer().then(setPorReconocer).catch(() => setPorReconocer([]));
  }, [vista, porReconocer]);

  const nombreGrupo = useCallback((clave: string) => base?.grupos.find((g) => g.clave === clave)?.nombre ?? clave, [base]);
  const borradores = useMemo(() => base?.productos.reduce((n, p) => n + p.componentes.filter((c) => !c.revisadoEn).length, 0) ?? 0, [base]);
  const q = buscar.trim().toLowerCase();
  const productos = (base?.productos ?? []).filter((p) => !q || [p.nombre, ...p.alias].some((x) => x.toLowerCase().includes(q)));
  const componentes = (base?.componentes ?? []).filter((c) => !q || [c.nombre, ...c.sinonimos].some((x) => x.toLowerCase().includes(q)));

  const hecho = async (p: Promise<unknown>) => { await p; setEditando(null); cargar(); };
  const borrar = async (titulo: string, mensaje: string, hacer: () => Promise<unknown>) => {
    if (await confirmar({ titulo, mensaje, textoConfirmar: 'Borrar', tono: 'peligro' })) await hecho(hacer());
  };
  const publicar = async (f: FilaComposicion, generico: string) => {
    if (!f.revisadoEn) {
      const si = await confirmar({
        titulo: `¿Publicar "${f.componente.nombre}" en ${generico}?`,
        mensaje: <>Desde ahora avisará al equipo de los salones cuando una clienta alérgica tenga cita con este producto. Publícala solo si leíste la fuente: <a className="underline" href={f.fuente} target="_blank" rel="noopener noreferrer">{f.fuente}</a></>,
        textoConfirmar: 'Publicar',
      });
      if (!si) return;
    }
    await hecho(baseProductosApi.publicar(f.id, !f.revisadoEn));
  };

  return (
    <section className="space-y-4 text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]">
      {modalConfirmar}
      <header>
        <h3 className="text-base font-bold flex items-center gap-2"><FlaskConical className="w-4 h-4" /> Lo que llevan los productos</h3>
        <p className="text-xs text-slate-500 dark:text-neutral-400">Los salones vinculan sus productos a estos genéricos por el nombre. Con eso el equipo ve un aviso cuando una clienta alérgica tiene cita con un producto que lleva (o puede llevar) lo que le hace daño. Solo lo publicado avisa.</p>
        {borradores > 0 && <p className="text-xs font-bold text-amber-700 dark:text-amber-300 mt-1">{borradores} fila{borradores === 1 ? '' : 's'} en borrador: abre su fuente y publícala.</p>}
      </header>

      <IOSSegmentedControl id="plataforma-productos" size="sm" value={vista} onChange={(v) => { setVista(v as Vista); setEditando(null); }}
        options={[{ id: 'productos', label: 'Productos' }, { id: 'componentes', label: 'Componentes' }, { id: 'reconocer', label: 'Por reconocer' }]} />

      {error && <p className="text-xs text-rose-600">{error}</p>}
      {!base ? <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div> : (
        <>
          {vista !== 'reconocer' && (
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[12rem]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar" className={`${campo} !mt-0 pl-8`} />
              </div>
              <button type="button" onClick={() => { setNombreSugerido(''); setEditando(vista === 'productos' ? 'nuevo' : 'c:nuevo'); }} className={botonPrimario}>
                <Plus className="w-4 h-4" /> {vista === 'productos' ? 'Producto genérico' : 'Componente'}
              </button>
            </div>
          )}

          {vista === 'productos' && (
            <div className="space-y-3">
              {editando === 'nuevo' && <FormGenerico nombreSugerido={nombreSugerido} onCancelar={() => setEditando(null)} onGuardar={(d) => hecho(baseProductosApi.guardarGenerico(null, d))} />}
              {productos.map((p) => editando === p.id ? (
                <FormGenerico key={p.id} inicial={p} onCancelar={() => setEditando(null)} onGuardar={(d) => hecho(baseProductosApi.guardarGenerico(p.id, d))} />
              ) : (
                <article key={p.id} className={`${tarjeta} space-y-2`}>
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <b className="text-sm">{p.nombre}</b>
                      <div className="text-xs text-slate-500">{[p.categoria, `${p.productosVinculados} producto${p.productosVinculados === 1 ? '' : 's'} de salones vinculados`].filter(Boolean).join(' · ')}</div>
                    </div>
                    <button type="button" onClick={() => setEditando(p.id)} className={botonChico}><Pencil className="w-3.5 h-3.5" /> Editar</button>
                    <button type="button" onClick={() => void borrar(`¿Borrar "${p.nombre}"?`, `Se borra con lo que lleva. ${p.productosVinculados ? `Los ${p.productosVinculados} productos de salones vinculados quedan sin vincular.` : ''}`, () => baseProductosApi.borrarGenerico(p.id))} className={`${botonChico} text-rose-600`}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  {p.alias.length > 0 && <p className="text-xs text-slate-500">También: {p.alias.join(', ')}</p>}
                  {p.marcas.length > 0 && <p className="text-xs text-slate-500">Marcas: {p.marcas.join(', ')}</p>}
                  {p.nota && <p className="text-xs text-slate-600 dark:text-neutral-300">{p.nota}</p>}
                  <ul className="space-y-1.5">
                    {p.componentes.map((f) => editando === `f:${f.id}` ? (
                      <li key={f.id}><FormComposicion generico={p} componentes={base.componentes} inicial={f} onCancelar={() => setEditando(null)} onGuardar={(d) => hecho(baseProductosApi.guardarComposicion(f.id, d))} /></li>
                    ) : (
                      <li key={f.id} className="rounded-xl bg-slate-50 dark:bg-neutral-800/60 p-2.5 flex flex-wrap items-center gap-2">
                        <div className="flex-1 min-w-[12rem]">
                          <div className="text-[0.8125rem] font-semibold">{f.componente.nombre} <span className="font-normal text-slate-500">· {f.presencia === 'marca' ? `solo ${f.marca}` : NOMBRE_PRESENCIA[f.presencia].toLowerCase()} · {nombreGrupo(f.componente.grupo)}</span></div>
                          {f.nota && <div className="text-xs text-slate-500">{f.nota}</div>}
                          <Fuente url={f.fuente} />
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[0.6875rem] font-bold ${f.revisadoEn ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>{f.revisadoEn ? 'Publicada' : 'Borrador'}</span>
                        <button type="button" onClick={() => void publicar(f, p.nombre)} className={botonChico}>{f.revisadoEn ? <><Undo2 className="w-3.5 h-3.5" /> A borrador</> : <><CheckCircle2 className="w-3.5 h-3.5" /> Publicar</>}</button>
                        <button type="button" aria-label="Editar" onClick={() => setEditando(`f:${f.id}`)} className={botonChico}><Pencil className="w-3.5 h-3.5" /></button>
                        <button type="button" aria-label="Borrar" onClick={() => void borrar(`¿Quitar "${f.componente.nombre}" de ${p.nombre}?`, 'Deja de avisar por este componente en este producto.', () => baseProductosApi.borrarComposicion(f.id))} className={`${botonChico} text-rose-600`}><Trash2 className="w-3.5 h-3.5" /></button>
                      </li>
                    ))}
                  </ul>
                  {editando === `nf:${p.id}`
                    ? <FormComposicion generico={p} componentes={base.componentes} onCancelar={() => setEditando(null)} onGuardar={(d) => hecho(baseProductosApi.guardarComposicion(null, d))} />
                    : <button type="button" onClick={() => setEditando(`nf:${p.id}`)} className={botonChico}><Plus className="w-3.5 h-3.5" /> Qué lleva</button>}
                </article>
              ))}
              {!productos.length && <p className="text-sm text-slate-500">No hay productos con ese nombre.</p>}
            </div>
          )}

          {vista === 'componentes' && (
            <div className="space-y-3">
              {editando === 'c:nuevo' && <FormComponente grupos={base.grupos} onCancelar={() => setEditando(null)} onGuardar={(d) => hecho(baseProductosApi.guardarComponente(null, d))} />}
              {componentes.map((c) => editando === `c:${c.id}` ? (
                <FormComponente key={c.id} grupos={base.grupos} inicial={c} onCancelar={() => setEditando(null)} onGuardar={(d) => hecho(baseProductosApi.guardarComponente(c.id, d))} />
              ) : (
                <article key={c.id} className={`${tarjeta} space-y-1.5`}>
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <b className="text-sm">{c.nombre}</b>
                      <div className="text-xs text-slate-500">{[nombreGrupo(c.grupo), c.cas && `CAS ${c.cas}`, `en ${c.enProductos} producto${c.enProductos === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</div>
                    </div>
                    <button type="button" onClick={() => setEditando(`c:${c.id}`)} className={botonChico}><Pencil className="w-3.5 h-3.5" /> Editar</button>
                    <button type="button" aria-label="Borrar" onClick={() => void borrar(`¿Borrar "${c.nombre}"?`, c.enProductos ? `Sale de los ${c.enProductos} productos que lo llevan.` : 'No está en ningún producto.', () => baseProductosApi.borrarComponente(c.id))} className={`${botonChico} text-rose-600`}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  {c.sinonimos.length > 0 && <p className="text-xs text-slate-500">También: {c.sinonimos.join(', ')}</p>}
                  {c.riesgos.map((r, i) => (
                    <p key={i} className="text-[0.8125rem]"><b>{NOMBRE_RIESGO[r.tipo]} · {NOMBRE_NIVEL[r.nivel]}:</b> {r.texto}</p>
                  ))}
                  <Fuente url={c.fuente} />
                </article>
              ))}
            </div>
          )}

          {vista === 'reconocer' && (
            !porReconocer ? <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
              : porReconocer.length === 0 ? <p className="text-sm text-slate-500">Todos los productos de los salones están vinculados.</p>
              : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">Nombres de productos que los salones no han vinculado, con cuántos salones los tienen. Solo nombres: nunca de qué salón son.</p>
                  {editando === 'nuevo' && <FormGenerico nombreSugerido={nombreSugerido} onCancelar={() => setEditando(null)} onGuardar={async (d) => { await hecho(baseProductosApi.guardarGenerico(null, d)); setPorReconocer(null); }} />}
                  <ul className="space-y-1.5">
                    {porReconocer.map((r) => (
                      <li key={r.nombre} className={`${tarjeta} !p-2.5 flex flex-wrap items-center gap-2`}>
                        <div className="flex-1 min-w-[10rem]">
                          <b className="text-[0.8125rem]">{r.nombre}</b>
                          <div className="text-xs text-slate-500">{r.salones} salón{r.salones === 1 ? '' : 'es'} · {r.productos} producto{r.productos === 1 ? '' : 's'}{r.sugerido ? ` · parece ${r.sugerido}` : ''}</div>
                        </div>
                        {!r.sugerido && (
                          <button type="button" onClick={() => { setNombreSugerido(r.nombre); setEditando('nuevo'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={botonChico}><Plus className="w-3.5 h-3.5" /> Crear genérico</button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )
          )}
        </>
      )}
    </section>
  );
};
