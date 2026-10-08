import React, { useRef } from 'react';
import { reducirFoto } from '../../utils/reducirFoto';
import { Camera, Loader2 } from 'lucide-react';

/**
 * Las piezas que comparten los pasos de la Bienvenida. Mismo estilo que el
 * resto de la app (tarjetas blancas redondeadas, color primario del tema).
 */

export const claseCampo =
  'w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.9375rem] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';

export const Encabezado: React.FC<{ titulo: string; texto?: string }> = ({ titulo, texto }) => (
  <div className="space-y-1">
    <h2 className="text-[1.375rem] font-extrabold leading-tight text-slate-900 dark:text-white">{titulo}</h2>
    {texto && <p className="text-[0.9375rem] leading-snug text-slate-500 dark:text-neutral-400">{texto}</p>}
  </div>
);

export const Tarjeta: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`rounded-2xl bg-white/85 dark:bg-neutral-900/80 backdrop-blur-md border border-white/70 dark:border-white/10 shadow-sm p-4 ${className}`}>{children}</div>
);

export const Etiqueta: React.FC<{ texto: string; children: React.ReactNode }> = ({ texto, children }) => (
  <label className="block space-y-1.5">
    <span className="text-[0.8125rem] font-semibold text-slate-600 dark:text-neutral-300">{texto}</span>
    {children}
  </label>
);

export const BotonPrincipal: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { cargando?: boolean }> = ({ cargando, children, className = '', disabled, ...resto }) => (
  <button
    type="button"
    {...resto}
    disabled={disabled || cargando}
    className={`py-3 px-5 rounded-xl bg-[var(--primary)] text-white font-bold text-[0.9375rem] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.98] transition-transform ${className}`}
  >
    {cargando && <Loader2 className="w-4 h-4 animate-spin" />}
    {children}
  </button>
);

export const BotonSecundario: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, className = '', ...resto }) => (
  <button
    type="button"
    {...resto}
    className={`py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 font-semibold text-[0.875rem] flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer ${className}`}
  >
    {children}
  </button>
);

/** Un botón que abre la cámara (en el teléfono) o el selector de fotos */
export const BotonFoto: React.FC<{ texto: string; cargando?: boolean; onFotos: (fotos: File[]) => void }> = ({ texto, cargando, onFotos }) => {
  const entrada = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={entrada}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          const fotos = Array.from(e.target.files ?? []).slice(0, 3);
          e.target.value = '';
          // Reducidas a 1600 px antes de subir: suben al momento y la IA responde antes
          if (fotos.length) void Promise.all(fotos.map(reducirFoto)).then(onFotos);
        }}
      />
      <BotonSecundario disabled={cargando} onClick={() => entrada.current?.click()} className="w-full">
        {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
        {cargando ? 'Leyendo la foto…' : texto}
      </BotonSecundario>
    </>
  );
};

export const Aviso: React.FC<{ tipo?: 'error' | 'info'; children: React.ReactNode }> = ({ tipo = 'info', children }) => (
  <div
    role={tipo === 'error' ? 'alert' : 'status'}
    className={`rounded-xl px-3.5 py-2.5 text-[0.8125rem] font-medium leading-snug ${
      tipo === 'error'
        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200'
        : 'bg-[var(--primary)]/10 text-slate-700 dark:text-neutral-200'
    }`}
  >
    {children}
  </div>
);

export const Cargando: React.FC = () => (
  <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" /></div>
);

/** "1500" → "1,500" para mostrar; al guardar se manda el número */
export const dinero = (n: number) => n.toLocaleString('es-DO', { maximumFractionDigits: 2 });

/** Un número escrito a mano ("1,500" o "1500") o null si no es número */
export function leerNumero(texto: string): number | null {
  const limpio = texto.replace(/[^\d.]/g, '');
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** Los envases que se dicen con "una" (igual que el servidor) */
const ENVASES_FEMENINOS = new Set(['bolsa', 'botella', 'caja', 'lata', 'bandeja']);
/** "frasco de 15 ml" → "Un frasco de 15 ml"; "bolsa de 200 g" → "Una bolsa de 200 g" */
export const conArticulo = (presentacion: string) => `${ENVASES_FEMENINOS.has(presentacion.split(' ')[0]) ? 'Una' : 'Un'} ${presentacion}`;
