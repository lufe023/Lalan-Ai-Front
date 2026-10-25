import { api } from './api';

/**
 * Lo que llevan los productos: la base de Lalan (genéricos, componentes y
 * riesgos), el vínculo de cada producto del salón y los avisos de alergia
 * para el equipo. A la clienta no se le dice nada desde aquí.
 */
export type Presencia = 'siempre' | 'algunas_marcas' | 'marca';
export type NivelAviso = 'contiene' | 'puede_contener' | 'sin_datos';
export type TipoRiesgo = 'irritacion' | 'alergia' | 'respiratorio' | 'quemadura' | 'inflamable';
export type NivelRiesgo = 'precaucion' | 'cuidado' | 'evitar';

export interface Riesgo { tipo: TipoRiesgo; nivel: NivelRiesgo; texto: string }
export interface GrupoAlergia { clave: string; nombre: string }

export const NOMBRE_PRESENCIA: Record<Presencia, string> = { siempre: 'Siempre', algunas_marcas: 'Algunas marcas', marca: 'Una marca' };
export const NOMBRE_RIESGO: Record<TipoRiesgo, string> = { irritacion: 'Irritación', alergia: 'Alergia', respiratorio: 'Respiratorio', quemadura: 'Quemadura', inflamable: 'Inflamable' };
export const NOMBRE_NIVEL: Record<NivelRiesgo, string> = { precaucion: 'Precaución', cuidado: 'Cuidado', evitar: 'Evitar' };

// ── Plataforma ───────────────────────────────────────────────

export interface Componente {
  id: string; nombre: string; sinonimos: string[]; cas: string | null; grupo: string; riesgos: Riesgo[]; fuente: string | null; enProductos: number;
}
export interface FilaComposicion {
  id: string; productoConocidoId: string; componenteId: string; presencia: Presencia; marca: string | null; nota: string | null; fuente: string;
  revisadoEn: string | null; componente: { nombre: string; grupo: string };
}
export interface ProductoConocido {
  id: string; nombre: string; alias: string[]; marcas: string[]; categoria: string | null; nota: string | null;
  componentes: FilaComposicion[]; productosVinculados: number;
}
export interface BaseProductos { grupos: GrupoAlergia[]; componentes: Componente[]; productos: ProductoConocido[] }
export interface PorReconocer { nombre: string; salones: number; productos: number; insumos: number; sugerido: string | null }

export interface FilaMercado {
  producto: string; marca: string | null; salones: number; productos: number; servicios: number; usos: number;
  costoPromedio: { moneda: string; valor: number; muestras: number }[];
}
export interface Mercado {
  desde: string; hasta: string; minimoSalones: number;
  opciones: { tipos: { id: string; nombre: string }[]; paises: string[]; ciudades: string[] };
  cobertura: { salones: number; productos: number; vinculados: number; conMarca: number };
  productos: { ocultas: number; filas: FilaMercado[] };
  marcas: { ocultas: number; filas: FilaMercado[] };
  tendencia: { mes: string; usos: Record<string, number> }[];
}

export type DatosComponente = Omit<Componente, 'id' | 'enProductos'>;
export type DatosGenerico = Pick<ProductoConocido, 'nombre' | 'alias' | 'marcas' | 'categoria' | 'nota'>;
export type DatosComposicion = Pick<FilaComposicion, 'productoConocidoId' | 'componenteId' | 'presencia' | 'marca' | 'nota' | 'fuente'>;

export interface PropuestaIa {
  existenteId: string | null;
  generico: { nombre: string; categoria: string | null; alias: string[]; marcas: string[] };
  componentes: { componenteId: string | null; nombre: string; grupo: string | null; presencia: Presencia; marca: string | null; nota: string | null }[];
}

export const baseProductosApi = {
  base: () => api.get<BaseProductos>('/plataforma/productos'),
  porReconocer: () => api.get<PorReconocer[]>('/plataforma/productos/por-reconocer'),
  /** La IA propone qué genérico es y qué suele llevar; no guarda nada */
  proponer: (nombre: string) => api.post<PropuestaIa>('/plataforma/productos/proponer', { nombre }),
  mercado: (f: { desde?: string; hasta?: string; tipo?: string; pais?: string; ciudad?: string }) => {
    const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
    return api.get<Mercado>(`/plataforma/productos/mercado${q ? `?${q}` : ''}`);
  },
  guardarComponente: (id: string | null, d: DatosComponente) => id ? api.put<Componente>(`/plataforma/productos/componentes/${id}`, d) : api.post<Componente>('/plataforma/productos/componentes', d),
  borrarComponente: (id: string) => api.delete<{ ok: true }>(`/plataforma/productos/componentes/${id}`),
  guardarGenerico: (id: string | null, d: DatosGenerico) => id ? api.put<ProductoConocido>(`/plataforma/productos/genericos/${id}`, d) : api.post<ProductoConocido>('/plataforma/productos/genericos', d),
  borrarGenerico: (id: string) => api.delete<{ ok: true }>(`/plataforma/productos/genericos/${id}`),
  guardarComposicion: (id: string | null, d: DatosComposicion) => id ? api.put<FilaComposicion>(`/plataforma/productos/composicion/${id}`, d) : api.post<FilaComposicion>('/plataforma/productos/composicion', d),
  borrarComposicion: (id: string) => api.delete<{ ok: true }>(`/plataforma/productos/composicion/${id}`),
  publicar: (id: string, publicada: boolean) => api.post<FilaComposicion>(`/plataforma/productos/composicion/${id}/publicar`, { publicada }),
};

// ── El salón ─────────────────────────────────────────────────

export interface ComponenteEnProducto { componente: string; grupo: string; presencia: Presencia; marca: string | null; riesgos: Riesgo[] }
export interface VinculoProducto {
  producto: string;
  actual: { id: string; nombre: string; confirmado: boolean } | null;
  marca: string | null;
  sugerido: { id: string; nombre: string } | null;
  marcaSugerida: string | null;
  lleva: ComponenteEnProducto[];
  enRiesgo: { clientas: number; citas: number; avisos: string[] };
}
export interface AvisoAlergia {
  productId: string; producto: string; conocido: string | null; nivel: NivelAviso; grupo: string | null; componente: string | null; marcas: string[];
  texto: string; revisado: { por: string; en: string } | null;
}
export interface AlergiasClienta { grupos: GrupoAlergia[]; detectados: string[]; /** Los que solo vio la IA */ porIa?: string[]; decididos: { grupo: string; estado: 'confirmada' | 'descartada' }[]; vigentes: string[] }

export const saberProductosApi = {
  genericos: (q: string) => api.get<{ id: string; nombre: string; categoria: string | null }[]>(`/saber-productos/genericos?q=${encodeURIComponent(q)}`),
  lleva: (genericoId: string) => api.get<ComponenteEnProducto[]>(`/saber-productos/genericos/${genericoId}/lleva`),
  sugerencia: (nombre: string) => api.get<{ sugerido: { id: string; nombre: string } | null; marcaSugerida: string | null; lleva: ComponenteEnProducto[] }>(`/saber-productos/sugerencia?nombre=${encodeURIComponent(nombre)}`),
  vinculo: (productId: string) => api.get<VinculoProducto>(`/saber-productos/productos/${productId}`),
  vincular: (productId: string, d: { productoConocidoId: string | null; marca?: string | null }) => api.put<VinculoProducto>(`/saber-productos/productos/${productId}`, d),
  riesgosDeServicio: (serviceId: string) => api.get<{ productId: string; producto: string; conocido: string; componentes: ComponenteEnProducto[] }[]>(`/saber-productos/servicios/${serviceId}/riesgos`),
  alergias: (clientId: string) => api.get<AlergiasClienta>(`/saber-productos/clientas/${clientId}/alergias`),
  marcarAlergia: (clientId: string, grupo: string, estado: 'confirmada' | 'descartada' | null) => api.put<AlergiasClienta>(`/saber-productos/clientas/${clientId}/alergias`, { grupo, estado }),
  avisosDeCita: (citaId: string) => api.get<{ grupos: string[]; avisos: AvisoAlergia[] }>(`/saber-productos/citas/${citaId}/avisos`),
  revisado: (citaId: string, productId: string) => api.post<{ ok: true }>(`/saber-productos/citas/${citaId}/revisado`, { productId }),
};
