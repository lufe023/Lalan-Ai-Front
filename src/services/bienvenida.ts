import { api, apiCadena, subirArchivo } from './api';
import type {
  EstadoBienvenida, Paso, Plantillas, ProductoBienvenida, ProductoLeido, RecetaServicio, SedeBienvenida, ServicioAGuardar, ServicioLeido, TipoSalon,
} from '../types/bienvenida';
import type { DiaDeHorario } from '../types';

/** La Bienvenida se abre desde cualquier parte (Ajustes, el aviso) con un evento, como Lalan */
const EVENTO_ABRIR = 'lalan:bienvenida';
/**
 * "Ahora no": no se vuelve a abrir sola en unos días. Antes duraba solo la
 * sesión del navegador y la dueña la veía cada vez que entraba.
 */
const CLAVE_POSPUESTA = 'lalan_bienvenida_pospuesta_hasta';
const DIAS_POSPUESTA = 3;
/** La cinta "Tu salón está al 70 %" cerrada con la X: vuelve en una semana */
const CLAVE_AVISO_OCULTO = 'lalan_aviso_bienvenida_oculto_hasta';
const DIAS_AVISO_OCULTO = 7;
const DIA_MS = 24 * 60 * 60 * 1000;

function vigente(clave: string): boolean {
  try { return Number(localStorage.getItem(clave) ?? 0) > Date.now(); } catch { return false; }
}
function hastaDentroDe(clave: string, dias: number) {
  try { localStorage.setItem(clave, String(Date.now() + dias * DIA_MS)); } catch { /* sin almacenamiento: se oculta solo por ahora */ }
}
export function avisoBienvenidaOculto(): boolean { return vigente(CLAVE_AVISO_OCULTO); }
export function ocultarAvisoBienvenida() { hastaDentroDe(CLAVE_AVISO_OCULTO, DIAS_AVISO_OCULTO); }

export function abrirBienvenida() { window.dispatchEvent(new Event(EVENTO_ABRIR)); }
export function alPedirBienvenida(fn: () => void) {
  window.addEventListener(EVENTO_ABRIR, fn);
  return () => window.removeEventListener(EVENTO_ABRIR, fn);
}
/** La Bienvenida se cerró o terminó: el aviso de arriba vuelve a mirar en qué va */
const EVENTO_CAMBIO = 'lalan:bienvenida-cambio';
export function avisarCambioBienvenida() { window.dispatchEvent(new Event(EVENTO_CAMBIO)); }
export function alCambiarBienvenida(fn: () => void) {
  window.addEventListener(EVENTO_CAMBIO, fn);
  return () => window.removeEventListener(EVENTO_CAMBIO, fn);
}

export function bienvenidaPospuesta(): boolean { return vigente(CLAVE_POSPUESTA); }
export function posponerBienvenida() { hastaDentroDe(CLAVE_POSPUESTA, DIAS_POSPUESTA); }

/** Las fotos (lista de precios, factura) van como multipart en el campo "fotos" */
function conFotos(fotos: File[]) {
  const f = new FormData();
  for (const x of fotos) f.append('fotos', x);
  return f;
}

export const bienvenidaApi = {
  estado: () => api.get<EstadoBienvenida>('/bienvenida'),
  marcarListo: (paso: Paso) => api.post<EstadoBienvenida>('/bienvenida/pasos/listo', { paso }),
  terminar: () => api.post<EstadoBienvenida>('/bienvenida/terminar', {}),

  salon: (d: { nombre?: string; tipos?: TipoSalon[] }) => api.put<EstadoBienvenida>('/bienvenida/salon', d),

  sedes: () => apiCadena.get<SedeBienvenida[]>('/bienvenida/sedes'),
  guardarSede: (id: string, d: { nombre?: string; direccion?: string | null; telefono?: string | null }) => apiCadena.patch<SedeBienvenida[]>(`/bienvenida/sedes/${id}`, d),
  nuevaSede: (d: { nombre: string; direccion?: string; telefono?: string }) => apiCadena.post<SedeBienvenida[]>('/bienvenida/sedes', d),
  horario: (horarioSemanal: DiaDeHorario[]) => apiCadena.put<SedeBienvenida[]>('/bienvenida/horario', { horarioSemanal }),

  /** `locationId`: la sede donde trabajan (con varias sedes) */
  especialistas: (especialistas: { nombre: string; rol?: string; telefono?: string }[], locationId?: string) =>
    api.post<{ creadas: unknown[]; todas: { id: string; name: string; role: string }[] }>('/bienvenida/especialistas', { especialistas, ...(locationId ? { locationId } : {}) }),

  plantillas: (tipos?: TipoSalon[]) => api.get<Plantillas>(`/bienvenida/plantillas${tipos?.length ? `?tipos=${tipos.join(',')}` : ''}`),
  servicios: (servicios: ServicioAGuardar[]) =>
    api.post<{ creados: string[]; actualizados: string[]; conReceta: number; insumosNuevos: string[]; estado: EstadoBienvenida }>('/bienvenida/servicios', { servicios }),
  fotoPrecios: (fotos: File[]) => subirArchivo<ServicioLeido[]>('/bienvenida/foto-precios', conFotos(fotos)),
  /** El texto de un Excel, un Word, unas notas o pegado → la misma tabla para revisar */
  textoPrecios: (texto: string) => api.post<ServicioLeido[]>('/bienvenida/texto-precios', { texto }),

  recetas: () => api.get<RecetaServicio[]>('/bienvenida/recetas'),
  rendimiento: (serviceId: string, lineas: { productId?: string; plantilla?: string; nombre?: string; rinde: number | null }[]) =>
    api.put<RecetaServicio>(`/bienvenida/recetas/${serviceId}`, { lineas }),

  /** Las existencias que se ven y se cargan son las de `sede` (con varias sedes) */
  productos: (sede?: string) => api.get<ProductoBienvenida[]>(`/bienvenida/productos${sede ? `?sede=${encodeURIComponent(sede)}` : ''}`),
  guardarProductos: (productos: { productId?: string; plantilla?: string; nombre?: string; costo?: number; cantidad?: number; locationId?: string }[]) =>
    api.post<{ guardados: string[]; productos: ProductoBienvenida[] }>('/bienvenida/productos', { productos }),
  fotoFactura: (fotos: File[]) => subirArchivo<ProductoLeido[]>('/bienvenida/foto-factura', conFotos(fotos)),
};
