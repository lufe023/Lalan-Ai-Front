import React, { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { URL_API, api } from '../../services/api';
import { EsferaLalan } from '../lalan/EsferaLalan';

interface Sugeridas { conocido: { id: string; nombre: string } | null; fotos: { id: string; url: string }[] }

export const urlDeFotoGenerica = (url: string) => `${URL_API}/${url}`;

/** La foto genérica como data URL, para subirla a la galería del salón como cualquier otra */
export async function fotoGenericaComoDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(urlDeFotoGenerica(url))).blob();
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => mal(new Error('No se pudo leer la foto'));
    r.readAsDataURL(blob);
  });
}

/** Las fotos de Plataforma que le sirven a un producto ya guardado */
export const fotosSugeridas = (productoId: string) => api.get<Sugeridas>(`/products/${productoId}/fotos-sugeridas`);

/**
 * Un producto sin foto: si Plataforma tiene fotos de presentación de lo que
 * es (aceite de cutículas, acetona…), Lalan las ofrece y con un toque quedan
 * de portada.
 */
export const FotoSugerida: React.FC<{ productoId: string; onUsar: (dataUrl: string) => Promise<void> }> = ({ productoId, onUsar }) => {
  const [s, setS] = useState<Sugeridas | null>(null);
  const [usando, setUsando] = useState<string | null>(null);
  const [lista, setLista] = useState(false);

  useEffect(() => {
    let vivo = true;
    fotosSugeridas(productoId).then(r => { if (vivo) setS(r); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [productoId]);

  if (!s?.fotos.length || lista) return lista ? (
    <p className="flex items-center gap-1 text-[0.6875rem] font-semibold text-emerald-700 dark:text-emerald-400"><Check className="w-3.5 h-3.5" /> Listo, ya tiene portada</p>
  ) : null;

  const usar = async (url: string, id: string) => {
    setUsando(id);
    try { await onUsar(await fotoGenericaComoDataUrl(url)); setLista(true); }
    finally { setUsando(null); }
  };

  return (
    <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-900 flex items-center gap-3">
      <span className="relative w-7 h-7 flex items-center justify-center shrink-0"><EsferaLalan modo="reposo" tamano={26} /></span>
      <div className="flex-1 min-w-0">
        <p className="text-[0.75rem] font-bold text-purple-700 dark:text-purple-300">Lalan tiene una foto para esto</p>
        <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">Foto de presentación de «{s.conocido?.nombre}». Toca la que quieras de portada.</p>
      </div>
      <div className="flex gap-2 shrink-0">
        {s.fotos.slice(0, 3).map(f => (
          <button key={f.id} type="button" onClick={() => void usar(f.url, f.id)} disabled={!!usando}
            className="relative w-14 h-14 rounded-lg overflow-hidden ring-1 ring-purple-200 dark:ring-purple-800 hover:ring-2 hover:ring-purple-500 cursor-pointer disabled:opacity-60">
            <img src={urlDeFotoGenerica(f.url)} alt="" className="w-full h-full object-cover" />
            {usando === f.id && <span className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="w-4 h-4 text-white animate-spin" /></span>}
          </button>
        ))}
      </div>
    </div>
  );
};
