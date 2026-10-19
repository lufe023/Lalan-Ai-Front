import React, { useRef } from 'react';
import { Maximize, Move, ZoomIn } from 'lucide-react';

/**
 * Cómo se acomoda una foto en su recuadro, como al poner una foto de perfil:
 * qué punto queda a la vista (x, y en %), cuánto se acerca (zoom en %) y si
 * se ve completa, con el resto del recuadro relleno con la misma foto
 * difuminada. Lo guarda el servidor con la foto (`catalogo/fotos/:id/encuadre`),
 * así se ve igual en la lista, en la ficha y en la Vitrina.
 */
export interface Encuadre {
  x: number;
  y: number;
  zoom: number;
  completa: boolean;
}

export const ENCUADRE_NORMAL: Encuadre = { x: 50, y: 50, zoom: 100, completa: false };
/** Lo mismo que acepta el servidor */
export const ZOOM_MAXIMO = 300;

export const esNormal = (e?: Encuadre | null) =>
  !e || (e.x === 50 && e.y === 50 && e.zoom === 100 && !e.completa);

/** El estilo del <img> para ese encuadre. Acerca alrededor del punto elegido, así ese punto no se mueve */
export function estiloEncuadre(e?: Encuadre | null): React.CSSProperties {
  const { x, y, zoom, completa } = e ?? ENCUADRE_NORMAL;
  return {
    objectFit: completa ? 'contain' : 'cover',
    objectPosition: `${x}% ${y}%`,
    ...(zoom !== 100 ? { transform: `scale(${zoom / 100})`, transformOrigin: `${x}% ${y}%` } : {}),
  };
}

/**
 * Una foto que llena su caja con su encuadre. Va dentro de una caja con
 * tamaño (y `relative`); recorta lo que se sale. Completa, detrás va la
 * misma foto difuminada para que no queden franjas vacías.
 */
export const FotoEncuadrada: React.FC<{
  src: string;
  alt: string;
  encuadre?: Encuadre | null;
  className?: string;
  loading?: 'lazy' | 'eager';
  onError?: () => void;
}> = ({ src, alt, encuadre, className = '', loading = 'lazy', onError }) => (
  <span className={`absolute inset-0 block overflow-hidden ${className}`}>
    {encuadre?.completa && (
      <img src={src} alt="" aria-hidden loading={loading} draggable={false} className="absolute inset-0 size-full scale-110 object-cover opacity-70 blur-xl pointer-events-none" />
    )}
    <img src={src} alt={alt} loading={loading} draggable={false} onError={onError} className="absolute inset-0 size-full pointer-events-none" style={estiloEncuadre(encuadre)} />
  </span>
);

/**
 * Los controles para acomodar una foto: se arrastra sobre la foto (en
 * cualquier dirección) y se ajusta con las barras: de lado a lado, de arriba
 * a abajo y el zoom. «Llenar» o «Completa» decide si se recorta para llenar
 * el recuadro o se ve entera. Cada cambio llega al momento a quien lo usa,
 * que lo pinta en su vista previa.
 */
export const AjustesDeEncuadre: React.FC<{
  encuadre: Encuadre;
  cambiar: (e: Encuadre) => void;
}> = ({ encuadre, cambiar }) => {
  const e = encuadre;
  const barra = (titulo: string, desde: string, hasta: string, valor: number, min: number, max: number, poner: (v: number) => void) => (
    <label className="flex items-center gap-2 text-[0.6875rem] text-slate-500 dark:text-neutral-400">
      <span className="w-[4.5rem] shrink-0 font-semibold text-slate-600 dark:text-neutral-300">{titulo}</span>
      <span className="w-10 shrink-0 text-right">{desde}</span>
      <input type="range" min={min} max={max} value={valor} onChange={(ev) => poner(Number(ev.target.value))} className="flex-1 min-w-0 accent-[var(--primary)]" aria-label={titulo} />
      <span className="w-10 shrink-0">{hasta}</span>
    </label>
  );
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Cómo llena el recuadro">
        {([
          [false, 'Llenar', 'Recorta para llenar el recuadro', ZoomIn],
          [true, 'Completa', 'Se ve entera, con relleno a los lados', Maximize],
        ] as const).map(([valor, titulo, ayuda, Icono]) => (
          <button key={titulo} type="button" role="radio" aria-checked={e.completa === valor} onClick={() => cambiar({ ...e, completa: valor })}
            className={`flex items-start gap-2 p-2 rounded-xl border text-left transition cursor-pointer ${e.completa === valor ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-slate-200 dark:border-neutral-700'}`}>
            <Icono className={`w-4 h-4 mt-0.5 shrink-0 ${e.completa === valor ? 'text-[var(--primary)]' : 'text-slate-400'}`} />
            <span className="min-w-0">
              <span className={`block text-[0.75rem] font-semibold ${e.completa === valor ? 'text-[var(--primary)]' : 'text-slate-700 dark:text-neutral-200'}`}>{titulo}</span>
              <span className="block text-[0.625rem] text-slate-400 leading-tight">{ayuda}</span>
            </span>
          </button>
        ))}
      </div>
      {barra('Zoom', '1×', `${ZOOM_MAXIMO / 100}×`, e.zoom, 100, ZOOM_MAXIMO, (zoom) => cambiar({ ...e, zoom }))}
      {barra('Horizontal', 'Izq.', 'Der.', e.x, 0, 100, (x) => cambiar({ ...e, x }))}
      {barra('Vertical', 'Arriba', 'Abajo', e.y, 0, 100, (y) => cambiar({ ...e, y }))}
    </div>
  );
};

/**
 * Arrastrar sobre la foto para moverla, como una foto de perfil: hacia abajo
 * muestra lo de arriba, hacia la derecha lo de la izquierda. Con zoom se
 * mueve más despacio, porque se ve menos foto.
 */
export function useArrastrarEncuadre(encuadre: Encuadre | null, cambiar: (e: Encuadre) => void) {
  const inicio = useRef<{ px: number; py: number; e: Encuadre } | null>(null);
  if (!encuadre) return {};
  return {
    onPointerDown: (ev: React.PointerEvent<HTMLElement>) => {
      (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
      inicio.current = { px: ev.clientX, py: ev.clientY, e: encuadre };
    },
    onPointerMove: (ev: React.PointerEvent<HTMLElement>) => {
      const i = inicio.current;
      if (!i) return;
      const caja = ev.currentTarget.getBoundingClientRect();
      const lento = i.e.zoom / 100;
      const dx = ((ev.clientX - i.px) / Math.max(caja.width, 1)) * 100 / lento;
      const dy = ((ev.clientY - i.py) / Math.max(caja.height, 1)) * 100 / lento;
      const dentro = (v: number) => Math.round(Math.min(100, Math.max(0, v)));
      cambiar({ ...i.e, x: dentro(i.e.x - dx), y: dentro(i.e.y - dy) });
    },
    onPointerUp: () => { inicio.current = null; },
    onPointerCancel: () => { inicio.current = null; },
  };
}

/** Las clases de la caja que se arrastra */
export const CAJA_ARRASTRABLE = 'cursor-grab active:cursor-grabbing touch-none select-none';

/** Sobre la foto, mientras se acomoda: invita a arrastrarla */
export const EtiquetaArrastrar: React.FC = () => (
  <span className="absolute left-2 bottom-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/55 text-white text-[0.6875rem] font-semibold pointer-events-none">
    <Move className="w-3 h-3" /> Arrastra para acomodarla
  </span>
);
