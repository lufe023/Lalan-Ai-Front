import React, { useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Loader2, MapPin, Plus, Star, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { urlDeFoto } from '../../services/api';
import { fotoParaCatalogo } from '../../utils/fotoParaCatalogo';

/** La dirección de la foto de un producto o servicio (la sirve la API, pública) */
export const urlFotoCatalogo = (fotoId?: string | null) => (fotoId ? urlDeFoto(`catalogo/fotos/${fotoId}`) : undefined);

/**
 * La miniatura de un producto o servicio en la lista: su foto o, si no tiene,
 * el ícono de su categoría con una camarita que avisa que falta la foto para
 * la Vitrina. Nunca una imagen rota ni una foto de muestra.
 */
export const MiniaturaCatalogo: React.FC<{
  fotoId?: string | null;
  nombre: string;
  icono: string;
  color?: string;
  className?: string;
  /** false = no lleva la camarita (un insumo no sale en la Vitrina) */
  pideFoto?: boolean;
}> = ({ fotoId, nombre, icono, color = '#e11d48', className = 'w-10 h-10', pideFoto = true }) => {
  const [rota, setRota] = useState(false);
  const url = urlFotoCatalogo(fotoId);
  if (url && !rota) {
    return <img src={url} alt={nombre} loading="lazy" onError={() => setRota(true)} className={`${className} rounded-2xl object-cover shrink-0 border border-slate-200 dark:border-neutral-700`} />;
  }
  return (
    <div className={`${className} relative rounded-2xl flex items-center justify-center shrink-0 shadow-xs`} style={{ backgroundColor: `${color}20`, color }} title={pideFoto ? 'Sin foto: agrégala para que se vea en tu Vitrina' : undefined}>
      <span className="text-base leading-none">{icono}</span>
      {pideFoto && <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 flex items-center justify-center text-slate-400">
        <Camera className="w-2.5 h-2.5" />
      </span>}
    </div>
  );
};

/** Hasta cuántas fotos lleva cada producto o servicio (lo mismo que acepta el servidor) */
export const MAXIMO_FOTOS = 10;

/** Una foto del carrusel: su id en el servidor (o una clave local si todavía no se subió) y su dirección */
export interface FotoDeGaleria { clave: string; url: string }

/** Las fotos guardadas de un artículo, en orden: la portada y luego las demás */
export const fotosGuardadas = (x?: { fotoId?: string | null; masFotos?: string[] } | null): FotoDeGaleria[] =>
  [x?.fotoId, ...(x?.masFotos ?? [])].filter((id): id is string => !!id).map(id => ({ clave: id, url: urlFotoCatalogo(id)! }));

/**
 * Las fotos de un producto o servicio dentro de su formulario, como un
 * carrusel de Instagram: hasta MAXIMO_FOTOS, la primera es la portada (la que
 * sale en la lista y en la tarjeta de la Vitrina). Sin fotos, un recuadro que
 * invita a tomarlas y explica para qué sirven. Se pueden elegir varias a la
 * vez; cada una se reduce en el teléfono antes de subirla. Quitar pide
 * confirmación.
 *
 * Si el artículo todavía no existe, quien lo usa guarda las fotos y las sube
 * al crearlo.
 */
export const FotosDelCatalogo: React.FC<{
  fotos: FotoDeGaleria[];
  nombre: string;
  /** "servicio" o "producto": para los textos */
  que: 'servicio' | 'producto';
  /** Dónde valen las fotos (con varias sedes). Se muestra como etiqueta */
  sede?: string | null;
  onAgregar: (dataUrl: string) => Promise<void> | void;
  onQuitar: (clave: string) => Promise<void> | void;
  onOrdenar: (claves: string[]) => Promise<void> | void;
}> = ({ fotos, nombre, que, sede, onAgregar, onQuitar, onOrdenar }) => {
  const entrada = useRef<HTMLInputElement>(null);
  const [trabajando, setTrabajando] = useState<'' | 'subiendo' | 'quitando' | 'ordenando'>('');
  const [subidas, setSubidas] = useState<{ van: number; de: number } | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState('');
  const [rotas, setRotas] = useState<string[]>([]);
  const [elegida, setElegida] = useState(0);
  const caben = MAXIMO_FOTOS - fotos.length;
  const i = Math.min(elegida, Math.max(fotos.length - 1, 0));
  const actual = fotos[i];

  const elegir = async (lista?: FileList | null) => {
    const archivos = Array.from(lista ?? []).slice(0, caben);
    if (!archivos.length) return;
    setError('');
    setTrabajando('subiendo');
    try {
      for (const [n, f] of archivos.entries()) {
        setSubidas({ van: n + 1, de: archivos.length });
        await onAgregar(await fotoParaCatalogo(f));
      }
      setElegida(fotos.length + archivos.length - 1);
      if ((lista?.length ?? 0) > archivos.length) setError(`Solo caben ${MAXIMO_FOTOS} fotos: subí las primeras ${archivos.length}.`);
    } catch (e: any) {
      setError(e?.message || 'No se pudo subir la foto. Intenta de nuevo.');
    } finally {
      setTrabajando('');
      setSubidas(null);
      if (entrada.current) entrada.current.value = '';
    }
  };

  const quitar = async () => {
    if (!actual) return;
    setError('');
    setTrabajando('quitando');
    try {
      await onQuitar(actual.clave);
      setConfirmando(false);
      setElegida(Math.max(0, i - 1));
    } catch (e: any) {
      setError(e?.message || 'No se pudo quitar la foto. Intenta de nuevo.');
    } finally {
      setTrabajando('');
    }
  };

  /** Lleva la foto elegida a otra posición (0 = portada) */
  const mover = async (destino: number) => {
    if (!actual || destino < 0 || destino >= fotos.length || destino === i) return;
    const claves = fotos.map(f => f.clave).filter(c => c !== actual.clave);
    claves.splice(destino, 0, actual.clave);
    setError('');
    setTrabajando('ordenando');
    try {
      await onOrdenar(claves);
      setElegida(destino);
    } catch (e: any) {
      setError(e?.message || 'No se pudo cambiar el orden. Intenta de nuevo.');
    } finally {
      setTrabajando('');
    }
  };

  const etiqueta = sede ? (
    <span className="inline-flex items-center gap-1 px-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-[0.6875rem] font-semibold text-slate-500 dark:text-neutral-400 whitespace-nowrap shrink-0">
      <MapPin className="w-3 h-3" /> {sede}
    </span>
  ) : null;

  const boton = 'flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 dark:bg-neutral-900/95 text-[0.75rem] font-semibold shadow-sm ios-touch cursor-pointer disabled:opacity-40';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-[0.6875rem] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
          Fotos <span className="normal-case font-normal opacity-60 text-[0.6875rem]">(hasta {MAXIMO_FOTOS}, la primera es la portada en la Vitrina)</span>
        </label>
        {etiqueta}
      </div>

      <input
        ref={entrada}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/*"
        className="hidden"
        onChange={e => elegir(e.target.files)}
      />

      {actual ? (
        <>
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-800 aspect-[4/3]">
            {rotas.includes(actual.clave) ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400"><Camera className="w-6 h-6" /></div>
            ) : (
              <motion.img key={actual.clave} initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }} src={actual.url} alt={nombre || `Foto del ${que}`} onError={() => setRotas(r => [...r, actual.clave])} className="w-full h-full object-cover" />
            )}
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/55 text-white text-[0.6875rem] font-semibold">
              {i === 0 ? 'Portada' : `${i + 1} de ${fotos.length}`}
            </span>
            {trabajando && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-[0.8125rem] font-semibold gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {trabajando === 'subiendo' ? (subidas && subidas.de > 1 ? `Subiendo ${subidas.van} de ${subidas.de}…` : 'Subiendo foto…') : trabajando === 'quitando' ? 'Quitando foto…' : 'Ordenando…'}
              </div>
            )}
            {!trabajando && !confirmando && (
              <div className="absolute bottom-2 inset-x-2 flex flex-wrap justify-end gap-1.5">
                {fotos.length > 1 && (
                  <>
                    <button type="button" aria-label="Mover a la izquierda" disabled={i === 0} onClick={() => mover(i - 1)} className={`${boton} text-slate-800 dark:text-neutral-100`}>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" aria-label="Mover a la derecha" disabled={i === fotos.length - 1} onClick={() => mover(i + 1)} className={`${boton} text-slate-800 dark:text-neutral-100`}>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    {i > 0 && (
                      <button type="button" onClick={() => mover(0)} className={`${boton} text-slate-800 dark:text-neutral-100 hover:text-[var(--primary)]`}>
                        <Star className="w-3.5 h-3.5" /> Portada
                      </button>
                    )}
                  </>
                )}
                <button type="button" onClick={() => setConfirmando(true)} className={`${boton} text-slate-600 dark:text-neutral-300 hover:text-rose-500`}>
                  <Trash2 className="w-3.5 h-3.5" /> Quitar
                </button>
              </div>
            )}
            {confirmando && !trabajando && (
              <div className="absolute inset-x-2 bottom-2 p-2.5 rounded-xl bg-white dark:bg-neutral-900 shadow-md space-y-2">
                <p className="text-[0.75rem] text-slate-700 dark:text-neutral-200">
                  ¿Quitar esta foto de <b>{nombre || `este ${que}`}</b>?{' '}
                  {fotos.length === 1 ? 'En la Vitrina se verá sin foto.' : i === 0 ? 'La siguiente pasa a ser la portada.' : ''}
                </p>
                <div className="flex gap-1.5 justify-end">
                  <button type="button" onClick={() => setConfirmando(false)} className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-200 ios-touch cursor-pointer">
                    No, dejarla
                  </button>
                  <button type="button" onClick={quitar} className="px-3 py-1.5 rounded-full bg-rose-500 text-white text-[0.75rem] font-bold ios-touch cursor-pointer">
                    Sí, quitar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* La tira de miniaturas: tocar una la muestra arriba; el + agrega más */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5 snap-x">
            {fotos.map((f, n) => (
              <button
                key={f.clave}
                type="button"
                onClick={() => { setElegida(n); setConfirmando(false); }}
                aria-label={n === 0 ? 'Portada' : `Foto ${n + 1}`}
                aria-pressed={n === i}
                className={`relative w-14 h-14 shrink-0 snap-start rounded-xl overflow-hidden border-2 transition ios-touch cursor-pointer ${n === i ? 'border-[var(--primary)] scale-[1.03]' : 'border-transparent opacity-80 hover:opacity-100'}`}
              >
                {rotas.includes(f.clave)
                  ? <span className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-neutral-800 text-slate-400"><Camera className="w-4 h-4" /></span>
                  : <img src={f.url} alt="" loading="lazy" onError={() => setRotas(r => [...r, f.clave])} className="w-full h-full object-cover" />}
                {n === 0 && <Star className="absolute top-0.5 left-0.5 w-3 h-3 text-white drop-shadow fill-white" />}
              </button>
            ))}
            {caben > 0 && (
              <button
                type="button"
                disabled={!!trabajando}
                onClick={() => entrada.current?.click()}
                aria-label="Agregar fotos"
                className="w-14 h-14 shrink-0 rounded-xl border-2 border-dashed border-slate-300 dark:border-neutral-700 text-slate-400 dark:text-neutral-500 flex flex-col items-center justify-center ios-touch cursor-pointer hover:border-[var(--primary)] hover:text-[var(--primary)] transition disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span className="text-[0.5625rem] font-semibold">{fotos.length}/{MAXIMO_FOTOS}</span>
              </button>
            )}
          </div>
        </>
      ) : (
        <button
          type="button"
          disabled={!!trabajando}
          onClick={() => entrada.current?.click()}
          className="w-full aspect-[4/3] max-h-48 rounded-2xl border-2 border-dashed border-slate-300 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800/60 flex flex-col items-center justify-center gap-1.5 px-4 text-center ios-touch cursor-pointer hover:border-[var(--primary)] transition disabled:opacity-60"
        >
          {trabajando ? (
            <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
          ) : (
            <span className="w-11 h-11 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
              <ImagePlus className="w-5 h-5" />
            </span>
          )}
          <span className="text-[0.8125rem] font-bold text-slate-800 dark:text-white">
            {trabajando ? (subidas && subidas.de > 1 ? `Subiendo ${subidas.van} de ${subidas.de}…` : 'Preparando la foto…') : `Agrega fotos del ${que}`}
          </span>
          <span className="text-[0.6875rem] text-slate-500 dark:text-neutral-400 max-w-[17rem]">
            Hasta {MAXIMO_FOTOS}, como un carrusel. Tómalas con luz natural y un fondo limpio.
          </span>
        </button>
      )}

      {error && <p className="text-[0.6875rem] text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
};

/** Arriba de la lista: cuántos todavía no tienen foto para la Vitrina */
export const AvisoSinFoto: React.FC<{ cuantos: number; que: 'servicio' | 'producto' }> = ({ cuantos, que }) => {
  if (cuantos <= 0) return null;
  const plural = cuantos === 1 ? `${que}` : `${que}s`;
  return (
    <div className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-dashed border-slate-300 dark:border-neutral-700 flex items-start gap-2.5">
      <span className="p-2 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] shrink-0"><Camera className="w-4 h-4" /></span>
      <p className="text-[0.75rem] text-slate-600 dark:text-neutral-300">
        <b className="text-slate-900 dark:text-white">{cuantos} {plural} sin foto.</b> En tu Vitrina lucen mucho más con foto: toca{' '}
        <span className="font-semibold">Editar</span> en cada uno y agrégala. Los que tienen la camarita <Camera className="inline w-3 h-3 -mt-0.5" /> son los que faltan.
      </p>
    </div>
  );
};
