import { api } from './api';
import type { CommunicationChannel } from '../types';
import type { Pendiente } from './pendientes';

/**
 * Lo que Lalan vio pendiente en un chat (backend: compromisos/): una cita por
 * cerrar, una cita para otra persona, algo por recordar o que el salón
 * prometió. Se resuelve ahí mismo en el chat: agendar, recordar o quitar.
 */

export type TipoCompromiso = 'cita' | 'recordatorio' | 'reunion' | 'promesa';

export interface Compromiso {
  id: string;
  tipo: TipoCompromiso;
  /** La tarea, con el nombre: «Agendar a Alanny, la hija de Lisbeth» */
  titulo: string;
  /** El dato concreto que importa para decidir: «Alanny tiene clase a las 4» */
  detalle: string | null;
  /** Para quién es, si no es la persona del chat */
  para: string | null;
  /** Cuándo, si se dijo una fecha */
  cuando: string | null;
  conHora: boolean;
  /** Lo que se dijo del cuándo si no hay fecha («cuando Lisbeth avise») */
  cuandoTexto: string | null;
  estado: 'nuevo' | 'agendado' | 'recordado' | 'descartado';
  conversacionId: string;
  clienta: { id: string | null; nombre: string; telefono: string | null; canal: CommunicationChannel };
  sede: { id: string; nombre: string };
  /** El mensaje donde Lalan lo vio, tal cual */
  dicho: string | null;
  creadoEn: string;
}

export const compromisosApi = {
  delChat: (conversacionId: string) => api.get<Compromiso[]>(`/chat/compromisos/conversaciones/${conversacionId}`),
  recordar: (id: string, d: { vence: string; antesMin?: number | null; texto?: string }) =>
    api.post<{ compromiso: Compromiso; recordatorio: Pendiente }>(`/chat/compromisos/${id}/recordar`, d),
  agendado: (id: string, appointmentId?: string) => api.post<Compromiso>(`/chat/compromisos/${id}/agendado`, appointmentId ? { appointmentId } : {}),
  descartar: (id: string) => api.post<Compromiso>(`/chat/compromisos/${id}/descartar`, {}),
};

/**
 * «Agendar cita» desde el chat: la Agenda abre «Nueva cita» con lo que Lalan
 * ya sabe (quién, para quién, el día, la hora y la nota). Igual que
 * ABRIR_CITA: se deja en la sesión y se avisa con un evento por si la Agenda
 * ya estaba abierta.
 */
export const NUEVA_CITA = 'lalan.nuevaCita';
export const EVENTO_NUEVA_CITA = 'lalan:nueva-cita';

export interface CitaPorAgendar {
  compromisoId?: string;
  clientId?: string | null;
  clientName: string;
  clientPhone?: string | null;
  /** YYYY-MM-DD, en la hora del aparato */
  fecha?: string | null;
  /** HH:mm */
  hora?: string | null;
  canal?: CommunicationChannel | null;
  notas?: string | null;
}

export function pedirNuevaCita(c: CitaPorAgendar) {
  try { sessionStorage.setItem(NUEVA_CITA, JSON.stringify(c)); } catch { /* sin almacenamiento: la Agenda abre vacía */ }
  window.dispatchEvent(new Event(EVENTO_NUEVA_CITA));
}

export function leerNuevaCita(): CitaPorAgendar | null {
  try {
    const crudo = sessionStorage.getItem(NUEVA_CITA);
    if (!crudo) return null;
    sessionStorage.removeItem(NUEVA_CITA);
    const c = JSON.parse(crudo) as CitaPorAgendar;
    return c && typeof c.clientName === 'string' ? c : null;
  } catch { return null; }
}

const dosDigitos = (n: number) => String(n).padStart(2, '0');
export const fechaLocal = (d: Date) => `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
export const horaLocal = (d: Date) => `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;

/** La cita que se arma desde un compromiso: si es para otra persona, a su nombre y con quién la pidió en la nota */
export function citaDeCompromiso(c: Compromiso): CitaPorAgendar {
  const cuando = c.cuando ? new Date(c.cuando) : null;
  const deOtra = !!c.para;
  const quien = c.clienta.nombre;
  const nota = [
    deOtra ? `La pidió ${quien}${c.clienta.telefono ? ` (${c.clienta.telefono})` : ''} por el chat.` : null,
    c.detalle,
    !cuando && c.cuandoTexto ? `Cuándo: ${c.cuandoTexto}.` : null,
  ].filter(Boolean).join(' ');
  return {
    compromisoId: c.id,
    clientId: deOtra ? null : c.clienta.id,
    clientName: deOtra ? c.para! : quien,
    // Con el teléfono de quien escribe, la cita de otra persona se uniría a su ficha
    clientPhone: deOtra ? '' : c.clienta.telefono ?? '',
    fecha: cuando ? fechaLocal(cuando) : null,
    hora: cuando && c.conHora ? horaLocal(cuando) : null,
    canal: c.clienta.canal,
    notas: nota || null,
  };
}

/** Las horas que se ofrecen para «Recuérdamelo», con un toque: la que se dijo en el chat primero */
export function horasParaRecordar(c: Pick<Compromiso, 'cuando' | 'conHora'>, ahora = new Date()): { etiqueta: string; vence: Date; antesMin: number | null }[] {
  const opciones: { etiqueta: string; vence: Date; antesMin: number | null }[] = [];
  const hora = (d: Date) => d.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' });
  if (c.cuando) {
    const d = new Date(c.cuando);
    if (d.getTime() > ahora.getTime() + 5 * 60_000) {
      const dia = d.toDateString() === ahora.toDateString() ? 'Hoy' : d.toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' });
      // Con hora: a esa hora, con aviso una hora antes (si da tiempo); sin hora, ese día temprano
      const antesMin = c.conHora && d.getTime() - ahora.getTime() > 2 * 60 * 60_000 ? 60 : null;
      opciones.push({ etiqueta: `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${hora(d)}${antesMin ? ' (te aviso 1 h antes)' : ''}`, vence: d, antesMin });
    }
  }
  const enUnaHora = new Date(ahora.getTime() + 60 * 60_000);
  opciones.push({ etiqueta: 'En 1 hora', vence: enUnaHora, antesMin: null });
  const tarde = new Date(ahora); tarde.setHours(17, 0, 0, 0);
  if (tarde.getTime() > ahora.getTime() + 90 * 60_000) opciones.push({ etiqueta: `Hoy, ${hora(tarde)}`, vence: tarde, antesMin: null });
  const manana = new Date(ahora); manana.setDate(manana.getDate() + 1); manana.setHours(9, 0, 0, 0);
  opciones.push({ etiqueta: `Mañana, ${hora(manana)}`, vence: manana, antesMin: null });
  return opciones;
}
