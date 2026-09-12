import React, { useState, useEffect } from 'react';
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
  Coins,
  X,
  Printer,
  Armchair,
  Scissors,
  MonitorPlay,
  Volume2,
} from 'lucide-react';
import { useTheme, THEME_PALETTE_PRESETS } from '../theme/ThemeContext';
import { useApp } from '../context/AppContext';
import { api, urlDePantalla } from '../services/api';
import QRCode from 'qrcode';
import { vocesDisponibles, alCargarVoces, decir, fraseDeTurno } from '../utils/campana';
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
    currencies,
    baseCurrency,
    loadCurrencies,
    saveCurrency,
    deleteCurrency,
    addDenomination,
    removeDenomination,
    zonas, loadZonas, guardarZona, eliminarZona,
    especialistas, loadEspecialistas, guardarEspecialista, eliminarEspecialista,
  } = useApp();

  const { currentUser, logout } = useAuth();

  const [showThemeModal, setShowThemeModal] = useState(false);
  // Alta de monedas y billetes desde Ajustes
  const [nuevaMoneda, setNuevaMoneda] = useState({ code: '', symbol: '', name: '', rateToBase: '' });
  const [nuevoBillete, setNuevoBillete] = useState<Record<string, string>>({});
  useEffect(() => { void loadCurrencies?.(); }, []);

  // Zonas y especialistas: el mantenimiento que da sentido a los turnos
  const [nuevaZona, setNuevaZona] = useState({ name: '', prefix: '', color: '#c4697d' });
  const [nuevaPersona, setNuevaPersona] = useState({ name: '', role: '', zoneId: '' });
  useEffect(() => { void loadZonas?.(); void loadEspecialistas?.(); }, []);

  // Pantalla de pared: token, enlace y su QR
  const [tokenPantalla, setTokenPantalla] = useState('');
  const [qrPantalla, setQrPantalla] = useState('');
  const [rotando, setRotando] = useState(false);
  const urlPantalla = tokenPantalla ? urlDePantalla(tokenPantalla) : '';

  const [modoAnuncio, setModoAnuncio] = useState('tono');
  const [vozPantalla, setVozPantalla] = useState('');
  const [voces, setVoces] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    api.get<any>('/salon/display/token')
      .then(r => {
        setTokenPantalla(r?.token ?? '');
        setModoAnuncio(r?.modo ?? 'tono');
        setVozPantalla(r?.voz ?? '');
      })
      .catch(() => setTokenPantalla(''));
  }, []);

  // El catálogo de voces llega tarde en varios navegadores: la primera
  // llamada devuelve vacío y se puebla después.
  useEffect(() => {
    const refrescar = () => setVoces(vocesDisponibles());
    refrescar();
    return alCargarVoces(refrescar);
  }, []);

  const guardarAnuncio = async (modo: string, voz: string) => {
    const antesModo = modoAnuncio, antesVoz = vozPantalla;
    setModoAnuncio(modo); setVozPantalla(voz);   // respuesta inmediata
    try {
      await api.patch('/salon/display/announce', { modo, voz: voz || null });
    } catch (e: any) {
      // Se revierte: dejarlo pintado como guardado cuando no lo está es peor
      // que no haber cambiado nada.
      setModoAnuncio(antesModo); setVozPantalla(antesVoz);
      showToast('No se pudo guardar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    }
  };

  useEffect(() => {
    if (!urlPantalla) { setQrPantalla(''); return; }
    let vivo = true;
    QRCode.toDataURL(urlPantalla, { margin: 1, width: 256, errorCorrectionLevel: 'M' })
      .then(d => { if (vivo) setQrPantalla(d); })
      .catch(() => { if (vivo) setQrPantalla(''); });
    return () => { vivo = false; };
  }, [urlPantalla]);
  const [skipSplash, setSkipSplash] = useState(() => {
    try { return localStorage.getItem('skipSplash') === 'true'; } catch { return false; }
  });
  const toggleSkipSplash = () => {
    const next = !skipSplash;
    try { localStorage.setItem('skipSplash', String(next)); } catch {}
    setSkipSplash(next);
  };
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

        {/* SECTION 3.4: ZONAS Y ESPECIALISTAS */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3">
          <div className="flex items-center gap-1.5">
            <Armchair className="w-4 h-4 text-[var(--primary)]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Zonas del Salón
            </h2>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            De aquí sale el código del turno: el prefijo de la zona más el
            número del día. Una zona con prefijo <span className="font-bold">G</span> da
            turnos <span className="font-mono font-bold">G1, G2, G3…</span> y el
            número reinicia cada mañana.
          </p>

          <div className="space-y-2">
            {(zonas ?? []).map(z => (
              <div
                key={z.id}
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${
                  z.active
                    ? 'bg-slate-50 dark:bg-neutral-800/60 border-slate-200 dark:border-neutral-700'
                    : 'bg-slate-50/50 dark:bg-neutral-800/20 border-dashed border-slate-200 dark:border-neutral-800 opacity-60'
                }`}
              >
                {/* defaultValue + onBlur, NO onChange: con onChange se
                    disparaba un guardado por cada tecla pulsada. */}
                <input
                  key={`p-${z.id}-${z.prefix}`}
                  defaultValue={z.prefix}
                  onBlur={e => {
                    const v = e.target.value.trim().toUpperCase();
                    if (v && v !== z.prefix) void guardarZona({ id: z.id, name: z.name, prefix: v });
                  }}
                  maxLength={3}
                  title="Prefijo del turno"
                  className="w-12 shrink-0 px-2 py-1.5 rounded-lg text-center text-white text-xs font-extrabold uppercase border-0 focus:outline-none focus:ring-2 focus:ring-white/40"
                  style={{ backgroundColor: z.color || 'var(--primary)' }}
                />
                <input
                  key={`n-${z.id}-${z.name}`}
                  defaultValue={z.name}
                  onBlur={e => {
                    const v = e.target.value.trim();
                    if (v && v !== z.name) void guardarZona({ id: z.id, name: v, prefix: z.prefix });
                  }}
                  className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-xs font-semibold text-slate-900 dark:text-white"
                />
                <input
                  type="color"
                  key={`c-${z.id}-${z.color}`}
                  defaultValue={z.color || '#c4697d'}
                  onBlur={e => {
                    if (e.target.value !== z.color) {
                      void guardarZona({ id: z.id, name: z.name, prefix: z.prefix, color: e.target.value });
                    }
                  }}
                  title="Color en la pantalla de sala"
                  className="w-8 h-8 shrink-0 rounded-lg border border-slate-200 dark:border-neutral-700 cursor-pointer bg-transparent"
                />
                <span className="shrink-0 text-[10px] text-slate-400 tabular-nums hidden sm:block">
                  {z.staff?.length ?? 0} pers.
                </span>
                <button
                  type="button"
                  onClick={() => eliminarZona(z.id)}
                  title={z.active ? 'Quitar esta zona' : 'Zona desactivada'}
                  className="shrink-0 w-7 h-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {!(zonas ?? []).length && (
              <p className="py-3 text-center text-[11px] text-slate-400">
                Sin zonas todavía. Los turnos salen como T1, T2…
              </p>
            )}
          </div>

          {/* Alta */}
          <div className="flex items-center gap-2 pt-1">
            <input
              value={nuevaZona.prefix}
              onChange={e => setNuevaZona(z => ({ ...z, prefix: e.target.value.toUpperCase() }))}
              placeholder="G"
              maxLength={3}
              className="w-12 shrink-0 px-2 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-center text-xs font-extrabold uppercase text-slate-900 dark:text-white"
            />
            <input
              value={nuevaZona.name}
              onChange={e => setNuevaZona(z => ({ ...z, name: e.target.value }))}
              placeholder="Nombre de la zona"
              className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white"
            />
            <input
              type="color"
              value={nuevaZona.color}
              onChange={e => setNuevaZona(z => ({ ...z, color: e.target.value }))}
              className="w-9 h-9 shrink-0 rounded-xl border border-slate-200 dark:border-neutral-700 cursor-pointer bg-transparent"
            />
            <button
              type="button"
              disabled={!nuevaZona.name.trim() || !nuevaZona.prefix.trim()}
              onClick={async () => {
                const ok = await guardarZona({ ...nuevaZona });
                if (ok) setNuevaZona({ name: '', prefix: '', color: '#c4697d' });
              }}
              className="shrink-0 px-3 py-2 rounded-xl bg-[var(--primary)] text-white text-[11px] font-bold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Añadir
            </button>
          </div>
        </div>

        {/* SECTION 3.45: ESPECIALISTAS */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3">
          <div className="flex items-center gap-1.5">
            <Scissors className="w-4 h-4 text-[var(--primary)]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Especialistas
            </h2>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Cada una con su especialidad y su zona. La zona es la que decide a
            qué cola entra un turno cuando no se elige a mano.
          </p>

          <div className="space-y-2">
            {(especialistas ?? []).map(e => (
              <div
                key={e.id}
                className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                  e.active
                    ? 'bg-slate-50 dark:bg-neutral-800/60 border-slate-200 dark:border-neutral-700'
                    : 'bg-slate-50/50 dark:bg-neutral-800/20 border-dashed border-slate-200 dark:border-neutral-800 opacity-60'
                }`}
              >
                <input
                  key={`n-${e.id}-${e.name}`}
                  defaultValue={e.name}
                  onBlur={ev => {
                    const v = ev.target.value.trim();
                    if (v && v !== e.name) void guardarEspecialista({ id: e.id, name: v });
                  }}
                  className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-xs font-semibold text-slate-900 dark:text-white"
                />
                <input
                  key={`r-${e.id}-${e.role}`}
                  defaultValue={e.role}
                  onBlur={ev => {
                    const v = ev.target.value.trim();
                    if (v && v !== e.role) void guardarEspecialista({ id: e.id, name: e.name, role: v });
                  }}
                  placeholder="Especialidad"
                  className="w-28 shrink-0 px-2 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[11px] text-slate-600 dark:text-neutral-300"
                />
                <select
                  value={e.zoneId ?? ''}
                  onChange={ev => guardarEspecialista({ id: e.id, name: e.name, zoneId: ev.target.value || null })}
                  className="w-28 shrink-0 px-2 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[11px] text-slate-600 dark:text-neutral-300"
                >
                  <option value="">Sin zona</option>
                  {(zonas ?? []).filter(z => z.active).map(z => (
                    <option key={z.id} value={z.id}>{z.prefix} · {z.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => eliminarEspecialista(e.id)}
                  className="shrink-0 w-7 h-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {!(especialistas ?? []).length && (
              <p className="py-3 text-center text-[11px] text-slate-400">
                Todavía no hay nadie dado de alta.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              value={nuevaPersona.name}
              onChange={ev => setNuevaPersona(p => ({ ...p, name: ev.target.value }))}
              placeholder="Nombre"
              className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white"
            />
            <input
              value={nuevaPersona.role}
              onChange={ev => setNuevaPersona(p => ({ ...p, role: ev.target.value }))}
              placeholder="Especialidad"
              className="w-28 shrink-0 px-2 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[11px] text-slate-900 dark:text-white"
            />
            <select
              value={nuevaPersona.zoneId}
              onChange={ev => setNuevaPersona(p => ({ ...p, zoneId: ev.target.value }))}
              className="w-28 shrink-0 px-2 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[11px] text-slate-900 dark:text-white"
            >
              <option value="">Sin zona</option>
              {(zonas ?? []).filter(z => z.active).map(z => (
                <option key={z.id} value={z.id}>{z.prefix} · {z.name}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={!nuevaPersona.name.trim()}
              onClick={async () => {
                const ok = await guardarEspecialista({
                  name: nuevaPersona.name,
                  role: nuevaPersona.role,
                  zoneId: nuevaPersona.zoneId || null,
                });
                if (ok) setNuevaPersona({ name: '', role: '', zoneId: '' });
              }}
              className="shrink-0 px-3 py-2 rounded-xl bg-[var(--primary)] text-white text-[11px] font-bold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Añadir
            </button>
          </div>
        </div>

        {/* SECTION 3.46: PANTALLA DE PARED */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3">
          <div className="flex items-center gap-1.5">
            <MonitorPlay className="w-4 h-4 text-[var(--primary)]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Pantalla de Turnos
            </h2>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Abre esta dirección en el televisor o la tablet de la sala. No pide
            usuario ni contraseña, es de solo lectura y únicamente muestra el
            código, el nombre de pila y a dónde va cada clienta — ni teléfonos,
            ni precios, ni la agenda.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* El QR: apuntas con la tablet y listo, sin teclear un token
                de treinta caracteres en un teclado en pantalla. */}
            <div className="shrink-0 self-center sm:self-start p-2 rounded-2xl bg-white border border-slate-200">
              {qrPantalla ? (
                <img src={qrPantalla} alt="QR de la pantalla" className="w-32 h-32" />
              ) : (
                <div className="w-32 h-32 flex items-center justify-center text-[10px] text-slate-300">
                  Generando…
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[11px] font-mono break-all text-slate-600 dark:text-neutral-300">
                {urlPantalla || 'Generando enlace…'}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!urlPantalla}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(urlPantalla);
                      showToast('Enlace copiado', 'Pégalo en el navegador del televisor.', 'success');
                    } catch {
                      showToast('No se pudo copiar', 'Selecciónalo y cópialo a mano.', 'warning');
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-bold hover:opacity-90 transition disabled:opacity-40 cursor-pointer"
                >
                  Copiar enlace
                </button>
                <button
                  type="button"
                  disabled={!urlPantalla}
                  onClick={() => window.open(urlPantalla, '_blank', 'noopener')}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 text-[11px] font-bold hover:bg-slate-200 dark:hover:bg-neutral-700 transition disabled:opacity-40 cursor-pointer"
                >
                  Abrir ahora
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (rotando) return;
                    setRotando(true);
                    try {
                      const r = await api.post<any>('/salon/display/token/rotate', {});
                      setTokenPantalla(r?.token ?? '');
                      showToast(
                        'Enlace nuevo',
                        'El anterior dejó de funcionar. Vuelve a abrir la pantalla en el televisor.',
                        'info',
                      );
                    } catch (e: any) {
                      showToast('No se pudo cambiar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
                    } finally { setRotando(false); }
                  }}
                  className="px-3 py-2 rounded-xl text-[11px] font-bold text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                >
                  {rotando ? 'Cambiando…' : 'Cambiar enlace'}
                </button>
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed">
                Si se pierde la tablet, cambia el enlace: el anterior deja de
                servir en ese mismo instante.
              </p>
            </div>
          </div>

          {/* ── Cómo se anuncia un turno ─────────────────────────── */}
          <div className="pt-3 mt-1 border-t border-slate-100 dark:border-neutral-800 space-y-2">
            <div className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                Al llamar un turno
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {([
                ['tono', '🔔', 'Tono'],
                ['voz', '🗣️', 'Voz'],
                ['ambos', '🔔🗣️', 'Ambos'],
                ['mudo', '🔇', 'Nada'],
              ] as [string, string, string][]).map(([valor, icono, etiqueta]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => guardarAnuncio(valor, vozPantalla)}
                  className={`py-2 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-0.5 transition cursor-pointer ${
                    modoAnuncio === valor
                      ? 'bg-[var(--primary)]/10 border-[var(--primary)]/30 text-[var(--primary)]'
                      : 'bg-slate-50 dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-slate-500 dark:text-neutral-400 hover:border-[var(--primary)]/40'
                  }`}
                >
                  <span className="text-sm leading-none">{icono}</span>
                  {etiqueta}
                </button>
              ))}
            </div>

            {(modoAnuncio === 'voz' || modoAnuncio === 'ambos') && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-2">
                  <select
                    value={vozPantalla}
                    onChange={e => guardarAnuncio(modoAnuncio, e.target.value)}
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[11px] text-slate-900 dark:text-white"
                  >
                    <option value="">Voz automática (español)</option>
                    {voces.map(v => (
                      <option key={v.name} value={v.name}>{v.name} · {v.lang}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => decir(fraseDeTurno('G15', 'Camila', 'Carlos M.'), { voz: vozPantalla })}
                    className="shrink-0 px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-[11px] font-bold text-slate-600 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700 transition cursor-pointer"
                  >
                    Probar
                  </button>
                </div>
                {/* Esto hay que decirlo: las voces las instala el sistema
                    operativo, no la web. La lista de aquí es la de ESTE
                    aparato, no la del televisor. */}
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Estas son las voces de <span className="font-semibold">este</span> dispositivo.
                  El televisor puede tener otras: si la elegida no está allí, usará
                  cualquier voz en español. Prueba el botón en el propio televisor
                  para oír cómo suena de verdad.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3.5: MONEDAS Y DENOMINACIONES */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3">
          <div className="flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Monedas y Billetes
            </h2>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            La caja vive en una sola moneda base. Las demás se registran con su
            tasa — cuántas unidades de la base vale una de ellas — y sirven para
            que una clienta pueda pagar en dólares un servicio en pesos.
          </p>

          <div className="space-y-2">
            {(currencies ?? []).filter(c => c.active !== false).map(c => (
              <div
                key={c.id}
                className={`p-3 rounded-xl border space-y-2 ${
                  c.isBase
                    ? 'border-[var(--primary)]/50 bg-[var(--primary)]/5'
                    : 'border-slate-200 dark:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {c.symbol} {c.code}
                      </span>
                      {c.isBase && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-[var(--primary)] text-white">
                          BASE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{c.name}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {c.isBase ? (
                      <span className="text-[11px] text-slate-400">tasa 1.00</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">1 {c.code} =</span>
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={Number(c.rateToBase)}
                          onBlur={e => {
                            const v = Number(e.target.value);
                            if (v > 0 && v !== Number(c.rateToBase)) {
                              saveCurrency({ id: c.id, rateToBase: v });
                            }
                          }}
                          className="w-20 px-2 py-1 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs font-mono tabular-nums text-right text-slate-900 dark:text-white"
                        />
                        <span className="text-[10px] text-slate-400">
                          {baseCurrency?.code}
                        </span>
                      </div>
                    )}
                    {!c.isBase && (
                      <>
                        <button
                          onClick={() => saveCurrency({ id: c.id, isBase: true })}
                          title="Hacerla la moneda base del salón"
                          className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-500 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition"
                        >
                          Hacer base
                        </button>
                        <button
                          onClick={() => deleteCurrency(c.id)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Billetes de esta moneda */}
                <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-100 dark:border-neutral-800">
                  {(c.denominations ?? []).filter(d => d.active !== false).map(d => (
                    <span
                      key={d.id}
                      className="group pl-2 pr-1 py-1 rounded-lg bg-slate-100 dark:bg-neutral-800 text-[11px] font-bold text-slate-600 dark:text-neutral-300 tabular-nums flex items-center gap-1"
                    >
                      {c.symbol}{Number(d.value).toLocaleString()}
                      <button
                        onClick={() => removeDenomination(d.id)}
                        className="w-4 h-4 rounded-full flex items-center justify-center opacity-40 hover:opacity-100 hover:bg-black/10 transition"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="number"
                    placeholder="+ billete"
                    value={nuevoBillete[c.id] ?? ''}
                    onChange={e => setNuevoBillete(p => ({ ...p, [c.id]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key !== 'Enter') return;
                      const v = Number(nuevoBillete[c.id]);
                      if (v > 0) {
                        addDenomination(c.id, v);
                        setNuevoBillete(p => ({ ...p, [c.id]: '' }));
                      }
                    }}
                    className="w-24 px-2 py-1 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-dashed border-slate-300 dark:border-neutral-700 text-[11px] text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Alta de moneda */}
          <div className="grid grid-cols-4 gap-1 pt-1">
            <input
              value={nuevaMoneda.code}
              onChange={e => setNuevaMoneda(p => ({ ...p, code: e.target.value.toUpperCase() }))}
              placeholder="USD"
              maxLength={4}
              className="px-2 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[11px] font-bold uppercase text-slate-900 dark:text-white"
            />
            <input
              value={nuevaMoneda.symbol}
              onChange={e => setNuevaMoneda(p => ({ ...p, symbol: e.target.value }))}
              placeholder="US$"
              maxLength={4}
              className="px-2 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[11px] text-slate-900 dark:text-white"
            />
            <input
              value={nuevaMoneda.name}
              onChange={e => setNuevaMoneda(p => ({ ...p, name: e.target.value }))}
              placeholder="Dólar"
              className="px-2 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[11px] text-slate-900 dark:text-white"
            />
            <input
              type="number"
              step="0.01"
              value={nuevaMoneda.rateToBase}
              onChange={e => setNuevaMoneda(p => ({ ...p, rateToBase: e.target.value }))}
              placeholder="60"
              className="px-2 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[11px] font-mono tabular-nums text-slate-900 dark:text-white"
            />
          </div>
          <button
            onClick={async () => {
              if (!nuevaMoneda.code.trim()) return;
              await saveCurrency({
                code: nuevaMoneda.code.trim(),
                symbol: nuevaMoneda.symbol.trim() || nuevaMoneda.code.trim(),
                name: nuevaMoneda.name.trim() || nuevaMoneda.code.trim(),
                rateToBase: Number(nuevaMoneda.rateToBase) || 1,
              });
              setNuevaMoneda({ code: '', symbol: '', name: '', rateToBase: '' });
            }}
            disabled={!nuevaMoneda.code.trim()}
            className="w-full py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-[11px] font-bold text-slate-600 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700 transition disabled:opacity-40"
          >
            Agregar moneda
          </button>
        </div>

        {/* SECTION 3.6: RECIBOS E IMPRESIÓN */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3">
          <div className="flex items-center gap-1.5">
            <Printer className="w-4 h-4 text-slate-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Recibos e Impresión
            </h2>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            El recibo se manda al diálogo de impresión del navegador, así que
            funciona con cualquier impresora instalada en la computadora —
            térmica o matricial — sin instalar nada aparte.
          </p>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Ancho del papel
            </label>
            <div className="flex gap-2 mt-1">
              {[58, 80].map(mm => (
                <button
                  key={mm}
                  onClick={() => updateSettings({ ...settings, receiptWidthMm: mm } as any)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${
                    Number((settings as any)?.receiptWidthMm ?? 80) === mm
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300'
                  }`}
                >
                  {mm}mm
                  <span className="block text-[9px] font-normal opacity-70">
                    {mm === 58 ? 'térmica chica' : 'estándar POS'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Pie del recibo
            </label>
            <input
              defaultValue={(settings as any)?.receiptFooter ?? '¡Gracias por tu visita!'}
              onBlur={e => updateSettings({ ...settings, receiptFooter: e.target.value } as any)}
              placeholder="¡Gracias por tu visita!"
              className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              RNC / Identificación fiscal
            </label>
            <input
              defaultValue={(settings as any)?.rnc ?? ''}
              onBlur={e => updateSettings({ ...settings, rnc: e.target.value } as any)}
              placeholder="Opcional"
              className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white"
            />
          </div>
        </div>

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

          {/* Skip splash toggle */}
          <div className="flex items-center justify-between py-3 px-0.5 border-b border-slate-100 dark:border-neutral-800 mb-1">
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Ocultar pantalla de inicio</p>
              <p className="text-[10px] text-slate-400 dark:text-neutral-500 mt-0.5">Salta el splash al recargar la app</p>
            </div>
            <button
              onClick={toggleSkipSplash}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ios-touch cursor-pointer flex-shrink-0 ${skipSplash ? 'bg-[var(--primary)]' : 'bg-slate-200 dark:bg-neutral-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${skipSplash ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

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
