import { api } from './api';

/** Los interruptores que la administración le enciende o apaga a cada especialista */
export type ClavePermiso =
  | 'alergiasYGustos' | 'notasClienta' | 'visitasPasadas'
  | 'marcarEstado' | 'llamarEnPizarra' | 'confirmarCitas' | 'reagendarCitas' | 'cancelarCitas' | 'verPrecios'
  | 'fotosPropias' | 'fotosTodas';

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

export interface PlantillaPermisos extends CatalogoPermisos { valores: MapaPermisos }

export const entradaApi = {
  estado: (staffId: string) => api.get<EntradaDeEspecialista>(`/salon/staff/${staffId}/entrada`),
  dar: (staffId: string, datos: { usuario?: string; telefono?: string }) => api.post<EntradaDeEspecialista>(`/salon/staff/${staffId}/entrada`, datos),
  permisos: (staffId: string, permisos: Partial<MapaPermisos>) => api.patch<EntradaDeEspecialista>(`/salon/staff/${staffId}/entrada/permisos`, { permisos }),
  aPlantilla: (staffId: string) => api.delete<EntradaDeEspecialista>(`/salon/staff/${staffId}/entrada/permisos`),
  nuevaClave: (staffId: string) => api.post<{ claveTemporal: string; entraCon: string[] }>(`/salon/staff/${staffId}/entrada/clave-temporal`, {}),
  quitar: (staffId: string) => api.delete<EntradaDeEspecialista>(`/salon/staff/${staffId}/entrada`),
  plantilla: () => api.get<PlantillaPermisos>('/salon/permisos-especialista'),
  guardarPlantilla: (permisos: Partial<MapaPermisos>) => api.patch<PlantillaPermisos>('/salon/permisos-especialista', { permisos }),
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
};
