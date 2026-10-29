import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Loader2, Paperclip, Send } from 'lucide-react';
import { reducirFoto } from '../../utils/reducirFoto';

/**
 * El clip del chat: mandarle a la clienta una foto o un video, como en
 * WhatsApp. Se elige el archivo, se ve antes de mandarlo y se le puede
 * poner un texto. Sale por el número o la cuenta del chat (la de su sede).
 *
 * La foto se achica aquí (1600 px, JPG) para que suba en un momento; el
 * video se sube tal cual y el servidor lo deja como lo recibe WhatsApp.
 */

/** Lo que acepta subir el servidor */
const MAXIMO_MB_SUBIDA = 100;
/** WhatsApp no recibe videos de más de 16 MB (ya convertidos) */
const MAXIMO_MB_VIDEO_WHATSAPP = 16;

interface Elegido { archivo: File; url: string; esVideo: boolean }

export const AdjuntarMedio: React.FC<{
  /** Manda el archivo; true si salió (cierra la vista previa) */
  onEnviar: (archivo: File, texto: string) => Promise<boolean>;
  onAviso: (titulo: string, detalle: string) => void;
  /** El nombre de la clienta, para el título */
  para: string;
  canal?: string;
  deshabilitado?: boolean;
  /** El texto que ya estaba escrito: pasa a ser el pie de la foto */
  textoInicial?: string;
}> = ({ onEnviar, onAviso, para, canal, deshabilitado, textoInicial = '' }) => {
  const entradaRef = useRef<HTMLInputElement>(null);
  const [elegido, setElegido] = useState<Elegido | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const quieto = useReducedMotion();
  const idTitulo = useId();

  const cerrar = () => {
    if (enviando) return;
    if (elegido) URL.revokeObjectURL(elegido.url);
    setElegido(null);
  };

  useEffect(() => {
    if (!elegido) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); cerrar(); } };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  });

  const alElegir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const esVideo = f.type.startsWith('video/');
    if (!esVideo && !f.type.startsWith('image/')) { onAviso('Solo fotos o videos', 'Elige una foto o un video de tu galería.'); return; }
    if (f.size > MAXIMO_MB_SUBIDA * 1024 * 1024) { onAviso('Es muy pesado', `Elige uno de menos de ${MAXIMO_MB_SUBIDA} MB.`); return; }
    const archivo = esVideo ? f : await reducirFoto(f);
    setTexto(textoInicial.trim());
    setElegido({ archivo, url: URL.createObjectURL(archivo), esVideo });
  };

  const enviar = async () => {
    if (!elegido || enviando) return;
    setEnviando(true);
    try {
      if (await onEnviar(elegido.archivo, texto.trim())) {
        URL.revokeObjectURL(elegido.url);
        setElegido(null);
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => entradaRef.current?.click()}
        disabled={deshabilitado}
        aria-label="Mandar una foto o un video"
        title="Mandar una foto o un video"
        data-medir="Chat: adjuntar foto o video"
        className="w-10 h-10 shrink-0 rounded-2xl text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 flex items-center justify-center disabled:opacity-40 transition ios-touch cursor-pointer"
      >
        <Paperclip className="w-5 h-5" />
      </button>
      <input ref={entradaRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => void alElegir(e)} />

      {createPortal(
        <AnimatePresence>
          {elegido && (
            <motion.div key="adjuntar-medio"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
              onClick={cerrar}>
              <motion.div
                initial={quieto ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 30, mass: 0.8 } }}
                exit={quieto ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12, transition: { duration: 0.16, ease: 'easeIn' } }}
                onClick={e => e.stopPropagation()}
                role="dialog" aria-modal="true" aria-labelledby={idTitulo}
                className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 text-slate-800 dark:text-neutral-100 shadow-2xl border border-slate-200 dark:border-neutral-800 p-4 space-y-3">
                <h2 id={idTitulo} className="text-[0.9375rem] font-bold text-slate-900 dark:text-white">
                  {elegido.esVideo ? 'Video' : 'Foto'} para {para}
                </h2>
                <div className="rounded-2xl overflow-hidden bg-black flex items-center justify-center max-h-[55vh]">
                  {elegido.esVideo
                    ? <video src={elegido.url} controls playsInline className="max-h-[55vh] w-full" />
                    : <img src={elegido.url} alt="La foto que vas a mandar" className="max-h-[55vh] w-auto object-contain" />}
                </div>
                <input
                  type="text"
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void enviar(); } }}
                  maxLength={1000}
                  disabled={enviando}
                  placeholder="Agrega un texto (opcional)"
                  aria-label="Texto que acompaña"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.875rem] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
                {elegido.esVideo && (
                  <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">
                    Sale el primer minuto{canal === 'whatsapp' ? `, y por WhatsApp hasta ${MAXIMO_MB_VIDEO_WHATSAPP} MB` : ''}.
                  </p>
                )}
                <div className="flex gap-2">
                  <button type="button" disabled={enviando} onClick={cerrar}
                    className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 text-[0.875rem] font-semibold hover:bg-slate-200 dark:hover:bg-neutral-700 transition ios-touch cursor-pointer disabled:opacity-50">
                    Cancelar
                  </button>
                  <button type="button" disabled={enviando} onClick={() => void enviar()}
                    className="flex-1 py-3 rounded-2xl bg-[var(--primary)] hover:brightness-110 text-white text-[0.875rem] font-bold transition ios-touch cursor-pointer disabled:opacity-70 flex items-center justify-center gap-1.5">
                    {enviando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
                    {enviando ? (elegido.esVideo ? 'Preparando el video…' : 'Enviando…') : 'Enviar'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
};
