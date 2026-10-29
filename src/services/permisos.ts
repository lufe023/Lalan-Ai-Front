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

/** Los textos de un permiso: lo que podrá hacer y lo que no verá */
export interface DefinicionPermisoRol {
  clave: ClavePermisoRol;
  area: string;
  /** "Cobrar, abrir y cerrar la caja" */
  puede: string;
  /** "No cobra en caja" */
  noPuede: string;
}

/** Un rol de Lalan (Recepción, Caja, Encargada de sede…) como lo ve un salón */
export interface RolDelSalon {
  clave: string;
  nombre: string;
  descripcion: string;
  /** Personas activas con este rol en el salón */
  personas: number;
  /** Lo que trae de Lalan */
  fabrica: MapaPermisosRol;
  /** Lo que cambió el salón; vacío = como lo trae Lalan */
  salon: MapaPermisosRol;
}

export interface CatalogoPermisosRol {
  modo: 'aplicar' | 'espejo';
  areas: { id: string; titulo: string }[];
  soloAdministracion: string[];
  /** El rol de quien no tiene uno elegido (Recepción) */
  rolBase: string;
  roles: RolDelSalon[];
  definiciones: DefinicionPermisoRol[];
}

/** Lo que tiene hoy ese permiso en el salón */
export const valorDelRol = (rol: RolDelSalon, c: ClavePermisoRol) => rol.salon[c] ?? !!rol.fabrica[c];

/** ¿El salón cambió algo de este rol? */
export const rolCambiado = (rol: RolDelSalon) =>
  Object.entries(rol.salon).some(([c, v]) => v !== !!rol.fabrica[c as ClavePermisoRol]);

/** El rol de una persona (Recepción si no tiene uno o ya no existe) */
export const rolDePersona = (catalogo: CatalogoPermisosRol, rolPersonal?: string | null) =>
  catalogo.roles.find((r) => r.clave === rolPersonal) ?? catalogo.roles.find((r) => r.clave === catalogo.rolBase)!;

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
  /** null en un permiso lo devuelve a lo que trae Lalan */
  guardarRol: (rol: string, cambio: Partial<Record<ClavePermisoRol, boolean | null>>) =>
    api.put<Record<string, MapaPermisosRol>>(`/permisos/rol/${encodeURIComponent(rol)}`, { permisos: cambio }),
  /** Todo el rol vuelve a como lo trae Lalan */
  volverRol: (rol: string) => api.delete<Record<string, MapaPermisosRol>>(`/permisos/rol/${encodeURIComponent(rol)}`),
  dePersona: (id: string) => api.get<PermisosDePersonaDatos>(`/permisos/usuario/${id}`),
  /** null en un permiso lo devuelve a lo de su rol */
  guardarPersona: (id: string, cambio: Partial<Record<ClavePermisoRol, boolean | null>>) =>
    api.put<PermisosDePersonaDatos>(`/permisos/usuario/${id}`, { permisos: cambio }),
};

export interface PermisosDePersonaDatos { rol: string; propios: MapaPermisosRol; efectivos: MapaPermisosRol }
