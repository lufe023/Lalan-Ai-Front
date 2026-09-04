import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Palette, X, Check, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useTheme, THEME_PALETTE_PRESETS } from '../../theme/ThemeContext';
import { ThemePalettePreset } from '../../types';

interface ThemeCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeCustomizerModal: React.FC<ThemeCustomizerModalProps> = ({ isOpen, onClose }) => {
  const {
    activePaletteId,
    applyPalettePreset,
    primaryColor,
    setPrimaryColor,
    accentColor,
    setAccentColor,
    tertiaryColor,
    setTertiaryColor,
    isCustomPalette,
  } = useTheme();

  const [showCustomPickers, setShowCustomPickers] = useState(isCustomPalette);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        />

        {/* Modal / iOS Bottom Sheet */}
        <motion.div
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-t-[32px] sm:rounded-[32px] bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xl z-10 overflow-hidden"
        >
          {/* iOS Sheet Handle indicator */}
          <div className="pt-3 pb-1 flex justify-center shrink-0">
            <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-neutral-700" />
          </div>

          {/* Header */}
          <div className="px-5 pt-2 pb-3.5 flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-[var(--primary)] flex items-center justify-center shadow-xs">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Personalizar Tema
                </h2>
                <p className="text-xs text-slate-500 dark:text-neutral-400">
                  Elige tu paleta de colores
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-500 dark:text-neutral-400 flex items-center justify-center transition ios-touch cursor-pointer"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto hide-scrollbar px-5 py-3.5 space-y-3.5">
            {/* Legend Bar: Primario, Acento, Terciario */}
            <div className="px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-neutral-800/80 border border-slate-200/60 dark:border-neutral-700/60 flex items-center gap-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full shadow-xs"
                  style={{ backgroundColor: primaryColor }}
                />
                <span className="text-[11px] font-bold">Primario</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full shadow-xs"
                  style={{ backgroundColor: accentColor }}
                />
                <span className="text-[11px] font-bold">Acento</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full shadow-xs"
                  style={{ backgroundColor: tertiaryColor }}
                />
                <span className="text-[11px] font-bold">Terciario</span>
              </div>
            </div>

            {/* Palette Cards List */}
            <div className="space-y-3">
              {THEME_PALETTE_PRESETS.map((preset: ThemePalettePreset) => {
                const isSelected = activePaletteId === preset.id;

                return (
                  <div
                    key={preset.id}
                    onClick={() => applyPalettePreset(preset.id)}
                    className={`group relative rounded-2xl p-3 border transition-all duration-200 ios-touch cursor-pointer ${
                      isSelected
                        ? 'bg-slate-50/90 dark:bg-neutral-800/90 shadow-md ring-2 ring-[var(--primary)]/30'
                        : 'bg-white dark:bg-neutral-900 border-slate-200/80 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700'
                    }`}
                    style={{
                      borderColor: isSelected ? preset.primary : undefined,
                    }}
                  >
                    {/* Mini UI Mockup Preview Box */}
                    <div
                      className="w-full rounded-xl p-2.5 mb-2.5 transition-all flex flex-col gap-1.5 border"
                      style={{
                        background: `linear-gradient(135deg, ${preset.primary}12 0%, ${preset.accent}12 50%, ${preset.tertiary}15 100%)`,
                        borderColor: isSelected ? `${preset.primary}40` : `${preset.primary}20`,
                      }}
                    >
                      {/* Top Preview Bar */}
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shadow-xs shrink-0"
                          style={{ backgroundColor: preset.primary }}
                        />
                        <div className="flex-1 h-2 rounded-full bg-white/80 dark:bg-black/40 border border-black/5 dark:border-white/5" />
                        <div
                          className="w-6 h-2 rounded-full shadow-xs shrink-0"
                          style={{ backgroundColor: preset.primary }}
                        />
                      </div>

                      {/* Bottom Preview Sub-bar */}
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full shadow-xs shrink-0"
                          style={{ backgroundColor: preset.primary }}
                        />
                        <div className="flex-1 h-2 rounded-full bg-white/80 dark:bg-black/40 border border-black/5 dark:border-white/5" />
                        <div
                          className="w-2 h-2 rounded-full shadow-xs shrink-0"
                          style={{ backgroundColor: preset.accent }}
                        />
                        <div className="flex-1 h-2 rounded-full bg-white/80 dark:bg-black/40 border border-black/5 dark:border-white/5" />
                      </div>
                    </div>

                    {/* Bottom Info Row */}
                    <div className="flex items-center justify-between">
                      {/* Left: Icon, Name & Subtitle */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xl shrink-0 select-none">
                          {preset.icon}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                            <span>{preset.name}</span>
                            {preset.popular && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-500">
                                Popular
                              </span>
                            )}
                          </h4>
                          <p className="text-[10px] text-slate-500 dark:text-neutral-400 truncate">
                            {preset.subtitle}
                          </p>
                        </div>
                      </div>

                      {/* Right: 3 Swatch Dots & Active Checkmark */}
                      <div className="flex items-center gap-1.5 shrink-0 pl-2">
                        {/* Dot 1: Primario */}
                        <span
                          className="w-4 h-4 rounded-full shadow-xs border border-white/50 dark:border-black/50"
                          style={{ backgroundColor: preset.primary }}
                          title="Primario"
                        />
                        {/* Dot 2: Acento */}
                        <span
                          className="w-4 h-4 rounded-full shadow-xs border border-white/50 dark:border-black/50"
                          style={{ backgroundColor: preset.accent }}
                          title="Acento"
                        />
                        {/* Dot 3: Terciario */}
                        <span
                          className="w-4 h-4 rounded-full shadow-xs border border-white/50 dark:border-black/50"
                          style={{ backgroundColor: preset.tertiary }}
                          title="Terciario"
                        />

                        {/* Checkmark badge */}
                        {isSelected && (
                          <div
                            className="w-4.5 h-4.5 rounded-full flex items-center justify-center text-white shadow-xs ml-0.5"
                            style={{ backgroundColor: preset.primary }}
                          >
                            <Check className="w-2.5 h-2.5 stroke-[3.5]" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom 3-Color Pickers Toggle Section */}
            <div className="pt-2 border-t border-slate-200/60 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setShowCustomPickers(!showCustomPickers)}
                className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-neutral-800/80 hover:bg-slate-200 dark:hover:bg-neutral-700/80 text-slate-700 dark:text-neutral-200 flex items-center justify-between text-xs font-bold transition ios-touch cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>Personalizar Colores Manualmente (HEX)</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {showCustomPickers ? 'Ocultar' : 'Ajustar 3 Tonos'}
                </span>
              </button>

              {showCustomPickers && (
                <div className="mt-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-neutral-800/50 border border-slate-200/80 dark:border-neutral-700/80 space-y-3">
                  {/* Primario Picker */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Color Primario
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-neutral-400">
                        Botones principales y elementos destacados
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-500 uppercase">
                        {primaryColor}
                      </span>
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={e => setPrimaryColor(e.target.value)}
                        className="w-7 h-7 rounded-xl border-0 cursor-pointer p-0 bg-transparent"
                      />
                    </div>
                  </div>

                  {/* Acento Picker */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Color Acento / Secundario
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-neutral-400">
                        Insignias, etiquetas y tonos complementarios
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-500 uppercase">
                        {accentColor}
                      </span>
                      <input
                        type="color"
                        value={accentColor}
                        onChange={e => setAccentColor(e.target.value)}
                        className="w-7 h-7 rounded-xl border-0 cursor-pointer p-0 bg-transparent"
                      />
                    </div>
                  </div>

                  {/* Terciario Picker */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Color Terciario / Tono Fondo
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-neutral-400">
                        Brillos suaves, luces y detalles sutiles
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-500 uppercase">
                        {tertiaryColor}
                      </span>
                      <input
                        type="color"
                        value={tertiaryColor}
                        onChange={e => setTertiaryColor(e.target.value)}
                        className="w-7 h-7 rounded-xl border-0 cursor-pointer p-0 bg-transparent"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Instant application footer note */}
            <div className="py-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-neutral-400 text-center font-medium">
              <span>Los cambios se aplican al instante</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
