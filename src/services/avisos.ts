import { api } from './api';

/**
 * La campana (backend: notificaciones/) y Mi actividad (backend: actividad/).
 * Cada aviso del teléfono también queda aquí, con su sede y lo que abre.
 */

export type GrupoAviso = 'chats' | 'agenda' | 'compras' | 'caja' | 'informes' | 'cuenta';

export interface Aviso {
  id: string;
  tipo: string;
  grupo: GrupoAviso;
  titulo: string;
  cuerpo: string;
  ir: string | null;
  aviso: string | null;
  conversacion: string | null;
  sede: { id: string; nombre: string | null } | null;
  leida: boolean;
  creadoEn: string;
}

export interface PaginaAvisos {
  items: Aviso[];
  total: number; pagina: number; paginas: number; porPagina: number;
  sinLeer: number;
  grupos: { id: GrupoAviso; nombre: string; sinLeer: number }[];
}

export type GrupoActividad = 'entradas' | 'agenda' | 'caja' | 'clientas' | 'chats' | 'catalogo' | 'compras' | 'ajustes';

export interface FilaActividad {
  id: string;
  cuando: string;
  grupo: GrupoActividad;
  /** "Cobraste…" o "Laura cobró…" */
  frase: string;
  /** El dato concreto: "Ana Rosario · Balayage · vie 31 de oct, 10:00 a. m." */
  detalle: string | null;
  quien: { id: string | null; nombre: string | null };
  soporte: boolean;
  sede: { id: string; nombre: string | null } | null;
  ir: string;
  aviso: string | null;
  conversacion: string | null;
}

export interface PaginaActividad {
  items: FilaActividad[];
  total: number; pagina: number; paginas: number; porPagina: number; dias: number;
  persona: string;
  grupos: { id: GrupoActividad; nombre: string }[];
  resumen: { id: GrupoActividad; nombre: string; cuantas: number }[];
  /** Solo para la dirección: a quién puede mirar */
  personas: { id: string; nombre: string; rol: string }[];
}

const qs = (o: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const avisosApi = {
  lista: (f: { estado?: 'sin_leer' | 'todas'; grupo?: string; pagina?: number; porPagina?: number }) =>
    api.get<PaginaAvisos>(`/notificaciones${qs(f)}`),
  sinLeer: () => api.get<{ sinLeer: number }>('/notificaciones/sin-leer'),
  leer: (id: string) => api.post<{ sinLeer: number }>(`/notificaciones/${id}/leida`, {}),
  leerTodas: (grupo?: string) => api.post<{ marcadas: number; sinLeer: number }>(`/notificaciones/leidas${qs({ grupo })}`, {}),
};

export const actividadApi = {
  lista: (f: { persona?: string; sede?: string; grupo?: string; dias?: number; pagina?: number }) =>
    api.get<PaginaActividad>(`/actividad${qs(f)}`),
};

/** Señal en la ventana: alguien leyó o marcó avisos (la campana se pone al día) */
export const EVENTO_AVISOS = 'lalan:avisos';
/** Pedirle a la app que vaya a una pantalla y abra algo dentro (lo mismo que tocar el push) */
export const EVENTO_IR = 'lalan:ir';

export function irA(destino: { ir: string | null; aviso?: string | null; conversacion?: string | null; titulo?: string; sede?: { id: string } | null }) {
  window.dispatchEvent(new CustomEvent(EVENTO_IR, { detail: { pantalla: destino.ir || 'dashboard', aviso: avisoDe(destino), conversacion: destino.conversacion ?? null } }));
}

/**
 * Qué abre el aviso dentro de la pantalla. Los «Por pedir» guardados antes de
 * que llevaran a la sede se reconocen por el título y abren lo mismo.
 */
export function avisoDe(a: { ir: string | null; aviso?: string | null; titulo?: string; sede?: { id: string } | null }): string | null {
  if (a.aviso) return a.aviso;
  if (a.ir === 'compras' && a.sede?.id && a.titulo) {
    if (a.titulo.startsWith('Por pedir en ')) return `por-pedir:${a.sede.id}`;
    if (a.titulo.startsWith('Te armé ')) return `borradores:${a.sede.id}`;
  }
  return null;
}

/** El botón de cada aviso dice adónde lleva */
export function botonDe(ir: string | null, aviso: string | null): string {
  if (aviso?.startsWith('cita:')) return 'Ver cita';
  if (aviso?.startsWith('pedido:')) return 'Revisar pedido';
  if (aviso?.startsWith('comparacion:')) return 'Comparar precios';
  if (aviso?.startsWith('servicio:')) return 'Subir fotos';
  if (aviso?.startsWith('clienta:')) return 'Ver ficha';
  if (aviso?.startsWith('por-pedir:')) return 'Armar el pedido';
  if (aviso?.startsWith('borradores:')) return 'Revisar pedidos';
  switch (ir) {
    case 'chats': return 'Abrir chat';
    case 'calendar': return 'Ir a la agenda';
    case 'compras': return 'Ir a Compras';
    case 'caja': return aviso === 'fiao' ? 'Revisar fiao' : 'Ir a Caja';
    case 'informes': return 'Leer informe';
    case 'mi-semana': return 'Ver Mi semana';
    case 'mis-citas': return 'Ver mis citas';
    case 'catalog': return 'Abrir catálogo';
    case 'clients': return 'Ver clientas';
    case 'settings': return 'Ver';
    default: return 'Abrir';
  }
}

const DIA = 86_400_000;
const inicioDelDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "Hoy", "Ayer", "jueves 23 de octubre" */
export function diaDe(iso: string, ahora = new Date()): string {
  const d = new Date(iso);
  const dif = Math.round((inicioDelDia(ahora) - inicioDelDia(d)) / DIA);
  if (dif === 0) return 'Hoy';
  if (dif === 1) return 'Ayer';
  return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "hace 5 min", "8:42 a. m.", "ayer", "23 oct" */
export function horaDe(iso: string, ahora = new Date()): string {
  const d = new Date(iso);
  const min = Math.floor((ahora.getTime() - d.getTime()) / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const dif = Math.round((inicioDelDia(ahora) - inicioDelDia(d)) / DIA);
  if (dif === 0) return d.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' });
  if (dif === 1) return 'ayer';
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

/** Agrupa una lista por día, en orden ("Hoy", "Ayer"…) */
export function porDia<T>(items: T[], fecha: (x: T) => string): { dia: string; items: T[] }[] {
  const grupos: { dia: string; items: T[] }[] = [];
  items.forEach(x => {
    const dia = diaDe(fecha(x));
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.dia === dia) ultimo.items.push(x); else grupos.push({ dia, items: [x] });
  });
  return grupos;
}
