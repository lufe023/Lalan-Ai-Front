import { api, subirArchivo } from './api';
import type { AvisoAlergia, PreguntaAlergia } from './saberProductos';

/** Los interruptores que la administración le enciende o apaga a cada especialista */
export type ClavePermiso =
  | 'alergiasYGustos' | 'notasClienta' | 'visitasPasadas'
  | 'marcarEstado' | 'llamarEnPizarra' | 'confirmarCitas' | 'reagendarCitas' | 'cancelarCitas' | 'verPrecios'
  | 'fotosPropias' | 'fotosTodas'
  | 'chatearConClientas' | 'verChatAnterior' | 'plantillasPagas' | 'sugerenciasLalan';

export type MapaPermisos = Record<ClavePermiso, boolean>;

export interface CatalogoPermisos {
  grupos: { id: string; descripcion: string }[];
  permisos: { clave: ClavePermiso; grupo: string; descripcion: string; porDefecto: boolean }[];
}

/** Lo que ve la administración en la ficha de una especialista */
export interface EntradaDeEspecialista extends CatalogoPermisos {
  entrada: { id: string; activa: boolean; usuario: string | null; entraCon: string[]; debeCambiarClave: boolean; desde: string } | null;
  valores: MapaPermisos;
  /** Las que tiene distintas a la plantilla del salón */
  propios: Partial<MapaPermisos>;
  /** Solo al darle entrada: se ve una vez */
  claveTemporal?: string;
  entraCon?: string[];
}

export interface PlantillaPermisos extends CatalogoPermisos {
  valores: MapaPermisos;
  /** Lo que trae de Lalan */
  fabrica?: MapaPermisos;
  /** Lo que cambió el salón; vacío = como lo trae Lalan */
  salon?: Partial<MapaPermisos>;
}

export const entradaApi = {
  estado: (staffId: string) => api.get<EntradaDeEspecialista>(`/salon/staff/${staffId}/entrada`),
  dar: (staffId: string, datos: { usuario?: string; telefono?: string }) => api.post<EntradaDeEspecialista>(`/salon/staff/${staffId}/entrada`, datos),
  permisos: (staffId: string, permisos: Partial<MapaPermisos>) => api.patch<EntradaDeEspecialista>(`/salon/staff/${staffId}/entrada/permisos`, { permisos }),
  aPlantilla: (staffId: string) => api.delete<EntradaDeEspecialista>(`/salon/staff/${staffId}/entrada/permisos`),
  nuevaClave: (staffId: string) => api.post<{ claveTemporal: string; entraCon: string[] }>(`/salon/staff/${staffId}/entrada/clave-temporal`, {}),
  quitar: (staffId: string) => api.delete<EntradaDeEspecialista>(`/salon/staff/${staffId}/entrada`),
  plantilla: () => api.get<PlantillaPermisos>('/salon/permisos-especialista'),
  guardarPlantilla: (permisos: Partial<MapaPermisos>) => api.patch<PlantillaPermisos>('/salon/permisos-especialista', { permisos }),
  /** La plantilla vuelve a como la trae Lalan */
  volverPlantilla: () => api.delete<PlantillaPermisos>('/salon/permisos-especialista'),
};

// ── Lo de la propia especialista ─────────────────────────────────

export interface MiPerfil {
  especialista: { id: string; nombre: string; especialidad: string | null; avatar: string | null; fotoId: string | null; zona: string | null };
  sedes: { id: string; name: string; timezone: string }[];
  permisos: MapaPermisos;
  servicios: { id: string; nombre: string; categoria: string; minutos: number; precio?: number; moneda?: string }[];
}

export type EstadoCita = 'pending' | 'confirmed' | 'confirmed_by_ai' | 'attending' | 'completed' | 'cancelled';

export interface MiCita {
  id: string;
  inicio: string;
  minutos: number;
  estado: EstadoCita;
  servicio: string;
  clienta: string;
  clientaId: string | null;
  sedeId: string;
  sede: string | null;
  precio?: number;
  moneda?: string;
  notas?: string | null;
}

export interface FichaClienta {
  nombre: string;
  alergias: string | null;
  /** Avisos de los productos de su servicio que llevan (o pueden llevar) algo a lo que es alérgica */
  avisos?: AvisoAlergia[];
  preguntas?: PreguntaAlergia[];
  gustos: { gusto: string; categoria: string; icono: string | null; nota: string | null; intensidad: number | null }[];
  notas: string | null;
  visitas: { fecha: string; servicio: string; notas?: string | null }[];
}

export const miAgendaApi = {
  perfil: () => api.get<MiPerfil>('/especialista/yo'),
  citas: (desde: Date, hasta: Date) =>
    api.get<MiCita[]>(`/especialista/citas?desde=${encodeURIComponent(desde.toISOString())}&hasta=${encodeURIComponent(hasta.toISOString())}`),
  clienta: (citaId: string) => api.get<FichaClienta>(`/especialista/citas/${citaId}/clienta`),
  estado: (citaId: string, estado: 'attending' | 'completed' | 'cancelled') => api.patch<MiCita>(`/especialista/citas/${citaId}/estado`, { estado }),
  confirmar: (citaId: string) => api.post<MiCita>(`/especialista/citas/${citaId}/confirmar`, {}),
  reagendar: (citaId: string, inicio: Date) => api.patch<MiCita>(`/especialista/citas/${citaId}/hora`, { inicio: inicio.toISOString() }),
  llamar: (citaId: string) => api.post<{ codigo: string; estado: string }>(`/especialista/citas/${citaId}/llamar`, {}),
  revisado: (citaId: string, productId: string) => api.post<{ ok: true }>(`/especialista/citas/${citaId}/revisado`, { productId }),
  /** Lo que dijo la clienta: sí la anota en su ficha, no la descarta */
  responderAlergia: (citaId: string, grupo: string, tiene: boolean) => api.post<FichaClienta>(`/especialista/citas/${citaId}/alergia`, { grupo, tiene }),
};

// ── Los chats de la especialista con sus clientas ────────────────

/** El aviso fijo que ve la especialista en cada chat (lo pidió la dirección de Lalan tal cual) */
export const AVISO_CHAT_ESPECIALISTA = 'Los administradores del salón pueden ver esta conversación. También Lalan la ve y puede informar de comportamientos antiéticos.';

export interface MiChatResumen {
  id: string;
  clienta: string;
  canal: 'whatsapp' | 'instagram' | 'messenger' | string;
  ultimo: string | null;
  ultimoEn: string;
  pausado: boolean;
  ventanaAbierta: boolean;
  /** Lo último lo escribió la clienta: le toca contestar */
  teEspera: boolean;
}

export interface MensajeDeMiChat {
  id: string;
  de: 'clienta' | 'yo' | 'salon' | 'lalan' | 'aviso' | 'sugerencia';
  autor: string | null;
  texto: string;
  borrado: boolean;
  tipo: string;
  en: string;
  estado: 'pendiente' | 'enviado' | 'entregado' | 'leido' | 'fallido' | null;
  motivoFallo: string | null;
  /** Una foto o un video de un servicio que mandó Lalan */
  fotoCatalogo?: string | null;
  adjunto: { tieneArchivo: boolean; mime?: string | null; nombre?: string | null; descripcion?: string | null; transcripcion?: string | null } | null;
}

export interface MiChat {
  id: string;
  clienta: string;
  canal: string;
  desde: string | null;
  ventanaAbierta: boolean;
  puedePlantilla: boolean;
  pausado: { desde: string; motivo: string | null } | null;
  mensajes: MensajeDeMiChat[];
}

export const misChatsApi = {
  lista: () => api.get<MiChatResumen[]>('/especialista/chats'),
  desdeCita: (citaId: string) => api.post<MiChat>(`/especialista/chats/desde-cita/${citaId}`, {}),
  chat: (id: string) => api.get<MiChat>(`/especialista/chats/${id}`),
  escribir: (id: string, texto: string) => api.post<MiChat>(`/especialista/chats/${id}/mensajes`, { texto }),
  /** Una foto o un video para la clienta (Lalan lo revisa antes de que salga) */
  medio: (id: string, archivo: File, texto: string) => {
    const f = new FormData();
    f.append('archivo', archivo, archivo.name);
    if (texto) f.append('texto', texto);
    return subirArchivo<MiChat>(`/especialista/chats/${id}/medio`, f);
  },
  plantilla: (id: string) => api.post<MiChat>(`/especialista/chats/${id}/plantilla`, {}),
  soltar: (id: string) => api.post<{ ok: true }>(`/especialista/chats/${id}/soltar`, {}),
  archivo: (id: string, mensajeId: string) => `/especialista/chats/${id}/mensajes/${mensajeId}/archivo`,
};

/** Lo de la dirección: a quién se le puede pasar un chat, y tomarlo o dejarla seguir */
export interface EspecialistaConEntrada { userId: string; staffId: string; nombre: string; especialidad: string | null; sedeId: string | null; puedeEscribir: boolean }

export const chatEspecialistaApi = {
  conEntrada: () => api.get<EspecialistaConEntrada[]>('/salon/especialistas-con-entrada'),
  asignar: (conversacionId: string, staffId: string) => api.post(`/conversations/${conversacionId}/especialista`, { staffId }),
  tomar: (conversacionId: string) => api.delete(`/conversations/${conversacionId}/especialista`),
  reanudar: (conversacionId: string) => api.post(`/conversations/${conversacionId}/especialista/reanudar`, {}),
};
