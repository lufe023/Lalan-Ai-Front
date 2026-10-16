import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { ErrorPublico, publicRequest, urlApi } from '../../services/api';
import { FotoConMarcas } from './FotoConMarcas';
import { aparatoActual, NOMBRE_APARATO, type Aparato, type Minitutorial } from './tipos';

export const urlCaptura = (id: string) => urlApi(`/minitutoriales/imagenes/${id}`);

interface TemaPublicado { id: string; nombre: string; aparatos: Aparato[] }

/**
 * "Ver cómo": el minitutorial de un tema, en la versión de este aparato (o
 * la de todos). Fotos paso a paso que se pasan deslizando, con las marcas
 * encima. Funciona también sin sesión (el aviso de instalar sale antes de entrar).
 *
 * Con `tutorial` muestra ese (la vista previa de Plataforma) sin pedir nada.
 * Si no hay nada publicado llama a `onSinTutorial`, o lo dice.
 */
export const VerComo: React.FC<{
  tema: string | null;
  onCerrar: () => void;
  tutorial?: Minitutorial | null;
  onSinTutorial?: () => void;
}> = ({ tema, onCerrar, tutorial, onSinTutorial }) => {
  const [aparato, setAparato] = useState<Aparato>(() => aparatoActual());
  const [datos, setDatos] = useState<Minitutorial | null>(null);
  const [otros, setOtros] = useState<Aparato[]>([]);
  const [fallo, setFallo] = useState('');
  const [paso, setPaso] = useState(0);
  const [direccion, setDireccion] = useState(1);
  const abierto = !!tema || !!tutorial;

  useEffect(() => {
    setPaso(0);
    setFallo('');
    if (tutorial) { setDatos(tutorial); setOtros([]); return; }
    if (!tema) { setDatos(null); return; }
    let vivo = true;
    setDatos(null);
    publicRequest<Minitutorial>(`/minitutoriales/${encodeURIComponent(tema)}?aparato=${aparato}`)
      .then((t) => { if (vivo) setDatos(t); })
      .catch((e) => {
        if (!vivo) return;
        if (e instanceof ErrorPublico && e.status === 404 && onSinTutorial) { onSinTutorial(); return; }
        setFallo(e instanceof ErrorPublico && e.status === 404 ? 'Todavía no hay fotos de esto. Pregúntale a Lalan y te lo explica.' : (e as Error).message);
      });
    publicRequest<TemaPublicado[]>('/minitutoriales')
      .then((l) => { if (vivo) setOtros(l.find((t) => t.id === tema)?.aparatos ?? []); })
      .catch(() => { /* solo es para cambiar de aparato */ });
    return () => { vivo = false; };
    // onSinTutorial cambia en cada render de quien lo usa: no vuelve a pedir por eso
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tema, tutorial, aparato]);

  const pasos = datos?.pasos ?? [];
  const ir = (n: number) => {
    if (n < 0 || n >= pasos.length) return;
    setDireccion(n > paso ? 1 : -1);
    setPaso(n);
  };
  const actual = pasos[paso];
  const ultimo = paso === pasos.length - 1;

  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => {
      // Escape cierra solo el visor, no la hoja de abajo (el editor de Plataforma)
      if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); }
      else if (e.key === 'ArrowRight') ir(paso + 1);
      else if (e.key === 'ArrowLeft') ir(paso - 1);
    };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  });

  return createPortal(
    <AnimatePresence>
      {abierto && (
        <motion.div key="ver-como" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-xs p-3" onClick={onCerrar}>
          <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
            onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={datos?.titulo ?? 'Ver cómo'}
            className="w-full max-w-md max-h-[94dvh] flex flex-col rounded-3xl bg-white dark:bg-neutral-900 text-slate-800 dark:text-neutral-100 shadow-2xl border border-slate-200 dark:border-neutral-800 overflow-hidden">
            <div className="flex items-start gap-2 px-4 pt-4 pb-2 shrink-0">
              <div className="flex-1 min-w-0">
                <h3 className="text-[0.9375rem] font-bold leading-snug">{datos?.titulo ?? 'Ver cómo'}</h3>
                {datos && (
                  otros.length > 1 ? (
                    <select value={datos.aparato} onChange={(e) => setAparato(e.target.value as Aparato)} aria-label="Ver para otro aparato"
                      className="mt-0.5 -ml-1 px-1 py-0.5 rounded-md bg-transparent text-[0.75rem] text-slate-500 dark:text-neutral-400 cursor-pointer">
                      {otros.map((a) => <option key={a} value={a}>{NOMBRE_APARATO[a]}</option>)}
                    </select>
                  ) : <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">{NOMBRE_APARATO[datos.aparato]}</p>
                )}
              </div>
              <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-1.5 -mr-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!datos ? (
              <div className="flex-1 flex items-center justify-center gap-2 p-10 text-[0.8125rem] text-slate-500 text-center">
                {fallo || <><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</>}
              </div>
            ) : (
              <>
                <div className="relative flex-1 min-h-0 overflow-hidden bg-slate-100 dark:bg-neutral-950">
                  <AnimatePresence initial={false} custom={direccion} mode="popLayout">
                    <motion.div key={paso} custom={direccion}
                      initial={{ x: `${direccion * 100}%`, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: `${-direccion * 100}%`, opacity: 0 }}
                      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                      drag={pasos.length > 1 ? 'x' : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.25}
                      onDragEnd={(_, i) => { if (i.offset.x < -60) ir(paso + 1); else if (i.offset.x > 60) ir(paso - 1); }}
                      className="h-full flex items-center justify-center p-3 touch-pan-y">
                      {actual?.imagenId
                        ? <FotoConMarcas src={urlCaptura(actual.imagenId)} marcas={actual.marcas} alt={`Paso ${paso + 1}`}
                            className="inline-block rounded-xl overflow-hidden shadow-md" imgClassName="block max-w-full max-h-[58dvh] w-auto h-auto" />
                        : <span className="text-5xl font-black text-[var(--primary)]/30">{paso + 1}</span>}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="px-4 pt-3 pb-4 space-y-3 shrink-0">
                  <p className="text-[0.875rem] leading-relaxed min-h-[2.75rem]">
                    <b className="text-[var(--primary)]">Paso {paso + 1}.</b> {actual?.texto}
                  </p>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => ir(paso - 1)} disabled={paso === 0} aria-label="Paso anterior"
                      className="w-11 h-11 shrink-0 rounded-xl border border-slate-200 dark:border-neutral-700 flex items-center justify-center disabled:opacity-30 cursor-pointer">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1 flex items-center justify-center gap-1.5">
                      {pasos.map((_, i) => (
                        <button key={i} type="button" onClick={() => ir(i)} aria-label={`Paso ${i + 1}`}
                          className={`h-2 rounded-full transition-all cursor-pointer ${i === paso ? 'w-5 bg-[var(--primary)]' : 'w-2 bg-slate-300 dark:bg-neutral-700'}`} />
                      ))}
                    </div>
                    <button type="button" onClick={() => (ultimo ? onCerrar() : ir(paso + 1))}
                      className="h-11 px-4 shrink-0 rounded-xl bg-[var(--primary)] text-white text-[0.875rem] font-bold flex items-center gap-1 cursor-pointer">
                      {ultimo ? 'Listo' : <>Siguiente <ChevronRight className="w-4 h-4" /></>}
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
