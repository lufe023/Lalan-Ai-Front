import React, { useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, Film, Link2, Loader2, RefreshCw, Sparkles, Store, Upload, X } from 'lucide-react';
import { api, blobProtegido, subirArchivo } from '../../services/api';
import { EsferaLalan } from '../lalan/EsferaLalan';
import { VideoProcesando, VistaVideo, miniaturaDeYoutube } from './VideoProcesando';

const LARGO = 1200;
/** Cuánto espera a que la dueña deje de escribir el nombre antes de pedírselo a Lalán */
const ESPERA_MS = 1500;
/** Lalán propone sola hasta estas veces por hoja abierta; después, solo con el botón */
const SOLA_MAX = 2;

interface Sugerencia { texto: string; fuentes: { titulo: string; url: string }[]; deMercado: string | null; video?: 'youtube' | 'instagram' | 'archivo' }

const DE_VIDEO: Record<NonNullable<Sugerencia['video']>, string> = { youtube: 'el video de YouTube', instagram: 'tu post de Instagram', archivo: 'tu video' };

/** Botón pequeño de las ayudas de Lalán bajo el texto */
const BOTON_AYUDA = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-900 text-purple-700 dark:text-purple-300 text-[0.6875rem] font-bold cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/50 transition';

const etiqueta = 'block text-[0.6875rem] font-semibold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wide';

/**
 * «Qué dice Lalán»: lo que Lalán usa en los chats para recomendar este
 * producto o servicio. Si está vacío y ya hay nombre, Lalán propone el texto
 * sola (como las respuestas sugeridas en los chats): con lo que Plataforma
 * sabe del producto y, si es de una marca, lo que la marca dice en la web.
 * La dueña lo usa con un toque, pide otro o lo escribe ella.
 *
 * También puede pasarle un video: un reel o post de su Instagram, uno de
 * YouTube o uno de su teléfono. Lalán saca lo que se dice y se ve y escribe
 * con eso.
 */
export const QueDiceLalan: React.FC<{
  tipo: 'producto' | 'servicio';
  nombre: string;
  categoria?: string;
  descripcion?: string;
  /** Si ya existe: así Lalán usa el producto de Plataforma al que está vinculado */
  productoId?: string | null;
  value: string;
  onChange: (texto: string) => void;
  /** Pone el video en el carrusel de la Vitrina (el mismo camino que «Fotos y videos») */
  onPonerEnVitrina?: (archivo: File) => Promise<void>;
  /** false = Lalán no propone sola (interruptor del catálogo); solo cuando la dueña lo pide */
  sugiereSola?: boolean;
}> = ({ tipo, nombre, categoria, descripcion, productoId, value, onChange, onPonerEnVitrina, sugiereSola = true }) => {
  const [sugerencia, setSugerencia] = useState<Sugerencia | null>(null);
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conVideo, setConVideo] = useState(false);
  const [enlace, setEnlace] = useState('');
  const [leyendo, setLeyendo] = useState<string | null>(null);
  /** La miniatura que se anima mientras Lalán ve el video */
  const [vista, setVista] = useState<VistaVideo | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  /** El último video que leyó Lalán: el mismo puede ir a la Vitrina */
  const [ultimoVideo, setUltimoVideo] = useState<{ archivo?: File; enlace?: string; origen: 'youtube' | 'instagram' | 'archivo' } | null>(null);
  const [vitrina, setVitrina] = useState<'nada' | 'subiendo' | 'puesto'>('nada');
  const [errorVitrina, setErrorVitrina] = useState<string | null>(null);
  const solas = useRef(0);
  const pedidoPara = useRef('');
  const vacio = !value.trim();
  const listoParaPedir = nombre.trim().length >= 3;

  const pedir = async (auto = false) => {
    if (!listoParaPedir || pensando) return;
    setPensando(true);
    setError(null);
    pedidoPara.current = nombre.trim();
    try {
      const r = await api.post<Sugerencia>('/lalan-dice/sugerir', {
        tipo, nombre: nombre.trim(),
        categoria: categoria?.trim() || undefined,
        descripcion: descripcion?.trim() || undefined,
        productoId: productoId || undefined,
        auto: auto || undefined,
      });
      // Con el interruptor apagado el servidor no gasta IA y no trae texto
      setSugerencia(r?.texto?.trim() ? r : null);
    } catch (e: any) {
      setError(e?.message || 'Lalán no pudo pensar ahora mismo. Inténtalo en un momento.');
    } finally {
      setPensando(false);
    }
  };

  /** Lalán aprende de un video: un enlace (Instagram o YouTube) o un archivo del teléfono */
  const pedirConVideo = async (archivo?: File, enlaceDado?: string) => {
    if (!listoParaPedir || pensando) return;
    const link = (enlaceDado ?? enlace).trim();
    if (!archivo && !link) return;
    setPensando(true);
    setError(null);
    setLeyendo(archivo ? 'tu video' : /youtu/i.test(link) ? 'el video de YouTube' : 'tu post de Instagram');
    const urlLocal = archivo ? URL.createObjectURL(archivo) : undefined;
    setVista(archivo ? { tipo: 'archivo', url: urlLocal }
      : /youtu/i.test(link) ? { tipo: 'youtube', url: miniaturaDeYoutube(link) }
      : { tipo: 'instagram' });
    pedidoPara.current = nombre.trim();
    try {
      const datos: Record<string, string | undefined> = {
        tipo, nombre: nombre.trim(),
        categoria: categoria?.trim() || undefined,
        descripcion: descripcion?.trim() || undefined,
        productoId: productoId || undefined,
        enlace: archivo ? undefined : link,
      };
      let r: Sugerencia;
      if (archivo) {
        const form = new FormData();
        for (const [k, v] of Object.entries(datos)) if (v) form.append(k, v);
        form.append('archivo', archivo);
        r = await subirArchivo<Sugerencia>('/lalan-dice/sugerir-video', form);
      } else {
        r = await api.post<Sugerencia>('/lalan-dice/sugerir-video', datos);
      }
      setSugerencia(r);
      setUltimoVideo({ archivo, enlace: archivo ? undefined : link, origen: r.video ?? (archivo ? 'archivo' : 'instagram') });
      setVitrina('nada');
      setErrorVitrina(null);
      setConVideo(false);
      setEnlace('');
    } catch (e: any) {
      setError(e?.message || 'Lalán no pudo leer ese video. Prueba con otro.');
    } finally {
      setPensando(false);
      setLeyendo(null);
      setVista(null);
      if (urlLocal) URL.revokeObjectURL(urlLocal);
    }
  };

  /* Arrastrar un video (o el enlace de un reel o de YouTube) sobre el bloque.
     Sin esto el navegador abre el archivo en otra pestaña. */
  const [arrastrando, setArrastrando] = useState(false);
  const capas = useRef(0);
  const traeVideo = (e: React.DragEvent) => {
    const tipos = Array.from(e.dataTransfer?.types ?? []);
    return tipos.includes('Files') || tipos.includes('text/uri-list');
  };
  const alEntrar = (e: React.DragEvent) => {
    if (!traeVideo(e)) return;
    e.preventDefault();
    capas.current += 1;
    setArrastrando(true);
  };
  const alSalir = () => {
    capas.current = Math.max(0, capas.current - 1);
    if (!capas.current) setArrastrando(false);
  };
  const alSoltar = (e: React.DragEvent) => {
    if (!traeVideo(e)) return;
    e.preventDefault();
    e.stopPropagation();
    capas.current = 0;
    setArrastrando(false);
    if (!listoParaPedir) { setError('Escribe primero el nombre, así Lalán sabe de qué es el video.'); return; }
    const archivo = Array.from(e.dataTransfer.files ?? [])[0];
    if (archivo) {
      if (!archivo.type.startsWith('video/')) { setError('Eso no es un video. Arrastra un video o el enlace de tu reel o de YouTube.'); return; }
      void pedirConVideo(archivo);
      return;
    }
    const link = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')).split('\n')[0].trim();
    if (/^https?:\/\//i.test(link)) void pedirConVideo(undefined, link);
  };

  // Un video soltado fuera del bloque, dentro de la hoja, tampoco abre otra pestaña
  useEffect(() => {
    const frenar = (e: DragEvent) => {
      if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) e.preventDefault();
    };
    window.addEventListener('dragover', frenar);
    window.addEventListener('drop', frenar);
    return () => { window.removeEventListener('dragover', frenar); window.removeEventListener('drop', frenar); };
  }, []);

  /** El mismo video al carrusel de la Vitrina: el subido tal cual; el reel, traído de su Instagram */
  const ponerEnVitrina = async () => {
    if (!onPonerEnVitrina || !ultimoVideo || ultimoVideo.origen === 'youtube') return;
    setVitrina('subiendo');
    setErrorVitrina(null);
    try {
      let archivo = ultimoVideo.archivo;
      if (!archivo && ultimoVideo.enlace) {
        const local = await blobProtegido(`/lalan-dice/video-instagram?enlace=${encodeURIComponent(ultimoVideo.enlace)}`);
        try {
          const blob = await (await fetch(local)).blob();
          archivo = new File([blob], 'instagram.mp4', { type: 'video/mp4' });
        } finally {
          URL.revokeObjectURL(local);
        }
      }
      if (!archivo) throw new Error('No se encontró el video.');
      await onPonerEnVitrina(archivo);
      setVitrina('puesto');
    } catch (e: any) {
      setVitrina('nada');
      setErrorVitrina(e?.message || 'No se pudo poner el video en la Vitrina.');
    }
  };

  // Vacío y con nombre: Lalán lo propone sola cuando la dueña deja de escribir el nombre
  useEffect(() => {
    if (!sugiereSola || !vacio || !listoParaPedir || sugerencia || pensando || solas.current >= SOLA_MAX) return;
    if (pedidoPara.current === nombre.trim()) return;
    const t = setTimeout(() => { solas.current += 1; void pedir(true); }, ESPERA_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vacio, nombre, listoParaPedir, sugiereSola]);

  // Si cambia el nombre, la sugerencia de antes ya no es de este producto
  useEffect(() => {
    if (sugerencia && pedidoPara.current && pedidoPara.current !== nombre.trim()) setSugerencia(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nombre]);

  const usar = () => {
    if (!sugerencia) return;
    onChange(sugerencia.texto);
    setSugerencia(null);
  };

  return (
    <div
      onDragEnter={alEntrar}
      onDragOver={e => { if (traeVideo(e)) e.preventDefault(); }}
      onDragLeave={alSalir}
      onDrop={alSoltar}
      className={`relative rounded-xl transition ${arrastrando ? 'ring-2 ring-purple-500 ring-offset-4 ring-offset-white dark:ring-offset-neutral-900' : ''}`}
    >
      {arrastrando && (
        <div className="absolute inset-0 z-10 rounded-xl bg-purple-600/10 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-600 text-white text-[0.75rem] font-bold shadow">
            <Film className="w-4 h-4" /> Suelta el video y Lalán lo ve
          </span>
        </div>
      )}
      <label className={etiqueta}>
        Qué dice Lalán <span className="normal-case font-normal opacity-60 text-[0.6875rem]">(lo usa en los chats para recomendar{tipo === 'producto' ? 'lo y venderlo' : 'lo'})</span>
      </label>
      <textarea
        rows={3}
        maxLength={LARGO}
        placeholder={tipo === 'producto'
          ? 'Para qué sirve, para quién es y cómo se usa. Ej.: hidrata el cabello seco desde el primer lavado…'
          : 'Para quién es, qué se siente y por qué vale la pena…'}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:bg-white dark:focus:bg-neutral-900 transition resize-none leading-relaxed"
      />

      {(pensando || sugerencia || error || (vacio && listoParaPedir)) && (
        <div className="mt-2 p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-900 flex items-start gap-2.5">
          <span className="relative w-7 h-7 flex items-center justify-center shrink-0">
            <EsferaLalan modo={pensando ? 'pensando' : 'reposo'} tamano={26} />
          </span>
          <div className="flex-1 min-w-0">
            {pensando && vista ? (
              <VideoProcesando vista={vista} />
            ) : pensando ? (
              <p className="text-[0.75rem] font-semibold text-purple-700 dark:text-purple-300 py-1">
                {leyendo ? `Lalán está viendo ${leyendo}… puede tardar un minuto.` : `Lalán está buscando qué decir de «${nombre.trim()}»…`}
              </p>
            ) : sugerencia ? (
              <>
                <div className="text-[0.6875rem] font-bold text-purple-700 dark:text-purple-300">Lalán sugiere decir:</div>
                <p className="text-[0.75rem] text-slate-700 dark:text-neutral-200 whitespace-pre-wrap">{sugerencia.texto}</p>
                {(sugerencia.video || sugerencia.deMercado || sugerencia.fuentes.length > 0) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[0.6875rem] text-slate-500 dark:text-neutral-400">
                    {sugerencia.video && <span className="inline-flex items-center gap-0.5"><Film className="w-3 h-3" /> Salió de {DE_VIDEO[sugerencia.video]}</span>}
                    {sugerencia.deMercado && <span>Usó lo que Lalán sabe de «{sugerencia.deMercado}»</span>}
                    {sugerencia.fuentes.map(f => (
                      <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 underline decoration-dotted hover:text-purple-600 dark:hover:text-purple-300 max-w-[14rem] truncate">
                        <ExternalLink className="w-3 h-3 shrink-0" /> {f.titulo}
                      </a>
                    ))}
                  </div>
                )}
              </>
            ) : error ? (
              <p className="text-[0.75rem] text-rose-600 dark:text-rose-400 py-1">{error}</p>
            ) : (
              <p className="text-[0.75rem] text-slate-600 dark:text-neutral-300 py-1">
                Está vacío: Lalán puede escribirlo por ti con lo que se sabe de este {tipo}.
              </p>
            )}
          </div>
          {!pensando && (
            <div className="flex flex-col gap-1.5 shrink-0">
              {sugerencia && (
                <button type="button" onClick={usar}
                  className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[0.6875rem] font-bold cursor-pointer">
                  Usar
                </button>
              )}
              <button type="button" onClick={() => void pedir()} disabled={!listoParaPedir}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-300 text-[0.6875rem] font-bold cursor-pointer disabled:opacity-50 inline-flex items-center gap-1">
                {sugerencia || error ? <><RefreshCw className="w-3 h-3" /> Otra</> : 'Pedírselo'}
              </button>
            </div>
          )}
        </div>
      )}

      {ultimoVideo && onPonerEnVitrina && !pensando && (
        ultimoVideo.origen === 'youtube' ? (
          <p className="mt-1.5 block text-[0.6875rem] text-slate-500 dark:text-neutral-400">
            Un video de YouTube no se puede poner en tu Vitrina: si es tuyo, súbelo desde «Fotos y videos».
          </p>
        ) : vitrina === 'puesto' ? (
          <p className="mt-1.5 flex items-center gap-1 text-[0.6875rem] font-semibold text-emerald-700 dark:text-emerald-400">
            <Check className="w-3.5 h-3.5" /> Listo: el video ya está en la Vitrina, en «Fotos y videos»
          </p>
        ) : (
          <button type="button" onClick={() => void ponerEnVitrina()} disabled={vitrina === 'subiendo'}
            className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-300 text-[0.6875rem] font-bold cursor-pointer disabled:opacity-60">
            {vitrina === 'subiendo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Store className="w-3.5 h-3.5" />}
            {vitrina === 'subiendo' ? 'Poniéndolo en la Vitrina…' : 'Usar este video en la Vitrina'}
          </button>
        )
      )}
      {errorVitrina && <p className="mt-1 text-[0.6875rem] text-rose-600 dark:text-rose-400">{errorVitrina}</p>}

      {listoParaPedir && !pensando && (conVideo ? (
        <div className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200">Pásale un video a Lalán</span>
            <button type="button" onClick={() => { setConVideo(false); setEnlace(''); }} aria-label="Cerrar"
              className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 dark:hover:bg-neutral-700 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
            Un reel o post de tu Instagram, un video de YouTube o uno de tu teléfono. Lalán escucha lo que se dice y escribe con eso.
          </p>
          <div className="flex gap-1.5">
            <div className="flex-1 min-w-0 relative">
              <Link2 className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="url" inputMode="url" value={enlace} onChange={e => setEnlace(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void pedirConVideo(); } }}
                placeholder="Pega el enlace de Instagram o YouTube"
                className="w-full pl-8 pr-2.5 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.75rem] text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>
            <button type="button" onClick={() => void pedirConVideo()} disabled={!enlace.trim()}
              className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[0.6875rem] font-bold cursor-pointer disabled:opacity-40 shrink-0">
              Leer
            </button>
          </div>
          <button type="button" onClick={() => archivoRef.current?.click()}
            className="w-full py-2 rounded-lg border border-dashed border-slate-300 dark:border-neutral-600 text-[0.6875rem] font-semibold text-slate-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-900 inline-flex items-center justify-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> O sube un video (también puedes arrastrarlo aquí)
          </button>
          <input ref={archivoRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/3gpp,video/x-m4v" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void pedirConVideo(f); }} />
          <p className="text-[0.625rem] text-slate-400 dark:text-neutral-500">
            De Instagram solo se leen los posts de tu cuenta conectada. Si el video es de otra cuenta, descárgalo y súbelo.
          </p>
        </div>
      ) : (
        /* Las dos ayudas de Lalán, como botones iguales en una fila (no enlaces pegados) */
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!vacio && !sugerencia && !error && (
            <button type="button" onClick={() => void pedir()} className={BOTON_AYUDA}>
              <Sparkles className="w-3.5 h-3.5" /> Pedirle otra versión
            </button>
          )}
          <button type="button" onClick={() => setConVideo(true)} className={BOTON_AYUDA}>
            <Film className="w-3.5 h-3.5" /> Pásale un video
          </button>
        </div>
      ))}
    </div>
  );
};
