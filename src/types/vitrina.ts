/**
 * La Vitrina: la página pública de una sede, donde las clientas ven lo que el
 * salón ofrece y reservan solas. Mismas formas que `vitrina.contrato.ts` del
 * servidor.
 */

export type TipoBloqueVitrina =
  | 'portada' | 'mensaje' | 'servicios' | 'ofertas' | 'productos' | 'especialistas' | 'horario' | 'ubicacion';

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
  ubicacion: { nombre: 'Ubicación y contacto', ayuda: 'Dirección, teléfono e Instagram' },
};

export type ModoPrecio = 'exacto' | 'desde' | 'consultar';

export interface ServicioVitrina {
  id: string;
  nombre: string;
  categoria: string;
  categoriaNombre: string;
  duracionMin: number;
  descripcion: string | null;
  precio: number | null;
  modoPrecio: ModoPrecio;
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
  precio: number;
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
  /** Las preguntas del Lounge al reservar (vacío si el salón no tiene hospitalidad) */
  gustos?: PreguntaDeGusto[];
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
  diseno: DisenoVitrina;
  portada: string | null;
  incluidaEnElPlan: boolean;
  publicados: { servicios: number; serviciosPublicados: number; productos: number; productosPublicados: number };
}

export interface ReservaHecha {
  confirmada: boolean;
  dia: string;
  fecha: string;
  sede: { nombre: string; direccion: string | null };
  citas: { servicio: string; hora: string; texto: string; especialista: string | null }[];
  apartados: string[];
}
