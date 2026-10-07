import React, { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react';

/**
 * El movimiento de las listas de Lalan: suave y con resorte, como iOS.
 *
 *  · Al abrir la pantalla las tarjetas entran en cascada (una tras otra,
 *    rápido). Después, lo que cambia —un filtro, una búsqueda, un chat que
 *    sube porque llegó un mensaje— se desliza a su sitio en vez de saltar.
 *  · Quien pidió menos movimiento en su teléfono lo tiene (MotionConfig
 *    reducedMotion="user" en App).
 */

/** El resorte de todo: rápido al salir, se asienta sin rebotar de más */
export const RESORTE = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 } as const;
/** Entre una tarjeta y la siguiente al entrar en cascada */
const PASO_CASCADA_S = 0.035;
/** Más allá de estas, entran todas a la vez (nadie espera a la tarjeta 40) */
const MAXIMO_EN_CASCADA = 10;
/** Pasado esto, la lista ya "llegó": lo nuevo entra sin cascada */
const DURACION_ENTRADA_MS = 700;

const PrimeraVez = createContext(false);

/** Una lista cuyas tarjetas entran en cascada y se reacomodan solas */
/**
 * `clave`: cuando cambia (otro día en la Agenda, otra pestaña), la lista
 * vuelve a entrar en cascada como si se abriera de nuevo.
 */
export const ListaAnimada: React.FC<{ className?: string; clave?: string; children: React.ReactNode }> = ({ className, clave, children }) => {
  const [primeraVez, setPrimeraVez] = useState(true);
  useEffect(() => {
    setPrimeraVez(true);
    const t = window.setTimeout(() => setPrimeraVez(false), DURACION_ENTRADA_MS);
    return () => window.clearTimeout(t);
  }, [clave]);
  return (
    <PrimeraVez.Provider value={primeraVez}>
      {/* El contenedor no se anima: si animara su tamaño, estiraría y aplastaría
          todas las tarjetas (el "elástico" al cambiar de filtro o al llegar
          al final y cargar más). Las tarjetas ya se acomodan solas.
          `relative`: popLayout saca las que se van con position absolute */}
      <div className={`relative ${className ?? ''}`}>
        <AnimatePresence initial mode="popLayout">{children}</AnimatePresence>
      </div>
    </PrimeraVez.Provider>
  );
};

type PropsItem = Omit<React.ComponentProps<typeof motion.div>, 'initial' | 'animate' | 'exit' | 'transition' | 'layout'> & {
  indice?: number;
  /** false para tarjetas que no se abren al tocarlas (llevan sus propios botones) */
  tocable?: boolean;
};

/**
 * Una tarjeta de la lista. Lleva `key` estable (el id): así, si sube al
 * primer lugar, se ve subir. Al tocarla se hunde un poco; en la computadora
 * se levanta al pasar el mouse.
 */
export const ItemAnimado = React.forwardRef<HTMLDivElement, PropsItem>(({ indice = 0, tocable = true, ...props }, ref) => {
  const primeraVez = useContext(PrimeraVez);
  const retraso = primeraVez ? Math.min(indice, MAXIMO_EN_CASCADA) * PASO_CASCADA_S : 0;
  return (
    <motion.div
      ref={ref}
      layout="position"
      initial={{ opacity: 0, y: primeraVez ? 14 : 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { ...RESORTE, delay: retraso } }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      {...(tocable ? { whileTap: { scale: 0.975 }, whileHover: { y: -2 } } : {})}
      transition={RESORTE}
      {...props}
    />
  );
});
ItemAnimado.displayName = 'ItemAnimado';

/**
 * Los chips de filtro (Todas · VIP · Frecuentes…): el color de la elegida
 * se desliza de un chip al otro en vez de apagarse y encenderse.
 */
export function ChipsFiltro<T extends string>({ opciones, valor, onCambio, className = '' }: {
  opciones: { id: T; label: React.ReactNode }[];
  valor: T;
  onCambio: (v: T) => void;
  className?: string;
}) {
  // Cada fila de chips con su propia pastilla: si dos compartieran nombre, saltaría de una fila a otra
  const propio = useId();
  return (
    <div className={`flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-0.5 ${className}`}>
      {opciones.map(o => {
        const elegido = valor === o.id;
        return (
          <motion.button
            key={o.id}
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => onCambio(o.id)}
            className={`relative px-3 py-1.5 rounded-full text-xs whitespace-nowrap cursor-pointer transition-colors ${
              elegido
                ? 'text-white font-bold'
                : 'font-semibold bg-white dark:bg-neutral-900 text-slate-700 dark:text-neutral-300 border border-slate-200/80 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700'
            }`}
          >
            {elegido && (
              <motion.span
                layoutId={`chip-${propio}`}
                className="absolute inset-0 rounded-full bg-[var(--primary)] shadow-sm"
                transition={RESORTE}
              />
            )}
            <span className="relative">{o.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

/**
 * Un número que cuenta hasta su valor en vez de cambiar de golpe ("20 de
 * 130", "RD$12,500"). Al cambiar de periodo en Métricas, sube o baja
 * contando. `formato` decide cómo se escribe (dinero, porcentaje…).
 */
export const NumeroAnimado: React.FC<{ valor: number; formato?: (n: number) => string; decimales?: boolean }> = ({ valor, formato, decimales }) => {
  const mv = useMotionValue(valor);
  const texto = useTransform(mv, (v) => (formato ? formato(decimales ? v : Math.round(v)) : Math.round(v).toLocaleString('es-DO')));
  const primero = useRef(true);
  useEffect(() => {
    // La primera vez cuenta desde cero (se ve "llegar" el número); después, desde el anterior
    const desde = primero.current ? 0 : mv.get();
    primero.current = false;
    mv.set(desde);
    const c = animate(mv, valor, { duration: 0.7, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [valor, mv]);
  return <motion.span>{texto}</motion.span>;
};

type PropsAparecer = Omit<React.ComponentProps<typeof motion.div>, 'initial' | 'whileInView' | 'viewport' | 'transition'> & {
  indice?: number;
  /** Se hunde un poco al tocarla (para tarjetas que abren algo) */
  tocable?: boolean;
};

/**
 * Una tarjeta o sección que sube suave al aparecer en pantalla (también al
 * bajar con el dedo: entra cuando se asoma, una sola vez).
 */
export const Aparecer = React.forwardRef<HTMLDivElement, PropsAparecer>(({ indice = 0, tocable, ...props }, ref) => (
  <motion.div
    ref={ref}
    initial={{ opacity: 0, y: 16, scale: 0.985 }}
    whileInView={{ opacity: 1, y: 0, scale: 1 }}
    viewport={{ once: true, margin: '0px 0px -24px 0px' }}
    transition={{ ...RESORTE, delay: Math.min(indice, MAXIMO_EN_CASCADA) * PASO_CASCADA_S }}
    {...(tocable ? { whileTap: { scale: 0.98 } } : {})}
    {...props}
  />
));
Aparecer.displayName = 'Aparecer';

/** El globito de "nuevo": aparece con un saltito y vuelve a saltar cuando sube la cuenta */
export const Insignia: React.FC<{ cuenta: number; className?: string; children: React.ReactNode }> = ({ cuenta, className, children }) => (
  <AnimatePresence>
    {cuenta > 0 && (
      <motion.span
        key={cuenta}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.4, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 600, damping: 18 }}
        className={className}
      >
        {children}
      </motion.span>
    )}
  </AnimatePresence>
);

/** El puntito de estado; si `late` (alguien espera), respira para llamar la atención */
export const PuntoEstado: React.FC<{ className: string; late?: boolean }> = ({ className, late }) => (
  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5">
    {late && <motion.span
      className={`absolute inset-0 rounded-full ${className}`}
      animate={{ scale: [1, 2.1], opacity: [0.55, 0] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
    />}
    <span className={`absolute inset-0 rounded-full border-2 border-white dark:border-neutral-900 ${className}`} />
  </span>
);

/** Aviso cuando la búsqueda no encuentra nada (entra suave, no de golpe) */
export const Vacio: React.FC<{ visible: boolean; children: React.ReactNode }> = ({ visible, children }) => (
  <AnimatePresence>
    {visible && (
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={RESORTE}
        className="py-8 text-center text-xs text-slate-400"
      >
        {children}
      </motion.p>
    )}
  </AnimatePresence>
);
