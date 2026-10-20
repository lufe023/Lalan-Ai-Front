import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import {
  ArrowDown, ArrowUp, Award, GripVertical, Loader2, MapPin, MessageSquareQuote, Pencil, Plus, Search, Trash2, X,
} from 'lucide-react';
import { api, subirArchivo, urlDeFoto } from '../../services/api';
import { sedePropia } from '../../services/sedeActiva';
import { useApp } from '../../context/AppContext';
import { useSedes } from '../../hooks/useSedes';
import { IOSModal } from '../ui/IOSModal';
import { IOSToggle } from '../ui/IOSToggle';
import { FotosDelCatalogo, urlVideoCatalogo, type FotoDeGaleria } from '../catalogo/FotoDelCatalogo';
import { FotoEncuadrada, type Encuadre } from '../catalogo/FotoEncuadrada';
import { haceCuanto } from '../vitrina/PaginaVitrina';
import {
  MAXIMO_FOTOS_TESTIMONIO, MAXIMO_SUBTITULO_TESTIMONIOS, MAXIMO_TEXTO_TESTIMONIO, MAXIMO_TITULO_TESTIMONIOS, TITULO_TESTIMONIOS,
  type DisenoVitrina, type FotoDeTestimonio, type ListaTestimonios, type ServicioVitrina, type TestimonioAjustes, type TestimonioDto,
} from '../../types/vitrina';

const TARJETA = 'p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs';
const TITULO = 'text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white';
const AYUDA = 'text-[0.75rem] text-slate-400 leading-relaxed';
const CAMPO = 'w-full px-3 py-2 rounded-xl text-[0.875rem] text-slate-800 dark:text-neutral-100 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700';
const ROTULO = 'text-[0.75rem] font-semibold text-slate-600 dark:text-neutral-300';
const MAXIMO_NOMBRE = 60;

const Etiqueta: React.FC<{ texto: string }> = ({ texto }) => (
  <span className="inline-flex min-w-0 max-w-[55%] items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-[0.6875rem] text-slate-500 dark:text-neutral-400">
    <MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{texto}</span>
  </span>
);

/**
 * Ajustes → Vitrina → «Lo que dicen mis clientes».
 *
 * El título y el subtítulo van con el diseño (se guardan con «Guardar»). Los
 * testimonios se guardan al momento, cada uno en su panel: nombre, lo que
 * dijo, fotos o videos (con «Ajustar», como el catálogo), antes y después,
 * el servicio, la clienta, el permiso y la fecha. La lista se ordena
 * arrastrando y cada uno se esconde sin borrarlo. Borrar pide confirmación.
 */
export const TestimoniosVitrina: React.FC<{
  q: string; sede: string; borrador: DisenoVitrina; cambiar: (c: Partial<DisenoVitrina>) => void;
  servicios: ServicioVitrina[]; encuadres: Record<string, Encuadre>; guardarEncuadre: (id: string, e: Encuadre) => Promise<void>;
  /** Algo cambió: la vista previa se vuelve a pedir */
  alCambiar: () => void;
}> = ({ q, sede, borrador, cambiar, servicios, encuadres, guardarEncuadre, alCambiar }) => {
  const { showToast } = useApp();
  const [datos, setDatos] = useState<ListaTestimonios | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** El que se está escribiendo: null = cerrado; 'nuevo' o el que se edita */
  const [editando, setEditando] = useState<TestimonioAjustes | 'nuevo' | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  // Con varias sedes, uno puede salir en todas; quien está atada a una sede no lo decide por las demás
  const variasSedes = useSedes({ todasLasDelSalon: true }).length > 1;
  const decidePorTodas = variasSedes && !sedePropia();

  const cargar = useCallback(async () => {
    setError(null);
    try { setDatos(await api.get<ListaTestimonios>(`/vitrina/testimonios${q}`)); } catch (e: any) { setError(e?.message ?? 'No se pudieron cargar'); }
  }, [q]);
  useEffect(() => { setDatos(null); void cargar(); }, [cargar]);

  const listo = (d: ListaTestimonios) => { setDatos(d); alCambiar(); };

  const cambiarUno = async (t: TestimonioAjustes, c: TestimonioDto) => {
    setOcupado(t.id);
    try { listo(await api.patch<ListaTestimonios>(`/vitrina/testimonios/${t.id}${q}`, c)); }
    catch (e: any) { showToast('No se pudo cambiar', e?.message ?? 'Inténtalo de nuevo.', 'warning'); }
    finally { setOcupado(null); }
  };

  const borrar = async (t: TestimonioAjustes) => {
    setOcupado(t.id);
    try {
      listo(await api.delete<ListaTestimonios>(`/vitrina/testimonios/${t.id}${q}`));
      setBorrando(null);
      showToast('Testimonio borrado', `El de ${t.nombre} ya no sale en la Vitrina`, 'info');
    } catch (e: any) {
      showToast('No se pudo borrar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally { setOcupado(null); }
  };

  // El orden se ve al momento y se guarda al soltar
  const [orden, setOrden] = useState<string[]>([]);
  useEffect(() => { setOrden(datos?.testimonios.map((t) => t.id) ?? []); }, [datos]);
  const guardarOrden = async (ids: string[]) => {
    if (!datos || ids.join() === datos.testimonios.map((t) => t.id).join()) return;
    try { listo(await api.put<ListaTestimonios>(`/vitrina/testimonios/orden${q}`, { ids })); }
    catch (e: any) { showToast('No se pudo ordenar', e?.message ?? 'Inténtalo de nuevo.', 'warning'); void cargar(); }
  };
  const mover = (i: number, d: -1 | 1) => {
    const ids = [...orden];
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    setOrden(ids);
    void guardarOrden(ids);
  };

  const lista = orden.map((id) => datos?.testimonios.find((t) => t.id === id)).filter(Boolean) as TestimonioAjustes[];
  const bloque = borrador.bloques.find((b) => b.tipo === 'testimonios');

  return (
    <div data-guia="vitrina-testimonios" className={`${TARJETA} space-y-3`}>
      <div className="flex items-center justify-between gap-2"><h2 className={TITULO}>Lo que dicen mis clientes</h2><Etiqueta texto={sede} /></div>
      <p className={AYUDA}>
        Lo que dicen tus clientas, con fotos y videos de su resultado. Ponle el nombre que quieras al bloque: «Mis mimados», «Mis reinas»…
        El título va con el diseño; los testimonios se guardan al momento.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className={ROTULO}>Título del bloque</span>
          <input value={borrador.testimoniosTitulo ?? ''} maxLength={MAXIMO_TITULO_TESTIMONIOS} placeholder={TITULO_TESTIMONIOS}
            onChange={(e) => cambiar({ testimoniosTitulo: e.target.value || null })} className={CAMPO} />
        </label>
        <label className="block space-y-1">
          <span className={ROTULO}>Subtítulo <span className="font-normal text-slate-400">(opcional)</span></span>
          <input value={borrador.testimoniosSubtitulo ?? ''} maxLength={MAXIMO_SUBTITULO_TESTIMONIOS} placeholder="Ellas ya lo vivieron"
            onChange={(e) => cambiar({ testimoniosSubtitulo: e.target.value || null })} className={CAMPO} />
        </label>
      </div>

      {bloque && !bloque.visible && !!lista.length && (
        <p className="text-[0.75rem] text-amber-600">El bloque está escondido: muéstralo en «Bloques» para que se vea.</p>
      )}

      {error ? (
        <p className="text-[0.8125rem] text-rose-500">{error}</p>
      ) : !datos ? (
        <p className="flex items-center gap-2 text-[0.8125rem] text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</p>
      ) : !lista.length ? (
        <div className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-neutral-700 px-4 py-6 text-center">
          <span className="w-11 h-11 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] grid place-items-center"><MessageSquareQuote className="w-5 h-5" /></span>
          <span className="text-[0.8125rem] font-bold text-slate-800 dark:text-white">Todavía no hay testimonios</span>
          <span className="text-[0.6875rem] text-slate-500 dark:text-neutral-400 max-w-[18rem]">El bloque sale en la Vitrina cuando agregues el primero. Pídele permiso a tu clienta antes de publicarlo.</span>
        </div>
      ) : (
        <Reorder.Group axis="y" values={orden} onReorder={setOrden} className="space-y-1.5">
          {lista.map((t, i) => (
            <Fila
              key={t.id} t={t} hoy={datos.hoy} encuadres={encuadres} variasSedes={variasSedes} ocupado={ocupado === t.id}
              primero={i === 0} ultimo={i === lista.length - 1} subir={() => mover(i, -1)} bajar={() => mover(i, 1)}
              soltar={() => void guardarOrden(orden)}
              mostrar={(visible) => void cambiarUno(t, { visible })} editar={() => setEditando(t)}
              confirmando={borrando === t.id} pedirBorrar={() => setBorrando(t.id)} noBorrar={() => setBorrando(null)} borrar={() => void borrar(t)}
            />
          ))}
        </Reorder.Group>
      )}

      <button type="button" onClick={() => setEditando('nuevo')} disabled={!datos}
        className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[0.8125rem] font-semibold text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/15 disabled:opacity-50">
        <Plus className="w-4 h-4" /> Agregar testimonio
      </button>

      <IOSModal
        isOpen={!!editando} onClose={() => setEditando(null)} id="vitrina-editar-testimonio" fixedHeight={false} height="92%"
        title={editando === 'nuevo' ? 'Nuevo testimonio' : 'Editar testimonio'} subtitle={datos?.sede.nombre}
      >
        {editando && datos && (
          <Editor
            key={editando === 'nuevo' ? 'nuevo' : editando.id}
            t={editando === 'nuevo' ? null : editando} q={q} hoy={datos.hoy} sede={datos.sede.nombre}
            servicios={servicios} encuadres={encuadres} guardarEncuadre={guardarEncuadre} decidePorTodas={decidePorTodas}
            listo={(d) => { listo(d); setEditando(null); }} cancelar={() => setEditando(null)}
          />
        )}
      </IOSModal>
    </div>
  );
};

/* ───────────── una fila de la lista ───────────── */

const Fila: React.FC<{
  t: TestimonioAjustes; hoy: string; encuadres: Record<string, Encuadre>; variasSedes: boolean; ocupado: boolean;
  primero: boolean; ultimo: boolean; subir: () => void; bajar: () => void; soltar: () => void;
  mostrar: (v: boolean) => void; editar: () => void;
  confirmando: boolean; pedirBorrar: () => void; noBorrar: () => void; borrar: () => void;
}> = ({ t, hoy, encuadres, variasSedes, ocupado, primero, ultimo, subir, bajar, soltar, mostrar, editar, confirmando, pedirBorrar, noBorrar, borrar }) => {
  const agarre = useDragControls();
  const flecha = 'w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-neutral-800 disabled:opacity-25';
  const primera = t.fotos[0];
  return (
    <Reorder.Item value={t.id} dragListener={false} dragControls={agarre} onDragEnd={soltar}
      className={`rounded-xl border bg-white dark:bg-neutral-900 px-1.5 py-1.5 ${t.visible ? 'border-slate-200 dark:border-neutral-700' : 'border-dashed border-slate-200 dark:border-neutral-800'}`}>
      <div className="flex items-center gap-1.5">
        <button type="button" onPointerDown={(e) => agarre.start(e)} disabled={!t.editable} aria-label={`Arrastrar el testimonio de ${t.nombre}`}
          className="w-6 h-10 grid place-items-center text-slate-400 cursor-grab active:cursor-grabbing touch-none disabled:opacity-30"><GripVertical className="w-4 h-4" /></button>
        <span className={`relative w-10 h-10 shrink-0 overflow-hidden rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] grid place-items-center ${t.visible ? '' : 'opacity-50'}`}>
          {primera
            ? <FotoEncuadrada src={urlDeFoto(primera.ruta)!} alt="" encuadre={encuadres[primera.id] ?? primera.encuadre ?? null} video={primera.video != null ? urlVideoCatalogo(primera.id) : null} />
            : <MessageSquareQuote className="w-4 h-4" />}
        </span>
        <button type="button" onClick={editar} disabled={!t.editable} className={`flex-1 min-w-0 text-left ${t.visible ? '' : 'opacity-60'}`}>
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="truncate text-[0.8125rem] font-semibold text-slate-800 dark:text-neutral-100">{t.nombre}</span>
            {t.destacado && <Award className="w-3.5 h-3.5 shrink-0 text-amber-500" aria-label="Destacado" />}
          </span>
          <span className="block truncate text-[0.6875rem] text-slate-400">
            {t.texto ? `“${t.texto}”` : `${t.fotos.length} ${t.fotos.length === 1 ? 'foto' : 'fotos'}`} · {haceCuanto(t.fecha, hoy).toLowerCase()}
          </span>
          {variasSedes && (
            <span className="mt-0.5 inline-flex items-center gap-1 px-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-[0.625rem] font-semibold text-slate-500 dark:text-neutral-400">
              <MapPin className="w-2.5 h-2.5" /> {t.todasLasSedes ? 'Todas las sedes' : t.sede.nombre}
            </span>
          )}
        </button>
        {ocupado ? <Loader2 className="w-4 h-4 animate-spin text-slate-400 mx-2" /> : (
          <IOSToggle checked={t.visible} onChange={mostrar} disabled={!t.editable} ariaLabel={t.visible ? `Esconder el de ${t.nombre}` : `Mostrar el de ${t.nombre}`} />
        )}
      </div>
      {t.editable && (
        <div className="flex items-center justify-end gap-0.5 pt-1">
          <span className="mr-auto pl-8 text-[0.625rem] text-slate-400">{t.visible ? 'Sale en la Vitrina' : 'Escondido'}</span>
          <button type="button" disabled={primero} onClick={subir} aria-label={`Subir el de ${t.nombre}`} className={flecha}><ArrowUp className="w-4 h-4" /></button>
          <button type="button" disabled={ultimo} onClick={bajar} aria-label={`Bajar el de ${t.nombre}`} className={flecha}><ArrowDown className="w-4 h-4" /></button>
          <button type="button" onClick={editar} aria-label={`Editar el de ${t.nombre}`} className={flecha}><Pencil className="w-4 h-4" /></button>
          <button type="button" onClick={pedirBorrar} aria-label={`Borrar el de ${t.nombre}`} className={`${flecha} hover:text-rose-500`}><Trash2 className="w-4 h-4" /></button>
        </div>
      )}
      {!t.editable && <p className="pl-8 pt-1 text-[0.625rem] text-slate-400">Es de otra sede: lo cambia quien está en esa sede.</p>}
      {confirmando && (
        <div className="mt-1.5 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 space-y-2">
          <p className="text-[0.75rem] text-slate-700 dark:text-neutral-200">
            ¿Borrar el testimonio de <b>{t.nombre}</b>?{t.todasLasSedes ? ' Sale en todas las sedes: dejará de salir en todas.' : ''} Si solo quieres que no salga, escóndelo.
          </p>
          <div className="flex gap-1.5 justify-end">
            <button type="button" onClick={noBorrar} className="px-3 py-1.5 rounded-full bg-white dark:bg-neutral-800 text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-200">No, dejarlo</button>
            <button type="button" onClick={borrar} disabled={ocupado} className="px-3 py-1.5 rounded-full bg-rose-500 text-white text-[0.75rem] font-bold disabled:opacity-60">Sí, borrar</button>
          </div>
        </div>
      )}
    </Reorder.Item>
  );
};

/* ───────────── el panel para escribir uno ───────────── */

interface ClientaEncontrada { id: string; name: string; phone: string | null }

const Editor: React.FC<{
  t: TestimonioAjustes | null; q: string; hoy: string; sede: string; servicios: ServicioVitrina[];
  encuadres: Record<string, Encuadre>; guardarEncuadre: (id: string, e: Encuadre) => Promise<void>; decidePorTodas: boolean;
  listo: (d: ListaTestimonios) => void; cancelar: () => void;
}> = ({ t, q, hoy, sede, servicios, encuadres, guardarEncuadre, decidePorTodas, listo, cancelar }) => {
  const [nombre, setNombre] = useState(t?.nombre ?? '');
  const [texto, setTexto] = useState(t?.texto ?? '');
  const [fotos, setFotos] = useState<FotoDeTestimonio[]>(t?.fotos ?? []);
  const [antesDespues, setAntesDespues] = useState(t?.antesDespues ?? false);
  const [servicioId, setServicioId] = useState(t?.servicio?.id ?? '');
  const [clienta, setClienta] = useState<{ id: string; nombre: string | null } | null>(t?.clienta ?? null);
  const [permiso, setPermiso] = useState(t?.permiso ?? false);
  const [fecha, setFecha] = useState(t?.fecha ?? hoy);
  const [destacado, setDestacado] = useState(t?.destacado ?? false);
  const [todasLasSedes, setTodasLasSedes] = useState(t?.todasLasSedes ?? false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  // Lo que faltaba se borra en cuanto lo arregla
  useEffect(() => { setError(''); }, [nombre, texto, fotos.length, permiso]);

  // Las que subió en este panel: si cancela o las quita, se sueltan para no dejar fotos sin dueño
  const subidas = useRef<Set<string>>(new Set());
  const guardado = useRef(false);
  const soltar = (id: string) => { void api.delete(`/vitrina/testimonios/fotos/${id}`).catch(() => undefined); };
  useEffect(() => () => {
    if (!guardado.current) subidas.current.forEach(soltar);
  }, []);

  const agregar = (f: FotoDeTestimonio) => { subidas.current.add(f.id); setFotos((l) => [...l, f]); };
  const galeria: FotoDeGaleria[] = fotos.map((f) => ({ clave: f.id, url: urlDeFoto(f.ruta)!, ...(f.video != null ? { video: urlVideoCatalogo(f.id) } : {}) }));
  const encuadresDeFotos = { ...Object.fromEntries(fotos.filter((f) => f.encuadre).map((f) => [f.id, f.encuadre!])), ...encuadres };

  // El servicio de antes puede no estar en esta sede (si sale en todas): se deja en la lista para no perderlo
  const opciones = t?.servicio && !servicios.some((s) => s.id === t.servicio!.id)
    ? [...servicios, { id: t.servicio.id, nombre: t.servicio.nombre ?? 'Servicio de otra sede' }]
    : servicios;

  const falta = !nombre.trim() ? 'Escribe su nombre como quiere salir'
    : !texto.trim() && !fotos.length ? 'Escribe lo que dijo o agrega una foto o video'
    : !permiso ? 'Marca que te dio permiso de publicarlo' : '';

  const guardar = async () => {
    if (falta) { setError(falta); return; }
    setGuardando(true); setError('');
    const dto: TestimonioDto = {
      nombre: nombre.trim(), texto: texto.trim() || null, fotoIds: fotos.map((f) => f.id), antesDespues: fotos.length === 2 && antesDespues,
      servicioId: servicioId || null, clienteId: clienta?.id ?? null, permiso, fecha, destacado,
      ...(decidePorTodas ? { todasLasSedes } : {}),
    };
    try {
      const d = t ? await api.patch<ListaTestimonios>(`/vitrina/testimonios/${t.id}${q}`, dto) : await api.post<ListaTestimonios>(`/vitrina/testimonios${q}`, dto);
      guardado.current = true;
      // Las que quitó en este panel y ya estaban guardadas las suelta el servidor
      listo(d);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo guardar. Inténtalo de nuevo.');
    } finally { setGuardando(false); }
  };

  return (
    <div className="space-y-4 pb-4">
      <label className="block space-y-1">
        <span className={ROTULO}>Nombre <span className="font-normal text-slate-400">(como ella quiere salir)</span></span>
        <input value={nombre} maxLength={MAXIMO_NOMBRE} onChange={(e) => setNombre(e.target.value)} placeholder="María G." className={CAMPO} autoFocus={!t} />
      </label>

      <label className="block space-y-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={ROTULO}>Lo que dijo</span>
          <span className={`text-[0.6875rem] tabular-nums ${texto.length > MAXIMO_TEXTO_TESTIMONIO - 40 ? 'text-amber-600' : 'text-slate-400'}`}>{texto.length}/{MAXIMO_TEXTO_TESTIMONIO}</span>
        </span>
        <textarea value={texto} maxLength={MAXIMO_TEXTO_TESTIMONIO} rows={4} onChange={(e) => setTexto(e.target.value)}
          placeholder="«Me encantó cómo quedó mi color, salí feliz»" className={`${CAMPO} resize-none`} />
      </label>

      <FotosDelCatalogo
        que="testimonio" nombre={nombre.trim()} maximo={MAXIMO_FOTOS_TESTIMONIO} aspecto="aspect-[4/3]" sede={sede}
        fotos={galeria} encuadres={encuadresDeFotos}
        onAgregar={async (foto) => agregar(await api.post<FotoDeTestimonio>('/vitrina/testimonios/fotos', { foto }))}
        onAgregarVideo={async (archivo) => {
          const f = new FormData();
          f.append('archivo', archivo);
          agregar(await subirArchivo<FotoDeTestimonio>('/vitrina/testimonios/videos', f));
        }}
        onQuitar={(clave) => {
          setFotos((l) => l.filter((f) => f.id !== clave));
          if (subidas.current.delete(clave)) soltar(clave);
        }}
        onOrdenar={(claves) => setFotos((l) => claves.map((c) => l.find((f) => f.id === c)!).filter(Boolean))}
        onEncuadre={guardarEncuadre}
      />

      {fotos.length === 2 && (
        <Interruptor titulo="Es un antes y después" valor={antesDespues} cambiar={setAntesDespues}
          detalle={antesDespues ? 'La primera es el antes y la segunda el después: en la Vitrina se comparan con una barra.' : 'Las dos fotos salen una tras otra.'} />
      )}

      <label className="block space-y-1">
        <span className={ROTULO}>Servicio que se hizo <span className="font-normal text-slate-400">(opcional)</span></span>
        <select value={servicioId} onChange={(e) => setServicioId(e.target.value)} className={CAMPO}>
          <option value="">Sin servicio</option>
          {opciones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <span className={`block ${AYUDA}`}>Sale como etiqueta en la tarjeta; al tocarla, la clienta ve el servicio y lo reserva.</span>
      </label>

      <BuscarClienta clienta={clienta} cambiar={(c) => { setClienta(c); if (c && !nombre.trim()) setNombre(nombreCorto(c.nombre ?? '')); }} />

      <label className="block space-y-1">
        <span className={ROTULO}>Cuándo lo dijo</span>
        <input type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value || hoy)} className={CAMPO} />
        <span className={`block ${AYUDA}`}>En la Vitrina sale como «{haceCuanto(fecha, hoy).toLowerCase()}».</span>
      </label>

      <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-neutral-700 p-3">
        <Interruptor titulo="Destacado" valor={destacado} cambiar={setDestacado}
          detalle={destacado ? 'Sale primero. Si otro estaba destacado, deja de estarlo.' : 'Sale en el orden de la lista.'} />
        {decidePorTodas && (
          <Interruptor titulo="Sale en todas las sedes" valor={todasLasSedes} cambiar={setTodasLasSedes}
            detalle={todasLasSedes ? 'Se ve en la Vitrina de todas tus sedes.' : `Solo en la Vitrina de ${sede}.`} />
        )}
      </div>

      <label className={`flex items-start gap-2.5 rounded-2xl p-3 cursor-pointer ${permiso ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-amber-50 dark:bg-amber-500/10'}`}>
        <input type="checkbox" checked={permiso} onChange={(e) => setPermiso(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[var(--primary)]" />
        <span className="text-[0.8125rem] text-slate-700 dark:text-neutral-200">
          <b>Ella me dio permiso de publicarlo</b>
          <span className="block text-[0.6875rem] text-slate-500 dark:text-neutral-400">Su nombre, lo que dijo y sus fotos salen en internet. Sin su permiso no se guarda.</span>
        </span>
      </label>

      {error && <p className="text-[0.75rem] text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={cancelar} className="flex-1 py-2.5 rounded-xl text-[0.8125rem] font-semibold text-slate-600 dark:text-neutral-300 bg-slate-100 dark:bg-neutral-800">Cancelar</button>
        <button type="button" onClick={guardar} disabled={guardando}
          className="flex-[2] inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[0.8125rem] font-semibold text-white bg-[var(--primary)] disabled:opacity-60">
          {guardando && <Loader2 className="w-4 h-4 animate-spin" />} {t ? 'Guardar cambios' : 'Agregar a la Vitrina'}
        </button>
      </div>
    </div>
  );
};

/** «María Fernanda Gómez» → «María G.»: lo más común en un testimonio */
function nombreCorto(completo: string) {
  const [pila, apellido] = completo.trim().split(/\s+/);
  if (!pila) return '';
  return apellido ? `${pila} ${apellido[0].toUpperCase()}.` : pila;
}

const Interruptor: React.FC<{ titulo: string; detalle: string; valor: boolean; cambiar: (v: boolean) => void }> = ({ titulo, detalle, valor, cambiar }) => (
  <div className="flex items-center gap-3">
    <span className="flex-1 min-w-0">
      <span className="block text-[0.8125rem] font-semibold text-slate-800 dark:text-neutral-100">{titulo}</span>
      <span className="block text-[0.6875rem] text-slate-400">{detalle}</span>
    </span>
    <IOSToggle checked={valor} onChange={cambiar} ariaLabel={titulo} />
  </div>
);

/** La ficha de la clienta de donde sale el testimonio: para saber quién dio el permiso */
const BuscarClienta: React.FC<{
  clienta: { id: string; nombre: string | null } | null; cambiar: (c: { id: string; nombre: string | null } | null) => void;
}> = ({ clienta, cambiar }) => {
  const [abierto, setAbierto] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [lista, setLista] = useState<ClientaEncontrada[]>([]);
  useEffect(() => {
    if (!abierto) return;
    const espera = window.setTimeout(() => {
      const p = new URLSearchParams({ limit: '6', ...(buscar.trim() ? { q: buscar.trim() } : {}) });
      api.get<{ items: ClientaEncontrada[] }>(`/clients?${p}`).then((r) => setLista(r.items ?? [])).catch(() => setLista([]));
    }, 250);
    return () => window.clearTimeout(espera);
  }, [abierto, buscar]);

  return (
    <div className="space-y-1">
      <span className={ROTULO}>Su ficha <span className="font-normal text-slate-400">(opcional, no sale en la Vitrina)</span></span>
      {clienta ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700">
          <span className="flex-1 min-w-0 truncate text-[0.875rem] text-slate-800 dark:text-neutral-100">{clienta.nombre ?? 'Clienta'}</span>
          <button type="button" onClick={() => cambiar(null)} aria-label="Quitar la ficha" className="text-slate-400 hover:text-rose-500"><X className="w-4 h-4" /></button>
        </div>
      ) : !abierto ? (
        <button type="button" onClick={() => setAbierto(true)} className="w-full text-left px-3 py-2 rounded-xl text-[0.875rem] text-slate-400 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700">
          Buscar a la clienta…
        </button>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-neutral-700 p-1.5 space-y-1">
          <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-neutral-800">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input autoFocus value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Nombre o teléfono"
              className="flex-1 min-w-0 bg-transparent outline-none text-[0.8125rem] text-slate-800 dark:text-neutral-100" />
            <button type="button" onClick={() => { setAbierto(false); setBuscar(''); }} aria-label="Cerrar la búsqueda" className="text-slate-400"><X className="w-3.5 h-3.5" /></button>
          </label>
          {lista.map((c) => (
            <button key={c.id} type="button" onClick={() => { cambiar({ id: c.id, nombre: c.name }); setAbierto(false); setBuscar(''); }}
              className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-neutral-800">
              <span className="truncate text-[0.8125rem] text-slate-800 dark:text-neutral-100">{c.name}</span>
              {c.phone && <span className="shrink-0 text-[0.6875rem] text-slate-400">{c.phone}</span>}
            </button>
          ))}
          {!lista.length && <p className="px-2 py-1 text-[0.75rem] text-slate-400">No encontré a nadie con eso.</p>}
        </div>
      )}
    </div>
  );
};
