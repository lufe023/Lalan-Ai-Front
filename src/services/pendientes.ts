import { api } from './api';

/**
 * Recordatorios y encargos del equipo, y «Tu día» (lo que Lalán enseña al
 * abrirla). Todo es de una sede: el servidor usa la sede activa.
 */

export type Repetir = 'dia' | 'semana' | 'mes' | 'anio';
export const REPETIR: { id: Repetir; nombre: string }[] = [
  { id: 'dia', nombre: 'Cada día' },
  { id: 'semana', nombre: 'Cada semana' },
  { id: 'mes', nombre: 'Cada mes' },
  { id: 'anio', nombre: 'Cada año' },
];

export type FiltroPendientes = 'todos' | 'mios' | 'encargados' | 'hechos';

export interface Pendiente {
  id: string;
  texto: string;
  vence: string;
  repetir: Repetir | null;
  estado: 'pendiente' | 'hecho' | 'descartado';
  vencido: boolean;
  sede: { id: string; nombre: string };
  para: { id: string; nombre: string };
  creadoPor: { id: string; nombre: string };
  /** Mío · me lo encargaron · yo lo encargué */
  relacion: 'mio' | 'me_toca' | 'encargue';
  hechoEn: string | null;
  hechoPor: string | null;
  enlace: string | null;
  origen: string;
}

export interface PersonaDelEquipo { id: string; name: string; role: string; avatar: string | null; locationId: string | null; yo: boolean }

export type ItemTuDia =
  | { tipo: 'recordatorio'; id: string; titulo: string; detalle: string; cuando: string; vencido: boolean; relacion: Pendiente['relacion']; enlace: string | null }
  | { tipo: 'cita'; id: string; motivo: 'por_confirmar' | 'sin_especialista'; titulo: string; detalle: string; cuando: string; clientId: string | null; conversationId: string | null }
  | { tipo: 'cumple'; id: string; quien: 'clienta' | 'equipo'; nombre: string; titulo: string; detalle: string; dias: number; clientId: string | null; telefono: string | null; conversationId: string | null }
  | { tipo: 'producto'; id: string; titulo: string; detalle: string; sede: { id: string; nombre: string } };

export interface TuDia {
  nombre: string;
  fecha: string;
  sede: { id: string; nombre: string } | null;
  resumen: { citas: number; porConfirmar: number; libres: number; pendientes: number };
  items: ItemTuDia[];
}

export interface NuevoPendiente {
  texto: string;
  vence: string;
  repetir?: Repetir | null;
  paraUserId?: string | null;
  sede?: string | null;
}

/** Algo cambió en los recordatorios: «Tu día» y la pantalla se recargan */
export const EVENTO_PENDIENTES = 'lalan:pendientes';
export const avisarCambioPendientes = () => window.dispatchEvent(new Event(EVENTO_PENDIENTES));

export const pendientesApi = {
  tuDia: () => api.get<TuDia>('/pendientes/tu-dia'),
  lista: (filtro: FiltroPendientes = 'todos') => api.get<Pendiente[]>(`/pendientes?filtro=${filtro}`),
  equipo: () => api.get<PersonaDelEquipo[]>('/pendientes/equipo'),
  crear: (d: NuevoPendiente) => api.post<Pendiente>('/pendientes', d),
  hecho: (id: string) => api.post<Pendiente>(`/pendientes/${id}/hecho`, {}),
  posponer: (id: string, hasta: { minutos?: number; manana?: boolean; vence?: string }) => api.post<Pendiente>(`/pendientes/${id}/posponer`, hasta),
  quitar: (id: string) => api.delete<{ ok: true }>(`/pendientes/${id}`),
};

/** "hoy 3:00 p. m.", "mañana 10:00 a. m.", "lun 16 nov · 10:00 a. m." */
export function cuandoCorto(iso: string, ahora = new Date()): string {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' });
  const dia = (x: Date) => x.toDateString();
  const manana = new Date(ahora); manana.setDate(manana.getDate() + 1);
  if (dia(d) === dia(ahora)) return `hoy ${hora}`;
  if (dia(d) === dia(manana)) return `mañana ${hora}`;
  return `${d.toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' })} · ${hora}`;
}

/** Mensaje de felicitación listo para mandar por WhatsApp */
export function textoFelicitar(nombre: string): string {
  const primero = nombre.trim().split(/\s+/)[0] ?? '';
  return `¡Feliz cumpleaños${primero ? `, ${primero}` : ''}! 🎉 Que tengas un día precioso. Te queremos mucho por aquí.`;
}
