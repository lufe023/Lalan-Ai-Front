import React from 'react';

/**
 * Una sección dentro de una hoja (IOSModal) o de una pantalla de ajustes.
 *
 * Antes cada sección era un iconito, un título chico y una raya fina: al bajar
 * de "Información del producto" a "Receta" la dueña no se enteraba de que ya
 * estaba en otra parte. Ahora cada sección es su propia tarjeta con una franja
 * de color arriba, y esa franja se queda pegada arriba mientras recorres la
 * sección: siempre se ve en qué parte estás.
 *
 * Se ve igual en claro y en oscuro (el tinte sale del color de la sección
 * mezclado con el fondo), en el teléfono y en la computadora.
 *
 * La franja se pega justo debajo del encabezado de la hoja: sube lo mismo que
 * el relleno de la hoja (p-5). Fuera de una hoja, cambia `--hoja-relleno`.
 */
export type ColorSeccion = 'primario' | 'verde' | 'ambar' | 'azul' | 'violeta' | 'rojo' | 'gris';

const COLOR: Record<ColorSeccion, string> = {
  primario: 'var(--primary)',
  verde: '#10b981',
  ambar: '#f59e0b',
  azul: '#0ea5e9',
  violeta: '#8b5cf6',
  rojo: '#f43f5e',
  gris: '#64748b',
};

interface Props {
  /** Ícono de lucide (o un emoji) */
  icono: React.ReactNode;
  titulo: React.ReactNode;
  /** Una línea que dice qué hay en la sección ("Lo que sale del inventario al servirla") */
  detalle?: React.ReactNode;
  color?: ColorSeccion;
  /** Botón o etiqueta a la derecha del título */
  accion?: React.ReactNode;
  /** Su lugar en la hoja: entra en cascada detrás de la anterior */
  indice?: number;
  /** La franja no se pega arriba (secciones muy cortas o hojas sin desplazamiento) */
  sinPegar?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const SeccionHoja: React.FC<Props> = ({
  icono, titulo, detalle, color = 'primario', accion, indice = 0, sinPegar = false, className = '', children,
}) => (
  <section
    className={`seccion-hoja entrar-suave rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ${className}`}
    style={{ '--seccion': COLOR[color], animationDelay: `${Math.min(indice, 8) * 45}ms` } as React.CSSProperties}
  >
    <header
      className={`${sinPegar ? 'relative' : 'sticky top-[calc(-1*var(--hoja-relleno,1.25rem))] z-[5]'} flex items-center gap-3 px-4 py-3 rounded-t-2xl border-b
        bg-[color-mix(in_srgb,var(--seccion)_9%,white)] dark:bg-[color-mix(in_srgb,var(--seccion)_16%,#171717)]
        border-[color-mix(in_srgb,var(--seccion)_22%,white)] dark:border-[color-mix(in_srgb,var(--seccion)_30%,#171717)]`}
    >
      <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-[var(--seccion)]" aria-hidden />
      <span className="w-8 h-8 shrink-0 rounded-xl flex items-center justify-center text-base leading-none text-[var(--seccion)] bg-white/80 dark:bg-black/25 shadow-[0_1px_2px_rgba(15,23,42,0.08)] [&>svg]:w-4 [&>svg]:h-4">
        {icono}
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="text-[0.9375rem] font-bold leading-tight text-slate-900 dark:text-white">{titulo}</h4>
        {detalle && <p className="text-[0.6875rem] leading-snug text-slate-500 dark:text-neutral-400 mt-0.5">{detalle}</p>}
      </div>
      {accion && <div className="shrink-0">{accion}</div>}
    </header>
    <div className="p-4 space-y-3">{children}</div>
  </section>
);
