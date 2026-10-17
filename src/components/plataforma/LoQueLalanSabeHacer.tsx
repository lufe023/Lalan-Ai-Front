import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Loader2, MapPin, MousePointerClick, Play, Plus, RotateCcw, Sparkles, Trash2, X } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { IOSModal } from '../ui/IOSModal';
import { IOSToggle } from '../ui/IOSToggle';
import { guiaPorId, type PasoGuia } from '../../data/guias';
import { olvidarRutas } from '../../data/rutasLalan';
import { iniciarGuia } from '../guias/GuiaEnCurso';
import { MENSAJE_PASO } from '../guias/GrabadorRuta';
import { PANTALLAS } from './UsoAppPanel';

interface Guia {
  id: string; nombre: string; frases: string[]; modulo: string | null; porSede: boolean; explicacion: string;
  activa: boolean; origen: 'app' | 'nueva'; editada: boolean; ruta: PasoGuia[] | null;
}
interface Catalogo { guias: Guia[]; modulos: { id: string; nombre: string }[]; sinTarea: { id: string; nombre: string }[] }
interface Prueba { tarea: string | null; nombre: string | null; respuesta: string }

type Dispositivo = 'pc' | 'movil';
const ANCHO: Record<Dispositivo, number> = { pc: 1280, movil: 390 };

const TARJETA = 'rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3';
const CAMPO = 'w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem]';
const ETIQUETA = 'text-[0.6875rem] text-slate-500';
const PILDORA = 'px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold';

const nombrePantalla = (id?: string) => PANTALLAS.find((p) => p.id === id)?.nombre ?? id ?? '—';
function queSenala(p: PasoGuia): string {
  if (p.ancla) return `Marca «${p.ancla}»`;
  if (p.etiqueta) return `«${p.etiqueta}»`;
  if (p.x !== undefined) return 'Un punto de la pantalla';
  return 'Nada: se lee';
}

/** La ruta que trae la app, para verla o copiarla y editarla */
function rutaDeLaApp(id: string): PasoGuia[] {
  const g = guiaPorId(id);
  return g ? g.pasos.map((p) => ({ ...p, pantalla: p.pantalla ?? g.pantalla })) : [];
}

/**
 * Plataforma → Lalan → Lo que sabe hacer: lo que Lalan sabe enseñar dentro
 * de la app, sin depender del código. Cada tarea tiene cómo la pide la gente,
 * lo que Lalan explica y la ruta del Llévame, que se graba a clics sobre la
 * app real. Las tareas que vienen en la app se pueden editar y volver al
 * original; las nuevas se crean aquí.
 */
export const LoQueLalanSabeHacer: React.FC = () => {
  const { showToast } = useApp();
  const [datos, setDatos] = useState<Catalogo | null>(null);
  const [b, setB] = useState<Guia | null>(null);
  const [tocado, setTocado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [frase, setFrase] = useState('');
  const [grabando, setGrabando] = useState<{ pantalla: string; disp: Dispositivo } | null>(null);
  const [pregunta, setPregunta] = useState('');
  const [prueba, setPrueba] = useState<Prueba | null>(null);
  const [probando, setProbando] = useState(false);
  const [nombreNueva, setNombreNueva] = useState<string | null>(null);

  const cargar = useCallback(async () => { setDatos(await api.get<Catalogo>('/asistente/guias/catalogo')); }, []);
  useEffect(() => { void cargar().catch((e) => showToast('No se pudo cargar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning')); }, [cargar, showToast]);

  const editar = (f: (x: Guia) => Guia) => { setB((x) => (x ? f(x) : x)); setTocado(true); };
  const ruta = b?.ruta ?? [];
  const cambiarRuta = (f: (r: PasoGuia[]) => PasoGuia[]) => editar((x) => ({ ...x, ruta: f(x.ruta ?? []) }));

  // Los pasos que manda el grabador (la app en el marco)
  useEffect(() => {
    if (!grabando) return;
    const oir = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin || ev.data?.tipo !== MENSAJE_PASO) return;
      cambiarRuta((r) => [...r, ev.data.paso as PasoGuia]);
    };
    window.addEventListener('message', oir);
    return () => window.removeEventListener('message', oir);
  }, [grabando]);

  const abrir = (g: Guia) => { setB(g); setTocado(false); setGrabando(null); setFrase(''); };
  const cerrar = () => {
    if (tocado && !window.confirm('Tienes cambios sin guardar. ¿Cerrar sin guardar?')) return;
    setB(null); setGrabando(null);
  };

  const nueva = async () => {
    const nombre = nombreNueva?.trim();
    if (!nombre || nombre.length < 2) return;
    try {
      const c = await api.post<Catalogo>('/asistente/guias', { valores: { nombre, frases: [], explicacion: '' } });
      setDatos(c);
      const g = c.guias.find((x) => x.origen === 'nueva' && x.nombre === nombre);
      setNombreNueva(null);
      if (g) abrir(g);
    } catch (e) { showToast('No se pudo crear', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
  };

  const guardar = async () => {
    if (!b) return;
    setOcupado(true);
    try {
      const { nombre, frases, explicacion, activa, modulo, porSede } = b;
      const c = await api.put<Catalogo>(`/asistente/guias/${b.id}`, { valores: { nombre, frases, explicacion, activa, modulo, porSede, ruta: b.ruta?.length ? b.ruta : null } });
      setDatos(c);
      olvidarRutas();
      setB(c.guias.find((x) => x.id === b.id) ?? null);
      setTocado(false);
      showToast('Tarea guardada', 'Lalan ya la usa así con todos los salones.', 'success');
    } catch (e) { showToast('No se pudo guardar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
    finally { setOcupado(false); }
  };

  const restaurar = async () => {
    if (!b) return;
    const pregunta = b.origen === 'nueva' ? `¿Borrar la tarea «${b.nombre}»? Lalan deja de conocerla.` : `¿Volver «${b.nombre}» al original? Se pierde lo que cambiaste, también la ruta grabada.`;
    if (!window.confirm(pregunta)) return;
    try {
      const c = await api.delete<Catalogo>(`/asistente/guias/${b.id}`);
      setDatos(c);
      olvidarRutas();
      setB(b.origen === 'nueva' ? null : c.guias.find((x) => x.id === b.id) ?? null);
      setTocado(false);
    } catch (e) { showToast('No se pudo', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
  };

  const probarRuta = () => {
    if (!b) return;
    if (tocado) { showToast('Guarda primero', 'El Llévame usa la ruta guardada.', 'info'); return; }
    olvidarRutas();
    setB(null);
    iniciarGuia(b.id);
  };

  const probar = async () => {
    if (pregunta.trim().length < 2) return;
    setProbando(true); setPrueba(null);
    try { setPrueba(await api.post<Prueba>('/asistente/guias/probar', { pregunta: pregunta.trim() })); }
    catch (e) { showToast('No se pudo probar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
    finally { setProbando(false); }
  };

  const quitarPaso = (i: number) => {
    if (!window.confirm(`¿Quitar el paso ${i + 1}?`)) return;
    cambiarRuta((r) => r.filter((_, j) => j !== i));
  };
  const moverPaso = (i: number, d: -1 | 1) => cambiarRuta((r) => { const n = [...r]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });
  const cambiarPaso = (i: number, p: Partial<PasoGuia>) => cambiarRuta((r) => r.map((q, j) => (j === i ? { ...q, ...p } : q)));

  if (!datos) return <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>;
  const nombreModulo = (id: string | null) => (id ? datos.modulos.find((m) => m.id === id)?.nombre ?? id : 'Todos los planes');
  const deApp = b && b.origen === 'app' && !b.ruta ? rutaDeLaApp(b.id) : [];

  return (
    <div className="space-y-3 text-slate-900 dark:text-neutral-100">
      <p className="text-[0.8125rem] text-slate-500 dark:text-neutral-400 leading-relaxed max-w-2xl">
        Lo que Lalan sabe enseñar <b>dentro de la app</b>: cómo lo pide la gente, qué explica ella y la ruta del botón «Llévame».
        La ruta se graba a clics sobre la app. Lo que guardes aquí lo usa Lalan al momento con todos los salones.
      </p>

      {datos.sinTarea.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[0.8125rem]">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <span>Lalan no tiene ninguna tarea de: <b>{datos.sinTarea.map((m) => m.nombre).join(', ')}</b>. Si una dueña pregunta por eso, solo podrá explicarlo con palabras.</span>
        </div>
      )}

      <div className={`${TARJETA} space-y-2`}>
        <b className="text-[0.875rem] flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-[var(--primary)]" /> Probar</b>
        <div className="flex gap-2">
          <input value={pregunta} onChange={(e) => setPregunta(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void probar()} maxLength={500}
            placeholder="Pregunta como lo haría una dueña. Ej.: ¿cómo configuro mi vitrina?" className={CAMPO} />
          <button type="button" onClick={() => void probar()} disabled={probando || pregunta.trim().length < 2}
            className="px-4 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold disabled:opacity-50 cursor-pointer">{probando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Probar'}</button>
        </div>
        {prueba && (
          <div className="text-[0.8125rem] space-y-1">
            <p>{prueba.nombre ? <>Dejaría el botón <b>«{prueba.nombre}»</b>.</> : <span className="text-amber-600">No elegiría ninguna tarea: lo explicaría con palabras.</span>}</p>
            {prueba.respuesta && <p className="text-slate-500 dark:text-neutral-400">«{prueba.respuesta}»</p>}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        {nombreNueva === null ? (
          <button type="button" onClick={() => setNombreNueva('')} className="flex items-center gap-1 text-[0.8125rem] font-bold text-[var(--primary)] cursor-pointer"><Plus className="w-4 h-4" /> Tarea nueva</button>
        ) : (
          <div className="flex w-full max-w-md gap-2">
            <input autoFocus value={nombreNueva} maxLength={80} onChange={(e) => setNombreNueva(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void nueva()}
              placeholder="Nombre de la tarea. Ej.: Ver lo que gané en el mes" aria-label="Nombre de la tarea nueva" className={CAMPO} />
            <button type="button" onClick={() => void nueva()} disabled={nombreNueva.trim().length < 2} className="px-3 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold disabled:opacity-50 cursor-pointer">Crear</button>
            <button type="button" onClick={() => setNombreNueva(null)} className="px-2 text-[0.8125rem] text-slate-500 cursor-pointer">Cancelar</button>
          </div>
        )}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {datos.guias.map((g) => (
          <button key={g.id} type="button" onClick={() => abrir(g)} className={`${TARJETA} text-left space-y-1.5 hover:border-[var(--primary)] cursor-pointer ${g.activa ? '' : 'opacity-60'}`}>
            <b className="text-[0.875rem] block">{g.nombre}</b>
            <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 line-clamp-2">{g.frases.length ? `«${g.frases.join('», «')}»` : 'Sin frases todavía'}</p>
            <div className="flex flex-wrap gap-1">
              <span className={`${PILDORA} bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300`}>{nombreModulo(g.modulo)}</span>
              {g.porSede && <span className={`${PILDORA} bg-sky-500/10 text-sky-600 flex items-center gap-0.5`}><MapPin className="w-3 h-3" /> Por sede</span>}
              <span className={`${PILDORA} ${g.ruta ? 'bg-fuchsia-500/10 text-fuchsia-600' : g.origen === 'app' ? 'bg-slate-100 dark:bg-neutral-800 text-slate-500' : 'bg-amber-500/10 text-amber-600'}`}>
                {g.ruta ? `Ruta grabada · ${g.ruta.length} pasos` : g.origen === 'app' ? 'Ruta de la app' : 'Sin ruta: solo explica'}
              </span>
              {g.editada && g.origen === 'app' && <span className={`${PILDORA} bg-emerald-500/10 text-emerald-600`}>Editada</span>}
              {g.origen === 'nueva' && <span className={`${PILDORA} bg-emerald-500/10 text-emerald-600`}>Nueva</span>}
              {!g.activa && <span className={`${PILDORA} bg-rose-500/10 text-rose-600`}>Apagada</span>}
            </div>
          </button>
        ))}
      </div>

      <IOSModal isOpen={!!b} onClose={cerrar} title={b?.nombre ?? ''} subtitle={b?.origen === 'nueva' ? 'Tarea nueva' : 'Tarea de la app'} height="94%">
        {b && (
          <div className="space-y-3 p-1">
            <div className="flex items-center gap-3">
              <span className="flex-1 text-[0.8125rem]"><b>{b.activa ? 'Lalan la usa' : 'Apagada'}</b><span className="block text-[0.6875rem] text-slate-400">Apagada, Lalan no la ofrece ni la explica.</span></span>
              <IOSToggle checked={b.activa} onChange={(v) => editar((x) => ({ ...x, activa: v }))} ariaLabel="Lalan usa esta tarea" />
            </div>

            <div className="grid sm:grid-cols-2 gap-2">
              <label className="block"><span className={ETIQUETA}>Nombre (sale en la tarjeta Llévame)</span>
                <input value={b.nombre} maxLength={80} onChange={(e) => editar((x) => ({ ...x, nombre: e.target.value }))} className={CAMPO} /></label>
              <label className="block"><span className={ETIQUETA}>Plan que la trae</span>
                <select value={b.modulo ?? ''} onChange={(e) => editar((x) => ({ ...x, modulo: e.target.value || null }))} className={CAMPO}>
                  <option value="">Todos los planes</option>
                  {datos.modulos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select></label>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex-1 text-[0.8125rem]">Se hace en una sede<span className="block text-[0.6875rem] text-slate-400">Con varias sedes, Lalan pregunta cuál y la app cambia a esa antes de empezar.</span></span>
              <IOSToggle checked={b.porSede} onChange={(v) => editar((x) => ({ ...x, porSede: v }))} ariaLabel="Se hace en una sede" />
            </div>

            <div className="space-y-1.5">
              <span className={ETIQUETA}>Cómo lo pide la gente</span>
              <div className="flex flex-wrap gap-1.5">
                {b.frases.map((f, i) => (
                  <span key={i} className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-slate-100 dark:bg-neutral-800 text-[0.75rem]">
                    {f}
                    <button type="button" aria-label={`Quitar «${f}»`} onClick={() => editar((x) => ({ ...x, frases: x.frases.filter((_, j) => j !== i) }))} className="p-0.5 rounded-full text-slate-400 hover:text-rose-500 cursor-pointer"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={frase} maxLength={120} onChange={(e) => setFrase(e.target.value)} placeholder="Ej.: publicar la vitrina" className={CAMPO}
                  onKeyDown={(e) => { if (e.key === 'Enter' && frase.trim()) { editar((x) => ({ ...x, frases: [...x.frases, frase.trim()] })); setFrase(''); } }} />
                <button type="button" disabled={!frase.trim() || b.frases.length >= 12} onClick={() => { editar((x) => ({ ...x, frases: [...x.frases, frase.trim()] })); setFrase(''); }}
                  className="px-3 rounded-xl border border-slate-200 dark:border-neutral-700 text-[0.8125rem] font-semibold disabled:opacity-50 cursor-pointer">Agregar</button>
              </div>
            </div>

            <label className="block"><span className={ETIQUETA}>Lo que Lalan explica de esta función (una o dos frases)</span>
              <textarea value={b.explicacion} maxLength={600} rows={3} onChange={(e) => editar((x) => ({ ...x, explicacion: e.target.value }))} className={`${CAMPO} resize-none`} /></label>

            {/* La ruta, como un flujo: un nodo por paso */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b className="text-[0.875rem]">Ruta del Llévame</b>
                <div className="flex flex-wrap gap-2">
                  {deApp.length > 0 && (
                    <button type="button" onClick={() => editar((x) => ({ ...x, ruta: deApp }))} className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-semibold cursor-pointer">Copiar para editar</button>
                  )}
                  <button type="button" onClick={() => setGrabando(grabando ? null : { pantalla: ruta[ruta.length - 1]?.pantalla ?? deApp[0]?.pantalla ?? 'dashboard', disp: 'pc' })}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--primary)] text-white text-[0.75rem] font-bold cursor-pointer">
                    <MousePointerClick className="w-3.5 h-3.5" /> {grabando ? 'Cerrar el grabador' : ruta.length ? 'Grabar más pasos' : 'Grabar ruta'}
                  </button>
                  {(b.ruta?.length || b.origen === 'app') && (
                    <button type="button" onClick={probarRuta} className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-semibold cursor-pointer"><Play className="w-3.5 h-3.5" /> Probar el Llévame</button>
                  )}
                </div>
              </div>

              {!b.ruta && deApp.length > 0 && <p className="text-[0.75rem] text-slate-500">Esta es la ruta que trae la app. Para cambiarla, cópiala o graba una nueva.</p>}
              {!b.ruta && b.origen === 'nueva' && <p className="text-[0.75rem] text-amber-600">Sin ruta, Lalan solo la explica con palabras. Graba la ruta para que deje el botón «Llévame».</p>}

              <div className={grabando ? 'grid gap-3 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)] xl:items-start' : ''}>
              <ol className={`space-y-0 ${grabando ? 'xl:sticky xl:top-0 xl:max-h-[70vh] xl:overflow-y-auto' : ''}`}>
                {(b.ruta ?? deApp).map((p, i, todos) => (
                  <li key={i} className="relative pl-8">
                    {i < todos.length - 1 && <span aria-hidden="true" className="absolute left-[0.8125rem] top-7 bottom-0 w-px bg-slate-200 dark:bg-neutral-700" />}
                    <span className="absolute left-0 top-2 w-7 h-7 rounded-full grid place-items-center text-[0.75rem] font-bold bg-[var(--primary)] text-white">{i + 1}</span>
                    <div className={`${TARJETA} mb-2 space-y-2`}>
                      <div className="flex items-center gap-1 text-[0.6875rem] text-slate-500">
                        <span className="flex-1 truncate"><b className="text-slate-700 dark:text-neutral-200">{nombrePantalla(p.pantalla)}</b>{p.seccion ? ` › ${p.seccion}` : ''} · {queSenala(p)}</span>
                        {b.ruta && (
                          <>
                            <button type="button" disabled={i === 0} onClick={() => moverPaso(i, -1)} aria-label="Subir paso" className="p-1 rounded-lg disabled:opacity-30 cursor-pointer"><ArrowUp className="w-4 h-4" /></button>
                            <button type="button" disabled={i === todos.length - 1} onClick={() => moverPaso(i, 1)} aria-label="Bajar paso" className="p-1 rounded-lg disabled:opacity-30 cursor-pointer"><ArrowDown className="w-4 h-4" /></button>
                            <button type="button" onClick={() => quitarPaso(i)} aria-label="Quitar paso" className="p-1 rounded-lg text-rose-500 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                      {b.ruta ? (
                        <>
                          <textarea value={p.texto} maxLength={300} rows={2} onChange={(e) => cambiarPaso(i, { texto: e.target.value })} className={`${CAMPO} resize-none`} aria-label={`Globito del paso ${i + 1}`} />
                          <div className="flex gap-1.5 text-[0.6875rem] font-semibold">
                            <button type="button" onClick={() => cambiarPaso(i, { leer: false })} disabled={!p.ancla && !p.etiqueta && p.x === undefined}
                              className={`px-2 py-1 rounded-lg border cursor-pointer disabled:opacity-40 ${!p.leer ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700'}`}>Avanza al tocarlo</button>
                            <button type="button" onClick={() => cambiarPaso(i, { leer: true })}
                              className={`px-2 py-1 rounded-lg border cursor-pointer ${p.leer ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700'}`}>Se lee y sigue</button>
                          </div>
                        </>
                      ) : <p className="text-[0.8125rem]">{p.texto}</p>}
                    </div>
                  </li>
                ))}
              </ol>

              {grabando && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={ETIQUETA}>Empezar en</span>
                    <select value={grabando.pantalla} onChange={(e) => setGrabando({ ...grabando, pantalla: e.target.value })} className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.75rem]">
                      {PANTALLAS.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                    {(['pc', 'movil'] as Dispositivo[]).map((d) => (
                      <button key={d} type="button" onClick={() => setGrabando({ ...grabando, disp: d })}
                        className={`px-2.5 py-1 rounded-full text-[0.75rem] font-semibold border cursor-pointer ${grabando.disp === d ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'border-slate-200 dark:border-neutral-700 text-slate-500'}`}>{d === 'pc' ? 'PC' : 'Móvil'}</button>
                    ))}
                  </div>
                  <p className="text-[0.75rem] text-slate-500">
                    En «Marcar pasos» toca lo que la dueña tiene que tocar, escribe el globito y guarda; «Guardar y tocarlo» lo toca de verdad para seguir en la pantalla que abre.
                    En «Usar la app» la app funciona normal: lo que toques se hace de verdad en tu salón.
                  </p>
                  <div className="rounded-xl overflow-auto bg-slate-100 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800" style={{ height: 'min(70vh, 820px)' }}>
                    <iframe key={`${grabando.pantalla}:${grabando.disp}`} src={`/app/?grabar=ruta&pantalla=${grabando.pantalla}`} title="Grabar la ruta"
                      className="block mx-auto bg-white" style={{ width: grabando.disp === 'pc' ? '100%' : ANCHO.movil, height: '100%', border: 0 }} />
                  </div>
                </div>
              )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-neutral-800">
              {(b.editada || b.origen === 'nueva') ? (
                <button type="button" onClick={() => void restaurar()} className="flex items-center gap-1 text-[0.8125rem] font-semibold text-rose-500 cursor-pointer">
                  {b.origen === 'nueva' ? <><Trash2 className="w-4 h-4" /> Borrar tarea</> : <><RotateCcw className="w-4 h-4" /> Volver al original</>}
                </button>
              ) : <span />}
              <button type="button" onClick={() => void guardar()} disabled={ocupado || !tocado || b.nombre.trim().length < 2}
                className="px-5 py-2 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold disabled:opacity-50 cursor-pointer">{ocupado ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        )}
      </IOSModal>
    </div>
  );
};
