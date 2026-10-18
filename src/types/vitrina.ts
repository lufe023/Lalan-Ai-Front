/**
 * La Vitrina: la página pública de una sede, donde las clientas ven lo que el
 * salón ofrece y reservan solas. Mismas formas que `vitrina.contrato.ts` del
 * servidor.
 */

export type TipoBloqueVitrina =
  | 'portada' | 'mensaje' | 'servicios' | 'ofertas' | 'productos' | 'especialistas' | 'horario' | 'ubicacion' | 'chat';

export interface BloqueVitrina {
  tipo: TipoBloqueVitrina;
  visible: boolean;
}

export interface DisenoVitrina {
  /** Id de una paleta de Lalan. Null = la de la sede */
  paleta: string | null;
  fondo: 'claro' | 'oscuro';
  bloques: BloqueVitrina[];
  titulo: string | null;
  mensaje: string | null;
  confirmaSola: boolean;
  elegirEspecialista: boolean;
  /** Qué parte de la foto de portada se ve, de arriba (0) a abajo (100) */
  portadaY?: number;
  /** El orden de servicios y productos (ids): lo primero se vende más. Lo que no está va después */
  orden?: { servicios: string[]; productos: string[] };
  /** Lo que la dueña recomienda: sale primero y con su etiqueta */
  destacados?: string[];
}

/** Lo que la dueña ve de cada bloque al ordenarlos */
export const INFO_BLOQUE_VITRINA: Record<TipoBloqueVitrina, { nombre: string; ayuda: string }> = {
  portada: { nombre: 'Portada', ayuda: 'La foto de la sede, el título y si hoy está abierto' },
  mensaje: { nombre: 'Mensaje', ayuda: 'Un texto tuyo: bienvenida, promoción del mes, aviso' },
  servicios: { nombre: 'Servicios', ayuda: 'Los servicios publicados, con foto y precio' },
  ofertas: { nombre: 'Ofertas', ayuda: 'Las ofertas activas de la sede' },
  productos: { nombre: 'Productos', ayuda: 'Lo que hay en existencia en esta sede' },
  especialistas: { nombre: 'Especialistas', ayuda: 'Quién atiende y qué hace' },
  horario: { nombre: 'Horario', ayuda: 'Los días y horas de la sede' },
  ubicacion: { nombre: 'Ubicación', ayuda: 'El mapa, la dirección y las otras sedes' },
  chat: { nombre: 'Escríbenos', ayuda: 'WhatsApp, Instagram y Messenger para chatear con Lalán' },
};

export type ModoPrecio = 'exacto' | 'desde' | 'consultar';

export interface VarianteVitrina { nombre: string; precio: number; detalle: string | null }

export interface ServicioVitrina {
  id: string;
  nombre: string;
  categoria: string;
  categoriaNombre: string;
  duracionMin: number;
  descripcion: string | null;
  precio: number | null;
  modoPrecio: ModoPrecio;
  /** Las variantes que la dueña deja ver (solo si son varias y muestra el precio exacto) */
  variantes?: VarianteVitrina[];
  foto: string | null;
  /** Todas sus fotos (hasta 10), la primera es `foto` */
  fotos?: string[];
  popular: boolean;
}

export interface ProductoVitrina {
  id: string;
  nombre: string;
  categoriaNombre: string;
  descripcion: string | null;
  /** null = la dueña no muestra el precio («Precio en el salón») */
  precio: number | null;
  modoPrecio?: ModoPrecio;
  variantes?: VarianteVitrina[];
  foto: string | null;
  fotos?: string[];
  quedanPocos: boolean;
}

export interface OfertaVitrina {
  id: string;
  nombre: string;
  descripcion: string | null;
  servicioIds: string[];
  servicios: string[];
  precio: number;
  desde: string | null;
  hasta: string | null;
  dias: number[];
}

export interface EspecialistaVitrina {
  id: string;
  nombre: string;
  especialidad: string;
  /** null = atiende de todo */
  categorias: string[] | null;
}

export interface DiaVitrina {
  dia: number;
  abierto: boolean;
  tramos: { desde: string; hasta: string }[];
}

export interface DatosVitrina {
  salon: { nombre: string };
  sede: {
    id: string;
    nombre: string;
    direccion: string | null;
    telefono: string | null;
    instagram: string | null;
    facebook: string | null;
    /** El pin del local; null = solo la dirección */
    latitud?: number | null;
    longitud?: number | null;
    zona: string;
    moneda: string;
    hoy: string;
    semana: DiaVitrina[];
    diasParaReservar: number;
    hoyFecha: string;
  };
  diseno: DisenoVitrina;
  portada: string | null;
  servicios: ServicioVitrina[];
  productos: ProductoVitrina[];
  ofertas: OfertaVitrina[];
  especialistas: EspecialistaVitrina[];
  /** Su dirección corta sin dominio ("lalanspa" o "lalanspa/piantini"); null si el salón no eligió nombre */
  direccionCorta?: string | null;
  /** Las preguntas del Lounge al reservar (vacío si el salón no tiene hospitalidad) */
  gustos?: PreguntaDeGusto[];
  /** Las cuentas conectadas de la sede para escribirle a Lalán (null si el bloque está apagado) */
  chat?: ChatVitrina | null;
  /** Las otras sedes publicadas del salón, para el bloque de ubicación */
  otrasSedes?: OtraSedeVitrina[];
}

export interface ChatVitrina { whatsapp: string | null; instagram: string | null; messenger: string | null }

export interface OtraSedeVitrina {
  nombre: string;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  slug: string;
  direccionCorta: string | null;
}

export interface PreguntaDeGusto {
  tipo: 'music' | 'drink';
  titulo: string;
  ayuda: string;
  opciones: { id: string; valor: string }[];
}

export interface ConfigVitrina {
  sede: { id: string; nombre: string; paleta: string | null };
  activa: boolean;
  slug: string | null;
  /** El nombre corto del salón (lalan…/<nombre>), el mismo en todas las sedes; null si no eligió */
  nombreCorto?: string | null;
  /** La parte de esta sede en la dirección (lalan…/<nombre>/<corto>) */
  corto?: string;
  /** La dirección corta de esta sede, sin dominio; null si no hay nombre o no está publicada */
  direccionCorta?: string | null;
  /** El pin del local en el mapa; null = solo la dirección */
  ubicacion?: { latitud: number; longitud: number } | null;
  /** El Instagram y el Facebook de la sede que salen en el bloque de ubicación */
  redes?: { instagram: string | null; facebook: string | null };
  diseno: DisenoVitrina;
  portada: string | null;
  incluidaEnElPlan: boolean;
  publicados: { servicios: number; serviciosPublicados: number; productos: number; productosPublicados: number };
}

export interface ReservaHecha {
  confirmada: boolean;
  /** «V-1A2B3C4D»: va en el mensaje a Lalán para que sepa que es esta reserva y no una cita nueva */
  codigo?: string;
  /** El WhatsApp de Lalán en la sede (solo dígitos); null si no está conectado */
  whatsapp?: string | null;
  dia: string;
  fecha: string;
  sede: { nombre: string; direccion: string | null };
  citas: { servicio: string; hora: string; texto: string; especialista: string | null }[];
  apartados: string[];
}

/** Lo que hay detrás de una dirección corta (/<nombre>): el nombre de hoy y las sedes publicadas */
export interface DireccionCortaVitrina {
  nombre: string;
  salon: string;
  sedes: { corto: string; nombre: string; direccion: string | null; slug: string; portada: string | null }[];
}

/** ¿Está libre ese nombre corto? */
export interface NombreCortoDisponible { nombre: string; libre: boolean; motivo: string | null }
