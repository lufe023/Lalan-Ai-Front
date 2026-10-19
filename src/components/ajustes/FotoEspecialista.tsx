import React, { useRef, useState } from 'react';
import { Camera, Crop, ImagePlus, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { fotoParaCatalogo } from '../../utils/fotoParaCatalogo';
import { urlFotoCatalogo } from '../catalogo/FotoDelCatalogo';
import { AjustesDeEncuadre, CAJA_ARRASTRABLE, ENCUADRE_NORMAL, FotoEncuadrada, esNormal, useArrastrarEncuadre, type Encuadre } from '../catalogo/FotoEncuadrada';

const iniciales = (nombre: string) =>
  nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?';

/**
 * La carita de la especialista en la lista: su foto con su encuadre o, sin
 * foto, sus iniciales con una camarita que invita a ponerla. Nunca una
 * imagen rota.
 */
export const AvatarEspecialista: React.FC<{
  fotoId?: string | null;
  nombre: string;
  encuadre?: Encuadre | null;
  className?: string;
  /** false = sin la camarita */
  pideFoto?: boolean;
}> = ({ fotoId, nombre, encuadre, className = 'w-8 h-8', pideFoto = true }) => {
  const [rota, setRota] = useState(false);
  const url = urlFotoCatalogo(fotoId);
  if (url && !rota) {
    return (
      <span className={`${className} relative block rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-neutral-700`}>
        <FotoEncuadrada src={url} alt={nombre} encuadre={encuadre} onError={() => setRota(true)} />
      </span>
    );
  }
  return (
    <span className={`${className} relative rounded-full flex items-center justify-center shrink-0 bg-[var(--primary)]/10 text-[var(--primary)] text-[0.6875rem] font-bold`}>
      {iniciales(nombre)}
      {pideFoto && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 flex items-center justify-center text-slate-400">
          <Camera className="w-2 h-2" />
        </span>
      )}
    </span>
  );
};

/**
 * La foto de una especialista, debajo de su fila en Ajustes: subirla o
 * cambiarla, acomodarla como una foto de perfil (zoom, llenar o completa, de
 * lado a lado y de arriba a abajo) y quitarla, con confirmación. Es la que
 * sale en la Vitrina («Quién te atiende») y en el quiosco. Se reduce en el
 * teléfono antes de subirla, como las fotos del catálogo.
 */
export const FotoEspecialista: React.FC<{
  persona: { id: string; name: string; fotoId?: string | null };
  encuadre?: Encuadre | null;
  /** Guarda cómo se acomoda la foto (lo mismo que las fotos del catálogo) */
  onEncuadre: (fotoId: string, e: Encuadre) => Promise<void>;
  /** Después de subir o quitar: recargar la lista */
  onCambio: () => Promise<void> | void;
}> = ({ persona, encuadre, onEncuadre, onCambio }) => {
  const entrada = useRef<HTMLInputElement>(null);
  const [trabajando, setTrabajando] = useState<'' | 'subiendo' | 'quitando' | 'ajustando'>('');
  const [ajuste, setAjuste] = useState<Encuadre | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState('');
  const [rota, setRota] = useState(false);
  const arrastre = useArrastrarEncuadre(ajuste, setAjuste);
  const url = urlFotoCatalogo(persona.fotoId);
  const pila = persona.name.split(' ')[0] || persona.name;

  const hacer = async (que: 'subiendo' | 'quitando' | 'ajustando', tarea: () => Promise<void>, fallo: string) => {
    setError('');
    setTrabajando(que);
    try { await tarea(); } catch (e: any) { setError(e?.message || fallo); } finally { setTrabajando(''); }
  };

  const elegir = (f?: File | null) => {
    if (!f) return;
    void hacer('subiendo', async () => {
      const imagen = await fotoParaCatalogo(f);
      await api.put(`/salon/staff/${encodeURIComponent(persona.id)}/foto`, { imagen });
      setRota(false);
      await onCambio();
    }, 'No se pudo subir la foto. Intenta de nuevo.').finally(() => { if (entrada.current) entrada.current.value = ''; });
  };

  const quitar = () => hacer('quitando', async () => {
    await api.delete(`/salon/staff/${encodeURIComponent(persona.id)}/foto`);
    setConfirmando(false);
    await onCambio();
  }, 'No se pudo quitar la foto. Intenta de nuevo.');

  const guardarAjuste = () => {
    if (!persona.fotoId || !ajuste) return;
    const fotoId = persona.fotoId;
    void hacer('ajustando', async () => {
      await onEncuadre(fotoId, ajuste);
      setAjuste(null);
    }, 'No se pudo guardar cómo se acomoda. Intenta de nuevo.');
  };

  const boton = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[0.75rem] font-semibold ios-touch cursor-pointer disabled:opacity-40';

  return (
    <div className="space-y-2.5">
      <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp,image/*" className="hidden" onChange={e => elegir(e.target.files?.[0])} />

      <div className="flex items-center gap-3">
        <div
          {...arrastre}
          className={`relative w-24 h-24 shrink-0 rounded-full overflow-hidden border-2 bg-slate-100 dark:bg-neutral-800 ${ajuste ? `border-[var(--primary)] ${CAJA_ARRASTRABLE}` : 'border-slate-200 dark:border-neutral-700'}`}
        >
          {url && !rota ? (
            <FotoEncuadrada src={url} alt={persona.name} encuadre={ajuste ?? encuadre} loading="eager" onError={() => setRota(true)} />
          ) : (
            <button type="button" disabled={!!trabajando} onClick={() => entrada.current?.click()} aria-label={`Subir la foto de ${persona.name}`}
              className="w-full h-full flex items-center justify-center text-[var(--primary)] cursor-pointer disabled:opacity-60">
              <ImagePlus className="w-6 h-6" />
            </button>
          )}
          {trabajando && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">
            {ajuste
              ? 'Arrastra la foto o usa las barras para que se vea bien su cara.'
              : url
                ? `Así sale ${pila} en tu Vitrina y en el quiosco.`
                : `Sin foto, en tu Vitrina y en el quiosco salen sus iniciales. Una foto de frente, con luz natural, da más confianza.`}
          </p>
          {!ajuste && !confirmando && (
            <div className="flex flex-wrap gap-1.5">
              <button type="button" disabled={!!trabajando} onClick={() => entrada.current?.click()} className={`${boton} bg-[var(--primary)] text-white`}>
                <ImagePlus className="w-3.5 h-3.5" />
                {trabajando === 'subiendo' ? 'Subiendo…' : url ? 'Cambiar foto' : 'Subir foto'}
              </button>
              {url && !rota && (
                <button type="button" disabled={!!trabajando} onClick={() => setAjuste(encuadre ?? ENCUADRE_NORMAL)} className={`${boton} bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 hover:text-[var(--primary)]`}>
                  <Crop className="w-3.5 h-3.5" /> Ajustar
                </button>
              )}
              {url && (
                <button type="button" disabled={!!trabajando} onClick={() => setConfirmando(true)} className={`${boton} text-slate-500 dark:text-neutral-400 hover:text-rose-500`}>
                  <Trash2 className="w-3.5 h-3.5" /> Quitar
                </button>
              )}
            </div>
          )}
          {confirmando && (
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-neutral-800 space-y-1.5">
              <p className="text-[0.75rem] text-slate-700 dark:text-neutral-200">
                ¿Quitar la foto de <b>{persona.name}</b>? En la Vitrina saldrán sus iniciales.
              </p>
              <div className="flex gap-1.5 justify-end">
                <button type="button" disabled={!!trabajando} onClick={() => setConfirmando(false)} className={`${boton} bg-white dark:bg-neutral-900 text-slate-700 dark:text-neutral-200`}>
                  No, dejarla
                </button>
                <button type="button" disabled={!!trabajando} onClick={quitar} className={`${boton} bg-rose-500 text-white font-bold`}>
                  {trabajando === 'quitando' ? 'Quitando…' : 'Sí, quitar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {ajuste && (
        <div className="p-3 rounded-2xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 space-y-2.5">
          <AjustesDeEncuadre encuadre={ajuste} cambiar={setAjuste} />
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={esNormal(ajuste) || !!trabajando} onClick={() => setAjuste(ENCUADRE_NORMAL)} className={`${boton} text-slate-500 hover:text-slate-800 dark:hover:text-white`}>
              <RotateCcw className="w-3.5 h-3.5" /> Como venía
            </button>
            <span className="flex-1" />
            <button type="button" disabled={!!trabajando} onClick={() => setAjuste(null)} className={`${boton} bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200`}>
              Cancelar
            </button>
            <button type="button" disabled={!!trabajando} onClick={guardarAjuste} className={`${boton} bg-[var(--primary)] text-white font-bold`}>
              {trabajando === 'ajustando' ? 'Guardando…' : 'Listo'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[0.6875rem] text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
};
