import { api, subirArchivo } from './api';
import type {
  EstadoBienvenida, Paso, Plantillas, ProductoBienvenida, ProductoLeido, RecetaServicio, SedeBienvenida, ServicioAGuardar, ServicioLeido, TipoSalon,
} from '../types/bienvenida';
import type { DiaDeHorario } from '../types';

/** La Bienvenida se abre desde cualquier parte (Ajustes, el aviso) con un evento, como Lalan */
const EVENTO_ABRIR = 'lalan:bienvenida';
/** "Ahora no": no se vuelve a abrir sola en esta sesión del navegador */
const CLAVE_POSPUESTA = 'lalan_bienvenida_pospuesta';

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

export function bienvenidaPospuesta(): boolean {
  try { return sessionStorage.getItem(CLAVE_POSPUESTA) === '1'; } catch { return false; }
}
export function posponerBienvenida() {
  try { sessionStorage.setItem(CLAVE_POSPUESTA, '1'); } catch { /* sin almacenamiento: se pospone solo por ahora */ }
}

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

  sedes: () => api.get<SedeBienvenida[]>('/bienvenida/sedes'),
  guardarSede: (id: string, d: { nombre?: string; direccion?: string | null; telefono?: string | null }) => api.patch<SedeBienvenida[]>(`/bienvenida/sedes/${id}`, d),
  nuevaSede: (d: { nombre: string; direccion?: string; telefono?: string }) => api.post<SedeBienvenida[]>('/bienvenida/sedes', d),
  horario: (horarioSemanal: DiaDeHorario[]) => api.put<SedeBienvenida[]>('/bienvenida/horario', { horarioSemanal }),

  especialistas: (especialistas: { nombre: string; rol?: string; telefono?: string }[]) =>
    api.post<{ creadas: unknown[]; todas: { id: string; name: string; role: string }[] }>('/bienvenida/especialistas', { especialistas }),

  plantillas: (tipos?: TipoSalon[]) => api.get<Plantillas>(`/bienvenida/plantillas${tipos?.length ? `?tipos=${tipos.join(',')}` : ''}`),
  servicios: (servicios: ServicioAGuardar[]) =>
    api.post<{ creados: string[]; actualizados: string[]; conReceta: number; insumosNuevos: string[]; estado: EstadoBienvenida }>('/bienvenida/servicios', { servicios }),
  fotoPrecios: (fotos: File[]) => subirArchivo<ServicioLeido[]>('/bienvenida/foto-precios', conFotos(fotos)),
  /** El texto de un Excel, un Word, unas notas o pegado → la misma tabla para revisar */
  textoPrecios: (texto: string) => api.post<ServicioLeido[]>('/bienvenida/texto-precios', { texto }),

  recetas: () => api.get<RecetaServicio[]>('/bienvenida/recetas'),
  rendimiento: (serviceId: string, lineas: { productId?: string; plantilla?: string; nombre?: string; rinde: number | null }[]) =>
    api.put<RecetaServicio>(`/bienvenida/recetas/${serviceId}`, { lineas }),

  productos: () => api.get<ProductoBienvenida[]>('/bienvenida/productos'),
  guardarProductos: (productos: { productId?: string; plantilla?: string; nombre?: string; costo?: number; cantidad?: number }[]) =>
    api.post<{ guardados: string[]; productos: ProductoBienvenida[] }>('/bienvenida/productos', { productos }),
  fotoFactura: (fotos: File[]) => subirArchivo<ProductoLeido[]>('/bienvenida/foto-factura', conFotos(fotos)),
};
