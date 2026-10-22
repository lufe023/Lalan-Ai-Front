import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, HelpCircle, Loader2 } from 'lucide-react';

/**
 * La pregunta antes de hacer algo: un panel en el centro de la pantalla con
 * el fondo oscurecido, en vez del confirm() del navegador (que parece un
 * fallo del sistema).
 *
 *  · Entra con el fondo apareciendo y el panel creciendo un poco desde abajo;
 *    sale igual pero más rápido. Quien pidió menos movimiento solo ve el fundido.
 *  · Se cierra con Esc o tocando fuera. El foco empieza en el botón seguro
 *    (Cancelar) y no se escapa del panel con Tab.
 *  · `tono="peligro"` pinta el botón de confirmar en rojo (borrar, desconectar…).
 *
 * Para cambiar un window.confirm() lo más cómodo es `useConfirmar()`, abajo.
 */
export type TonoConfirmar = 'normal' | 'peligro';

export interface ModalConfirmarProps {
  abierto: boolean;
  titulo: string;
  mensaje?: React.ReactNode;
  textoConfirmar?: string;
  textoCancelar?: string;
  tono?: TonoConfirmar;
  /** Icono propio en vez del de la pregunta o el aviso */
  icono?: React.ReactNode;
  /** Mientras se hace lo confirmado: botones quietos y un aro girando */
  ocupado?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

const ENFOCABLES = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const ModalConfirmar: React.FC<ModalConfirmarProps> = ({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = 'Sí, seguir',
  textoCancelar = 'Cancelar',
  tono = 'normal',
  icono,
  ocupado = false,
  onConfirmar,
  onCancelar,
}) => {
  const quieto = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const antesRef = useRef<HTMLElement | null>(null);
  const idTitulo = useId();
  const idMensaje = useId();
  const peligro = tono === 'peligro';

  // Al abrir: recuerda dónde estaba el foco y lo pone en Cancelar. Al cerrar, lo devuelve.
  useEffect(() => {
    if (!abierto) return;
    antesRef.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => cancelarRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      antesRef.current?.focus?.();
    };
  }, [abierto]);

  // Esc cierra solo esta pregunta, no la hoja que haya debajo (por eso en captura)
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!ocupado) onCancelar();
    };
    window.addEventListener('keydown', alTeclear, true);
    return () => window.removeEventListener('keydown', alTeclear, true);
  }, [abierto, ocupado, onCancelar]);

  // La página de atrás no se desplaza mientras está abierta
  useEffect(() => {
    if (!abierto) return;
    const html = document.documentElement;
    const antes = [html.style.overflow, document.body.style.overflow];
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => { [html.style.overflow, document.body.style.overflow] = antes; };
  }, [abierto]);

  // Tab da la vuelta dentro del panel
  const atraparFoco = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const lista = Array.from(panelRef.current.querySelectorAll<HTMLElement>(ENFOCABLES));
    if (!lista.length) return;
    const primero = lista[0];
    const ultimo = lista[lista.length - 1];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  };

  return createPortal(
    <AnimatePresence>
      {abierto && (
        <motion.div key="modal-confirmar"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => { if (!ocupado) onCancelar(); }}>
          <motion.div ref={panelRef}
            initial={quieto ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 30, mass: 0.8 } }}
            exit={quieto ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12, transition: { duration: 0.16, ease: 'easeIn' } }}
            onClick={(e) => e.stopPropagation()} onKeyDown={atraparFoco}
            role="alertdialog" aria-modal="true" aria-labelledby={idTitulo} aria-describedby={mensaje ? idMensaje : undefined}
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-neutral-900 text-slate-800 dark:text-neutral-100 shadow-2xl border border-slate-200 dark:border-neutral-800 p-6 text-center">
            <div className={`mx-auto mb-4 w-14 h-14 rounded-2xl flex items-center justify-center ${peligro ? 'bg-rose-500/10 text-rose-500' : 'bg-[var(--primary)]/10 text-[var(--primary)]'}`}>
              {icono ?? (peligro ? <AlertTriangle className="w-7 h-7" aria-hidden="true" /> : <HelpCircle className="w-7 h-7" aria-hidden="true" />)}
            </div>
            <h2 id={idTitulo} className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">{titulo}</h2>
            {mensaje && (
              <div id={idMensaje} className="mt-2 text-[0.875rem] leading-relaxed text-slate-600 dark:text-neutral-300">{mensaje}</div>
            )}
            <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2">
              <button ref={cancelarRef} type="button" disabled={ocupado} onClick={onCancelar}
                className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 text-[0.875rem] font-semibold hover:bg-slate-200 dark:hover:bg-neutral-700 transition ios-touch cursor-pointer disabled:opacity-50">
                {textoCancelar}
              </button>
              <button type="button" disabled={ocupado} onClick={onConfirmar}
                className={`flex-1 py-3 rounded-2xl text-white text-[0.875rem] font-bold transition ios-touch cursor-pointer disabled:opacity-70 flex items-center justify-center gap-1.5 ${peligro ? 'bg-rose-500 hover:bg-rose-600' : 'bg-[var(--primary)] hover:brightness-110'}`}>
                {ocupado && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                {textoConfirmar}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export type PreguntaConfirmar = Omit<ModalConfirmarProps, 'abierto' | 'ocupado' | 'onConfirmar' | 'onCancelar'>;

/**
 * El reemplazo directo de window.confirm():
 *
 *   const { confirmar, modalConfirmar } = useConfirmar();
 *   if (!(await confirmar({ titulo: '¿Borrar?', tono: 'peligro' }))) return;
 *   …
 *   return <>{modalConfirmar}…</>;
 */
export function useConfirmar() {
  const [pregunta, setPregunta] = useState<PreguntaConfirmar | null>(null);
  const [abierto, setAbierto] = useState(false);
  const resolverRef = useRef<((si: boolean) => void) | null>(null);

  const responder = useCallback((si: boolean) => {
    resolverRef.current?.(si);
    resolverRef.current = null;
    setAbierto(false);
  }, []);

  const confirmar = useCallback((p: PreguntaConfirmar) => new Promise<boolean>((resolve) => {
    resolverRef.current?.(false);
    resolverRef.current = resolve;
    setPregunta(p);
    setAbierto(true);
  }), []);

  const onCancelar = useCallback(() => responder(false), [responder]);
  const onConfirmar = useCallback(() => responder(true), [responder]);

  // Si el componente se va con la pregunta abierta, cuenta como "no"
  useEffect(() => () => { resolverRef.current?.(false); }, []);

  const modalConfirmar = pregunta && (
    <ModalConfirmar {...pregunta} abierto={abierto} onConfirmar={onConfirmar} onCancelar={onCancelar} />
  );

  return { confirmar, modalConfirmar };
}
