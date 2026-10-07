import React, { useEffect, useState } from 'react';
import { ActividadCanal } from '../components/canales/ActividadCanal';
import { CostosWhatsapp } from '../components/canales/CostosWhatsapp';
import { PlantillasWhatsapp } from '../components/canales/PlantillasWhatsapp';
import { motion } from 'motion/react';
import {
  Bot,
  MessageCircle,
  Instagram,
  Facebook,
  Sparkles,
  Zap,
  Activity,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../context/PlanContext';

/** Cuántas horas antes va el segundo recordatorio (0 = no se manda) */
const HORAS_RECORDATORIO = [
  { valor: 0, texto: 'No mandar' },
  { valor: 1, texto: '1 hora antes' },
  { valor: 2, texto: '2 horas antes' },
  { valor: 3, texto: '3 horas antes' },
  { valor: 4, texto: '4 horas antes' },
];
import { CommunicationChannel } from '../types';
import { IOSHeader } from '../components/ui/IOSHeader';
import { IOSToggle } from '../components/ui/IOSToggle';
import { PageContent } from '../components/ui/PageContent';
import { ConectarMeta } from '../components/canales/ConectarMeta';

export const BotsControlScreen: React.FC = () => {
  const { botConfigs, toggleBotChannel, updateBotMessage, settings, updateSettings, showToast, navigateTo } = useApp();
  const { currentUser } = useAuth();

  /* Las instrucciones base: se muestran para que la dueña vea qué dice
     Lalan cuando el campo está vacío, y para partir de ellas si quiere
     cambiarlas en vez de escribir desde cero */
  const [promptBase, setPromptBase] = useState<string | null>(null);
  const [fijo, setFijo] = useState<{ politicas: string; reglas: string } | null>(null);
  const [verBase, setVerBase] = useState(false);
  const [verFijo, setVerFijo] = useState(false);
  const cargarPrompt = () => api.get<{ texto: string; politicas: string; reglas: string }>('/chat/panel/prompt-base')
    .then(r => { setPromptBase(r.texto); setFijo({ politicas: r.politicas, reglas: r.reglas }); })
    .catch(() => setPromptBase(null));
  // Las políticas salen de los parámetros del salón: si cambian, se vuelven a pedir
  useEffect(() => { void cargarPrompt(); }, [
    settings.depositPercent, settings.requireDeposit, settings.aiAutoBooking, settings.aiAgentName,
    settings.cancellationNoticeHours, settings.gracePeriodMinutes, settings.maxAdvanceBookingDays,
  ]);
  const esDireccion = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  /* Aviso a la dueña por WhatsApp: se editan en local y se guardan al salir del campo */
  const [nombreAviso, setNombreAviso] = useState(settings.alertContactName ?? '');
  const [telefonoAviso, setTelefonoAviso] = useState(settings.alertPhone ?? '');
  useEffect(() => { setNombreAviso(settings.alertContactName ?? ''); }, [settings.alertContactName]);
  useEffect(() => { setTelefonoAviso(settings.alertPhone ?? ''); }, [settings.alertPhone]);
  const [probandoAviso, setProbandoAviso] = useState(false);
  const probarAviso = async () => {
    setProbandoAviso(true);
    try {
      const r = await api.post<{ hecho: boolean; motivo: string | null }>('/chat/panel/aviso-prueba', {});
      if (r.hecho) showToast('Aviso enviado', 'Revisa el WhatsApp de ese número: debería llegar en unos segundos.', 'success');
      else showToast('No se pudo enviar el aviso', r.motivo ?? 'Revisa la configuración.', 'warning');
    } catch (e: any) {
      showToast('No se pudo enviar el aviso', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally { setProbandoAviso(false); }
  };
  const [instruccionesSalon, setInstruccionesSalon] = useState(settings.aiPromptSalon ?? '');
  useEffect(() => { setInstruccionesSalon(settings.aiPromptSalon ?? ''); }, [settings.aiPromptSalon]);

  /** "hace 5 min", "hace 3 h", "hace 2 días": para ver de un vistazo si el canal está vivo */
  const haceCuanto = (iso: string | null) => {
    if (!iso) return 'todavía no ha respondido';
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
    if (min < 1) return 'respondió hace un momento';
    if (min < 60) return `respondió hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `respondió hace ${h} h`;
    return `respondió hace ${Math.round(h / 24)} días`;
  };

  /**
   * La cuenta de Meta de cada canal.
   *
   * Es lo que decide de qué salón es cada mensaje que entra: n8n manda "llegó
   * esto a la cuenta X" y el backend busca aquí de quién es X. Se guarda al
   * salir del campo, no en cada tecla, y si otro salón ya la tiene conectada
   * se deshace y se dice por qué.
   */
  const [cuentas, setCuentas] = useState<Partial<Record<CommunicationChannel, string>>>({});
  useEffect(() => {
    setCuentas(Object.fromEntries(botConfigs.map(b => [b.id, b.channelIdentifier ?? ''])));
  }, [botConfigs]);

  const guardarCuenta = async (canal: CommunicationChannel, actual: string) => {
    const valor = (cuentas[canal] ?? '').trim();
    if (valor === actual) return;
    try {
      await updateBotMessage(canal, 'channelIdentifier', valor);
      showToast(
        valor ? 'Cuenta conectada' : 'Cuenta desconectada',
        valor ? 'Los mensajes de esta cuenta ya llegan a este salón.' : 'Este canal ya no recibe mensajes.',
        'success',
      );
    } catch (e: any) {
      setCuentas(c => ({ ...c, [canal]: actual }));
      showToast('No se pudo conectar la cuenta', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    }
  };

  /** Qué número tiene que pegar la dueña, según el canal: cada uno lo llama distinto */
  const AYUDA_CUENTA: Record<CommunicationChannel, string> = {
    whatsapp: 'Phone number ID — Meta › WhatsApp › Configuración de la API',
    instagram: 'ID de la cuenta profesional de Instagram',
    messenger: 'ID de la página de Facebook',
  };

  /* El nombre y las instrucciones se editan en local y se guardan al salir
     del campo: guardar en cada tecla mandaría una petición por letra */
  const [nombreAgente, setNombreAgente] = useState(settings.aiAgentName);
  const [instrucciones, setInstrucciones] = useState(settings.aiPrompt ?? '');
  useEffect(() => { setNombreAgente(settings.aiAgentName); }, [settings.aiAgentName]);
  useEffect(() => { setInstrucciones(settings.aiPrompt ?? ''); }, [settings.aiPrompt]);
  const agente = settings.aiAgentName || 'la asistente';
  const { tieneModulo } = usePlan();
  const conRecordatorios = tieneModulo('recordatorios');

  const getChannelIcon = (id: CommunicationChannel) => {
    switch (id) {
      case 'whatsapp':
        return <MessageCircle className="w-5 h-5 text-emerald-500" />;
      case 'instagram':
        return <Instagram className="w-5 h-5 text-pink-500" />;
      case 'messenger':
        return <Facebook className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div id="bots-control-screen" className="flex-1 w-full h-full flex flex-col overflow-hidden">
      <IOSHeader
        title={`${agente} en los chats`}
        subtitle="WhatsApp, Instagram y Messenger"
      />

      <PageContent className="space-y-4">
        {/* Aquí solo se muestra lo que de verdad pasó: cada número sale de la base */}
        <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 px-1 leading-relaxed">
          Cada canal se enciende por separado. Encendido, {agente} contesta sola; apagado, no le escribe a nadie
          y, si abajo están activas las sugerencias, solo te propone respuestas. Una conversación que {agente} pasa
          a una persona queda en tus manos hasta que se la devuelvas desde el chat.
        </p>

        {esDireccion && <ConectarMeta />}

        {/* Independent Channel Bot Toggles */}
        <div className="space-y-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 block px-1">
            Interruptores de Automatización por Canal
          </span>

          {botConfigs.map(bot => (
            <motion.div
              key={bot.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3"
            >
              {/* Top Row: Icon, Title & Main Switch */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-neutral-800 flex items-center justify-center">
                    {getChannelIcon(bot.id)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      {bot.name}
                    </h4>
                    <span className="text-[0.6875rem] text-slate-400">
                      {bot.channelIdentifier
                        ? <>{bot.cuentaNombre && <span className="font-semibold text-slate-600 dark:text-neutral-300">{bot.cuentaNombre} · </span>}{haceCuanto(bot.actividad.ultimaRespuesta)}</>
                        : 'sin cuenta conectada'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[0.6875rem] font-extrabold ${
                      bot.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    {bot.enabled ? 'ENCENDIDO' : 'APAGADO'}
                  </span>
                  <IOSToggle
                    id={`bot-toggle-${bot.id}`}
                    checked={bot.enabled}
                    onChange={checked => toggleBotChannel(bot.id, checked)}
                    activeColor="#22c55e"
                  />
                </div>
              </div>

              {/* La cuenta de Meta que alimenta este canal: a mano solo el super admin;
                  la dueña usa los botones "Conectar" de arriba */}
              {currentUser?.role === 'super_admin' ? (
              <div className="pt-2 border-t border-slate-100 dark:border-neutral-800/80">
                <label className="block text-[0.6875rem] font-bold uppercase text-slate-400 mb-1">
                  Cuenta de Meta conectada
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cuentas[bot.id] ?? ''}
                  onChange={e => setCuentas(c => ({ ...c, [bot.id]: e.target.value }))}
                  onBlur={() => void guardarCuenta(bot.id, bot.channelIdentifier ?? '')}
                  placeholder="Sin conectar"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
                <p className="text-[0.6875rem] text-slate-400 mt-1">
                  {bot.cuentaNombre && bot.channelIdentifier ? <span className="font-semibold text-slate-600 dark:text-neutral-300">Es {bot.cuentaNombre} · </span> : null}
                  {AYUDA_CUENTA[bot.id]}
                </p>
              </div>
              ) : !bot.channelIdentifier && (
                <p className="pt-2 border-t border-slate-100 dark:border-neutral-800/80 text-[0.75rem] text-slate-500">
                  Sin conectar: usa el botón de {bot.name} de arriba.
                </p>
              )}

              {/* Lo que hizo, contado de verdad: hoy o los últimos días */}
              <ActividadCanal canal={bot.id} hoy={bot.actividad} alVerChats={() => navigateTo('chats')} />

              {/* WhatsApp: lo que cobra Meta, apagar lo cobrado y cómo se ven las plantillas */}
              {bot.id === 'whatsapp' && bot.channelIdentifier && esDireccion && (
                <details className="pt-2 border-t border-slate-100 dark:border-neutral-800/80 group">
                  <summary className="text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200 cursor-pointer select-none">
                    Lo que cobra Meta y tus plantillas
                  </summary>
                  <div className="mt-2 space-y-2">
                    <CostosWhatsapp />
                    <PlantillasWhatsapp />
                  </div>
                </details>
              )}
            </motion.div>
          ))}
        </div>

        {/* Global AI Salon Parameters */}
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-purple-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Parámetros de Agendamiento IA
              </h3>
            </div>
            <span className="text-[0.6875rem] font-bold text-purple-600 dark:text-purple-400">
            </span>
          </div>

          {/* Setting 1: Auto Booking */}
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-neutral-800/80">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Agendamiento 100% Autónomo
              </div>
              <div className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
                El bot bloquea el horario directamente sin requerir confirmación humana.
              </div>
            </div>
            <IOSToggle
              id="toggle-auto-booking"
              checked={settings.aiAutoBooking}
              onChange={val => updateSettings({ aiAutoBooking: val })}
              activeColor="#9333ea"
            />
          </div>

          {/* Setting 2: Require Deposit */}
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-neutral-800/80">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Exigir {settings.depositPercent}% de anticipo
              </div>
              <div className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
                Al agendar, {agente} le dice a la clienta cuánto es el anticipo ({settings.depositPercent}% del total). El porcentaje se cambia en Ajustes.
              </div>
            </div>
            <IOSToggle
              id="toggle-require-deposit"
              checked={settings.requireDeposit}
              onChange={val => updateSettings({ requireDeposit: val })}
              activeColor="#9333ea"
            />
          </div>

          {/* La asistente: cómo se llama */}
          <div className="py-1.5 border-b border-slate-100 dark:border-neutral-800/80">
            <label className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nombre de la asistente
            </label>
            <input
              type="text"
              value={nombreAgente}
              maxLength={40}
              onChange={e => setNombreAgente(e.target.value)}
              onBlur={() => {
                const limpio = nombreAgente.trim();
                if (!limpio) { setNombreAgente(settings.aiAgentName); return; }   // sin nombre no hay asistente
                if (limpio !== settings.aiAgentName) updateSettings({ aiAgentName: limpio });
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          {/* Sugerencias con la asistente pausada */}
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-neutral-800/80 gap-3">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Sugerencias cuando {agente} no atiende
              </div>
              <div className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
                Con un canal apagado o un chat en manos de una persona, {agente} sigue leyendo y te propone
                respuestas. Cada sugerencia consume lo mismo que una respuesta; apagado, {agente} no gasta nada.
              </div>
            </div>
            <IOSToggle
              id="toggle-sugerencias"
              checked={settings.aiSuggestWhenPaused}
              onChange={val => updateSettings({ aiSuggestWhenPaused: val })}
              activeColor="#9333ea"
            />
          </div>

          {/* Aviso por WhatsApp a la dueña o a quien esté de guardia */}
          <div className="py-1.5 border-b border-slate-100 dark:border-neutral-800/80 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Avisarme por WhatsApp</div>
                <div className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
                  Cuando {agente} pase un chat a una persona o agende una cita sin especialista, te llega un WhatsApp
                  (plantilla aprobada por Meta). Es el único mensaje que el sistema manda sin que le escriban.
                </div>
              </div>
              <IOSToggle
                id="toggle-avisos-duena"
                checked={settings.alertsEnabled}
                onChange={val => updateSettings({ alertsEnabled: val })}
                activeColor="#9333ea"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[0.6875rem] font-bold text-slate-500 mb-0.5">Cómo te saluda</label>
                <input
                  type="text"
                  value={nombreAviso}
                  maxLength={40}
                  placeholder="Alanny"
                  onChange={e => setNombreAviso(e.target.value)}
                  onBlur={() => { if (nombreAviso.trim() !== (settings.alertContactName ?? '')) updateSettings({ alertContactName: nombreAviso.trim() || null }); }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>
              <div>
                <label className="block text-[0.6875rem] font-bold text-slate-500 mb-0.5">WhatsApp, con código de país</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={telefonoAviso}
                  placeholder="584141234567"
                  onChange={e => setTelefonoAviso(e.target.value)}
                  onBlur={() => {
                    const digitos = telefonoAviso.replace(/\D/g, '');
                    if (digitos && (digitos.length < 8 || digitos.length > 15)) {
                      showToast('Número no válido', 'Escríbelo con código de país y solo números: 584141234567.', 'warning');
                      return;
                    }
                    if (digitos !== (settings.alertPhone ?? '')) updateSettings({ alertPhone: digitos || null });
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>
            </div>
            {settings.alertsEnabled && (
              <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-[0.75rem] text-amber-900 dark:text-amber-100">
                <span>
                  <b className="block">Aunque Meta lo cobre</b>
                  Si no le has escrito a {agente} en 24 h, el aviso es una plantilla y Meta la cobra a tu cuenta de WhatsApp.
                  Apagado, solo te avisa por WhatsApp dentro de esas 24 h (gratis); fuera, te llega la notificación de la app.
                </span>
                <IOSToggle id="toggle-avisos-pagados" checked={settings.avisosPagados} onChange={val => updateSettings({ avisosPagados: val })} activeColor="#d97706" />
              </label>
            )}
            <button
              type="button"
              onClick={probarAviso}
              disabled={probandoAviso || !settings.alertPhone}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200 disabled:opacity-50 cursor-pointer"
            >
              {probandoAviso ? 'Enviando…' : 'Enviar aviso de prueba'}
            </button>
          </div>

          {/* Recordatorios de cita a la clienta */}
          <div className="py-1.5 border-b border-slate-100 dark:border-neutral-800/80 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Recordatorios de cita</div>
                <div className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
                  {conRecordatorios
                    ? `${agente} le recuerda la cita a la clienta por WhatsApp. Si ella contesta que necesita cambiarla, ${agente} la reagenda. Cada recordatorio que sale fuera de una conversación abierta tiene un costo pequeño en Meta.`
                    : 'Incluidos en el Plan Salón y en el Plan Lounge. Escríbenos para activarlos.'}
                </div>
              </div>
              <IOSToggle
                id="toggle-recordatorios"
                checked={conRecordatorios && settings.remindersEnabled}
                disabled={!conRecordatorios}
                onChange={val => updateSettings({ remindersEnabled: val })}
                activeColor="#9333ea"
              />
            </div>
            {conRecordatorios && settings.remindersEnabled && (
              <div className="grid sm:grid-cols-2 gap-2">
                <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800/60 text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-200">
                  <span>El día antes, a la hora de la cita</span>
                  <IOSToggle id="toggle-recordatorio-dia" checked={settings.reminderDayBefore} onChange={val => updateSettings({ reminderDayBefore: val })} activeColor="#9333ea" />
                </label>
                <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800/60 text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-200">
                  <span>Unas horas antes</span>
                  <select
                    value={settings.reminderHoursBefore}
                    onChange={e => updateSettings({ reminderHoursBefore: Number(e.target.value) })}
                    className="px-2 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.75rem] dark:[color-scheme:dark]"
                  >
                    {HORAS_RECORDATORIO.map(o => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
                  </select>
                </label>
                <label className="sm:col-span-2 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-[0.75rem] text-amber-900 dark:text-amber-100">
                  <span>
                    <b className="block">Aunque Meta lo cobre</b>
                    Si la clienta no ha escrito en 24 h, el recordatorio es una plantilla y Meta la cobra a tu cuenta de WhatsApp.
                    Apagado, solo se le recuerda a quien tiene la conversación abierta (gratis).
                  </span>
                  <IOSToggle id="toggle-recordatorios-pagados" checked={settings.recordatoriosPagados} onChange={val => updateSettings({ recordatoriosPagados: val })} activeColor="#d97706" />
                </label>
              </div>
            )}
          </div>

          {/* Instrucciones para todo el salón (todas las sedes) */}
          {esDireccion && (
            <div className="py-1.5 border-b border-slate-100 dark:border-neutral-800/80">
              <label className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Instrucciones de {agente} para todas las sedes
              </label>
              <textarea
                value={instruccionesSalon}
                maxLength={8000}
                rows={5}
                onChange={e => setInstruccionesSalon(e.target.value)}
                onBlur={() => {
                  const texto = instruccionesSalon.trim();
                  if (texto !== (settings.aiPromptSalon ?? '')) updateSettings({ aiPromptSalon: texto || null });
                }}
                placeholder={`Vacío: todas las sedes usan las instrucciones base.`}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-y"
              />
              <p className="text-[0.6875rem] text-slate-400 mt-1">
                Valen para todas las sucursales, salvo las que escriban las suyas abajo.
              </p>
            </div>
          )}

          {/* Instrucciones propias de la sede */}
          <div className="py-1.5 border-b border-slate-100 dark:border-neutral-800/80">
            <label className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Instrucciones de {agente} solo para esta sede
            </label>
            <textarea
              value={instrucciones}
              maxLength={8000}
              rows={6}
              onChange={e => setInstrucciones(e.target.value)}
              onBlur={() => {
                const texto = instrucciones.trim();
                if (texto !== (settings.aiPrompt ?? '')) updateSettings({ aiPrompt: texto || null });
              }}
              placeholder={settings.aiPromptSalon
                ? 'Vacío: esta sede usa las instrucciones del salón.'
                : `Vacío: ${agente} usa las instrucciones base (las ves abajo).`}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-y"
            />
            {promptBase && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVerBase(v => !v)}
                  className="flex items-center gap-1 text-[0.6875rem] font-bold text-[var(--primary)] cursor-pointer"
                >
                  <FileText className="w-3 h-3" /> {verBase ? 'Ocultar' : 'Ver'} las instrucciones base
                </button>
                {!instrucciones.trim() && (
                  <button
                    type="button"
                    onClick={() => setInstrucciones(promptBase)}
                    className="text-[0.6875rem] font-bold text-slate-600 dark:text-neutral-300 underline cursor-pointer"
                  >
                    Partir de ellas para escribir las mías
                  </button>
                )}
              </div>
            )}
            {verBase && promptBase && (
              <pre className="mt-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700 text-[0.6875rem] text-slate-600 dark:text-neutral-300 whitespace-pre-wrap font-sans max-h-64 overflow-y-auto">
                {promptBase}
              </pre>
            )}
            {fijo && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setVerFijo(v => !v)}
                  className="flex items-center gap-1 text-[0.6875rem] font-bold text-[var(--primary)] cursor-pointer"
                >
                  <FileText className="w-3 h-3" /> {verFijo ? 'Ocultar' : 'Ver'} lo que {agente} recibe además de tus instrucciones
                </button>
                {verFijo && (
                  <div className="mt-1.5 space-y-2">
                    <div>
                      <div className="text-[0.6875rem] font-bold text-slate-600 dark:text-neutral-300">
                        Políticas del salón (salen de los parámetros: cambian solas si cambias un parámetro)
                      </div>
                      <pre className="mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700 text-[0.6875rem] text-slate-600 dark:text-neutral-300 whitespace-pre-wrap font-sans">{fijo.politicas}</pre>
                    </div>
                    <div>
                      <div className="text-[0.6875rem] font-bold text-slate-600 dark:text-neutral-300">
                        Reglas de trabajo (fijas: son las que hacen que agende bien y no invente)
                      </div>
                      <pre className="mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700 text-[0.6875rem] text-slate-600 dark:text-neutral-300 whitespace-pre-wrap font-sans max-h-72 overflow-y-auto">{fijo.reglas}</pre>
                    </div>
                    <p className="text-[0.6875rem] text-slate-400">
                      Además recibe la lista de servicios con precios, el equipo y quién hace qué, la ficha de la clienta y la conversación.
                    </p>
                  </div>
                )}
              </div>
            )}
            <p className="text-[0.6875rem] text-slate-400 mt-1 leading-relaxed">
              Puedes usar {'{{agente}}'}, {'{{negocio}}'}, {'{{sede}}'}, {'{{horario}}'},{' '}
              {'{{zona_horaria}}'}, {'{{fecha_actual}}'}, {'{{tono}}'} y {'{{clienta}}'}: se rellenan
              solos con los datos del salón en cada conversación.
            </p>
          </div>

          {/* Setting 3: AI Tone */}
          <div className="pt-1">
            <label className="block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1">
              Tono de Personalidad del Bot de Salón
            </label>
            <select
              value={settings.aiTone}
              onChange={e => updateSettings({ aiTone: e.target.value as any })}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="friendly_luxury">✨ Amable & Lujoso (Recomendado para Spas)</option>
              <option value="direct_professional">💼 Directo & Profesional</option>
              <option value="chic_casual">💅 Chic & Juvenil</option>
            </select>
          </div>
        </div>
      </PageContent>
    </div>
  );
};
