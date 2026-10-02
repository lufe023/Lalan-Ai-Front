/** Lo que responde el backend en /plataforma/landing (ver landing.contrato.ts) */
export type Dispositivo = 'movil' | 'tableta' | 'pc';
export type EstadoAplicacion = 'nueva' | 'contactada' | 'aceptada' | 'descartada';

export interface Conteo { id: string; visitas: number }
export interface Opcion { id: string; descripcion: string }

export interface ResumenLanding {
  desde: string;
  hasta: string;
  visitas: number;
  visitantes: number;
  anterior: { visitas: number; visitantes: number; aplicaciones: number };
  duracionMediaSeg: number;
  rebote: number;
  scrollMedio: number;
  porDia: { fecha: string; visitas: number; visitantes: number }[];
  calorHoras: { dia: number; hora: number; visitas: number }[];
  paises: Conteo[];
  ciudades: { id: string; pais: string | null; visitas: number }[];
  dispositivos: { id: Dispositivo; visitas: number }[];
  navegadores: Conteo[];
  sistemas: Conteo[];
  fuentes: Conteo[];
  secciones: { id: string; descripcion: string; visitas: number }[];
  historia: { inicios: number; conSonido: number; finales: number; pantallaCompleta: number; repeticiones: number; visitasQueLaVieron: number };
  piloto: { abrieron: number; aplicaciones: number; nuevas: number };
  clicsDestacados: { detalle: string; clics: number }[];
}

export interface AplicacionPiloto {
  id: string;
  creadoEn: string;
  nombre: string;
  salon: string;
  telefono: string;
  correo: string | null;
  ciudad: string | null;
  tamanoEquipo: string | null;
  servicios: string[];
  planInteres: string | null;
  comoNosConocio: string | null;
  mensaje: string | null;
  estado: EstadoAplicacion;
  notas: string | null;
  fuente: string | null;
  pais: string | null;
  dispositivo: Dispositivo | null;
}

/** «No tengo salón»: alguien que quiere una asistente para otro negocio */
export interface OtroNegocio {
  id: string; creadoEn: string; tipoNegocio: string; queAutomatizar: string[]; nombre: string | null; negocio: string | null;
  telefono: string; detalle: string | null; estado: EstadoAplicacion; notas: string | null; fuente: string | null;
}
export interface ResumenOtrosNegocios { porTipo: (Opcion & { total: number })[]; lista: OtroNegocio[] }

export interface CatalogosPiloto { tiposNegocio: Opcion[]; queAutomatizar: Opcion[]; tamanosEquipo: Opcion[]; servicios: Opcion[]; planes: Opcion[]; comoNosConocio: Opcion[] }

// ── Planes, negocios y usuarios ───────────────────────────────────────

export type ClaveModulo =
  | 'especialistas_zonas' | 'avisos_duena' | 'informes' | 'canales_extra' | 'sala_turnos' | 'caja' | 'inventario'
  | 'listas_precios' | 'multimoneda' | 'hospitalidad' | 'lounge_musica' | 'pedir_cancion' | 'recordatorios';

export type GrupoModulo = 'atencion' | 'salon' | 'dinero' | 'experiencia';
export interface ModuloCatalogo { id: ClaveModulo; nombre: string; descripcion: string; grupo: GrupoModulo }
export interface CatalogoModulos { modulos: ModuloCatalogo[]; siempreIncluido: string[] }

export type Recurso = 'mensajesMes' | 'sedes' | 'usuarios' | 'especialistas';
export type Limites = Record<Recurso, number | null>;
export type Uso = Record<Recurso, number>;

export interface MiPlan {
  plan: { id: string; clave: string; nombre: string } | null;
  modulos: ClaveModulo[];
  limites: Limites;
  uso: Uso;
  nivelMensajes: NivelMensajes;
  siempreIncluido: string[];
}

export interface PlanLalan {
  id: string;
  clave: string;
  nombre: string;
  descripcion: string | null;
  precioMensual: number;
  moneda: string;
  orden: number;
  activo: boolean;
  modulos: ClaveModulo[];
  limites: Limites;
  negocios: number;
}

export interface NegocioResumen {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
  creadoEn: string;
  plan: { id: string; nombre: string } | null;
  excepciones: number;
  duena: { name: string; email: string; debeCambiarClave: boolean } | null;
  uso: Uso;
  limites: Limites;
}

export interface NegocioDetalle {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
  creadoEn: string;
  notasPlataforma: string | null;
  plan: { id: string; nombre: string } | null;
  modulosExtra: ClaveModulo[];
  modulosQuitados: ClaveModulo[];
  limitesPropios: Limites;
  efectivo: { plan: MiPlan['plan']; modulos: ClaveModulo[]; limites: Limites };
  uso: Uso;
  sedes: { id: string; name: string; address: string | null; phone: string | null }[];
  usuarios: { id: string; name: string; email: string | null; usuario?: string | null; telefono?: string | null; correoConfirmadoEn?: string | null; role: string; active: boolean; debeCambiarClave: boolean }[];
}

export interface UsuarioSalon {
  id: string;
  name: string;
  /** Opcional para el equipo; obligatorio para administración */
  email: string | null;
  /** Para entrar sin correo: "maria.bella" */
  usuario: string | null;
  /** Para entrar con el teléfono: 18095551234 */
  telefono: string | null;
  /** null = sin confirmar */
  correoConfirmadoEn: string | null;
  role: 'admin' | 'assistant';
  roleTitle: string | null;
  active: boolean;
  locationId: string | null;
  debeCambiarClave: boolean;
  createdAt: string;
}

/** Cómo se nombra cada límite en pantalla */
export const NOMBRE_RECURSO: Record<Recurso, string> = {
  mensajesMes: 'Mensajes de Lalan al mes',
  sedes: 'Sedes',
  usuarios: 'Usuarios',
  especialistas: 'Especialistas',
};
export const RECURSOS: Recurso[] = ['mensajesMes', 'sedes', 'usuarios', 'especialistas'];

/** En qué punto está el cupo de mensajes de Lalan este mes (igual que el backend) */
export const NIVEL_MENSAJES = { normal: 'normal', aviso: 'aviso', agotado: 'agotado' } as const;
export type NivelMensajes = typeof NIVEL_MENSAJES[keyof typeof NIVEL_MENSAJES];
