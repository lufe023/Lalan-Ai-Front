import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeMode, ThemePalettePreset } from '../types';

export const THEME_PALETTE_PRESETS: ThemePalettePreset[] = [
  {
    id: 'lalan_rose',
    name: 'Lalan Rose',
    subtitle: 'Rosa pastel · Lavanda · Oro',
    icon: '✨',
    primary: '#C46B7C',
    accent: '#A58FE3',
    tertiary: '#D4A853',
    popular: true,
  },
  {
    id: 'sakura',
    name: 'Sakura',
    subtitle: 'Rosa chicle · Melocotón · Champán',
    icon: '🌺',
    primary: '#F45B82',
    accent: '#F99A7A',
    tertiary: '#FCD5B5',
  },
  {
    id: 'lilas',
    name: 'Lilas',
    subtitle: 'Violeta · Periwinkle · Blush',
    icon: '💜',
    primary: '#845EC2',
    accent: '#7B90D2',
    tertiary: '#F694C1',
  },
  {
    id: 'menta_fresca',
    name: 'Menta Fresca',
    subtitle: 'Menta · Salvia · Crema',
    icon: '🌿',
    primary: '#38B2AC',
    accent: '#68D391',
    tertiary: '#9AE6B4',
  },
  {
    id: 'cielo_coral',
    name: 'Cielo Coral',
    subtitle: 'Coral · Cielo · Arena',
    icon: '🪸',
    primary: '#FF6F59',
    accent: '#43BCCD',
    tertiary: '#F8D377',
  },
  {
    id: 'medianoche',
    name: 'Medianoche',
    subtitle: 'Rosa eléctrico · Violeta neón · Oro',
    icon: '🌙',
    primary: '#FF2A7A',
    accent: '#7928CA',
    tertiary: '#F5A623',
  },
  {
    id: 'dorado_noir',
    name: 'Dorado Noir',
    subtitle: 'Oro cálido · Champán · Cobre',
    icon: '✨',
    primary: '#C69C4E',
    accent: '#B8977E',
    tertiary: '#A06535',
  },
];

// Fallback legacy individual presets
export const PRIMARY_COLOR_PRESETS = THEME_PALETTE_PRESETS.map(p => ({
  id: p.id,
  name: p.name,
  hex: p.primary,
  lightHex: p.primary + '25',
  darkHex: p.primary,
}));

export const SECONDARY_COLOR_PRESETS = THEME_PALETTE_PRESETS.map(p => ({
  id: p.id,
  name: p.name,
  hex: p.accent,
  lightHex: p.accent + '25',
  darkHex: p.accent,
}));

// Utility to lighten or darken a hex color
function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
  // 3-Color Triple System
  primaryColor: string;
  setPrimaryColor: (hex: string) => void;
  primaryLightColor: string;
  primaryDarkColor: string;
  
  accentColor: string;
  setAccentColor: (hex: string) => void;
  accentLightColor: string;
  accentDarkColor: string;
  
  tertiaryColor: string;
  setTertiaryColor: (hex: string) => void;
  tertiaryLightColor: string;
  tertiaryDarkColor: string;

  // Preset Palette management
  activePaletteId: string;
  activePalette: ThemePalettePreset;
  applyPalettePreset: (presetId: string) => void;
  isCustomPalette: boolean;

  // Legacy aliases
  secondaryColor: string;
  setSecondaryColor: (hex: string) => void;
  setPrimaryPreset: (presetId: string) => void;
  activePrimaryPreset: string;
  setSecondaryPreset: (presetId: string) => void;
  activeSecondaryPreset: string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('aura_theme_mode') as ThemeMode) || 'light';
  });

  const [activePaletteId, setActivePaletteId] = useState<string>(() => {
    const p = localStorage.getItem('aura_active_palette');
    if (!p || p === 'aura_rose') return 'lalan_rose';
    return p;
  });

  const [primaryColor, setPrimaryColorState] = useState<string>(() => {
    const saved = localStorage.getItem('aura_color_primary');
    if (saved) return saved;
    const initialPreset = THEME_PALETTE_PRESETS.find(p => p.id === activePaletteId) || THEME_PALETTE_PRESETS[0];
    return initialPreset.primary;
  });

  const [accentColor, setAccentColorState] = useState<string>(() => {
    const saved = localStorage.getItem('aura_color_accent');
    if (saved) return saved;
    const initialPreset = THEME_PALETTE_PRESETS.find(p => p.id === activePaletteId) || THEME_PALETTE_PRESETS[0];
    return initialPreset.accent;
  });

  const [tertiaryColor, setTertiaryColorState] = useState<string>(() => {
    const saved = localStorage.getItem('aura_color_tertiary');
    if (saved) return saved;
    const initialPreset = THEME_PALETTE_PRESETS.find(p => p.id === activePaletteId) || THEME_PALETTE_PRESETS[0];
    return initialPreset.tertiary;
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemIsDark);

  const activePalette = THEME_PALETTE_PRESETS.find(p => p.id === activePaletteId) || {
    id: 'custom',
    name: 'Personalizado',
    subtitle: 'Colores a medida',
    icon: '🎨',
    primary: primaryColor,
    accent: accentColor,
    tertiary: tertiaryColor,
  };

  const isCustomPalette = activePaletteId === 'custom' || !THEME_PALETTE_PRESETS.some(p => p.id === activePaletteId);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem('aura_theme_mode', mode);
  };

  const applyPalettePreset = (presetId: string) => {
    const preset = THEME_PALETTE_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setActivePaletteId(preset.id);
      setPrimaryColorState(preset.primary);
      setAccentColorState(preset.accent);
      setTertiaryColorState(preset.tertiary);
      localStorage.setItem('aura_active_palette', preset.id);
      localStorage.setItem('aura_color_primary', preset.primary);
      localStorage.setItem('aura_color_accent', preset.accent);
      localStorage.setItem('aura_color_tertiary', preset.tertiary);
    }
  };

  const setPrimaryColor = (hex: string) => {
    setPrimaryColorState(hex);
    setActivePaletteId('custom');
    localStorage.setItem('aura_active_palette', 'custom');
    localStorage.setItem('aura_color_primary', hex);
  };

  const setAccentColor = (hex: string) => {
    setAccentColorState(hex);
    setActivePaletteId('custom');
    localStorage.setItem('aura_active_palette', 'custom');
    localStorage.setItem('aura_color_accent', hex);
  };

  const setTertiaryColor = (hex: string) => {
    setTertiaryColorState(hex);
    setActivePaletteId('custom');
    localStorage.setItem('aura_active_palette', 'custom');
    localStorage.setItem('aura_color_tertiary', hex);
  };

  // Derived light and dark values
  const primaryLightColor = adjustColor(primaryColor, 65);
  const primaryDarkColor = adjustColor(primaryColor, -25);
  const accentLightColor = adjustColor(accentColor, 65);
  const accentDarkColor = adjustColor(accentColor, -25);
  const tertiaryLightColor = adjustColor(tertiaryColor, 75);
  const tertiaryDarkColor = adjustColor(tertiaryColor, -25);

  // Sync to root CSS variables and dark class
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    root.style.setProperty('--primary', primaryColor);
    root.style.setProperty('--primary-light-val', primaryLightColor);
    root.style.setProperty('--primary-dark-val', primaryDarkColor);

    root.style.setProperty('--secondary', accentColor);
    root.style.setProperty('--secondary-light-val', accentLightColor);
    root.style.setProperty('--secondary-dark-val', accentDarkColor);

    root.style.setProperty('--accent', accentColor);
    root.style.setProperty('--accent-light-val', accentLightColor);
    root.style.setProperty('--accent-dark-val', accentDarkColor);

    root.style.setProperty('--tertiary', tertiaryColor);
    root.style.setProperty('--tertiary-light-val', tertiaryLightColor);
    root.style.setProperty('--tertiary-dark-val', tertiaryDarkColor);
    
    root.style.setProperty('--primary-gradient', `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%)`);
  }, [isDark, primaryColor, accentColor, tertiaryColor, primaryLightColor, primaryDarkColor, accentLightColor, accentDarkColor, tertiaryLightColor, tertiaryDarkColor]);

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        setThemeMode,
        isDark,
        primaryColor,
        setPrimaryColor,
        primaryLightColor,
        primaryDarkColor,
        accentColor,
        setAccentColor,
        accentLightColor,
        accentDarkColor,
        tertiaryColor,
        setTertiaryColor,
        tertiaryLightColor,
        tertiaryDarkColor,
        activePaletteId,
        activePalette,
        applyPalettePreset,
        isCustomPalette,
        // Legacy compatibility
        secondaryColor: accentColor,
        setSecondaryColor: setAccentColor,
        setPrimaryPreset: applyPalettePreset,
        activePrimaryPreset: activePaletteId,
        setSecondaryPreset: applyPalettePreset,
        activeSecondaryPreset: activePaletteId,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
