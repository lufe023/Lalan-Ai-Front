import React, { useState, useEffect } from 'react';
import { recibeCitas } from '../utils/recibeCitas';
import { RESORTE } from '../components/ui/movimiento';
import { AnimatePresence, motion } from 'motion/react';
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
  Music,
  Bot,
  ChevronRight,
  Zap,
  CalendarClock,
  CalendarCheck,
  CalendarOff,
} from 'lucide-react';
import { useTheme, THEME_PALETTE_PRESETS } from '../theme/ThemeContext';
import { CatalogoEnOtraMoneda } from '../components/ajustes/CatalogoEnOtraMoneda';
import { useApp } from '../context/AppContext';
import { api, urlDePantalla, urlDeReproductor } from '../services/api';
import QRCode from 'qrcode';
import { vocesDisponibles, alCargarVoces, decir, fraseDeTurno } from '../utils/campana';
import { useAuth } from '../context/AuthContext';
import { quickAuth, QuickAuthRegistration } from '../services/quickAuth';
import { CommunicationChannel, ThemeMode, UserRole, ThemePalettePreset, EventoActividad } from '../types';
import { IOSHeader } from '../components/ui/IOSHeader';
import { IOSSegmentedControl } from '../components/ui/IOSSegmentedControl';
import { IOSModal } from '../components/ui/IOSModal';
import { ThemeCustomizerModal } from '../components/ui/ThemeCustomizerModal';
import { PageContent } from '../components/ui/PageContent';
import { EditorPizarra } from '../components/ui/EditorPizarra';
import { PeticionesMusica } from '../components/ui/PeticionesMusica';
import { TuPlan } from '../components/ajustes/TuPlan';
import { UsuariosSalon } from '../components/ajustes/UsuariosSalon';
import { AvisosEquipo } from '../components/ajustes/AvisosEquipo';
import { TamanoLetraSelector } from '../components/ui/TamanoLetraSelector';
import { GRUPOS_AJUSTES, gruposPara, MenuAjustes, SeccionAjustes, tomarSeccionPedida } from '../components/ajustes/MenuAjustes';
import { HorarioSemanal, semanaCompleta } from '../components/ajustes/HorarioSemanal';
import { HorarioEspecialista } from '../components/ajustes/HorarioEspecialista';
import { ConectarMeta } from '../components/canales/ConectarMeta';
import { abrirBienvenida } from '../services/bienvenida';
import { ActivarNotificaciones } from '../components/ui/ActivarNotificaciones';
import { SeguridadCuenta } from '../components/ajustes/SeguridadCuenta';
import { enSoporte } from '../services/soporte';

/** Cómo se ve cada tipo de evento en la actividad reciente */
const ESTILO_ACTIVIDAD: Record<EventoActividad['tipo'], { titulo: string; clase: string }> = {
  entrada: { titulo: 'Escribió', clase: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  respuesta: { titulo: 'Respondió la asistente', clase: 'bg-purple-500/15 text-purple-700 dark:text-purple-300' },
  persona: { titulo: 'Respondió el salón', clase: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  aviso: { titulo: 'Aviso', clase: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  cita: { titulo: 'Cita agendada', clase: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
};

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
    triggerSplash,
    navigateTo,
    abrirConversacion,
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
    categoriasDe,
  } = useApp();

  const { currentUser, logout } = useAuth();
  // Ajustes es un menú: cada grupo abre su página (o llega directo desde otra pantalla)
  const [seccion, setSeccion] = useState<SeccionAjustes | null>(() => tomarSeccionPedida());
  const abrirSeccion = (s: SeccionAjustes | null) => {
    setSeccion(s);
    document.querySelector('#settings-screen .overflow-y-auto, #settings-screen main')?.scrollTo?.({ top: 0 });
  };
  const grupoAbierto = seccion ? gruposPara(currentUser?.role).find((x) => x.id === seccion) ?? GRUPOS_AJUSTES.find((x) => x.id === seccion) ?? null : null;

  const [quickReg, setQuickReg] = useState<QuickAuthRegistration>(() => quickAuth.getRegistration());

  const handleVincularDispositivo = async () => {
    if (!currentUser) return;
    try {
      await quickAuth.registerDevice({
        id: currentUser.id,
        name: currentUser.name,
        email: (currentUser as any).email ?? '',
        role: currentUser.role,
        avatar: currentUser.avatar,
      });
      setQuickReg(quickAuth.getRegistration());
      showToast('Acceso Rápido activado', 'Este dispositivo ahora puede entrar con 1 solo toque.', 'success');
    } catch (e: any) {
      setQuickReg(quickAuth.getRegistration());
      showToast('No se pudo activar el acceso rápido', e?.message || 'Inténtalo de nuevo.', 'warning');
    }
  };

  const handleDesvincularDispositivo = async () => {
    try {
      await quickAuth.revokeDevice();
      setQuickReg(quickAuth.getRegistration());
      showToast('Dispositivo desvinculado', 'Se ha revocado el acceso rápido en este equipo.', 'info');
    } catch (e: any) {
      showToast('Error al desvincular', e?.message, 'warning');
    }
  };

  const [showThemeModal, setShowThemeModal] = useState(false);
  // Alta de monedas y billetes desde Ajustes
  const [nuevaMoneda, setNuevaMoneda] = useState({ code: '', symbol: '', name: '', rateToBase: '' });
  const [nuevoBillete, setNuevoBillete] = useState<Record<string, string>>({});
  useEffect(() => { void loadCurrencies?.(); }, []);

  // Zonas y especialistas: el mantenimiento que da sentido a los turnos
  const [nuevaZona, setNuevaZona] = useState({ name: '', prefix: '', color: '#c4697d' });
  /* Igual que el servidor: si alguna zona activa ya marcó sus servicios, una
     sin marcar no atiende nada (si ninguna marcó, todas hacen de todo) */
  const zonasConServicios = (zonas ?? []).some(z => z.active && !z.sinServicios && (z.serviceCategories ?? []).length > 0);
  const [nuevaPersona, setNuevaPersona] = useState({ name: '', role: '', zoneId: '' });
  useEffect(() => { void loadZonas?.(); void loadEspecialistas?.(); }, []);

  // Pantalla de pared: token, enlace y su QR
  const [tokenPantalla, setTokenPantalla] = useState('');
  const [qrPantalla, setQrPantalla] = useState('');
  const [rotando, setRotando] = useState(false);
  const urlPantalla = tokenPantalla ? urlDePantalla(tokenPantalla) : '';
  const urlReproductor = tokenPantalla ? urlDeReproductor(tokenPantalla) : '';

  const [modoAnuncio, setModoAnuncio] = useState('tono');
  /** La pizarra pone también la música (para el salón de un solo televisor) */
  const [pantallaSuena, setPantallaSuena] = useState(false);
  /** Bajar la música mientras se anuncia un turno */
  const [bajarAlLlamar, setBajarAlLlamar] = useState(true);
  const [vozPantalla, setVozPantalla] = useState('');
  const [voces, setVoces] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    api.get<any>('/salon/display/token')
      .then(r => {
        setTokenPantalla(r?.token ?? '');
        setModoAnuncio(r?.modo ?? 'tono');
        setVozPantalla(r?.voz ?? '');
        setPantallaSuena(!!r?.suena);
        setBajarAlLlamar(r?.bajar !== false);
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

  /**
   * Los dos interruptores de la pared. Se manda solo el que cambió: el
   * servidor deja en paz lo que no venga en la petición, así que encender
   * uno no puede apagar el otro sin querer.
   */
  const guardarInterruptor = async (campo: 'suena' | 'bajar', valor: boolean) => {
    const poner = campo === 'suena' ? setPantallaSuena : setBajarAlLlamar;
    const antes = campo === 'suena' ? pantallaSuena : bajarAlLlamar;
    poner(valor);
    try {
      await api.patch('/salon/display/announce', {
        modo: modoAnuncio, voz: vozPantalla || null, [campo]: valor,
      });
      if (campo === 'suena') {
        showToast(
          valor ? 'La pantalla pondrá la música' : 'La pantalla ya no pone música',
          valor
            ? 'Vuelve a abrir la pantalla en el televisor y toca "Activar sonido y música".'
            : 'La música vuelve a salir del aparato que la esté poniendo.',
          'info',
        );
      }
    } catch (e: any) {
      poner(antes);
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
  /** La especialista cuyo horario y ausencias se están viendo */
  const [horarioDe, setHorarioDe] = useState<string | null>(null);
  /* La actividad reciente de los chats, de la base: si aquí no aparece
     nada, es que no está llegando nada (antes había eventos inventados) */
  const [actividad, setActividad] = useState<EventoActividad[] | null>(null);
  const abrirActividad = async () => {
    setShowLogsModal(true);
    setActividad(null);
    try { setActividad(await api.get<EventoActividad[]>('/chat/panel/actividad')); }
    catch { setActividad([]); showToast('No se pudo cargar la actividad', 'Inténtalo de nuevo en un momento.', 'warning'); }
  };

  // Business Parameters State
  const [salonName, setSalonName] = useState(settings.salonName);
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
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
      bufferTimeMinutes,
      defaultAppointmentDurationMinutes,
      gracePeriodMinutes,
      depositPercent,
    });
  };

  return (
    <div id="settings-screen" className="flex-1 w-full h-full flex flex-col overflow-hidden">
      <IOSHeader
        title={grupoAbierto ? grupoAbierto.titulo : 'Configuración'}
        subtitle={grupoAbierto ? grupoAbierto.resumen : 'Tu cuenta, tu equipo y todo lo del salón'}
        showBack={!!grupoAbierto}
        onBack={() => abrirSeccion(null)}
      />

      <PageContent className="text-xs">
        {/* Como en el iPhone: la sección entra desde la derecha y, al volver, el menú desde la izquierda */}
        <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={seccion ?? 'menu'}
          initial={{ opacity: 0, x: seccion ? 28 : -28 }}
          animate={{ opacity: 1, x: 0, transition: RESORTE }}
          exit={{ opacity: 0, x: seccion ? -16 : 16, transition: { duration: 0.12 } }}
          className="space-y-4"
        >
        {!seccion && <MenuAjustes rol={currentUser?.role} onAbrir={abrirSeccion} />}
        {seccion === 'cuenta' && (
          <>
        {/* Todo el equipo puede activar las notificaciones: la dueña decide qué le llega a cada quien */}
        {currentUser?.role !== 'support' && <ActivarNotificaciones />}
        {/* SECTION 5: ACCOUNT & PROFILE ACTIONS */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Mi perfil
            </span>
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
                <div className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
                  {currentUser.roleTitle}
                </div>
              </div>
            </div>
          )}

          {/* Acceso Rápido Seguro con 1 toque */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <Zap className="w-4 h-4 fill-white" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Acceso Rápido (1 toque)
                  </h4>
                  <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
                    {quickReg.isRegistered
                      ? `Vinculado a este ${quickReg.deviceName || 'dispositivo'}`
                      : 'No configurado en este dispositivo'}
                  </p>
                </div>
              </div>

              {quickReg.isRegistered ? (
                <button
                  type="button"
                  onClick={handleDesvincularDispositivo}
                  className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-600 dark:text-red-400 text-[0.6875rem] font-bold hover:bg-red-500/25 transition cursor-pointer"
                >
                  Desvincular
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleVincularDispositivo}
                  className="px-3 py-1 rounded-lg bg-[var(--primary)] text-white text-[0.6875rem] font-bold hover:opacity-90 transition cursor-pointer shadow-xs"
                >
                  Vincular
                </button>
              )}
            </div>
            <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400 leading-tight">
              {quickReg.isRegistered
                ? 'Este teléfono puede entrar al salón sin volver a ingresar contraseña.'
                : 'Actívalo para entrar a tu salón con un solo toque desde este equipo.'}
            </p>
          </div>

          {/* Skip splash toggle */}
          <div className="flex items-center justify-between py-3 px-0.5 border-b border-slate-100 dark:border-neutral-800 mb-1">
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Ocultar pantalla de inicio</p>
              <p className="text-[0.6875rem] text-slate-400 dark:text-neutral-500 mt-0.5">Salta el splash al recargar la app</p>
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
        {/* Contraseña y sesiones: son de la dueña de la cuenta, no de quien entra a dar soporte */}
        {!enSoporte() && <SeguridadCuenta />}
          </>
        )}
        {seccion === 'plan' && (
          <>
        {/* Su plan y su gente: lo primero que una dueña busca en Ajustes */}
        <TuPlan />
          </>
        )}
        {seccion === 'equipo' && (
          <>
        {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && <UsuariosSalon />}
        {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && <AvisosEquipo />}
          </>
        )}
        {seccion === 'salon' && (
          <>
        {/* La Bienvenida, para volver a recorrer la configuración paso a paso */}
        {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
          <button
            type="button"
            onClick={abrirBienvenida}
            className="w-full p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs flex items-center gap-3 text-left cursor-pointer"
          >
            <Sparkles className="w-5 h-5 shrink-0 text-[var(--primary)]" />
            <span className="flex-1">
              <span className="block text-[0.875rem] font-bold text-slate-900 dark:text-white">Configurar mi salón paso a paso</span>
              <span className="block text-[0.75rem] text-slate-500 dark:text-neutral-400">Servicios con precios, lo que lleva cada uno, productos, horario y equipo.</span>
            </span>
          </button>
        )}
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
            <span className="text-[0.6875rem] text-slate-400">Datos Públicos</span>
          </div>

          <div>
            <label className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">
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
            <label className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Dirección Principal
            </label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          <div className="pt-2 border-t border-slate-200/60 dark:border-neutral-800">
            <HorarioSemanal
              semana={semanaCompleta(settings.horarioSemanal, settings.openingTime, settings.closingTime)}
              onGuardar={horarioSemanal => updateSettings({ horarioSemanal })}
            />
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
                <label className="text-[0.75rem] font-bold text-slate-800 dark:text-slate-200">
                  Descanso / Preparación entre Citas
                </label>
                <span className="text-[0.75rem] font-black text-[var(--primary)]">
                  {bufferTimeMinutes} minutos
                </span>
              </div>
              <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
                Pausa de descanso, esterilización y limpieza antes de iniciar la siguiente cita.
              </p>
              <div className="grid grid-cols-4 gap-1 pt-1">
                {[0, 5, 10, 15].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setBufferTimeMinutes(mins)}
                    className={`py-1 rounded-lg text-[0.6875rem] font-bold transition ios-touch cursor-pointer ${
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
                <label className="text-[0.75rem] font-bold text-slate-800 dark:text-slate-200">
                  Duración Estándar de Cita
                </label>
                <span className="text-[0.75rem] font-black text-slate-900 dark:text-white">
                  {defaultAppointmentDurationMinutes} minutos
                </span>
              </div>
              <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
                Tiempo base asignado en el calendario si el servicio no tiene una duración fija.
              </p>
              <div className="grid grid-cols-4 gap-1 pt-1">
                {[30, 45, 60, 90].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDefaultAppointmentDurationMinutes(mins)}
                    className={`py-1 rounded-lg text-[0.6875rem] font-bold transition ios-touch cursor-pointer ${
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
                <label className="text-[0.75rem] font-bold text-slate-800 dark:text-slate-200">
                  Tolerancia de Gracia por Retraso
                </label>
                <span className="text-[0.75rem] font-black text-emerald-600 dark:text-emerald-400">
                  {gracePeriodMinutes} minutos
                </span>
              </div>
              <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
                Tiempo de espera permitido si la clienta avisa que llegará tarde antes de cancelar el turno.
              </p>
              <div className="grid grid-cols-4 gap-1 pt-1">
                {[5, 10, 15, 20].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setGracePeriodMinutes(mins)}
                    className={`py-1 rounded-lg text-[0.6875rem] font-bold transition ios-touch cursor-pointer ${
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
                <label className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">
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
          <p className="text-[0.75rem] text-slate-400 leading-relaxed">
            Marca qué servicios se hacen en cada zona: con eso la asistente sabe qué especialistas
            pueden atender cada cita y a quién ofrecer. De aquí sale también el código del turno: el prefijo de la zona más el
            número del día. Una zona con prefijo <span className="font-bold">G</span> da
            turnos <span className="font-mono font-bold">G1, G2, G3…</span> y el
            número reinicia cada mañana.
          </p>

          <div className="space-y-2">
            {(zonas ?? []).map(z => (
              <div
                key={z.id}
                className={`p-2.5 rounded-xl border space-y-2 ${
                  z.active
                    ? 'bg-slate-50 dark:bg-neutral-800/60 border-slate-200 dark:border-neutral-700'
                    : 'bg-slate-50/50 dark:bg-neutral-800/20 border-dashed border-slate-200 dark:border-neutral-800 opacity-60'
                }`}
              >
              <div className="flex items-center gap-2.5">
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
                <span className="shrink-0 text-[0.6875rem] text-slate-400 tabular-nums hidden sm:block">
                  {z.staff?.length ?? 0} pers.
                </span>
                {!z.active && (
                  <button
                    type="button"
                    onClick={() => void guardarZona({ id: z.id, name: z.name, prefix: z.prefix, active: true })}
                    className="shrink-0 px-2 py-1 rounded-lg bg-[var(--primary)] text-white text-[0.6875rem] font-bold cursor-pointer"
                  >
                    Reactivar
                  </button>
                )}
                {z.active && <button
                  type="button"
                  onClick={() => eliminarZona(z.id)}
                  title="Quitar esta zona"
                  className="shrink-0 w-7 h-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>}
              </div>
              {/* Qué servicios se hacen aquí: así la asistente sabe quién atiende qué */}
              <div className="flex flex-wrap items-center gap-1.5 pl-0.5">
                <span className="text-[0.6875rem] text-slate-400 mr-0.5">Aquí se hace:</span>
                {!z.sinServicios && categoriasDe('service').map(c => {
                  const cat = c.key;
                  const marcadas = z.serviceCategories ?? [];
                  const activa = marcadas.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => void guardarZona({
                        id: z.id, name: z.name, prefix: z.prefix,
                        serviceCategories: activa ? marcadas.filter(c => c !== cat) : [...marcadas, cat],
                      })}
                      className={`px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold border transition cursor-pointer ${
                        activa
                          ? 'bg-[var(--primary)] text-white border-transparent'
                          : 'bg-white dark:bg-neutral-900 text-slate-500 dark:text-neutral-400 border-slate-200 dark:border-neutral-700'
                      }`}
                    >
                      {c.icon ? `${c.icon} ` : ''}{c.name}
                    </button>
                  );
                })}
                {/* El bar, la recepción, la caja: zonas para el turno, no para citas */}
                <button
                  type="button"
                  onClick={() => void guardarZona({ id: z.id, name: z.name, prefix: z.prefix, sinServicios: !z.sinServicios })}
                  className={`px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold border transition cursor-pointer ${
                    z.sinServicios
                      ? 'bg-slate-700 dark:bg-neutral-200 text-white dark:text-neutral-900 border-transparent'
                      : 'bg-white dark:bg-neutral-900 text-slate-500 dark:text-neutral-400 border-dashed border-slate-300 dark:border-neutral-600'
                  }`}
                >
                  🚫 Ningún servicio
                </button>
                <span className="w-full text-[0.6875rem] text-slate-400 italic">
                  {z.sinServicios
                    ? 'No es zona de servicios (bar, recepción…): aquí no se agenda y su gente no recibe citas.'
                    : (z.serviceCategories ?? []).length ? null
                    : zonasConServicios ? 'Sin marcar: como las otras zonas sí lo tienen, aquí no se agenda nada.'
                    : 'Sin marcar: aquí se hace de todo.'}
                </span>
              </div>
              </div>
            ))}
            {!(zonas ?? []).length && (
              <p className="py-3 text-center text-[0.75rem] text-slate-400">
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
              className="shrink-0 px-3 py-2 rounded-xl bg-[var(--primary)] text-white text-[0.75rem] font-bold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
          <p className="text-[0.75rem] text-slate-400 leading-relaxed">
            Cada una con su especialidad y su zona. La zona es la que decide a
            qué cola entra un turno cuando no se elige a mano. Con el reloj
            pones su horario (si no es el del salón) y los días que no viene.
            Con el calendario dices si recibe citas: bartender, recepción o caja
            no reciben, salvo que lo enciendas.
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
                  className="w-28 shrink-0 px-2 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.75rem] text-slate-600 dark:text-neutral-300"
                />
                <select
                  value={e.zoneId ?? ''}
                  onChange={ev => guardarEspecialista({ id: e.id, name: e.name, zoneId: ev.target.value || null })}
                  className="w-28 shrink-0 px-2 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.75rem] text-slate-600 dark:text-neutral-300"
                >
                  <option value="">Sin zona</option>
                  {(zonas ?? []).filter(z => z.active).map(z => (
                    <option key={z.id} value={z.id}>{z.prefix} · {z.name}</option>
                  ))}
                </select>
                {(() => {
                  const recibe = recibeCitas(e.atiendeCitas, e.role);
                  const porOficio = typeof e.atiendeCitas !== 'boolean';
                  return (
                    <button
                      type="button"
                      onClick={() => void guardarEspecialista({ id: e.id, name: e.name, atiendeCitas: !recibe })}
                      aria-pressed={recibe}
                      aria-label={recibe ? `${e.name} recibe citas` : `${e.name} no recibe citas`}
                      title={`${recibe ? 'Recibe citas' : 'No recibe citas: Lalan nunca se la asigna'}${porOficio ? ' (por su especialidad)' : ''}. Toca para cambiarlo.`}
                      className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer ${
                        recibe ? 'text-emerald-600 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'
                      }`}
                    >
                      {recibe ? <CalendarCheck className="w-3.5 h-3.5" /> : <CalendarOff className="w-3.5 h-3.5" />}
                    </button>
                  );
                })()}
                <button
                  type="button"
                  onClick={() => setHorarioDe(e.id)}
                  aria-label={`Horario de ${e.name}`}
                  title="Horario y días que no viene"
                  className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer ${
                    e.horarioSemanal ? 'text-[var(--primary)] bg-[var(--primary)]/10' : 'text-slate-400 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10'
                  }`}
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                </button>
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
              <p className="py-3 text-center text-[0.75rem] text-slate-400">
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
              className="w-28 shrink-0 px-2 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.75rem] text-slate-900 dark:text-white"
            />
            <select
              value={nuevaPersona.zoneId}
              onChange={ev => setNuevaPersona(p => ({ ...p, zoneId: ev.target.value }))}
              className="w-28 shrink-0 px-2 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.75rem] text-slate-900 dark:text-white"
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
              className="shrink-0 px-3 py-2 rounded-xl bg-[var(--primary)] text-white text-[0.75rem] font-bold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Añadir
            </button>
          </div>
        </div>

          </>
        )}
        {seccion === 'chats' && (
          <>
        {/* SECTION 4: LA ASISTENTE EN LOS CHATS */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-2">
          <div className="flex items-center gap-1.5">
            <Bot className="w-4 h-4 text-purple-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              {settings.aiAgentName || 'La asistente'} en los chats
            </h3>
          </div>
          {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && <ConectarMeta incrustado />}
          <button
            onClick={() => navigateTo('bots')}
            className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 hover:bg-slate-100 dark:hover:bg-neutral-800 text-left flex items-center justify-between gap-2 ios-touch cursor-pointer"
          >
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Canales, instrucciones y agenda</div>
              <div className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
                Encender cada canal, sugerencias, nombre, tono e instrucciones
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
          <button
            onClick={abrirActividad}
            className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 hover:bg-slate-100 dark:hover:bg-neutral-800 text-left flex items-center justify-between gap-2 ios-touch cursor-pointer"
          >
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Actividad reciente</div>
              <div className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
                Lo último que entró, lo que respondió, las citas que agendó y los chats que pasó a una persona
              </div>
            </div>
            <Terminal className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
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
            <span className="text-[0.6875rem] text-slate-400">Meta Webhook Reply</span>
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
            <label className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">
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
            <label className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Aviso cuando el salón está cerrado
            </label>
            <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400 mb-1.5">
              Lalan atiende y agenda a toda hora, también con el salón cerrado (solo ofrece horas en que abres).
              Este aviso solo le cuenta a la clienta que, si necesita a alguien del equipo, le escriben cuando abran.
            </p>
            <textarea
              rows={2}
              placeholder="Ahora estamos cerrados, pero yo te ayudo y te agendo. Si necesitas a alguien del equipo, te escriben apenas abramos 💜"
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

          </>
        )}
        {seccion === 'sala' && (
          <>
        {/* SECTION 3.46: PANTALLA DE PARED */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3">
          <div className="flex items-center gap-1.5">
            <MonitorPlay className="w-4 h-4 text-[var(--primary)]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Pantalla de Turnos
            </h2>
          </div>
          <p className="text-[0.75rem] text-slate-400 leading-relaxed">
            Abre esta dirección en el televisor o la tablet de la sala. No pide
            usuario ni contraseña, es de solo lectura y únicamente muestra el
            código, el nombre de pila y a dónde va cada clienta — ni teléfonos,
            ni precios, ni la agenda.
          </p>

          {/* ── Composición de la pared ───────────────────────────
              Va antes del enlace a propósito: primero se decide qué muestra
              la pantalla, y solo después se cuelga en la pared. */}
          <EditorPizarra />

          <div className="pt-3 mt-1 border-t border-slate-100 dark:border-neutral-800 flex flex-col sm:flex-row gap-3">
            {/* El QR: apuntas con la tablet y listo, sin teclear un token
                de treinta caracteres en un teclado en pantalla. */}
            <div className="shrink-0 self-center sm:self-start p-2 rounded-2xl bg-white border border-slate-200">
              {qrPantalla ? (
                <img src={qrPantalla} alt="QR de la pantalla" className="w-32 h-32" />
              ) : (
                <div className="w-32 h-32 flex items-center justify-center text-[0.6875rem] text-slate-300">
                  Generando…
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-mono break-all text-slate-600 dark:text-neutral-300">
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
                  className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[0.75rem] font-bold hover:opacity-90 transition disabled:opacity-40 cursor-pointer"
                >
                  Copiar enlace
                </button>
                <button
                  type="button"
                  disabled={!urlPantalla}
                  onClick={() => window.open(urlPantalla, '_blank', 'noopener')}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 text-[0.75rem] font-bold hover:bg-slate-200 dark:hover:bg-neutral-700 transition disabled:opacity-40 cursor-pointer"
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
                  className="px-3 py-2 rounded-xl text-[0.75rem] font-bold text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                >
                  {rotando ? 'Cambiando…' : 'Cambiar enlace'}
                </button>
              </div>

              <p className="text-[0.6875rem] text-slate-400 leading-relaxed">
                Si se pierde la tablet, cambia el enlace: el anterior deja de
                servir en ese mismo instante.
              </p>

              {/* ── El reproductor, en su propia ventana ───────────────
                  Mismo token, otra pantalla. Va aquí y no en el Lounge
                  porque el altavoz del salón es un aparato que se queda
                  encendido todo el día a la vista de cualquiera: ahí no se
                  deja una sesión abierta con la agenda y la caja dentro. */}
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-neutral-800">
                <div className="text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200">
                  Reproductor del salón
                </div>
                <p className="text-[0.6875rem] text-slate-400 leading-relaxed mt-0.5">
                  Abre esto en el aparato conectado a los altavoces. Suena ahí
                  y se controla desde el Lounge de cualquier teléfono con
                  permiso. No pide sesión y no enseña ningún dato.
                </p>
                <div className="mt-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700 text-[0.6875rem] font-mono text-slate-500 dark:text-neutral-400 break-all">
                  {urlReproductor || 'Generando enlace…'}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    type="button"
                    disabled={!urlReproductor}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(urlReproductor);
                        showToast('Copiado', 'Pégalo en el navegador del aparato que va a sonar.', 'success');
                      } catch {
                        showToast('No se pudo copiar', 'Selecciónalo y cópialo a mano.', 'warning');
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-[var(--primary)] text-white text-[0.75rem] font-bold hover:opacity-90 transition disabled:opacity-40 cursor-pointer"
                  >
                    Copiar enlace
                  </button>
                  <button
                    type="button"
                    disabled={!urlReproductor}
                    onClick={() => window.open(urlReproductor, '_blank', 'noopener')}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 text-[0.75rem] font-bold hover:bg-slate-200 dark:hover:bg-neutral-700 transition disabled:opacity-40 cursor-pointer"
                  >
                    Abrir ahora
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Cómo se anuncia un turno ─────────────────────────── */}
          <div className="pt-3 mt-1 border-t border-slate-100 dark:border-neutral-800 space-y-2">
            <div className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
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
                  className={`py-2 rounded-xl border text-[0.75rem] font-bold flex flex-col items-center gap-0.5 transition cursor-pointer ${
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
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.75rem] text-slate-900 dark:text-white"
                  >
                    <option value="">Voz automática (español)</option>
                    {voces.map(v => (
                      <option key={v.name} value={v.name}>{v.name} · {v.lang}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => decir(fraseDeTurno('G15', 'Camila', 'Carlos M.'), { voz: vozPantalla })}
                    className="shrink-0 px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-[0.75rem] font-bold text-slate-600 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700 transition cursor-pointer"
                  >
                    Probar
                  </button>
                </div>
                {/* Esto hay que decirlo: las voces las instala el sistema
                    operativo, no la web. La lista de aquí es la de ESTE
                    aparato, no la del televisor. */}
                <p className="text-[0.6875rem] text-slate-400 leading-relaxed">
                  Estas son las voces de <span className="font-semibold">este</span> dispositivo.
                  El televisor puede tener otras: si la elegida no está allí, usará
                  cualquier voz en español. Prueba el botón en el propio televisor
                  para oír cómo suena de verdad.
                </p>
              </div>
            )}

            {/* ── Los dos interruptores de la pared ──────────────────── */}
            <div className="pt-2 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pantallaSuena}
                  onChange={e => guardarInterruptor('suena', e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[var(--primary)] cursor-pointer shrink-0"
                />
                <span className="min-w-0">
                  <span className="block text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200">
                    La pantalla también pone la música
                  </span>
                  {/* Este es el caso del salón con UN televisor: sin esto
                      habría que elegir entre poner los turnos o poner la
                      música, y ninguna de las dos es aceptable. */}
                  <span className="block text-[0.6875rem] text-slate-400 leading-relaxed">
                    Para el salón de un solo televisor. La pared se vuelve el altavoz:
                    muestra la portada y el vídeo queda escondido detrás, con un botón
                    para verlo en pantalla completa.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bajarAlLlamar}
                  onChange={e => guardarInterruptor('bajar', e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[var(--primary)] cursor-pointer shrink-0"
                />
                <span className="min-w-0">
                  <span className="block text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200">
                    Bajar la música al llamar
                  </span>
                  <span className="block text-[0.6875rem] text-slate-400 leading-relaxed">
                    La música baja unos segundos mientras se anuncia el turno y
                    vuelve sola. Si tu música ya está baja, esto sobra.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* SECTION 3.47: CANCIONES PEDIDAS POR LAS CLIENTAS (QR) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3">
          <div className="flex items-center gap-1.5">
            <Music className="w-4 h-4 text-[var(--primary)]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Canciones pedidas por las clientas
            </h2>
          </div>
          <p className="text-[0.75rem] text-slate-400 leading-relaxed">
            Las clientas escanean el QR de la pantalla de turnos y piden canciones
            desde su teléfono, sin registrarse. Cada canción entra en la cola del
            salón detrás de la que está sonando.
          </p>
          <PeticionesMusica />
        </div>

          </>
        )}
        {seccion === 'caja' && (
          <>
        {/* SECTION 3.5: MONEDAS Y DENOMINACIONES */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3">
          <div className="flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Monedas y Billetes
            </h2>
          </div>
          <p className="text-[0.75rem] text-slate-400 leading-relaxed">
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
                        <span className="px-1.5 py-0.5 rounded-full text-[0.6875rem] font-extrabold bg-[var(--primary)] text-white">
                          BASE
                        </span>
                      )}
                    </div>
                    <p className="text-[0.75rem] text-slate-400 truncate">{c.name}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {c.isBase ? (
                      <span className="text-[0.75rem] text-slate-400">tasa 1.00</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-[0.6875rem] text-slate-400">1 {c.code} =</span>
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
                        <span className="text-[0.6875rem] text-slate-400">
                          {baseCurrency?.code}
                        </span>
                      </div>
                    )}
                    {!c.isBase && (
                      <>
                        <button
                          onClick={() => saveCurrency({ id: c.id, isBase: true })}
                          title="Hacerla la moneda base del salón"
                          className="px-2 py-1 rounded-lg text-[0.6875rem] font-bold text-slate-500 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition"
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
                      className="group pl-2 pr-1 py-1 rounded-lg bg-slate-100 dark:bg-neutral-800 text-[0.75rem] font-bold text-slate-600 dark:text-neutral-300 tabular-nums flex items-center gap-1"
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
                    className="w-24 px-2 py-1 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-dashed border-slate-300 dark:border-neutral-700 text-[0.75rem] text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            ))}
          </div>

          <CatalogoEnOtraMoneda />

          {/* Alta de moneda */}
          <div className="grid grid-cols-4 gap-1 pt-1">
            <input
              value={nuevaMoneda.code}
              onChange={e => setNuevaMoneda(p => ({ ...p, code: e.target.value.toUpperCase() }))}
              placeholder="USD"
              maxLength={4}
              className="px-2 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-bold uppercase text-slate-900 dark:text-white"
            />
            <input
              value={nuevaMoneda.symbol}
              onChange={e => setNuevaMoneda(p => ({ ...p, symbol: e.target.value }))}
              placeholder="US$"
              maxLength={4}
              className="px-2 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.75rem] text-slate-900 dark:text-white"
            />
            <input
              value={nuevaMoneda.name}
              onChange={e => setNuevaMoneda(p => ({ ...p, name: e.target.value }))}
              placeholder="Dólar"
              className="px-2 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.75rem] text-slate-900 dark:text-white"
            />
            <input
              type="number"
              step="0.01"
              value={nuevaMoneda.rateToBase}
              onChange={e => setNuevaMoneda(p => ({ ...p, rateToBase: e.target.value }))}
              placeholder="60"
              className="px-2 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-mono tabular-nums text-slate-900 dark:text-white"
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
            className="w-full py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-[0.75rem] font-bold text-slate-600 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700 transition disabled:opacity-40"
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
          <p className="text-[0.75rem] text-slate-400 leading-relaxed">
            El recibo se manda al diálogo de impresión del navegador, así que
            funciona con cualquier impresora instalada en la computadora —
            térmica o matricial — sin instalar nada aparte.
          </p>

          <div>
            <label className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">
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
                  <span className="block text-[0.6875rem] font-normal opacity-70">
                    {mm === 58 ? 'térmica chica' : 'estándar POS'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">
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
            <label className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">
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

          </>
        )}
        {seccion === 'apariencia' && (
          <>
            <TamanoLetraSelector />
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
                <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
                  Primario · Acento / Secundario · Terciario
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowThemeModal(true)}
              className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white font-bold text-[0.6875rem] flex items-center gap-1 shadow-xs ios-touch cursor-pointer hover:opacity-90"
            >
              <Sparkles className="w-3 h-3" />
              <span>Ver Paletas</span>
            </button>
          </div>

          {/* Theme Mode Selector (Claro / Oscuro / Sistema) */}
          <div>
            <label className="block text-[0.75rem] font-semibold text-slate-500 dark:text-neutral-400 mb-1.5">
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
                <span className="text-[0.6875rem] font-bold text-slate-700 dark:text-slate-300">Primario</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full shadow-xs"
                  style={{ backgroundColor: accentColor }}
                />
                <span className="text-[0.6875rem] font-bold text-slate-700 dark:text-slate-300">Acento</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full shadow-xs"
                  style={{ backgroundColor: tertiaryColor }}
                />
                <span className="text-[0.6875rem] font-bold text-slate-700 dark:text-slate-300">Terciario</span>
              </div>
            </div>

            <button
              onClick={() => setShowCustomPickers(!showCustomPickers)}
              className="text-[0.6875rem] font-bold text-[var(--primary)] hover:underline flex items-center gap-1"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>{showCustomPickers ? 'Ocultar HEX' : 'Editar HEX'}</span>
            </button>
          </div>

          {/* Custom HEX Pickers (Optional expand) */}
          {showCustomPickers && (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/50 border border-slate-200/80 dark:border-neutral-700/80 grid grid-cols-3 gap-2">
              <div className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200/60 dark:border-neutral-800 text-center">
                <label className="block text-[0.6875rem] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Primario
                </label>
                <div className="flex items-center justify-center gap-1.5">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="w-5 h-5 rounded-full border-0 cursor-pointer p-0 bg-transparent"
                  />
                  <span className="text-[0.6875rem] font-mono uppercase text-slate-500">
                    {primaryColor}
                  </span>
                </div>
              </div>

              <div className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200/60 dark:border-neutral-800 text-center">
                <label className="block text-[0.6875rem] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Acento
                </label>
                <div className="flex items-center justify-center gap-1.5">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={e => setAccentColor(e.target.value)}
                    className="w-5 h-5 rounded-full border-0 cursor-pointer p-0 bg-transparent"
                  />
                  <span className="text-[0.6875rem] font-mono uppercase text-slate-500">
                    {accentColor}
                  </span>
                </div>
              </div>

              <div className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200/60 dark:border-neutral-800 text-center">
                <label className="block text-[0.6875rem] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Terciario
                </label>
                <div className="flex items-center justify-center gap-1.5">
                  <input
                    type="color"
                    value={tertiaryColor}
                    onChange={e => setTertiaryColor(e.target.value)}
                    className="w-5 h-5 rounded-full border-0 cursor-pointer p-0 bg-transparent"
                  />
                  <span className="text-[0.6875rem] font-mono uppercase text-slate-500">
                    {tertiaryColor}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Quick 1-Click Preset Palettes Grid */}
          <div className="space-y-2">
            <label className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300">
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
                        <div className="text-[0.75rem] font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                          <span>{preset.name}</span>
                          {isSelected && (
                            <span className="text-[0.6875rem] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold">
                              Activo
                            </span>
                          )}
                        </div>
                        <div className="text-[0.6875rem] text-slate-500 dark:text-neutral-400 truncate">
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

          </>
        )}
        </motion.div>
        </AnimatePresence>
      </PageContent>

      {horarioDe && (() => {
        const persona = (especialistas ?? []).find(x => x.id === horarioDe);
        return persona ? (
          <HorarioEspecialista
            persona={persona}
            semanaSalon={semanaCompleta(settings.horarioSemanal, settings.openingTime, settings.closingTime)}
            onCerrar={() => setHorarioDe(null)}
          />
        ) : null;
      })()}


      {/* Actividad reciente de los chats */}
      <IOSModal
        isOpen={showLogsModal}
        onClose={() => setShowLogsModal(false)}
        title="Actividad reciente"
        subtitle="Lo último que pasó en los chats del salón"
      >
        <div className="space-y-1.5 text-[0.75rem]">
          {actividad === null && <p className="text-slate-400 text-center py-6">Cargando…</p>}
          {actividad?.length === 0 && (
            <p className="text-slate-400 text-center py-6">Todavía no hay actividad en los chats.</p>
          )}
          {actividad?.map(ev => {
            const estilo = ESTILO_ACTIVIDAD[ev.tipo];
            const cuando = new Date(ev.en).toLocaleString('es', { day: 'numeric', month: 'short', hour: 'numeric', hour12: true, minute: '2-digit' });
            const abrible = !!ev.conversacionId;
            return (
              <button
                key={`${ev.tipo}-${ev.id}`}
                type="button"
                disabled={!abrible}
                onClick={() => { if (ev.conversacionId) { setShowLogsModal(false); abrirConversacion(ev.conversacionId); } }}
                className="w-full text-left p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/70 dark:border-neutral-800 enabled:hover:border-[var(--primary)] enabled:cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 text-[0.6875rem]">
                  <span className={`px-1.5 rounded font-bold ${estilo.clase}`}>{estilo.titulo}</span>
                  <span className="text-slate-400 tabular-nums">{ev.canal.descripcion} · {cuando}</span>
                </div>
                <div className="mt-1 text-slate-800 dark:text-neutral-200">
                  <span className="font-semibold">{ev.cliente}</span>
                  {ev.tipo === 'cita' && ev.citaInicio
                    ? <> · {ev.texto} el {new Date(ev.citaInicio).toLocaleString('es', { weekday: 'long', day: 'numeric', hour: 'numeric', hour12: true, minute: '2-digit' })}</>
                    : <> · {ev.texto}</>}
                </div>
              </button>
            );
          })}
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
