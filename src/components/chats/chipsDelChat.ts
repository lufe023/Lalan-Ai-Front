/** Las herramientas del chat que se abren desde la fila de chips de arriba */
export type HerramientaDelChat = 'ficha' | 'especialista' | 'turno' | 'bloquear';

/** Un chip de la fila de herramientas: pequeño, pero con texto, para que se vea qué hay */
export const CHIP_CHAT = 'shrink-0 h-8 px-3 rounded-full text-[0.75rem] font-bold flex items-center gap-1.5 border whitespace-nowrap transition cursor-pointer ios-touch';
export const CHIP_NEUTRO = 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-300 hover:border-slate-300 dark:hover:border-neutral-700';
export const CHIP_VIOLETA = 'bg-violet-50 dark:bg-violet-950/50 border-violet-200 dark:border-violet-900 text-violet-700 dark:text-violet-300';
export const CHIP_AMBAR = 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200';
/** El chip cuya herramienta está abierta */
export const CHIP_ABIERTO = 'bg-slate-800 border-slate-800 text-white dark:bg-white dark:border-white dark:text-slate-900';
