import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { IOSModal } from '../ui/IOSModal';
import { EditorMarcas } from '../minitutoriales/FotoConMarcas';
import { urlCaptura, VerComo } from '../minitutoriales/VerComo';
import { LIMITES, NOMBRE_APARATO, type Aparato, type Minitutorial, type PasoTutorial } from '../minitutoriales/tipos';
import { PLANTILLAS } from './plantillasGuias';

interface Catalogo { temas: { id: string; nombre: string }[]; aparatos: Aparato[]; tutoriales: Minitutorial[] }
interface Borrador { id?: string; tema: string; aparato: Aparato; titulo: string; pasos: PasoTutorial[]; publicado: boolean }

/** Las capturas se guardan a lo sumo de 1080 px de ancho, en JPG (el servidor acepta hasta 700 KB) */
const ANCHO_MAXIMO = 1080, ALTO_MAXIMO = 2400, PESO_MAXIMO = 680_000;
async function prepararCaptura(archivo: File): Promise<string> {
  const img = await createImageBitmap(archivo).catch(() => { throw new Error('No se pudo leer la imagen'); });
  const escala = Math.min(1, ANCHO_MAXIMO / img.width, ALTO_MAXIMO / img.height);
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * escala);
  c.height = Math.round(img.height * escala);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  for (const calidad of [0.85, 0.72, 0.6, 0.48]) {
    const d = c.toDataURL('image/jpeg', calidad);
    if (d.length * 0.75 <= PESO_MAXIMO) return d;
  }
  throw new Error('La captura pesa demasiado aun reducida: recórtala un poco.');
}

function pasosDePlantilla(tema: string, aparato: Aparato) {
  const p = PLANTILLAS[tema]?.[aparato];
  return { titulo: p?.titulo ?? '', pasos: (p?.pasos ?? ['']).map((texto) => ({ imagenId: null, texto, marcas: [] })) };
}

/**
 * Plataforma → Guías: los minitutoriales con fotos de lo que se hace fuera
 * de la app. Cada tema puede tener una versión por aparato; si no hay la del
 * aparato de la dueña, ella ve la de "Todos los aparatos". Lalan los ofrece
 * con su tarjeta «Ver cómo».
 */
export const GuiasPlataforma: React.FC = () => {
  const { showToast } = useApp();
  const [datos, setDatos] = useState<Catalogo | null>(null);
  const [b, setB] = useState<Borrador | null>(null);
  const [tocado, setTocado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const [vista, setVista] = useState<Minitutorial | null>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const pasoDelArchivo = useRef(0);

  const cargar = useCallback(async () => { setDatos(await api.get<Catalogo>('/plataforma/minitutoriales')); }, []);
  useEffect(() => { void cargar().catch(() => setDatos({ temas: [], aparatos: [], tutoriales: [] })); }, [cargar]);

  const libres = (tema: string) => (datos?.aparatos ?? []).filter((a) => !datos?.tutoriales.some((t) => t.tema === tema && t.aparato === a));
  const nuevo = (tema: string) => {
    const aparato = libres(tema)[0];
    if (!aparato) return;
    setB({ tema, aparato, publicado: false, ...pasosDePlantilla(tema, aparato) });
    setTocado(false);
  };
  const abrir = (t: Minitutorial) => { setB({ id: t.id, tema: t.tema, aparato: t.aparato, titulo: t.titulo, pasos: t.pasos, publicado: t.publicado }); setTocado(true); };
  const cambiarAparato = (aparato: Aparato) => {
    if (!b) return;
    // Mientras no se haya tocado nada, los pasos siguen la plantilla del aparato
    setB(tocado ? { ...b, aparato } : { ...b, aparato, ...pasosDePlantilla(b.tema, aparato) });
  };
  const editar = (f: (x: Borrador) => Borrador) => { setB((x) => (x ? f(x) : x)); setTocado(true); };
  const cambiarPaso = (i: number, p: Partial<PasoTutorial>) => editar((x) => ({ ...x, pasos: x.pasos.map((q, j) => (j === i ? { ...q, ...p } : q)) }));
  const moverPaso = (i: number, d: -1 | 1) => editar((x) => {
    const pasos = [...x.pasos];
    [pasos[i], pasos[i + d]] = [pasos[i + d], pasos[i]];
    return { ...x, pasos };
  });
  const quitarPaso = (i: number) => {
    if (!window.confirm(`¿Quitar el paso ${i + 1}? Se pierden su captura y sus marcas.`)) return;
    editar((x) => ({ ...x, pasos: x.pasos.filter((_, j) => j !== i) }));
  };

  const elegirCaptura = (i: number) => { pasoDelArchivo.current = i; archivo.current?.click(); };
  const subir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = e.target.files?.[0];
    e.target.value = '';
    if (!a) return;
    const i = pasoDelArchivo.current;
    setSubiendo(i);
    try {
      const imagen = await prepararCaptura(a);
      const { id } = await api.post<{ id: string }>('/plataforma/minitutoriales/imagenes', { imagen });
      cambiarPaso(i, { imagenId: id });
    } catch (err) { showToast('No se pudo subir la captura', (err as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
    finally { setSubiendo(null); }
  };

  const guardar = async () => {
    if (!b) return;
    setOcupado(true);
    try {
      const cuerpo = { tema: b.tema, aparato: b.aparato, titulo: b.titulo, pasos: b.pasos, publicado: b.publicado };
      if (b.id) await api.put(`/plataforma/minitutoriales/${b.id}`, cuerpo);
      else await api.post('/plataforma/minitutoriales', cuerpo);
      await cargar();
      showToast(b.publicado ? 'Minitutorial publicado' : 'Borrador guardado', b.publicado ? 'Lalan ya puede mostrarlo a las dueñas.' : 'Nadie lo ve hasta que lo publiques.', 'success');
      setB(null);
    } catch (e) { showToast('No se pudo guardar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
    finally { setOcupado(false); }
  };
  const borrar = async () => {
    if (!b?.id || !window.confirm(`¿Borrar «${b.titulo}» (${NOMBRE_APARATO[b.aparato]})? Se borran también sus capturas.`)) return;
    try { await api.delete(`/plataforma/minitutoriales/${b.id}`); await cargar(); setB(null); }
    catch (e) { showToast('No se pudo borrar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
  };

  if (!datos) return <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>;
  const listo = !!b && b.titulo.trim().length >= 2 && b.pasos.length > 0 && b.pasos.every((p) => p.texto.trim() || p.imagenId);
  const nombreTema = (id: string) => datos.temas.find((t) => t.id === id)?.nombre ?? id;

  return (
    <div className="space-y-3">
      <p className="text-[0.8125rem] text-slate-500 dark:text-neutral-400 leading-relaxed max-w-2xl">
        Fotos paso a paso de lo que se hace <b>fuera de la app</b>: instalarla, dar permisos, el lado de Meta. Lalan las ofrece con su tarjeta «Ver cómo».
        Haz una versión por aparato si los pasos cambian; si a una dueña no le toca ninguna, ve la de «Todos los aparatos». Solo se ven las publicadas.
      </p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {datos.temas.map((tema) => {
          const versiones = datos.tutoriales.filter((t) => t.tema === tema.id);
          return (
            <div key={tema.id} className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <b className="text-[0.875rem]">{tema.nombre}</b>
                {libres(tema.id).length > 0 && (
                  <button type="button" onClick={() => nuevo(tema.id)} className="flex items-center gap-1 text-[0.75rem] font-bold text-[var(--primary)] cursor-pointer">
                    <Plus className="w-3.5 h-3.5" /> Versión
                  </button>
                )}
              </div>
              {versiones.length === 0
                ? <p className="text-[0.75rem] text-slate-400">Sin minitutorial todavía</p>
                : (
                  <div className="flex flex-wrap gap-1.5">
                    {versiones.map((t) => (
                      <button key={t.id} type="button" onClick={() => abrir(t)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-neutral-700 text-[0.75rem] hover:border-[var(--primary)] cursor-pointer">
                        <span className={`w-1.5 h-1.5 rounded-full ${t.publicado ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        {NOMBRE_APARATO[t.aparato]}
                        <span className="text-slate-400">{t.publicado ? 'Publicado' : 'Borrador'}</span>
                      </button>
                    ))}
                  </div>
                )}
            </div>
          );
        })}
      </div>

      <input ref={archivo} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void subir(e)} />

      <IOSModal isOpen={!!b} onClose={() => setB(null)} title={b ? nombreTema(b.tema) : ''} subtitle={b?.id ? 'Editar minitutorial' : 'Nuevo minitutorial'} height="94%">
        {b && (
          <div className="space-y-3 p-1">
            <div className="grid sm:grid-cols-2 gap-2">
              <label className="block"><span className="text-[0.6875rem] text-slate-500">Para qué aparato</span>
                <select value={b.aparato} disabled={!!b.id} onChange={(e) => cambiarAparato(e.target.value as Aparato)}
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem] disabled:opacity-70">
                  {(b.id ? [b.aparato] : libres(b.tema)).map((a) => <option key={a} value={a}>{NOMBRE_APARATO[a]}</option>)}
                </select></label>
              <label className="block"><span className="text-[0.6875rem] text-slate-500">Título</span>
                <input value={b.titulo} maxLength={LIMITES.titulo} onChange={(e) => editar((x) => ({ ...x, titulo: e.target.value }))}
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem]" /></label>
            </div>

            {b.pasos.map((p, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 dark:border-neutral-800 p-3 space-y-2.5">
                <div className="flex items-center gap-1">
                  <b className="flex-1 text-[0.8125rem]">Paso {i + 1}</b>
                  <button type="button" disabled={i === 0} onClick={() => moverPaso(i, -1)} aria-label="Subir paso" className="p-1.5 rounded-lg text-slate-500 disabled:opacity-30 cursor-pointer"><ArrowUp className="w-4 h-4" /></button>
                  <button type="button" disabled={i === b.pasos.length - 1} onClick={() => moverPaso(i, 1)} aria-label="Bajar paso" className="p-1.5 rounded-lg text-slate-500 disabled:opacity-30 cursor-pointer"><ArrowDown className="w-4 h-4" /></button>
                  {b.pasos.length > 1 && <button type="button" onClick={() => quitarPaso(i)} aria-label="Quitar paso" className="p-1.5 rounded-lg text-rose-500 cursor-pointer"><Trash2 className="w-4 h-4" /></button>}
                </div>
                <textarea value={p.texto} maxLength={LIMITES.texto} rows={2} placeholder="Qué hacer en este paso"
                  onChange={(e) => cambiarPaso(i, { texto: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem] resize-y" />
                {p.imagenId ? (
                  <div className="max-w-xs mx-auto space-y-2">
                    <EditorMarcas src={urlCaptura(p.imagenId)} marcas={p.marcas} onCambiar={(marcas) => cambiarPaso(i, { marcas })} />
                    <button type="button" onClick={() => elegirCaptura(i)} disabled={subiendo !== null}
                      className="w-full min-h-[38px] flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-bold cursor-pointer disabled:opacity-50">
                      {subiendo === i ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />} Cambiar captura (las marcas se quedan)
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => elegirCaptura(i)} disabled={subiendo !== null}
                    className="w-full min-h-[88px] flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 dark:border-neutral-700 text-[0.8125rem] font-bold text-slate-500 cursor-pointer disabled:opacity-50">
                    {subiendo === i ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                    Subir captura
                    <span className="text-[0.6875rem] font-normal">JPG o PNG; la app la achica sola</span>
                  </button>
                )}
              </div>
            ))}

            {b.pasos.length < LIMITES.pasos && (
              <button type="button" onClick={() => editar((x) => ({ ...x, pasos: [...x.pasos, { imagenId: null, texto: '', marcas: [] }] }))}
                className="w-full min-h-[40px] flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-neutral-700 text-[0.8125rem] font-bold cursor-pointer">
                <Plus className="w-4 h-4" /> Agregar paso
              </button>
            )}

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/60 cursor-pointer">
              <input type="checkbox" checked={b.publicado} onChange={(e) => editar((x) => ({ ...x, publicado: e.target.checked }))} className="mt-0.5 w-4 h-4 accent-[var(--primary)]" />
              <span className="text-[0.8125rem]"><b>Publicado</b><span className="block text-[0.75rem] text-slate-500">Lalan lo muestra a las dueñas con este aparato. Sin marcar, queda como borrador.</span></span>
            </label>

            <div className="flex gap-2">
              <button type="button" disabled={!listo} onClick={() => setVista({ id: b.id ?? 'vista', tema: b.tema, aparato: b.aparato, titulo: b.titulo, pasos: b.pasos, publicado: b.publicado, actualizadoEn: '' })}
                className="min-h-[44px] px-4 flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-neutral-700 text-[0.8125rem] font-bold cursor-pointer disabled:opacity-50">
                <Eye className="w-4 h-4" /> Vista previa
              </button>
              <button type="button" disabled={ocupado || !listo || subiendo !== null} onClick={() => void guardar()}
                className="flex-1 min-h-[44px] rounded-xl bg-[var(--primary)] text-white text-sm font-bold disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
                {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} {b.publicado ? 'Guardar y publicar' : 'Guardar borrador'}
              </button>
            </div>
            {b.id && (
              <button type="button" onClick={() => void borrar()} className="w-full min-h-[40px] flex items-center justify-center gap-1.5 rounded-xl text-[0.8125rem] text-rose-600 cursor-pointer">
                <Trash2 className="w-4 h-4" /> Borrar esta versión
              </button>
            )}
          </div>
        )}
      </IOSModal>

      <VerComo tema={null} tutorial={vista} onCerrar={() => setVista(null)} />
    </div>
  );
};
