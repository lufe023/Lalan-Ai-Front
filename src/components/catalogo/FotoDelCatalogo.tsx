import React, { useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, MapPin, RefreshCw, Trash2 } from 'lucide-react';
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

/**
 * La foto de un producto o servicio dentro de su formulario. Sin foto, un
 * recuadro que invita a tomarla y explica para qué sirve (la Vitrina). Con
 * foto: se ve grande, como la verá la clienta, con Cambiar y Quitar (que pide
 * confirmación). La foto se reduce en el teléfono antes de subirla.
 *
 * `onElegir` recibe la foto ya lista (data URL). Si el artículo todavía no
 * existe, quien lo usa la guarda y la sube al crearlo.
 */
export const FotoDelCatalogo: React.FC<{
  /** La foto actual (dirección) o la recién elegida sin subir (data URL) */
  foto?: string | null;
  nombre: string;
  /** "servicio" o "producto": para los textos */
  que: 'servicio' | 'producto';
  /** Dónde vale la foto (con varias sedes). Se muestra como etiqueta */
  sede?: string | null;
  onElegir: (dataUrl: string) => Promise<void> | void;
  onQuitar: () => Promise<void> | void;
}> = ({ foto, nombre, que, sede, onElegir, onQuitar }) => {
  const entrada = useRef<HTMLInputElement>(null);
  const [trabajando, setTrabajando] = useState<'' | 'subiendo' | 'quitando'>('');
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState('');
  const [rota, setRota] = useState<string | null>(null);
  const visible = foto && rota !== foto ? foto : null;

  const elegir = async (f?: File) => {
    if (!f) return;
    setError('');
    setTrabajando('subiendo');
    try {
      await onElegir(await fotoParaCatalogo(f));
    } catch (e: any) {
      setError(e?.message || 'No se pudo subir la foto. Intenta de nuevo.');
    } finally {
      setTrabajando('');
      if (entrada.current) entrada.current.value = '';
    }
  };

  const quitar = async () => {
    setError('');
    setTrabajando('quitando');
    try {
      await onQuitar();
      setConfirmando(false);
    } catch (e: any) {
      setError(e?.message || 'No se pudo quitar la foto. Intenta de nuevo.');
    } finally {
      setTrabajando('');
    }
  };

  const etiqueta = sede ? (
    <span className="inline-flex items-center gap-1 px-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-[0.6875rem] font-semibold text-slate-500 dark:text-neutral-400 whitespace-nowrap shrink-0">
      <MapPin className="w-3 h-3" /> {sede}
    </span>
  ) : null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-[0.6875rem] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
          Foto <span className="normal-case font-normal opacity-60 text-[0.6875rem]">(la ven tus clientas en la Vitrina)</span>
        </label>
        {etiqueta}
      </div>

      <input
        ref={entrada}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="hidden"
        onChange={e => elegir(e.target.files?.[0])}
      />

      {visible ? (
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-800 aspect-[4/3]">
          <img src={visible} alt={nombre || `Foto del ${que}`} onError={() => setRota(visible)} className="w-full h-full object-cover" />
          {trabajando && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-[0.8125rem] font-semibold gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> {trabajando === 'subiendo' ? 'Subiendo foto…' : 'Quitando foto…'}
            </div>
          )}
          {!trabajando && !confirmando && (
            <div className="absolute bottom-2 right-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => entrada.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 dark:bg-neutral-900/95 text-[0.75rem] font-semibold text-slate-800 dark:text-neutral-100 shadow-sm ios-touch cursor-pointer hover:text-[var(--primary)]"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Cambiar
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 dark:bg-neutral-900/95 text-[0.75rem] font-semibold text-slate-600 dark:text-neutral-300 shadow-sm ios-touch cursor-pointer hover:text-rose-500"
              >
                <Trash2 className="w-3.5 h-3.5" /> Quitar
              </button>
            </div>
          )}
          {confirmando && !trabajando && (
            <div className="absolute inset-x-2 bottom-2 p-2.5 rounded-xl bg-white dark:bg-neutral-900 shadow-md space-y-2">
              <p className="text-[0.75rem] text-slate-700 dark:text-neutral-200">
                ¿Quitar la foto de <b>{nombre || `este ${que}`}</b>? En la Vitrina se verá sin foto.
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
            {trabajando ? 'Preparando la foto…' : `Agrega la foto del ${que}`}
          </span>
          <span className="text-[0.6875rem] text-slate-500 dark:text-neutral-400 max-w-[17rem]">
            Sin foto no luce en tu Vitrina. Tómala con luz natural y un fondo limpio.
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
