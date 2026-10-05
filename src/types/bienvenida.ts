import type { DiaDeHorario } from './index';

/**
 * La Bienvenida: configurar el salón paso a paso. Mismo contrato que el
 * servidor (bienvenida/bienvenida.contrato.ts).
 */

export type TipoSalon = 'unas' | 'peluqueria' | 'barberia' | 'estetica';
export type Paso = 'salon' | 'sedes' | 'horario' | 'especialistas' | 'servicios' | 'recetas' | 'productos';
export type Porcion = 'manos' | 'pies' | 'cabezas' | 'clientas' | 'servicios';

export interface PasoVista {
  id: Paso;
  nombre: string;
  descripcion: string;
  necesario: boolean;
  aplica: boolean;
  avance: number;
  hecho: boolean;
  falta: string | null;
}

export interface EstadoBienvenida {
  tipos: TipoSalon[];
  pasos: PasoVista[];
  porcentaje: number;
  listoParaEmpezar: boolean;
  terminada: boolean;
  mostrar: boolean;
  siguiente: Paso | null;
}

export interface TipoSalonCatalogo { id: TipoSalon; nombre: string; icono: string; descripcion: string }

export interface SedeBienvenida {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  horarioSemanal: DiaDeHorario[];
}

export interface ServicioPlantilla {
  clave: string;
  nombre: string;
  categoria: string;
  categoriaNombre: string;
  duracion: number;
  comun: boolean;
  yaLoTienes: { serviceId: string; nombre: string; precio: number; duracion: number } | null;
  lleva: string[];
}

export interface Plantillas {
  tiposSalon: TipoSalonCatalogo[];
  tipos: TipoSalon[];
  conRecetas: boolean;
  servicios: ServicioPlantilla[];
}

export interface ServicioAGuardar {
  plantilla?: string;
  serviceId?: string;
  nombre?: string;
  categoria?: string;
  precio: number;
  duracion?: number;
}

export interface LineaReceta {
  productId: string;
  insumo: string;
  presentacion: string | null;
  rinde: number | null;
  estimada: boolean;
  cantidad: number;
  unidad: string;
}

export interface RecetaServicio {
  serviceId: string;
  servicio: string;
  categoria: string;
  porcion: Porcion;
  palabra: { una: string; varias: string };
  estimada: boolean;
  lineas: LineaReceta[];
}

export interface ProductoBienvenida {
  productId: string;
  nombre: string;
  categoria: string;
  presentacion: string | null;
  costo: number | null;
  cantidad: number;
  insumo: boolean;
  enRecetas: number;
}

export interface ServicioLeido {
  leido: string;
  precio: number | null;
  duracion: number | null;
  plantilla: string | null;
  plantillaNombre: string | null;
  categoria: string | null;
  serviceIdExistente: string | null;
}

export interface ProductoLeido {
  leido: string;
  cantidad: number | null;
  costo: number | null;
  plantilla: string | null;
  plantillaNombre: string | null;
  productIdExistente: string | null;
  productoExistente: string | null;
  categoria: string | null;
}
