import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Copy, Download, Loader2, Smartphone, X } from 'lucide-react';
import { VerComo } from '../minitutoriales/VerComo';
import { alCambiarInstalacion, comoInstalar, esTelefono, instalarDirecto, pasosParaInstalar, type ComoInstalar } from '../../services/instalarApp';

/** Cómo se instala aquí, y se pone al día si el navegador avisa tarde o ya se instaló */
export function useComoInstalar(): ComoInstalar {
  const [como, setComo] = useState<ComoInstalar>(() => comoInstalar());
  useEffect(() => alCambiarInstalacion(() => setComo(comoInstalar())), []);
  return como;
}

/**
 * El camino para instalar cuando no hay botón de un toque: primero las fotos
 * del minitutorial («instalar-app», las que el equipo sube en Plataforma →
 * Guías, en la versión de este aparato); si todavía no hay, los pasos en texto.
 */
export const GuiaInstalar: React.FC<{ abierta: boolean; onCerrar: () => void }> = ({ abierta, onCerrar }) => {
  const [enTexto, setEnTexto] = useState(false);
  const como = comoInstalar();
  // Dentro de Instagram o Facebook las fotos de "Compartir" no sirven: va directo al texto con «Copiar enlace»
  const soloTexto = como === 'dentro-de-app' || como === 'otro-navegador';
  useEffect(() => { if (!abierta) setEnTexto(false); }, [abierta]);

  return (
    <>
      <VerComo tema={abierta && !enTexto && !soloTexto ? 'instalar-app' : null} onCerrar={onCerrar} onSinTutorial={() => setEnTexto(true)} />
      <PasosEnTexto abierta={abierta && (enTexto || soloTexto)} como={como} onCerrar={onCerrar} />
    </>
  );
};

const PasosEnTexto: React.FC<{ abierta: boolean; como: ComoInstalar; onCerrar: () => void }> = ({ abierta, como, onCerrar }) => {
  const { titulo, pasos } = pasosParaInstalar(como);
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    const enlace = `${window.location.origin}${window.location.pathname}`;
    try { await navigator.clipboard.writeText(enlace); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { /* sin portapapeles: el enlace se ve escrito */ }
  };
  return createPortal(
    <AnimatePresence>
      {abierta && (
        <motion.div key="pasos-instalar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
          <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
            onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={titulo}
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-neutral-900 p-5 shadow-2xl text-slate-800 dark:text-neutral-100 border border-slate-200 dark:border-neutral-800 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[var(--primary)] flex items-center justify-center text-white shrink-0"><Download className="w-4 h-4" /></div>
              <h3 className="flex-1 font-bold text-[0.9375rem]">{titulo}</h3>
              <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-1.5 -mr-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <ol className="space-y-2.5">
              {pasos.map((p, i) => (
                <li key={i} className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/60">
                  <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-white text-[0.75rem] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-[0.875rem] font-bold">{p.titulo}</span>
                    <span className="block text-[0.8125rem] text-slate-500 dark:text-neutral-400 leading-snug mt-0.5">{p.texto}</span>
                  </span>
                </li>
              ))}
            </ol>
            {(como === 'dentro-de-app' || como === 'otro-navegador') && (
              <button type="button" onClick={() => void copiar()}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-neutral-700 text-[0.875rem] font-bold flex items-center justify-center gap-2 cursor-pointer">
                {copiado ? <><Check className="w-4 h-4 text-emerald-500" /> Enlace copiado</> : <><Copy className="w-4 h-4" /> Copiar el enlace</>}
              </button>
            )}
            <button type="button" onClick={onCerrar} className="w-full min-h-[44px] rounded-xl bg-[var(--primary)] text-white text-[0.875rem] font-bold cursor-pointer">Entendido</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

/**
 * El botón de instalar: un toque donde el navegador lo permite (Android con
 * Chrome, Samsung, computadora con Chrome o Edge) y «Ver cómo» donde no
 * (iPhone, Mac con Safari, dentro de Instagram).
 */
export const BotonInstalar: React.FC<{ className?: string; onInstalada?: () => void }> = ({ className = '', onInstalada }) => {
  const como = useComoInstalar();
  const [guia, setGuia] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  if (como === 'instalada') return null;
  const tocar = async () => {
    if (como !== 'directo') { setGuia(true); return; }
    setOcupado(true);
    try { if (await instalarDirecto()) onInstalada?.(); } finally { setOcupado(false); }
  };
  return (
    <>
      <button type="button" onClick={() => void tocar()} disabled={ocupado}
        className={`min-h-[44px] px-4 rounded-xl bg-[var(--primary)] text-white text-[0.875rem] font-bold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer ${className}`}>
        {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {como === 'directo' ? 'Instalar Lalan' : como === 'dentro-de-app' ? 'Cómo abrirla en el navegador' : 'Ver cómo instalarla'}
      </button>
      <GuiaInstalar abierta={guia} onCerrar={() => setGuia(false)} />
    </>
  );
};

/** La tarjeta completa (paso del teléfono en la Bienvenida, Ajustes): por qué y el botón */
export const TarjetaInstalar: React.FC<{ className?: string }> = ({ className = '' }) => {
  const como = useComoInstalar();
  const telefono = esTelefono();
  if (como === 'instalada') {
    return (
      <div className={`p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/70 dark:border-emerald-500/20 flex items-center gap-3 ${className}`}>
        <Check className="w-5 h-5 text-emerald-600 shrink-0" />
        <p className="text-[0.875rem] font-semibold text-emerald-800 dark:text-emerald-300">Lalan ya está instalada en este {telefono ? 'teléfono' : 'aparato'}.</p>
      </div>
    );
  }
  return (
    <div className={`p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-3 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shrink-0"><Smartphone className="w-5 h-5" /></div>
        <div className="min-w-0">
          <p className="text-[0.9375rem] font-bold text-slate-900 dark:text-white">{telefono ? 'Ponla en tu pantalla de inicio' : 'Instálala en esta computadora'}</p>
          <p className="text-[0.8125rem] text-slate-500 dark:text-neutral-400 leading-snug mt-0.5">
            {como === 'iphone'
              ? 'En iPhone es la única forma de que te lleguen los avisos. Se abre como cualquier app, sin buscar la página.'
              : como === 'directo'
                ? 'Un toque y queda con tus apps. Se abre a pantalla completa y te llegan los avisos.'
                : 'Queda con tus apps, se abre a pantalla completa y te llegan los avisos.'}
          </p>
        </div>
      </div>
      <BotonInstalar className="w-full" />
    </div>
  );
};
