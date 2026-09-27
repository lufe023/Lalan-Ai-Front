import React from 'react';

/**
 * El símbolo de Lalan: una L y su eco detrás. Toma el color del texto
 * (currentColor); el eco va un poco más suave. Para ponerlo sobre el color
 * de la marca, dale `text-white`.
 */
export const LogoLalan: React.FC<{ className?: string; titulo?: string }> = ({ className = 'w-5 h-5', titulo }) => (
  <svg viewBox="0 0 120 120" className={className} role={titulo ? 'img' : undefined} aria-hidden={titulo ? undefined : true} aria-label={titulo} focusable="false">
    <path d="M52 18V74H94" fill="none" stroke="currentColor" strokeOpacity={0.62} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M30 42V98H72" fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
