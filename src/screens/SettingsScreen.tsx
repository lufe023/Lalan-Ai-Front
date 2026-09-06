import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Palette,
  Sun,
  Moon,
  Laptop,
  MessageSquare,
  Clock,
  MapPin,
  Phone,
  Shield,
  RotateCcw,
  LogOut,
  Terminal,
  Sparkles,
  Check,
  Building,
  Save,
  SlidersHorizontal,
} from 'lucide-react';
import { useTheme, THEME_PALETTE_PRESETS } from '../theme/ThemeContext';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { CommunicationChannel, ThemeMode, UserRole, ThemePalettePreset } from '../types';
import { IOSHeader } from '../components/ui/IOSHeader';
import { IOSSegmentedControl } from '../components/ui/IOSSegmentedControl';
import { IOSModal } from '../components/ui/IOSModal';
import { ThemeCustomizerModal } from '../components/ui/ThemeCustomizerModal';
import { PageContent } from '../components/ui/PageContent';

export const SettingsScreen: React.FC = () => {
  const {
    themeMode,
    setThemeMode,
    activePaletteId,
    applyPalettePreset,
    primaryColor,
    setPrimaryColor,
    accentColor,
    setAccentColor,
    tertiaryColor,
    setTertiaryColor,
    isCustomPalette,
    isDark,
  } = useTheme();

  const {
    settings,
    updateSettings,
    botConfigs,
    updateBotMessage,
    systemLogs,
    triggerSplash,
    showToast,
  } = useApp();

  const { currentUser, logout } = useAuth();

  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showCustomPickers, setShowCustomPickers] = useState(isCustomPalette);

  // Welcome message editing channel selector
  const [activeMessageChannel, setActiveMessageChannel] = useState<CommunicationChannel>('whatsapp');
  const [welcomeText, setWelcomeText] = useState(() => {
    return botConfigs.find(b => b.id === 'whatsapp')?.welcomeMessage || '';
  });
  const [offHoursText, setOffHoursText] = useState(() => {
    return botConfigs.find(b => b.id === 'whatsapp')?.offHoursMessage || '';
  });

  const [showLogsModal, setShowLogsModal] = useState(false);

  // Business Parameters State
  const [salonName, setSalonName] = useState(settings.salonName);
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
  const [openingTime, setOpeningTime] = useState(settings.openingTime);
  const [closingTime, setClosingTime] = useState(settings.closingTime);
  const [bufferTimeMinutes, setBufferTimeMinutes] = useState(settings.bufferTimeMinutes);
  const [defaultAppointmentDurationMinutes, setDefaultAppointmentDurationMinutes] = useState(
    settings.defaultAppointmentDurationMinutes
  );
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(settings.gracePeriodMinutes);
  const [depositPercent, setDepositPercent] = useState(settings.depositPercent);

  const handleChannelChange = (channelId: CommunicationChannel) => {
    setActiveMessageChannel(channelId);
    const cfg = botConfigs.find(b => b.id === channelId);
    if (cfg) {
      setWelcomeText(cfg.welcomeMessage);
      setOffHoursText(cfg.offHoursMessage);
    }
  };

  const handleSaveWelcomeMessages = () => {
    updateBotMessage(activeMessageChannel, 'welcomeMessage', welcomeText);
    updateBotMessage(activeMessageChannel, 'offHoursMessage', offHoursText);
  };

  const handleSaveSalonSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      salonName,
      address,
      phone,
      openingTime,
      closingTime,
      bufferTimeMinutes,
      defaultAppointmentDurationMinutes,
      gracePeriodMinutes,
      depositPercent,
    });
  };

  return (
    <div id="settings-screen" className="flex-1 w-full h-full flex flex-col overflow-hidden">
      <IOSHeader
        title="Configuración"
        subtitle="Temas, colores de marca, mensajes automatizados y perfil"
      />

      <PageContent className="space-y-4 text-xs select-none">
        {/* SECTION 1: THEME & COLOR CUSTOMIZATION (MANDATORY REQUIREMENT) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-[var(--primary)] flex items-center justify-center">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  Personalización de Tema & 3 Colores
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-neutral-400">
                  Primario · Acento / Secundario · Terciario
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowThemeModal(true)}
              className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white font-bold text-[10px] flex items-center gap-1 shadow-xs ios-touch cursor-pointer hover:opacity-90"
            >
              <Sparkles className="w-3 h-3" />
              <span>Ver Paletas</span>
            </button>
          </div>

          {/* Theme Mode Selector (Claro / Oscuro / Sistema) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-neutral-400 mb-1.5">
              Modo de Pantalla
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'light', label: 'Modo Claro', icon: <Sun className="w-3.5 h-3.5" /> },
                { id: 'dark', label: 'Modo Oscuro', icon: <Moon className="w-3.5 h-3.5" /> },
                { id: 'system', label: 'Automático', icon: <Laptop className="w-3.5 h-3.5" /> },
              ].map(m => {
                const isSelected = themeMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setThemeMode(m.id as ThemeMode)}
                    className={`py-2 rounded-xl flex items-center justify-center gap-1.5 font-bold transition ios-touch cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--primary)] text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 hover:bg-slate-200'
                    }`}
                  >
                    {m.icon}
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3-Color Legend and Quick Active Preview */}
          <div className="px-3.5 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-neutral-800/80 border border-slate-200/60 dark:border-neutral-700/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full shadow-xs"
                  style={{ backgroundColor: primaryColor }}
                />
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Primario</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full shadow-xs"
                  style={{ backgroundColor: accentColor }}
                />
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Acento</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full shadow-xs"
                  style={{ backgroundColor: tertiaryColor }}
                />
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Terciario</span>
              </div>
            </div>

            <button
              onClick={() => setShowCustomPickers(!showCustomPickers)}
              className="text-[10px] font-bold text-[var(--primary)] hover:underline flex items-center gap-1"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>{showCustomPickers ? 'Ocultar HEX' : 'Editar HEX'}</span>
            </button>
          </div>

          {/* Custom HEX Pickers (Optional expand) */}
          {showCustomPickers && (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/50 border border-slate-200/80 dark:border-neutral-700/80 grid grid-cols-3 gap-2">
              <div className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200/60 dark:border-neutral-800 text-center">
                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Primario
                </label>
                <div className="flex items-center justify-center gap-1.5">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="w-5 h-5 rounded-full border-0 cursor-pointer p-0 bg-transparent"
                  />
                  <span className="text-[10px] font-mono uppercase text-slate-500">
                    {primaryColor}
                  </span>
                </div>
              </div>

              <div className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200/60 dark:border-neutral-800 text-center">
                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Acento
                </label>
                <div className="flex items-center justify-center gap-1.5">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={e => setAccentColor(e.target.value)}
                    className="w-5 h-5 rounded-full border-0 cursor-pointer p-0 bg-transparent"
                  />
                  <span className="text-[10px] font-mono uppercase text-slate-500">
                    {accentColor}
                  </span>
                </div>
              </div>

              <div className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200/60 dark:border-neutral-800 text-center">
                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Terciario
                </label>
                <div className="flex items-center justify-center gap-1.5">
                  <input
                    type="color"
                    value={tertiaryColor}
                    onChange={e => setTertiaryColor(e.target.value)}
                    className="w-5 h-5 rounded-full border-0 cursor-pointer p-0 bg-transparent"
                  />
                  <span className="text-[10px] font-mono uppercase text-slate-500">
                    {tertiaryColor}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Quick 1-Click Preset Palettes Grid */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
              Combinaciones Listas (1 Clic):
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {THEME_PALETTE_PRESETS.map((preset: ThemePalettePreset) => {
                const isSelected = activePaletteId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPalettePreset(preset.id)}
                    className={`p-2.5 rounded-2xl border text-left flex items-center justify-between transition ios-touch cursor-pointer ${
                      isSelected
                        ? 'bg-slate-50 dark:bg-neutral-800 shadow-xs ring-2 ring-[var(--primary)]/40'
                        : 'bg-white dark:bg-neutral-900 border-slate-200/80 dark:border-neutral-800 hover:border-slate-300'
                    }`}
                    style={{
                      borderColor: isSelected ? preset.primary : undefined,
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{preset.icon}</span>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                          <span>{preset.name}</span>
                          {isSelected && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold">
                              Activo
                            </span>
                          )}
                        </div>
                        <div className="text-[9.5px] text-slate-500 dark:text-neutral-400 truncate">
                          {preset.subtitle}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 pl-1.5">
                      <span
                        className="w-3 h-3 rounded-full shadow-xs border border-white/50"
                        style={{ backgroundColor: preset.primary }}
                        title="Primario"
                      />
                      <span
                        className="w-3 h-3 rounded-full shadow-xs border border-white/50"
                        style={{ backgroundColor: preset.accent }}
                        title="Acento"
                      />
                      <span
                        className="w-3 h-3 rounded-full shadow-xs border border-white/50"
                        style={{ backgroundColor: preset.tertiary }}
                        title="Terciario"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* SECTION 2: AUTOMATED WELCOME & OFF-HOURS MESSAGES */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-purple-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Mensajes Automatizados del Bot
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">Meta Webhook Reply</span>
          </div>

          {/* Channel Selector */}
          <IOSSegmentedControl
            id="message-channel-selector"
            options={[
              { id: 'whatsapp', label: 'WhatsApp' },
              { id: 'instagram', label: 'Instagram DM' },
              { id: 'messenger', label: 'Messenger' },
            ]}
            value={activeMessageChannel}
            onChange={handleChannelChange}
            size="sm"
          />

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Mensaje de Bienvenida Inicial
            </label>
            <textarea
              rows={3}
              value={welcomeText}
              onChange={e => setWelcomeText(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Mensaje Fuera de Horario
            </label>
            <textarea
              rows={2}
              value={offHoursText}
              onChange={e => setOffHoursText(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          <button
            onClick={handleSaveWelcomeMessages}
            className="w-full py-2.5 rounded-xl bg-[var(--primary)] text-white font-bold flex items-center justify-center gap-1.5 ios-touch cursor-pointer hover:opacity-90 shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar Plantillas de Mensajes</span>
          </button>
        </div>

        {/* SECTION 3: SALON BUSINESS PARAMETERS */}
        <form
          onSubmit={handleSaveSalonSettings}
          className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Building className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Parámetros del Salón de Belleza
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">Datos Públicos</span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nombre del Salón
            </label>
            <input
              type="text"
              value={salonName}
              onChange={e => setSalonName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Dirección Principal
            </label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Hora Apertura
              </label>
              <input
                type="time"
                value={openingTime}
                onChange={e => setOpeningTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Hora Cierre
              </label>
              <input
                type="time"
                value={closingTime}
                onChange={e => setClosingTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          {/* CRITICAL PARAMETERS: BUFFER TIME, DURATION, AND GRACE PERIOD */}
          <div className="pt-2 border-t border-slate-200/60 dark:border-neutral-800 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
              <Clock className="w-4 h-4 text-[var(--primary)]" />
              <span>Tiempos de Agenda, Descanso & Tolerancia</span>
            </div>

            {/* 1. Buffer time between appointments */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/60 dark:border-neutral-700/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  Descanso / Preparación entre Citas
                </label>
                <span className="text-[11px] font-black text-[var(--primary)]">
                  {bufferTimeMinutes} minutos
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-neutral-400">
                Pausa de descanso, esterilización y limpieza antes de iniciar la siguiente cita.
              </p>
              <div className="grid grid-cols-4 gap-1 pt-1">
                {[0, 5, 10, 15].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setBufferTimeMinutes(mins)}
                    className={`py-1 rounded-lg text-[10px] font-bold transition ios-touch cursor-pointer ${
                      bufferTimeMinutes === mins
                        ? 'bg-[var(--primary)] text-white shadow-xs'
                        : 'bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300'
                    }`}
                  >
                    {mins === 0 ? 'Sin Pausa' : `${mins} min`}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Default Appointment Duration */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/60 dark:border-neutral-700/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  Duración Estándar de Cita
                </label>
                <span className="text-[11px] font-black text-slate-900 dark:text-white">
                  {defaultAppointmentDurationMinutes} minutos
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-neutral-400">
                Tiempo base asignado en el calendario si el servicio no tiene una duración fija.
              </p>
              <div className="grid grid-cols-4 gap-1 pt-1">
                {[30, 45, 60, 90].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDefaultAppointmentDurationMinutes(mins)}
                    className={`py-1 rounded-lg text-[10px] font-bold transition ios-touch cursor-pointer ${
                      defaultAppointmentDurationMinutes === mins
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                        : 'bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300'
                    }`}
                  >
                    {mins} min
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Grace Period (Tiempo de espera) */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/60 dark:border-neutral-700/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  Tolerancia de Gracia por Retraso
                </label>
                <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                  {gracePeriodMinutes} minutos
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-neutral-400">
                Tiempo de espera permitido si la clienta avisa que llegará tarde antes de cancelar el turno.
              </p>
              <div className="grid grid-cols-4 gap-1 pt-1">
                {[5, 10, 15, 20].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setGracePeriodMinutes(mins)}
                    className={`py-1 rounded-lg text-[10px] font-bold transition ios-touch cursor-pointer ${
                      gracePeriodMinutes === mins
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300'
                    }`}
                  >
                    {mins} min
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Deposit Percentage */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Anticipo para Reservar (%)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="5"
                    value={depositPercent}
                    onChange={e => setDepositPercent(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white font-bold focus:outline-none"
                  />
                  <span className="font-bold text-slate-400 text-sm">%</span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold flex items-center justify-center gap-1.5 ios-touch cursor-pointer hover:opacity-90 shadow-sm mt-2"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar Parámetros de Negocio</span>
          </button>
        </form>

        {/* SECTION 4: ADVANCED SYSTEM TELEMETRY (ESPECIALLY FOR LUFE & ALANNY) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-purple-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Telemetría & Webhooks (Soporte)
              </h3>
            </div>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-purple-500/15 text-purple-600 dark:text-purple-400">
              DevOps
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-neutral-400 leading-snug">
            Visualizador de logs en tiempo real para eventos de Meta Graph API, Webhooks y encriptación.
          </p>

          <button
            onClick={() => setShowLogsModal(true)}
            className="w-full py-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center gap-1.5 border border-purple-500/20 ios-touch cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Ver Logs y Eventos Meta API ({systemLogs.length})</span>
          </button>
        </div>

        {/* SECTION 5: ACCOUNT & PROFILE ACTIONS */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Perfil Activo
            </span>
            <span className="text-[10px] text-slate-400">Mock Auth</span>
          </div>

          {currentUser && (
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-11 h-11 rounded-full object-cover border"
              />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs text-slate-900 dark:text-white">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-neutral-400">
                  {currentUser.roleTitle}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={triggerSplash}
              className="py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 font-bold flex items-center justify-center gap-1 ios-touch cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Ver Splash Screen</span>
            </button>

            <button
              onClick={logout}
              className="py-2.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold flex items-center justify-center gap-1 border border-rose-500/20 ios-touch cursor-pointer hover:bg-rose-500/25"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </PageContent>

      {/* System Logs Bottom Sheet Modal */}
      <IOSModal
        isOpen={showLogsModal}
        onClose={() => setShowLogsModal(false)}
        title="Telemetría & Meta Webhooks"
        subtitle="Registro de eventos del sistema en vivo"
      >
        <div className="space-y-2 text-[11px] font-mono select-none">
          {systemLogs.map(log => (
            <div
              key={log.id}
              className="p-2.5 rounded-xl bg-neutral-950 text-neutral-200 border border-neutral-800 space-y-1 shadow-inner"
            >
              <div className="flex items-center justify-between text-[9px]">
                <span className="text-neutral-400">{log.timestamp}</span>
                <span
                  className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                    log.level === 'success'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : log.level === 'warn'
                      ? 'bg-amber-950 text-amber-400 border border-amber-800'
                      : 'bg-sky-950 text-sky-400 border border-sky-800'
                  }`}
                >
                  {log.service}
                </span>
              </div>
              <p className="text-neutral-300">{log.message}</p>
              {log.payload && (
                <pre className="text-[8px] text-neutral-500 overflow-x-auto p-1 bg-black/50 rounded">
                  {JSON.stringify(log.payload, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </IOSModal>

      {/* Theme Customizer Modal Sheet */}
      <ThemeCustomizerModal
        isOpen={showThemeModal}
        onClose={() => setShowThemeModal(false)}
      />
    </div>
  );
};
