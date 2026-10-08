import React, { useEffect, useRef, useState } from 'react';
import { Camera, ClipboardPaste, FileUp, Loader2, Sparkles } from 'lucide-react';
import { bienvenidaApi } from '../../services/bienvenida';
import type { ServicioLeido } from '../../types/bienvenida';
import { reducirFoto } from '../../utils/reducirFoto';
import { ACEPTA_TEXTO, ArchivoNoLegible, esDeTexto, textoDeArchivo } from '../../utils/textoDeArchivo';
import { BotonPrincipal, BotonSecundario, claseCampo } from './comun';

const FOTOS = 'image/jpeg,image/png,image/webp,application/pdf';
const FOTOS_POR_VEZ = 3;

/**
 * "Súbela como la tengas": la lista de servicios que la dueña ya tiene, en
 * lo que la tenga. Fotos y PDF van al servidor como imagen; Excel, Word, CSV,
 * notas y lo pegado se convierten aquí en texto y la IA solo lo ordena (más
 * rápido y barato). Todo termina en la misma tabla para revisar.
 */
export const SubirLista: React.FC<{ onLeidos: (leidos: ServicioLeido[]) => void; onError: (msg: string) => void }> = ({ onLeidos, onError }) => {
  const camara = useRef<HTMLInputElement>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const [pegando, setPegando] = useState(false);
  const [texto, setTexto] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    if (!leyendo) { setSegundos(0); return; }
    const id = window.setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [leyendo]);

  const leer = async (trabajo: () => Promise<ServicioLeido[]>) => {
    onError('');
    setLeyendo(true);
    try { onLeidos(await trabajo()); }
    catch (e) { onError((e as Error).message || 'No pude leer tu lista.'); }
    finally { setLeyendo(false); }
  };

  /** Lo que se suba: las fotos/PDF por un lado, lo de texto por otro; los resultados se juntan */
  const subir = (lista: FileList | null) => {
    const todos = Array.from(lista ?? []);
    if (!todos.length) return;
    const deTexto = todos.filter(esDeTexto);
    const fotos = todos.filter((f) => !esDeTexto(f) && FOTOS.split(',').includes(f.type)).slice(0, FOTOS_POR_VEZ);
    const raros = todos.filter((f) => !esDeTexto(f) && !FOTOS.split(',').includes(f.type));
    if (raros.length && !deTexto.length && !fotos.length) {
      onError(/\.doc$/i.test(raros[0].name)
        ? 'Ese Word es del formato viejo (.doc): guárdalo como .docx o copia y pega el texto.'
        : `No sé leer "${raros[0].name}": usa una foto, un PDF, un Excel, un Word o pega el texto.`);
      return;
    }
    void leer(async () => {
      const partes: Promise<ServicioLeido[]>[] = [];
      if (fotos.length) partes.push(Promise.all(fotos.map(reducirFoto)).then((f) => bienvenidaApi.fotoPrecios(f)));
      if (deTexto.length) {
        partes.push((async () => {
          try {
            const textos = await Promise.all(deTexto.map(textoDeArchivo));
            return bienvenidaApi.textoPrecios(textos.join('\n\n'));
          } catch (e) {
            if (e instanceof ArchivoNoLegible) throw e;
            throw new Error('No pude abrir ese archivo. Si es un Excel o un Word, prueba a copiar y pegar el texto.');
          }
        })());
      }
      return (await Promise.all(partes)).flat();
    });
  };

  return (
    <div className="space-y-2.5">
      <p className="text-[0.875rem] text-slate-600 dark:text-neutral-300 flex items-start gap-2">
        <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-[var(--primary)]" />
        ¿Ya tienes tu lista de precios? Pásamela como la tengas —foto del letrero o del flyer, PDF, Excel, Word o el texto de tus notas o de WhatsApp— y la ordeno yo.
      </p>
      <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { subir(e.target.files); e.target.value = ''; }} />
      <input ref={archivo} type="file" accept={`${FOTOS},${ACEPTA_TEXTO}`} multiple className="hidden"
        onChange={(e) => { subir(e.target.files); e.target.value = ''; }} />
      <div className="grid grid-cols-3 gap-2">
        <BotonSecundario disabled={leyendo} onClick={() => camara.current?.click()} className="flex-col !gap-1 !py-3">
          <Camera className="w-5 h-5 text-[var(--primary)]" /> Foto
        </BotonSecundario>
        <BotonSecundario disabled={leyendo} onClick={() => archivo.current?.click()} className="flex-col !gap-1 !py-3">
          <FileUp className="w-5 h-5 text-[var(--primary)]" /> Archivo
        </BotonSecundario>
        <BotonSecundario disabled={leyendo} onClick={() => setPegando((p) => !p)} aria-pressed={pegando}
          className={`flex-col !gap-1 !py-3 ${pegando ? 'ring-2 ring-[var(--primary)]' : ''}`}>
          <ClipboardPaste className="w-5 h-5 text-[var(--primary)]" /> Pegar texto
        </BotonSecundario>
      </div>
      <p className="text-[0.75rem] text-slate-400 text-center">Archivo: foto, PDF, Excel, Word, CSV o texto.</p>
      {pegando && (
        <div className="space-y-2">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6} maxLength={30_000} autoFocus
            placeholder={'Pega aquí tu lista, como la tengas. Por ejemplo:\nManicure 500\nPedicure spa 900\nKeratina desde 2,500'}
            className={`${claseCampo} resize-y min-h-[8rem]`} />
          <BotonPrincipal disabled={texto.trim().length < 3} cargando={leyendo} onClick={() => void leer(() => bienvenidaApi.textoPrecios(texto))} className="w-full">
            Ordenar mi lista
          </BotonPrincipal>
        </div>
      )}
      {leyendo && (
        <p role="status" className="flex items-center justify-center gap-2 text-[0.8125rem] font-medium text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--primary)]" />
          {segundos < 3 ? 'Subiendo…' : `Ordenando tu lista… ${segundos} s`}
        </p>
      )}
    </div>
  );
};
