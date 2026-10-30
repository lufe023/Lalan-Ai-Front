import React, { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';

/**
 * La factura que la dueña acaba de pasar, con una luz que la recorre
 * mientras Lalan la lee: se ve que está leyendo SU factura, no una rueda
 * que da vueltas. De un PDF se muestra la primera página.
 */

const ANCHO_MINIATURA = 360;

/** La primera página del PDF como imagen. pdf.js se carga solo aquí, cuando hace falta */
async function primeraPagina(archivo: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const { default: trabajador } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = trabajador;
  const doc = await pdfjs.getDocument({ data: await archivo.arrayBuffer() }).promise;
  try {
    const pagina = await doc.getPage(1);
    const base = pagina.getViewport({ scale: 1 });
    const vista = pagina.getViewport({ scale: (ANCHO_MINIATURA * 2) / base.width });
    const lienzo = document.createElement('canvas');
    lienzo.width = vista.width; lienzo.height = vista.height;
    const ctx = lienzo.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    await pagina.render({ canvasContext: ctx, viewport: vista }).promise;
    return lienzo.toDataURL('image/jpeg', 0.85);
  } finally { doc.destroy(); }
}

export const EscaneoFactura: React.FC<{ archivos: File[] }> = ({ archivos }) => {
  const primero = archivos[0];
  const [miniatura, setMiniatura] = useState<string | null>(null);

  useEffect(() => {
    if (!primero) return;
    let vivo = true;
    let url: string | null = null;
    setMiniatura(null);
    if (primero.type.startsWith('image/')) {
      url = URL.createObjectURL(primero);
      setMiniatura(url);
    } else if (primero.type === 'application/pdf' || /\.pdf$/i.test(primero.name)) {
      // Si no se puede dibujar, queda la hoja de muestra: la lectura sigue igual
      primeraPagina(primero).then((m) => { if (vivo) setMiniatura(m); }).catch(() => {});
    }
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [primero]);

  return (
    <div className="relative mx-auto w-full" style={{ maxWidth: 220 }}>
      {/* Las otras páginas, detrás */}
      {archivos.length > 1 && <div className="absolute inset-0 translate-x-2 translate-y-2 rotate-2 rounded-xl bg-white/70 dark:bg-neutral-700/60 border border-slate-200 dark:border-neutral-600" />}
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-white border border-slate-200 dark:border-neutral-600 shadow-lg">
        {miniatura ? (
          <img src={miniatura} alt={`Factura: ${primero?.name ?? ''}`} className="w-full h-full object-cover object-top" />
        ) : (
          // Hoja de muestra mientras se dibuja la miniatura (o si no se puede)
          <div className="w-full h-full p-4 flex flex-col gap-2" aria-label={primero?.name}>
            <FileText className="w-6 h-6 text-slate-300" />
            {[80, 55, 70, 40, 90, 65, 85, 50, 75].map((w, i) => <div key={i} className="h-2 rounded bg-slate-200" style={{ width: `${w}%` }} />)}
          </div>
        )}
        {/* La luz que la recorre */}
        <div className="escanear-luz pointer-events-none absolute inset-x-0 h-16 motion-reduce:hidden" aria-hidden>
          <div className="h-full bg-gradient-to-b from-transparent via-violet-500/25 to-violet-500/45" />
          <div className="h-0.5 bg-violet-500 shadow-[0_0_14px_3px_rgba(139,92,246,0.8)]" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-violet-500/5" aria-hidden />
      </div>
      {archivos.length > 1 && (
        <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-violet-600 text-white text-[0.6875rem] font-bold shadow">{archivos.length} páginas</span>
      )}
    </div>
  );
};
