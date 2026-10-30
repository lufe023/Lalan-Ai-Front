import React from 'react';
import { motion } from 'motion/react';
import { RESORTE } from '../ui/movimiento';
import { BellRing, Bot, ChevronRight, Globe, Mail, Monitor, Palette, Sparkles, Store, UserCircle2, Users, Wallet } from 'lucide-react';
import type { UserRole } from '../../types';

/** Los grupos de Ajustes (catálogo: id + descripción) */
export type SeccionAjustes = 'cuenta' | 'plan' | 'equipo' | 'salon' | 'chats' | 'sala' | 'vitrina' | 'caja' | 'correo' | 'apariencia';

interface Grupo {
  id: SeccionAjustes;
  titulo: string;
  resumen: string;
  icono: React.ElementType;
  color: string;
  /** Otras palabras con que la buscan en el buscador de opciones */
  palabras?: string;
  /** Quién lo ve. Sin lista = todo el mundo */
  roles?: UserRole[];
}

const ADMINISTRACION: UserRole[] = ['admin', 'super_admin'];

export const GRUPOS_AJUSTES: Grupo[] = [
  { id: 'cuenta', titulo: 'Mi cuenta', resumen: 'Notificaciones, entrar con 1 toque, contraseña, dónde está abierta tu sesión y lo que Lalan sabe de ti', icono: UserCircle2, color: 'bg-slate-500' },
  { id: 'plan', titulo: 'Mi plan', resumen: 'Lo que incluye y cuánto llevas usado este mes', icono: Sparkles, color: 'bg-amber-500', roles: ADMINISTRACION },
  { id: 'equipo', titulo: 'Equipo', resumen: 'Quién entra a la app y a quién le llega cada aviso', icono: Users, color: 'bg-sky-500', roles: ADMINISTRACION },
  { id: 'salon', titulo: 'El salón', resumen: 'Horario de la semana, citas, zonas y especialistas', icono: Store, color: 'bg-emerald-500', roles: ADMINISTRACION },
  { id: 'chats', titulo: 'Lalan en los chats', resumen: 'Conectar WhatsApp, Instagram y Messenger; mensajes automáticos', icono: Bot, color: 'bg-purple-500', roles: ADMINISTRACION },
  { id: 'sala', titulo: 'Sala y Lounge', resumen: 'Pantalla de turnos, quiosco de llegada y canciones que piden las clientas', icono: Monitor, color: 'bg-indigo-500', roles: ADMINISTRACION },
  { id: 'vitrina', titulo: 'Vitrina', resumen: 'Tu página para que las clientas reserven solas: bloques, colores y enlace', icono: Globe, color: 'bg-fuchsia-500', roles: ADMINISTRACION },
  { id: 'caja', titulo: 'Caja', resumen: 'Fiao, monedas, billetes, recibos e impresión', icono: Wallet, color: 'bg-teal-500', roles: ADMINISTRACION },
  // Se configura una vez: lo usan Compras (pedidos por correo) y lo que venga después
  { id: 'correo', titulo: 'Correo del salón', resumen: 'Tu correo (Gmail u otro) para mandar pedidos y que Lalan lea lo que contestan', icono: Mail, color: 'bg-blue-500', roles: ADMINISTRACION, palabras: 'smtp imap gmail email e-mail buzon contraseña de aplicacion proveedores compras' },
  // Es de cada teléfono (no cambia nada del salón): la ve todo el equipo
  { id: 'apariencia', titulo: 'Apariencia', resumen: 'Tamaño de la letra, tema claro u oscuro y colores', icono: Palette, color: 'bg-rose-500' },
];

export function gruposPara(rol?: UserRole) {
  return GRUPOS_AJUSTES.filter((g) => !g.roles || (rol && g.roles.includes(rol)));
}

/** Otras pantallas pueden mandar directo a un grupo ("Ir a Ajustes → El salón") */
const CLAVE_DESTINO = 'lalan_ajustes_seccion';
export function pedirSeccionAjustes(s: SeccionAjustes) {
  try { sessionStorage.setItem(CLAVE_DESTINO, s); } catch { /* sin almacenamiento: abre el menú */ }
}
export function tomarSeccionPedida(): SeccionAjustes | null {
  try {
    const s = sessionStorage.getItem(CLAVE_DESTINO) as SeccionAjustes | null;
    sessionStorage.removeItem(CLAVE_DESTINO);
    return s && GRUPOS_AJUSTES.some((g) => g.id === s) ? s : null;
  } catch { return null; }
}

/** La lista corta de Ajustes, como en el iPhone: un grupo por fila */
export const MenuAjustes: React.FC<{ rol?: UserRole; onAbrir: (s: SeccionAjustes) => void; avisoNotificaciones?: boolean }> = ({ rol, onAbrir, avisoNotificaciones }) => (
  <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs overflow-hidden divide-y divide-slate-100 dark:divide-neutral-800">
    {gruposPara(rol).map((g, i) => {
      const Icono = g.icono;
      return (
        <motion.button key={g.id} type="button" onClick={() => onAbrir(g.id)} data-guia={`ajustes-${g.id}`}
          initial={false} style={{ animationDelay: `${i * 0.03}s`, ['--entrar-y' as string]: '8px' }}
          whileTap={{ scale: 0.985, backgroundColor: 'rgba(148,163,184,0.12)' }}
          className="entrar-suave w-full px-3.5 py-3 flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-neutral-800/60 ios-touch cursor-pointer">
          <span className={`w-8 h-8 rounded-xl ${g.color} text-white flex items-center justify-center shrink-0`}><Icono className="w-4 h-4" /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-[0.875rem] font-bold text-slate-900 dark:text-white">{g.titulo}</span>
            <span className="block text-[0.75rem] text-slate-500 dark:text-neutral-400 truncate">{g.resumen}</span>
          </span>
          {g.id === 'cuenta' && avisoNotificaciones && <BellRing className="w-4 h-4 text-amber-500 shrink-0" aria-label="Notificaciones sin activar" />}
          <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
        </motion.button>
      );
    })}
  </div>
);
