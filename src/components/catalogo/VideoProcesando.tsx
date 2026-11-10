import React, { useEffect, useState } from 'react';
import { Film, Instagram, Sparkles } from 'lucide-react';

export interface VistaVideo {
  tipo: 'archivo' | 'youtube' | 'instagram';
  /** Archivo: un object URL del video. YouTube: la miniatura pública. Instagram: nada (se pinta un cuadro) */
  url?: string;
}

/** La miniatura de YouTube sale directa del enlace, sin pedirle nada al servidor */
export const miniaturaDeYoutube = (enlace: string): string | undefined => {
  const m = enlace.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
  return m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : undefined;
};

const PASOS = ['Mirando las escenas', 'Escuchando lo que se dice', 'Sacando lo importante', 'Escribiéndolo a su manera'];

/**
 * Mientras Lalán ve un video: la miniatura con una luz que la recorre y los
 * pasos que va dando, para que la dueña vea que algo está pasando.
 */
export const VideoProcesando: React.FC<{ vista: VistaVideo }> = ({ vista }) => {
  const [paso, setPaso] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPaso(p => (p + 1) % PASOS.length), 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex items-center gap-3 py-0.5">
      <style>{`
        @keyframes lalan-escaneo { 0% { transform: translateY(-100%); } 100% { transform: translateY(260%); } }
        @keyframes lalan-barra { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }
        @keyframes lalan-paso { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .lalan-anima { animation: none !important; } }
      `}</style>
      <div className="relative w-24 h-16 shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-purple-500 via-fuchsia-500 to-amber-400 shadow-md ring-1 ring-purple-300/60 dark:ring-purple-800">
        {vista.tipo === 'archivo' && vista.url ? (
          <video src={vista.url} muted autoPlay loop playsInline className="w-full h-full object-cover" />
        ) : vista.tipo === 'youtube' && vista.url ? (
          <img src={vista.url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/90">
            {vista.tipo === 'instagram' ? <Instagram className="w-7 h-7" /> : <Film className="w-7 h-7" />}
          </div>
        )}
        {/* La luz que recorre el video */}
        <div className="lalan-anima absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-transparent via-white/55 to-transparent"
          style={{ animation: 'lalan-escaneo 1.8s ease-in-out infinite' }} />
        <div className="absolute inset-0 bg-purple-900/15" />
        <Sparkles className="lalan-anima absolute top-1 right-1 w-3.5 h-3.5 text-white drop-shadow animate-pulse" />
      </div>
      <div className="flex-1 min-w-0">
        <p key={paso} className="lalan-anima text-[0.75rem] font-semibold text-purple-700 dark:text-purple-300"
          style={{ animation: 'lalan-paso 0.35s ease-out' }}>
          {PASOS[paso]}…
        </p>
        <div className="mt-1.5 h-1 rounded-full bg-purple-200/70 dark:bg-purple-900/60 overflow-hidden">
          <div className="lalan-anima h-full w-2/5 rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500"
            style={{ animation: 'lalan-barra 1.4s ease-in-out infinite' }} />
        </div>
        <p className="mt-1 text-[0.625rem] text-slate-500 dark:text-neutral-400">Puede tardar un minuto.</p>
      </div>
    </div>
  );
};
