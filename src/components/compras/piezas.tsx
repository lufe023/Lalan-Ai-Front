import React from 'react';
import { Bot, FileText, Mail, MessageCircle, Printer, UserRound } from 'lucide-react';
import { COLOR_ESTADO, NOMBRE_ESTADO, type EstadoCompra } from '../../services/compras';

/** Las piezas chicas de Compras, para que todas sus pantallas se vean iguales */

export const campo = 'w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.875rem] text-slate-900 dark:text-white placeholder:text-slate-400 dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40';
export const etiqueta = 'block text-[0.75rem] text-slate-500 dark:text-neutral-400 mb-1';

export const botonPrincipal = 'px-3.5 py-2 rounded-xl text-[0.8125rem] font-bold bg-[var(--primary)] text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ios-touch';
export const botonSuave = 'px-3 py-2 rounded-xl text-[0.8125rem] font-bold bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ios-touch hover:border-[var(--primary)]/50';
export const botonWhatsapp = 'px-3 py-2 rounded-xl text-[0.8125rem] font-bold bg-[#25D366] text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ios-touch';

export const PastillaEstado: React.FC<{ estado: EstadoCompra; className?: string }> = ({ estado, className = '' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.6875rem] font-bold whitespace-nowrap ${COLOR_ESTADO[estado]} ${className}`}>
    {NOMBRE_ESTADO[estado]}
  </span>
);

/** Por dónde llegó o salió algo del historial */
export const IconoCanal: React.FC<{ canal: string | null; autor?: string; className?: string }> = ({ canal, autor, className = 'w-3.5 h-3.5' }) => {
  if (autor === 'lalan' || canal === 'lalan') return <Bot className={className} />;
  switch (canal) {
    case 'whatsapp': return <MessageCircle className={className} />;
    case 'correo': return <Mail className={className} />;
    case 'impreso': return <Printer className={className} />;
    case 'app': return <UserRound className={className} />;
    default: return autor === 'persona' ? <UserRound className={className} /> : <FileText className={className} />;
  }
};

export const NOMBRE_CANAL: Record<string, string> = {
  whatsapp: 'WhatsApp', correo: 'Correo', impreso: 'Impreso', app: 'En la app', lalan: 'Lalan',
};

export const fechaCorta = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' }) : '';
export const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-DO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
/** "2026-11-01" para un <input type="date"> */
export const paraInputFecha = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');
/** El mediodía de ese día, para que la zona horaria no lo corra al día anterior */
export const deInputFecha = (v: string) => (v ? new Date(`${v}T12:00:00`).toISOString() : null);
