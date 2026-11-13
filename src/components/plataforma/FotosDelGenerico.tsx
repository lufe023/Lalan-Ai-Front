import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ImagePlus, Loader2, Trash2, Undo2 } from 'lucide-react';
import { api } from '../../services/api';
import { useConfirmar } from '../ui/ModalConfirmar';
import { fotoParaCatalogo } from '../../utils/fotoParaCatalogo';
import { urlDeFotoGenerica } from '../catalogo/FotoSugerida';

interface FotoGenerica { id: string; publicada: boolean; url: string }
const MAXIMO = 6;
const botonChico = 'text-xs font-bold flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-neutral-800 cursor-pointer';

/**
 * Plataforma → Mercado: las fotos de presentación de un producto genérico.
 * Se suben en borrador y se publican; publicadas, Lalan las ofrece a los
 * salones con ese producto sin foto. Genéricas: nada de fotos de marca bajadas de internet.
 */
export const FotosDelGenerico: React.FC<{ genericoId: string; nombre: string }> = ({ genericoId, nombre }) => {
  const [fotos, setFotos] = useState<FotoGenerica[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const { confirmar, modalConfirmar } = useConfirmar();
  const base = `/plataforma/productos/genericos`;

  useEffect(() => { api.get<FotoGenerica[]>(`${base}/${genericoId}/fotos`).then(setFotos).catch(() => undefined); }, [genericoId]);

  const hacer = async (p: Promise<FotoGenerica[]>) => {
    setError(null);
    try { setFotos(await p); } catch (e: any) { setError(e?.message || 'No se pudo.'); }
  };

  const subir = async (lista: FileList | null) => {
    const archivos = Array.from(lista ?? []).slice(0, MAXIMO - fotos.length);
    if (!archivos.length) return;
    setSubiendo(true);
    try {
      for (const f of archivos) await hacer(api.post<FotoGenerica[]>(`${base}/${genericoId}/fotos`, { imagen: await fotoParaCatalogo(f) }));
    } finally { setSubiendo(false); }
  };

  const publicar = async (f: FotoGenerica) => {
    if (!f.publicada && !(await confirmar({
      titulo: `¿Publicar esta foto de ${nombre}?`,
      mensaje: 'La verán todos los salones con este producto sin foto, y podrán ponerla en su Vitrina. Que sea genérica, sin marca de otro.',
      textoConfirmar: 'Publicar',
    }))) return;
    await hacer(api.put<FotoGenerica[]>(`${base}/fotos/${f.id}`, { publicada: !f.publicada }));
  };

  const quitar = async (f: FotoGenerica) => {
    if (!(await confirmar({ titulo: '¿Quitar esta foto?', mensaje: 'Los salones que ya la usan la conservan en su galería.', textoConfirmar: 'Quitar', tono: 'peligro' }))) return;
    await hacer(api.delete<FotoGenerica[]>(`${base}/fotos/${f.id}`));
  };

  return (
    <div className="space-y-1.5">
      <div className="text-[0.75rem] font-bold">Fotos de presentación</div>
      <div className="flex flex-wrap gap-2">
        {fotos.map(f => (
          <div key={f.id} className="w-28 space-y-1">
            <div className="relative w-28 h-28 rounded-xl overflow-hidden bg-slate-100 dark:bg-neutral-800">
              <img src={urlDeFotoGenerica(f.url)} alt="" className="w-full h-full object-cover" />
              <span className={`absolute top-1 left-1 px-1.5 py-0.5 rounded-full text-[0.625rem] font-bold ${f.publicada ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {f.publicada ? 'Publicada' : 'Borrador'}
              </span>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => void publicar(f)} className={`${botonChico} flex-1 justify-center`}>
                {f.publicada ? <><Undo2 className="w-3 h-3" /> Borrador</> : <><CheckCircle2 className="w-3 h-3" /> Publicar</>}
              </button>
              <button type="button" aria-label="Quitar" onClick={() => void quitar(f)} className={`${botonChico} text-rose-600`}><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
        {fotos.length < MAXIMO && (
          <button type="button" onClick={() => archivo.current?.click()} disabled={subiendo}
            className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-300 dark:border-neutral-700 flex flex-col items-center justify-center gap-1 text-xs text-slate-500 cursor-pointer hover:border-[var(--primary)] disabled:opacity-60">
            {subiendo ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
            {subiendo ? 'Subiendo…' : 'Subir foto'}
          </button>
        )}
        <input ref={archivo} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
          onChange={e => { void subir(e.target.files); e.target.value = ''; }} />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {modalConfirmar}
    </div>
  );
};
