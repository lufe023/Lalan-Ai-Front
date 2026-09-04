import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles,
  ShieldCheck,
  UserCheck,
  Headphones,
  CheckCircle2,
  ArrowRight,
  Flower2,
  KeyRound,
  Lock,
  Bot,
} from 'lucide-react';
import { useAuth, PROFILES } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';

export const LoginScreen: React.FC = () => {
  const { loginAs } = useAuth();
  const { showToast, navigateTo } = useApp();
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');

  const handleQuickLogin = (role: UserRole) => {
    loginAs(role);
    const profile = PROFILES[role];
    showToast(
      `¡Bienvenida/o ${profile.name}!`,
      `Has iniciado sesión con el rol de ${profile.roleTitle}.`,
      'success'
    );
    // Navigate to appropriate primary screen based on role
    if (role === 'assistant') {
      navigateTo('calendar');
    } else if (role === 'support') {
      navigateTo('bots');
    } else {
      navigateTo('dashboard');
    }
  };

  return (
    <div
      id="login-screen"
      className="flex-1 w-full h-full overflow-y-auto hide-scrollbar p-5 flex flex-col justify-between select-none"
    >
      {/* Top Brand Header */}
      <div className="flex flex-col items-center text-center pt-3 pb-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[var(--primary)] to-indigo-500 p-0.5 shadow-lg mb-3 flex items-center justify-center">
          <div className="w-full h-full rounded-[14px] bg-white dark:bg-neutral-900 flex items-center justify-center">
            <Bot className="w-8 h-8 text-[var(--primary)]" />
          </div>
        </div>

        <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white tracking-tight">
          Lalan AI
        </h1>
        <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 max-w-xs font-medium">
          Live Assistant for Logistics, Appointments & Networks
        </p>
      </div>

      {/* Role Selection / Quick Access Section */}
      <div className="my-auto space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" />
            Acceso Rápido por Perfil (Mock Login)
          </span>
          <span className="text-[10px] text-slate-400 font-medium">1-Tap Login</span>
        </div>

        {/* 3 Quick Access Role Cards */}
        <div className="space-y-2.5">
          {/* Card 1: Alanny (Admin) */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedRole('admin')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
              selectedRole === 'admin'
                ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-500/60 shadow-md ring-2 ring-rose-500/30'
                : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <img
                src={PROFILES.admin.avatar}
                alt="Alanny"
                className="w-12 h-12 rounded-full object-cover border-2 border-rose-500/50 shadow-xs"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">Alanny</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Administradora
                    </span>
                  </div>
                  {selectedRole === 'admin' && (
                    <CheckCircle2 className="w-4 h-4 text-rose-500 fill-rose-500 text-white" />
                  )}
                </div>

                <p className="text-[11px] text-slate-600 dark:text-neutral-300 mt-1 leading-snug">
                  Acceso total: Métricas financieras, configuración de bots Meta y gestión global.
                </p>

                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 font-medium">
                    ✓ Métricas & Ganancias
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 font-medium">
                    ✓ Control de Bots
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 font-medium">
                    ✓ Toda la Agenda
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Alan (Assistant) */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedRole('assistant')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
              selectedRole === 'assistant'
                ? 'bg-sky-50/80 dark:bg-sky-950/30 border-sky-500/60 shadow-md ring-2 ring-sky-500/30'
                : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <img
                src={PROFILES.assistant.avatar}
                alt="Alan"
                className="w-12 h-12 rounded-full object-cover border-2 border-sky-500/50 shadow-xs"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">Alan</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center gap-1">
                      <UserCheck className="w-3 h-3" />
                      Asistente
                    </span>
                  </div>
                  {selectedRole === 'assistant' && (
                    <CheckCircle2 className="w-4 h-4 text-sky-500 fill-sky-500 text-white" />
                  )}
                </div>

                <p className="text-[11px] text-slate-600 dark:text-neutral-300 mt-1 leading-snug">
                  Acceso a la agenda del salón, confirmación de citas y atención de chats directos.
                </p>

                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 font-medium">
                    ✓ Calendario y Citas
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 font-medium">
                    ✓ Inbox WhatsApp / IG
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 font-medium">
                    ✓ Tomar Control Manual
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Card 3: Lufe (Technical Support) */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedRole('support')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
              selectedRole === 'support'
                ? 'bg-purple-50/80 dark:bg-purple-950/30 border-purple-500/60 shadow-md ring-2 ring-purple-500/30'
                : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <img
                src={PROFILES.support.avatar}
                alt="Lufe"
                className="w-12 h-12 rounded-full object-cover border-2 border-purple-500/50 shadow-xs"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">Lufe</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center gap-1">
                      <Headphones className="w-3 h-3" />
                      Soporte Técnico
                    </span>
                  </div>
                  {selectedRole === 'support' && (
                    <CheckCircle2 className="w-4 h-4 text-purple-500 fill-purple-500 text-white" />
                  )}
                </div>

                <p className="text-[11px] text-slate-600 dark:text-neutral-300 mt-1 leading-snug">
                  Acceso a configuraciones avanzadas del sistema, Meta Webhooks, logs y bots.
                </p>

                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 font-medium">
                    ✓ Meta Graph API & Webhooks
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 font-medium">
                    ✓ Telemetría & Logs
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 font-medium">
                    ✓ Configuración de Servidor
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Action Button */}
      <div className="pt-4 pb-2">
        <button
          id="login-submit-button"
          onClick={() => handleQuickLogin(selectedRole)}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[var(--primary)] to-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2 ios-touch cursor-pointer hover:opacity-95"
        >
          <span>Ingresar como {PROFILES[selectedRole].name}</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-[11px] text-center text-slate-400 mt-2">
          Diseñado para Expo Router & React Native en iOS 18
        </p>
      </div>
    </div>
  );
};
