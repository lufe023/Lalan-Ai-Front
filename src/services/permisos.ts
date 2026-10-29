import { api } from './api';
import type { ScreenName } from '../context/AppContext';

/**
 * Los permisos con nombre de la asistente (backend: permisos/permisos.contrato.ts).
 * Administración puede todo; la especialista tiene su propia lista
 * (services/especialistas.ts).
 */
export type ClavePermisoRol =
  | 'general'
  | 'agenda.ver' | 'agenda.gestionar'
  | 'clientas.ver' | 'clientas.editar' | 'clientas.borrar'
  | 'chats.atender' | 'sala.operar' | 'caja.cobrar'
  | 'catalogo.ver' | 'catalogo.editar' | 'precios.editar'
  | 'inventario.ver' | 'inventario.ajustar'
  | 'reportes.ver';

export type MapaPermisosRol = Partial<Record<ClavePermisoRol, boolean>>;

export interface DefinicionPermisoRol {
  clave: ClavePermisoRol;
  area: string;
  /** "Cobrar, abrir y cerrar la caja" */
  puede: string;
  /** "No cobra en caja" */
  noPuede: string;
  /** Lo que trae de fábrica una asistente (lo fija Lalan) */
  fabrica: boolean;
  /** Lo que decidió este salón; null = como viene de fábrica */
  salon: boolean | null;
}

export interface CatalogoPermisosRol {
  modo: 'aplicar' | 'espejo';
  areas: { id: string; titulo: string }[];
  soloAdministracion: string[];
  permisos: DefinicionPermisoRol[];
}

/** Lo que tendría hoy una asistente nueva en este salón */
export const valorDelSalon = (p: DefinicionPermisoRol) => p.salon ?? p.fabrica;

/** Qué pide cada pantalla: sin el permiso, la pantalla no sale en el menú */
export const PERMISO_DE_PANTALLA: Partial<Record<ScreenName, ClavePermisoRol>> = {
  dashboard: 'reportes.ver',
  informes: 'reportes.ver',
  'mi-semana': 'reportes.ver',
  ganancias: 'reportes.ver',
  'citas-report': 'reportes.ver',
  'conversiones-report': 'reportes.ver',
  calendar: 'agenda.ver',
  sala: 'sala.operar',
  lounge: 'sala.operar',
  clients: 'clientas.ver',
  caja: 'caja.cobrar',
  chats: 'chats.atender',
  catalog: 'catalogo.ver',
  'price-lists': 'precios.editar',
};

/** Sin mapa (administración, o un servidor viejo) se puede todo */
export const puedeCon = (permisos: MapaPermisosRol | null | undefined, clave?: ClavePermisoRol) =>
  !clave || !permisos || permisos[clave] !== false;

export const permisosApi = {
  catalogo: () => api.get<CatalogoPermisosRol>('/permisos/catalogo'),
  /** null en un permiso lo devuelve a lo de fábrica */
  guardarSalon: (cambio: Partial<Record<ClavePermisoRol, boolean | null>>) =>
    api.put<{ assistant: MapaPermisosRol }>('/permisos/rol/assistant', { permisos: cambio }),
  dePersona: (id: string) => api.get<{ propios: MapaPermisosRol; efectivos: MapaPermisosRol }>(`/permisos/usuario/${id}`),
  /** null en un permiso lo devuelve a lo del salón */
  guardarPersona: (id: string, cambio: Partial<Record<ClavePermisoRol, boolean | null>>) =>
    api.put<{ propios: MapaPermisosRol; efectivos: MapaPermisosRol }>(`/permisos/usuario/${id}`, { permisos: cambio }),
};
