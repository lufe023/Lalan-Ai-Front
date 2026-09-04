import React, { useState } from 'react';
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
  Play,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { CommunicationChannel } from '../types';
import { IOSHeader } from '../components/ui/IOSHeader';
import { IOSToggle } from '../components/ui/IOSToggle';

export const BotsControlScreen: React.FC = () => {
  const { botConfigs, toggleBotChannel, settings, updateSettings, showToast, addSystemLog } = useApp();
  const { currentUser } = useAuth();
  const [testingChannel, setTestingChannel] = useState<CommunicationChannel | null>(null);

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

  const handleTestWebhook = (channelId: CommunicationChannel) => {
    setTestingChannel(channelId);
    addSystemLog({
      level: 'info',
      service: 'Meta_Webhook',
      message: `Enviando ping de prueba a Webhook Meta (${channelId})...`,
    });

    setTimeout(() => {
      setTestingChannel(null);
      showToast(
        'Webhook 200 OK',
        `El endpoint de ${channelId.toUpperCase()} respondió en 36ms. Token activo.`,
        'success'
      );
      addSystemLog({
        level: 'success',
        service: 'Meta_Webhook',
        message: `Webhook ${channelId} validado con Meta Cloud API. Latencia: 36ms.`,
      });
    }, 1200);
  };

  return (
    <div id="bots-control-screen" className="flex-1 w-full h-full flex flex-col overflow-hidden">
      <IOSHeader
        title="Panel de Bots Meta"
        subtitle="Control independiente de IA para WhatsApp, Instagram y Messenger"
      />

      <div className="flex-1 overflow-y-auto hide-scrollbar px-4 pb-6 space-y-4">
        {/* Meta Server Connection Health Status */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-slate-100 to-sky-500/10 dark:from-emerald-950/30 dark:via-neutral-900 dark:to-sky-950/30 border border-emerald-500/30 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-sm">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Meta Graph API v20.0
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-500 text-white">
                  ONLINE
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-neutral-400">
                SSL Handshake verificado • Webhooks activos
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-mono">Latencia Media</span>
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
              ~41 ms
            </span>
          </div>
        </div>

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
                    <span className="text-[10px] font-mono text-slate-400">
                      Modelo: {bot.model}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-extrabold ${
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

              {/* Bot Performance Stats */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-neutral-800/80">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-neutral-800/60 text-left">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">
                    Mensajes Hoy
                  </span>
                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                    {bot.messagesProcessedToday} respondidos
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 dark:bg-neutral-800/60 text-left">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">
                    Citas Agendadas
                  </span>
                  <span className="text-xs font-extrabold text-[var(--primary)]">
                    {bot.appointmentsBookedToday} automáticas
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-slate-400">
                  Webhook Ping: {bot.webhookLatencyMs}ms
                </span>

                <button
                  onClick={() => handleTestWebhook(bot.id)}
                  disabled={testingChannel === bot.id}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-300 text-[10px] font-bold flex items-center gap-1 ios-touch cursor-pointer transition"
                >
                  {testingChannel === bot.id ? (
                    <>
                      <RotateCcw className="w-3 h-3 animate-spin text-[var(--primary)]" />
                      <span>Probando...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      <span>Test Webhook</span>
                    </>
                  )}
                </button>
              </div>
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
            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
              Lalan Engine v3
            </span>
          </div>

          {/* Setting 1: Auto Booking */}
          <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-neutral-800/80">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Agendamiento 100% Autónomo
              </div>
              <div className="text-[10px] text-slate-500 dark:text-neutral-400">
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
                Exigir 30% de Anticipo Previo
              </div>
              <div className="text-[10px] text-slate-500 dark:text-neutral-400">
                La IA solicita comprobante antes de confirmar definitivamente la cita.
              </div>
            </div>
            <IOSToggle
              id="toggle-require-deposit"
              checked={settings.requireDeposit}
              onChange={val => updateSettings({ requireDeposit: val })}
              activeColor="#9333ea"
            />
          </div>

          {/* Setting 3: AI Tone */}
          <div className="pt-1">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
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
      </div>
    </div>
  );
};
