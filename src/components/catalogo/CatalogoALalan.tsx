import React, { useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, FileText, Film, ImagePlus, Link2, Loader2, Package, Scissors, Sparkles, Store } from 'lucide-react';
import { IOSModal } from '../ui/IOSModal';
import { IOSToggle } from '../ui/IOSToggle';
import { VideoProcesando, VistaVideo, miniaturaDeYoutube } from './VideoProcesando';
import { api, blobProtegido, subirArchivo } from '../../services/api';
import { bienvenidaApi } from '../../services/bienvenida';
import { reducirFoto } from '../../utils/reducirFoto';
import { useApp } from '../../context/AppContext';
import type { SalonProduct } from '../../types';
import type { ServicioLeido } from '../../types/bienvenida';

/** Fotos y PDF por vez (lo mismo que acepta el servidor) */
const FOTOS_POR_VEZ = 3;
const ACEPTA = 'video/*,image/jpeg,image/png,image/webp,application/pdf';

interface ProductoLeido {
  nombre: string;
  marca: string | null;
  categoria: string | null;
  precio?: number | null;
  descripcion?: string | null;
  lalanDice?: string;
  cuadro?: number | null;
  yaExiste: { id: string; nombre: string } | null;
}
interface DelVideo { video: 'archivo' | 'instagram' | 'youtube'; deQueTrata: string; cuadros: string[]; productos: ProductoLeido[] }
interface DelCatalogo { servicios: ServicioLeido[]; productos: ProductoLeido[] }

interface FilaProducto {
  marcado: boolean; nombre: string; precio: string; categoria: string;
  descripcion: string; lalanDice: string; cuadro: number | null; yaExiste: ProductoLeido['yaExiste'];
}
interface FilaServicio {
  marcado: boolean; nombre: string; precio: string; duracion: number | null;
  categoria: string | null; plantilla: string | null; serviceId: string | null;
}

/** Sin conexión el navegador dice «Failed to fetch»: eso no se le enseña a la dueña */
const mensaje = (e: any, porDefecto: string) => {
  const m = String(e?.message ?? '');
  return !m || /failed to fetch|networkerror|load failed/i.test(m) ? porDefecto : m;
};
const precioValido = (p: string) => Number(p.replace(',', '.')) > 0;

/**
 * «Pásale a Lalán tu catálogo»: un video (su reel, YouTube o del teléfono),
 * fotos o el PDF de su catálogo impreso o de un diseño. Lalán saca los
 * productos (y los servicios, del catálogo) con su precio si lo trae; la
 * dueña solo revisa, pone el precio que falte y toca «Crear».
 */
export const CatalogoALalan: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  /** Abre la ficha de un producto que ya estaba en el catálogo */
  onAbrirProducto: (id: string) => void;
}> = ({ isOpen, onClose, onAbrirProducto }) => {
  const { categoriasDe, addProduct, galeriaProducto, recargarCatalogo, showToast } = useApp();
  const categoriasProducto = categoriasDe('product');

  const [enlace, setEnlace] = useState('');
  const [leyendo, setLeyendo] = useState<VistaVideo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);

  const [origen, setOrigen] = useState<{ tipo: 'video' | 'catalogo'; video?: File; enlace?: string; deQueTrata?: string } | null>(null);
  const [cuadros, setCuadros] = useState<string[]>([]);
  const [productos, setProductos] = useState<FilaProducto[]>([]);
  const [servicios, setServicios] = useState<FilaServicio[]>([]);
  const [videoEnVitrina, setVideoEnVitrina] = useState(true);
  const [creando, setCreando] = useState(false);
  const [hecho, setHecho] = useState<{ productos: number; servicios: number } | null>(null);

  const empezarDeNuevo = () => {
    setEnlace(''); setLeyendo(null); setError(null); setOrigen(null); setCuadros([]);
    setProductos([]); setServicios([]); setHecho(null); setVideoEnVitrina(true);
  };
  useEffect(() => { if (!isOpen) empezarDeNuevo(); }, [isOpen]);

  const filaDe = (p: ProductoLeido): FilaProducto => ({
    marcado: !p.yaExiste,
    nombre: p.nombre,
    precio: p.precio ? String(p.precio) : '',
    categoria: p.categoria ?? categoriasProducto[0]?.key ?? '',
    descripcion: p.descripcion ?? '',
    lalanDice: p.lalanDice ?? '',
    cuadro: p.cuadro ?? null,
    yaExiste: p.yaExiste,
  });

  /** Un video: subido o el enlace de su reel o de YouTube */
  const leerVideo = async (archivo?: File, link?: string) => {
    const url = archivo ? URL.createObjectURL(archivo) : undefined;
    setError(null);
    setLeyendo(archivo ? { tipo: 'archivo', url } : /youtu/i.test(link!) ? { tipo: 'youtube', url: miniaturaDeYoutube(link!) } : { tipo: 'instagram' });
    try {
      let r: DelVideo;
      if (archivo) {
        const f = new FormData();
        f.append('archivo', archivo);
        r = await subirArchivo<DelVideo>('/lalan-dice/productos-del-video', f);
      } else {
        r = await api.post<DelVideo>('/lalan-dice/productos-del-video', { enlace: link });
      }
      setOrigen({ tipo: 'video', video: archivo, enlace: archivo ? undefined : link, deQueTrata: r.deQueTrata });
      setCuadros(r.cuadros);
      setProductos(r.productos.map(filaDe));
      setServicios([]);
      // Un video con un solo producto es SU video: va a su Vitrina. Con varios, que ella decida
      setVideoEnVitrina(r.productos.length === 1 && r.video !== 'youtube');
    } catch (e) {
      setError(mensaje(e, 'No pude conectar con Lalán ahora mismo. Inténtalo en un momento.'));
    } finally {
      setLeyendo(null);
      if (url) URL.revokeObjectURL(url);
    }
  };

  /** Fotos o PDF de su catálogo impreso, un flyer o un diseño */
  const leerCatalogo = async (fotos: File[]) => {
    const primera = fotos.find(f => f.type.startsWith('image/'));
    const url = primera ? URL.createObjectURL(primera) : undefined;
    setError(null);
    setLeyendo({ tipo: 'foto', url });
    try {
      const f = new FormData();
      for (const x of await Promise.all(fotos.slice(0, FOTOS_POR_VEZ).map(reducirFoto))) f.append('fotos', x);
      const r = await subirArchivo<DelCatalogo>('/bienvenida/foto-catalogo', f);
      if (!r.productos.length && !r.servicios.length) {
        setError('No vi productos ni servicios en eso. Prueba con una foto más clara de tu catálogo o de tu lista de precios.');
        return;
      }
      setOrigen({ tipo: 'catalogo' });
      setCuadros([]);
      setProductos(r.productos.map(filaDe));
      setServicios(r.servicios.map(s => ({
        marcado: true,
        nombre: s.leido,
        precio: s.precio ? String(s.precio) : '',
        duracion: s.duracion,
        categoria: s.categoria,
        plantilla: s.plantilla,
        serviceId: s.serviceIdExistente,
      })));
      setVideoEnVitrina(false);
    } catch (e) {
      setError(mensaje(e, 'No pude conectar con Lalán ahora mismo. Inténtalo en un momento.'));
    } finally {
      setLeyendo(null);
      if (url) URL.revokeObjectURL(url);
    }
  };

  const recibirArchivos = (lista: FileList | File[] | null) => {
    const archivos = Array.from(lista ?? []);
    if (!archivos.length) return;
    const video = archivos.find(f => f.type.startsWith('video/'));
    if (video) { void leerVideo(video); return; }
    const fotos = archivos.filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
    if (fotos.length) { void leerCatalogo(fotos); return; }
    setError('Eso no lo puedo leer. Pásame un video, fotos o el PDF de tu catálogo.');
  };

  const leerEnlace = () => {
    const link = enlace.trim();
    if (!/^https?:\/\//i.test(link)) { setError('Pega el enlace completo de tu reel o del video de YouTube.'); return; }
    void leerVideo(undefined, link);
  };

  /* Arrastrar y soltar: un video, fotos, un PDF o un enlace */
  const traeAlgo = (e: React.DragEvent) => {
    const t = Array.from(e.dataTransfer?.types ?? []);
    return t.includes('Files') || t.includes('text/uri-list');
  };
  const alSoltar = (e: React.DragEvent) => {
    if (!traeAlgo(e)) return;
    e.preventDefault();
    setArrastrando(false);
    if (e.dataTransfer.files?.length) { recibirArchivos(e.dataTransfer.files); return; }
    const link = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')).split('\n')[0].trim();
    if (/^https?:\/\//i.test(link)) { setEnlace(link); void leerVideo(undefined, link); }
  };

  const cambiarProducto = (i: number, cambio: Partial<FilaProducto>) => setProductos(l => l.map((p, j) => (j === i ? { ...p, ...cambio } : p)));
  const cambiarServicio = (i: number, cambio: Partial<FilaServicio>) => setServicios(l => l.map((s, j) => (j === i ? { ...s, ...cambio } : s)));

  const productosACrear = productos.filter(p => p.marcado && !p.yaExiste);
  const serviciosAGuardar = servicios.filter(s => s.marcado);
  const faltanPrecios = [...productosACrear, ...serviciosAGuardar].filter(x => !precioValido(x.precio)).length;
  const total = productosACrear.length + serviciosAGuardar.length;

  /** El video del reel, una sola vez, para la Vitrina de lo que se cree */
  const videoParaVitrina = async (): Promise<File | null> => {
    if (!videoEnVitrina || origen?.tipo !== 'video') return null;
    if (origen.video) return origen.video;
    if (origen.enlace && /instagr/i.test(origen.enlace)) {
      const url = await blobProtegido(`/lalan-dice/video-instagram?enlace=${encodeURIComponent(origen.enlace)}`);
      try { return new File([await (await fetch(url)).blob()], 'instagram.mp4', { type: 'video/mp4' }); }
      finally { URL.revokeObjectURL(url); }
    }
    return null;
  };

  const crear = async () => {
    if (!total || faltanPrecios || creando) return;
    setCreando(true);
    setError(null);
    let hechos = 0;
    try {
      const video = productosACrear.length ? await videoParaVitrina().catch(() => null) : null;
      for (const p of productosACrear) {
        const precio = Number(p.precio.replace(',', '.'));
        const cat = categoriasProducto.find(c => c.key === p.categoria) ?? categoriasProducto[0];
        const nuevo: SalonProduct = await addProduct({
          name: p.nombre.trim(), category: (cat?.key ?? '') as any, categoryName: cat?.name ?? '',
          sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`, basePrice: precio, stock: 0, unit: 'unit',
          description: p.descripcion.trim() || undefined, lalanDice: p.lalanDice.trim() || undefined,
          aiAvailable: true, enVitrina: true, vitrinaPrecio: 'exacto', preparedToOrder: false, supplyOnly: false,
          priceTiers: [{ id: `ptier_${Date.now()}`, name: 'Precio Venta Público (PVP)', price: precio, isDefault: true, description: 'Venta individual estándar' }],
        } as any);
        // La portada y el video: si fallan, el producto ya quedó creado
        if (p.cuadro != null && cuadros[p.cuadro]) await galeriaProducto(nuevo.id, { agregar: cuadros[p.cuadro] }).catch(() => undefined);
        if (video) await galeriaProducto(nuevo.id, { video }).catch(() => undefined);
        hechos += 1;
      }
      if (serviciosAGuardar.length) {
        await bienvenidaApi.servicios(serviciosAGuardar.map(s => ({
          plantilla: s.plantilla ?? undefined,
          serviceId: s.serviceId ?? undefined,
          nombre: s.nombre.trim(),
          categoria: s.categoria ?? undefined,
          precio: Number(s.precio.replace(',', '.')),
          duracion: s.duracion ?? undefined,
        })));
        await recargarCatalogo();
      }
      setHecho({ productos: hechos, servicios: serviciosAGuardar.length });
    } catch (e) {
      setError(mensaje(e, 'No se pudo crear todo. Lo que ya se creó quedó en tu catálogo.'));
      if (hechos) showToast('Creados en parte', `${hechos} producto${hechos === 1 ? '' : 's'} quedaron en tu catálogo.`, 'warning');
    } finally {
      setCreando(false);
    }
  };

  const entrada = 'w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';

  return (
    <IOSModal isOpen={isOpen} onClose={onClose} title="Pásale a Lalán tu catálogo" subtitle="Un video, fotos o el PDF: Lalán crea los productos y servicios">
      <div className="space-y-4 text-xs pb-6">
        {hecho ? (
          <div className="py-8 flex flex-col items-center text-center gap-3">
            <span className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center"><Check className="w-7 h-7" /></span>
            <p className="text-[0.9375rem] font-bold text-slate-900 dark:text-white">
              {[hecho.productos ? `${hecho.productos} producto${hecho.productos === 1 ? '' : 's'}` : null,
                hecho.servicios ? `${hecho.servicios} servicio${hecho.servicios === 1 ? '' : 's'}` : null].filter(Boolean).join(' y ')} en tu catálogo
            </p>
            <p className="text-slate-500 dark:text-neutral-400 max-w-sm">
              Ya están en la Vitrina y Lalán los ofrece en los chats. Las existencias se suman con «Recibir mercancía» cuando llegue la mercancía.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={empezarDeNuevo} className="px-4 py-2 rounded-full border border-slate-200 dark:border-neutral-700 font-bold text-slate-700 dark:text-neutral-200 cursor-pointer">Pasarle otro</button>
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-full bg-[var(--primary)] text-white font-bold cursor-pointer">Listo</button>
            </div>
          </div>
        ) : leyendo ? (
          <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-900">
            <VideoProcesando vista={leyendo} />
          </div>
        ) : !origen ? (
          <>
            <div
              onDragEnter={e => { if (traeAlgo(e)) { e.preventDefault(); setArrastrando(true); } }}
              onDragOver={e => { if (traeAlgo(e)) e.preventDefault(); }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={alSoltar}
              onClick={() => archivoRef.current?.click()}
              className={`p-6 rounded-2xl border-2 border-dashed flex flex-col items-center text-center gap-2 cursor-pointer transition ${arrastrando
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40'
                : 'border-slate-300 dark:border-neutral-700 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-950/20'}`}
            >
              <div className="flex gap-2 text-purple-600 dark:text-purple-300">
                <Film className="w-6 h-6" /><ImagePlus className="w-6 h-6" /><FileText className="w-6 h-6" />
              </div>
              <p className="text-[0.8125rem] font-bold text-slate-900 dark:text-white">
                {arrastrando ? 'Suéltalo y Lalán lo lee' : 'Arrastra aquí un video, fotos o el PDF de tu catálogo'}
              </p>
              <p className="text-slate-500 dark:text-neutral-400">o toca para elegirlo. Si tu catálogo trae precios, Lalán los copia.</p>
              <input ref={archivoRef} type="file" multiple accept={ACEPTA} className="hidden"
                onChange={e => { const f = e.target.files; recibirArchivos(f ? Array.from(f) : null); e.target.value = ''; }} />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[0.6875rem] font-semibold text-slate-400 uppercase tracking-wide">O el enlace de tu reel o de YouTube</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={enlace} onChange={e => setEnlace(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') leerEnlace(); }}
                    placeholder="https://www.instagram.com/reel/…" className={`${entrada} pl-9`} />
                </div>
                <button type="button" onClick={leerEnlace} disabled={!enlace.trim()}
                  className="px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer disabled:opacity-50">Leer</button>
              </div>
              <p className="text-[0.625rem] text-slate-400">De Instagram solo se leen los posts de tu cuenta conectada.</p>
            </div>
            {error && <p className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">{error}</p>}
          </>
        ) : (
          <>
            {origen.deQueTrata && (
              <p className="flex items-start gap-2 text-slate-600 dark:text-neutral-300">
                <Sparkles className="w-4 h-4 text-purple-500 shrink-0 mt-px" /> Lalán vio: {origen.deQueTrata}
              </p>
            )}

            {productos.length > 0 && (
              <section className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-[0.75rem] font-bold text-slate-900 dark:text-white"><Package className="w-4 h-4" /> Productos</h3>
                {productos.map((p, i) => (
                  <div key={i} className={`p-3 rounded-2xl border transition ${p.marcado && !p.yaExiste
                    ? 'bg-white dark:bg-neutral-900 border-purple-200 dark:border-purple-900'
                    : 'bg-slate-50 dark:bg-neutral-900/40 border-slate-200 dark:border-neutral-800 opacity-80'}`}>
                    <div className="flex gap-3">
                      {cuadros.length > 0 && (
                        <button type="button" title="Toca para cambiar la portada"
                          onClick={() => cambiarProducto(i, { cuadro: p.cuadro == null ? 0 : (p.cuadro + 1) % cuadros.length })}
                          className="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-slate-100 dark:bg-neutral-800 cursor-pointer">
                          {p.cuadro != null
                            ? <img src={cuadros[p.cuadro]} alt="" className="w-full h-full object-cover" />
                            : <span className="w-full h-full flex items-center justify-center text-slate-400"><ImagePlus className="w-5 h-5" /></span>}
                          <span className="absolute bottom-0 inset-x-0 text-[0.5625rem] font-bold text-white bg-black/50 text-center">Portada</span>
                        </button>
                      )}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <input value={p.nombre} onChange={e => cambiarProducto(i, { nombre: e.target.value })} disabled={!!p.yaExiste}
                            className={`${entrada} font-semibold`} />
                          {!p.yaExiste && <IOSToggle id={`crear-prd-${i}`} checked={p.marcado} onChange={v => cambiarProducto(i, { marcado: v })} activeColor="#9333ea" />}
                        </div>
                        {p.yaExiste ? (
                          <button type="button" onClick={() => onAbrirProducto(p.yaExiste!.id)}
                            className="inline-flex items-center gap-1 text-[0.6875rem] font-bold text-purple-700 dark:text-purple-300 cursor-pointer hover:underline">
                            Ya está en tu catálogo como «{p.yaExiste.nombre}» <ExternalLink className="w-3 h-3" />
                          </button>
                        ) : p.marcado && (
                          <>
                            <div className="flex gap-2">
                              <input inputMode="decimal" value={p.precio} onChange={e => cambiarProducto(i, { precio: e.target.value })} placeholder="Precio"
                                className={`${entrada} w-28 ${precioValido(p.precio) ? '' : 'ring-2 ring-amber-400'}`} />
                              <select value={p.categoria} onChange={e => cambiarProducto(i, { categoria: e.target.value })} className={`${entrada} flex-1`}>
                                {categoriasProducto.map(c => <option key={c.key} value={c.key}>{`${c.icon ?? ''} ${c.name}`.trim()}</option>)}
                              </select>
                            </div>
                            {p.lalanDice && (
                              <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400"><span className="font-bold text-purple-600 dark:text-purple-300">Lalán dirá:</span> {p.lalanDice}</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {origen.tipo === 'video' && origen.enlace && !/instagr/i.test(origen.enlace) ? null : origen.tipo === 'video' && productosACrear.length > 0 && (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800">
                    <span className="flex items-center gap-2 text-slate-700 dark:text-neutral-200"><Store className="w-4 h-4 text-purple-500" /> Poner el video en la Vitrina de {productosACrear.length === 1 ? 'este producto' : 'estos productos'}</span>
                    <IOSToggle id="video-en-vitrina" checked={videoEnVitrina} onChange={setVideoEnVitrina} activeColor="#9333ea" />
                  </div>
                )}
              </section>
            )}

            {servicios.length > 0 && (
              <section className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-[0.75rem] font-bold text-slate-900 dark:text-white"><Scissors className="w-4 h-4" /> Servicios</h3>
                {servicios.map((s, i) => (
                  <div key={i} className={`p-3 rounded-2xl border ${s.marcado ? 'bg-white dark:bg-neutral-900 border-purple-200 dark:border-purple-900' : 'bg-slate-50 dark:bg-neutral-900/40 border-slate-200 dark:border-neutral-800 opacity-80'}`}>
                    <div className="flex items-center gap-2">
                      <input value={s.nombre} onChange={e => cambiarServicio(i, { nombre: e.target.value })} className={`${entrada} font-semibold`} />
                      <input inputMode="decimal" value={s.precio} onChange={e => cambiarServicio(i, { precio: e.target.value })} placeholder="Precio"
                        className={`${entrada} w-24 ${!s.marcado || precioValido(s.precio) ? '' : 'ring-2 ring-amber-400'}`} />
                      <IOSToggle id={`crear-srv-${i}`} checked={s.marcado} onChange={v => cambiarServicio(i, { marcado: v })} activeColor="#9333ea" />
                    </div>
                    {s.serviceId && s.marcado && <p className="mt-1 text-[0.6875rem] text-slate-500">Ya lo tienes: se actualiza su precio.</p>}
                  </div>
                ))}
              </section>
            )}

            {error && <p className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">{error}</p>}

            <div className="sticky bottom-0 pt-2 bg-gradient-to-t from-white dark:from-neutral-900 via-white/95 dark:via-neutral-900/95 to-transparent flex items-center gap-2">
              <button type="button" onClick={empezarDeNuevo} className="px-4 py-2.5 rounded-full border border-slate-200 dark:border-neutral-700 font-bold text-slate-600 dark:text-neutral-300 cursor-pointer">Otro</button>
              <button type="button" onClick={() => void crear()} disabled={!total || !!faltanPrecios || creando}
                className="flex-1 py-2.5 rounded-full bg-[var(--primary)] text-white font-bold cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {creando ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando…</>
                  : faltanPrecios ? `Falta el precio de ${faltanPrecios}`
                  : total ? `Crear ${total}` : 'Marca lo que quieres crear'}
              </button>
            </div>
          </>
        )}
      </div>
    </IOSModal>
  );
};
