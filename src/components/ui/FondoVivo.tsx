import React from 'react';
import { motion } from 'motion/react';

/**
 * Manchas de color que se mueven despacio: la pantalla se ve viva aunque
 * nadie la toque. Nació en el quiosco; la pantalla de Lalan lo usa como
 * fondo "Colores". Toma el color de la marca del salón (--primary).
 */
export const FondoVivo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden>
    {[
      { c: 'bg-[var(--primary)]/25', t: 'top-[-10%] left-[-10%] w-[55vw] h-[55vw]', x: [0, 60, 0], y: [0, 40, 0], d: 22 },
      { c: 'bg-rose-300/30 dark:bg-rose-500/15', t: 'bottom-[-15%] right-[-10%] w-[60vw] h-[60vw]', x: [0, -50, 0], y: [0, -30, 0], d: 26 },
      { c: 'bg-amber-200/30 dark:bg-amber-500/10', t: 'top-[30%] right-[20%] w-[35vw] h-[35vw]', x: [0, 30, 0], y: [0, 50, 0], d: 30 },
    ].map((m, i) => (
      <motion.div key={i} className={`absolute rounded-full blur-3xl ${m.c} ${m.t}`}
        animate={{ x: m.x, y: m.y }} transition={{ duration: m.d, repeat: Infinity, ease: 'easeInOut' }} />
    ))}
  </div>
);
