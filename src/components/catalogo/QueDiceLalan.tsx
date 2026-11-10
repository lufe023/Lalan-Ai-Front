import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { EsferaLalan } from '../lalan/EsferaLalan';

const LARGO = 1200;
/** Cuánto espera a que la dueña deje de escribir el nombre antes de pedírselo a Lalán */
const ESPERA_MS = 1500;
/** Lalán propone sola hasta estas veces por hoja abierta; después, solo con el botón */
const SOLA_MAX = 2;

interface Sugerencia { texto: string; fuentes: { titulo: string; url: string }[]; deMercado: string | null }

const etiqueta = 'block text-[0.6875rem] font-semibold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wide';

/**
 * «Qué dice Lalán»: lo que Lalán usa en los chats para recomendar este
 * producto o servicio. Si está vacío y ya hay nombre, Lalán propone el texto
 * sola (como las respuestas sugeridas en los chats): con lo que Plataforma
 * sabe del producto y, si es de una marca, lo que la marca dice en la web.
 * La dueña lo usa con un toque, pide otro o lo escribe ella.
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
}> = ({ tipo, nombre, categoria, descripcion, productoId, value, onChange }) => {
  const [sugerencia, setSugerencia] = useState<Sugerencia | null>(null);
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const solas = useRef(0);
  const pedidoPara = useRef('');
  const vacio = !value.trim();
  const listoParaPedir = nombre.trim().length >= 3;

  const pedir = async () => {
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
      });
      setSugerencia(r);
    } catch (e: any) {
      setError(e?.message || 'Lalán no pudo pensar ahora mismo. Inténtalo en un momento.');
    } finally {
      setPensando(false);
    }
  };

  // Vacío y con nombre: Lalán lo propone sola cuando la dueña deja de escribir el nombre
  useEffect(() => {
    if (!vacio || !listoParaPedir || sugerencia || pensando || solas.current >= SOLA_MAX) return;
    if (pedidoPara.current === nombre.trim()) return;
    const t = setTimeout(() => { solas.current += 1; void pedir(); }, ESPERA_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vacio, nombre, listoParaPedir]);

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
    <div>
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

      {!vacio && !pensando && !sugerencia && !error && listoParaPedir && (
        <button type="button" onClick={() => void pedir()}
          className="mt-1.5 text-[0.6875rem] font-semibold text-purple-700 dark:text-purple-300 hover:underline cursor-pointer">
          Pedirle a Lalán otra versión
        </button>
      )}

      {(pensando || sugerencia || error || (vacio && listoParaPedir)) && (
        <div className="mt-2 p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-900 flex items-start gap-2.5">
          <span className="relative w-7 h-7 flex items-center justify-center shrink-0">
            <EsferaLalan modo={pensando ? 'pensando' : 'reposo'} tamano={26} />
          </span>
          <div className="flex-1 min-w-0">
            {pensando ? (
              <p className="text-[0.75rem] font-semibold text-purple-700 dark:text-purple-300 py-1">
                Lalán está buscando qué decir de «{nombre.trim()}»…
              </p>
            ) : sugerencia ? (
              <>
                <div className="text-[0.6875rem] font-bold text-purple-700 dark:text-purple-300">Lalán sugiere decir:</div>
                <p className="text-[0.75rem] text-slate-700 dark:text-neutral-200 whitespace-pre-wrap">{sugerencia.texto}</p>
                {(sugerencia.deMercado || sugerencia.fuentes.length > 0) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[0.6875rem] text-slate-500 dark:text-neutral-400">
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
    </div>
  );
};
