import type React from 'react';
import { THEME_PALETTE_PRESETS } from '../../theme/ThemeContext';
import type { DisenoVitrina } from '../../types/vitrina';

/**
 * Los colores de una Vitrina, sacados de una paleta de Lalan.
 *
 * La página pública no usa el tema de la app (el de quien mira no tiene nada
 * que ver con el del salón): aquí se arman variables propias, `--v-*`, a
 * partir de la paleta y del fondo que eligió la dueña.
 */

const CLARO = { fondo: '#FAF7F6', superficie: '#FFFFFF', texto: '#1F1A1C', suave: '#6B6266', borde: 'rgba(31,26,28,0.09)' };
const OSCURO = { fondo: '#141114', superficie: '#1E1A1E', texto: '#F5EFF2', suave: '#A99FA5', borde: 'rgba(245,239,242,0.11)' };

/** Blanco o casi negro, lo que se lea mejor encima de ese color */
function textoSobre(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const canal = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
  return lum > 0.45 ? '#1F1A1C' : '#FFFFFF';
}

export function paletaVitrina(id: string | null) {
  return THEME_PALETTE_PRESETS.find((p) => p.id === id) ?? THEME_PALETTE_PRESETS[0];
}

export function estiloVitrina(diseno: Pick<DisenoVitrina, 'paleta' | 'fondo'>): React.CSSProperties {
  const p = paletaVitrina(diseno.paleta);
  const base = diseno.fondo === 'oscuro' ? OSCURO : CLARO;
  return {
    '--v-p': p.primary,
    '--v-a': p.accent,
    '--v-t': p.tertiary,
    '--v-sobre-p': textoSobre(p.primary),
    '--v-fondo': base.fondo,
    '--v-sup': base.superficie,
    '--v-texto': base.texto,
    '--v-suave': base.suave,
    '--v-borde': base.borde,
    '--v-tinte': `color-mix(in srgb, ${p.primary} ${diseno.fondo === 'oscuro' ? 22 : 12}%, transparent)`,
    colorScheme: diseno.fondo === 'oscuro' ? 'dark' : 'light',
  } as React.CSSProperties;
}
