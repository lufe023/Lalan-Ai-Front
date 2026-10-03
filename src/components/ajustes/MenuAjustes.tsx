import React from 'react';
import { BellRing, Bot, ChevronRight, Monitor, Palette, Sparkles, Store, UserCircle2, Users, Wallet } from 'lucide-react';
import type { UserRole } from '../../types';

/** Los grupos de Ajustes (catálogo: id + descripción) */
export type SeccionAjustes = 'cuenta' | 'plan' | 'equipo' | 'salon' | 'chats' | 'sala' | 'caja' | 'apariencia';

interface Grupo {
  id: SeccionAjustes;
  titulo: string;
  resumen: string;
  icono: React.ElementType;
  color: string;
  /** Quién lo ve. Sin lista = todo el mundo */
  roles?: UserRole[];
}

const ADMINISTRACION: UserRole[] = ['admin', 'super_admin'];

export const GRUPOS_AJUSTES: Grupo[] = [
  { id: 'cuenta', titulo: 'Mi cuenta', resumen: 'Notificaciones de este teléfono, entrar con 1 toque y cerrar sesión', icono: UserCircle2, color: 'bg-slate-500' },
  { id: 'plan', titulo: 'Mi plan', resumen: 'Lo que incluye y cuánto llevas usado este mes', icono: Sparkles, color: 'bg-amber-500', roles: ADMINISTRACION },
  { id: 'equipo', titulo: 'Equipo', resumen: 'Quién entra a la app y a quién le llega cada aviso', icono: Users, color: 'bg-sky-500', roles: ADMINISTRACION },
  { id: 'salon', titulo: 'El salón', resumen: 'Horario de la semana, citas, zonas y especialistas', icono: Store, color: 'bg-emerald-500', roles: ADMINISTRACION },
  { id: 'chats', titulo: 'Lalan en los chats', resumen: 'Conectar WhatsApp, Instagram y Messenger; mensajes automáticos', icono: Bot, color: 'bg-purple-500', roles: ADMINISTRACION },
  { id: 'sala', titulo: 'Sala y Lounge', resumen: 'Pantalla de turnos en la pared y canciones que piden las clientas', icono: Monitor, color: 'bg-indigo-500', roles: ADMINISTRACION },
  { id: 'caja', titulo: 'Caja', resumen: 'Monedas, billetes, recibos e impresión', icono: Wallet, color: 'bg-teal-500', roles: ADMINISTRACION },
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
    {gruposPara(rol).map((g) => {
      const Icono = g.icono;
      return (
        <button key={g.id} type="button" onClick={() => onAbrir(g.id)}
          className="w-full px-3.5 py-3 flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-neutral-800/60 ios-touch cursor-pointer">
          <span className={`w-8 h-8 rounded-xl ${g.color} text-white flex items-center justify-center shrink-0`}><Icono className="w-4 h-4" /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-[0.875rem] font-bold text-slate-900 dark:text-white">{g.titulo}</span>
            <span className="block text-[0.75rem] text-slate-500 dark:text-neutral-400 truncate">{g.resumen}</span>
          </span>
          {g.id === 'cuenta' && avisoNotificaciones && <BellRing className="w-4 h-4 text-amber-500 shrink-0" aria-label="Notificaciones sin activar" />}
          <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
        </button>
      );
    })}
  </div>
);
