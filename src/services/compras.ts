import { api, blobProtegido, descargarArchivo, subirArchivo } from './api';

/**
 * Compras (backend: compras/): proveedores, qué se le compra a cada uno,
 * cotizaciones, órdenes y recepción. Un pedido es de UNA sede y lo que llega
 * entra al inventario de esa sede.
 */

export type EstadoCompra = 'borrador' | 'cotizacion_enviada' | 'confirmada' | 'recibida_parcial' | 'recibida' | 'cancelada';
export type ModoCompra = 'manual' | 'sugerir' | 'lalan';
export type CanalEnvio = 'whatsapp' | 'correo' | 'impreso';

export const NOMBRE_ESTADO: Record<EstadoCompra, string> = {
  borrador: 'Borrador',
  cotizacion_enviada: 'Cotización enviada',
  confirmada: 'Orden de compra',
  recibida_parcial: 'Recibida en parte',
  recibida: 'Recibida',
  cancelada: 'Cancelada',
};

/** Color de la pastilla del estado */
export const COLOR_ESTADO: Record<EstadoCompra, string> = {
  borrador: 'bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300',
  cotizacion_enviada: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  confirmada: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  recibida_parcial: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  recibida: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  cancelada: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
};

/** Los pasos de arriba del pedido, como en Odoo */
export const PASOS: { id: EstadoCompra; nombre: string }[] = [
  { id: 'borrador', nombre: 'Cotización' },
  { id: 'cotizacion_enviada', nombre: 'Cotización enviada' },
  { id: 'confirmada', nombre: 'Orden de compra' },
  { id: 'recibida', nombre: 'Recibida' },
];

export interface Proveedor {
  id: string; nombre: string; contacto: string | null; whatsapp: string | null; correo: string | null; telefono: string | null;
  direccion: string | null; rnc: string | null; currencyCode: string | null; diasEntrega: number | null;
  condicionesPago: string | null; pedidoMinimo: number | null; notas: string | null; sedes: string[];
  lalanHabla: boolean; plataformaId: string | null; activo: boolean;
  productos?: number; pedidosAbiertos?: number;
}

export interface Vinculo {
  id: string; proveedorId: string; productId: string; codigo: string | null; precio: number | null; currencyCode: string | null;
  unidadCompra: string | null; factor: number; minimo: number | null; preferido: boolean;
}

export interface DetalleProveedor extends Omit<Proveedor, 'productos'> {
  productos: (Vinculo & { producto: { id: string; name: string; unit: string; fotoId: string | null } })[];
  ordenes: { id: string; numeroTexto: string; estado: EstadoCompra; total: number; currencyCode: string; creadoEn: string; locationId: string; esperaDuena: boolean }[];
  historial: Evento[];
}

export interface Evento {
  id: string; tipo: string; canal: string | null; autorTipo: 'persona' | 'lalan' | 'proveedor' | 'sistema';
  autorNombre: string | null; texto: string | null; datos: any; adjuntoId: string | null; creadoEn: string;
}

export interface FilaPedido {
  id: string; numero: string; estado: EstadoCompra; estadoNombre: string;
  proveedor: { id: string; nombre: string }; sede: { id: string; nombre: string };
  total: number; currencyCode: string; renglones: number; fechaLimite: string | null; entregaEsperada: string | null;
  creadoEn: string; creadoPor: string | null; origen: string; manejaLalan: boolean; esperaDuena: boolean; atrasada: boolean;
}

export interface LineaPedido {
  id: string; productId: string; descripcion: string; cantidad: number; unidadCompra: string | null; factor: number;
  precio: number; impuestoPct: number; recibido: number; importe: number; codigo: string | null; hay: number;
  producto: { id: string; name: string; unit: string; fotoId: string | null } | null;
}

export interface Pedido {
  id: string; numero: string; estado: EstadoCompra; estadoNombre: string;
  sede: { id: string; nombre: string; direccion: string | null };
  proveedor: Proveedor; currencyCode: string; simbolo: string;
  subtotal: number; impuestos: number; total: number; totalBase: number | null;
  fechaLimite: string | null; entregaEsperada: string | null; confirmadaEn: string | null; recibidaEn: string | null;
  referenciaProveedor: string | null; terminos: string | null; origen: string;
  manejaLalan: boolean; esperaDuena: boolean; preguntaDuena: string | null; creadoEn: string; seEdita: boolean;
  lineas: LineaPedido[]; historial: Evento[];
  adjuntos: { id: string; nombre: string; tipo: string; tamano: number; creadoEn: string }[];
}

export interface Resumen {
  borradores: number; cotizacionesEnviadas: number; cotizacionesAtrasadas: number; sinRecibir: number;
  recepcionAtrasada: number; esperanTuSi: number; entregasATiempo: number | null; diasDeEntrega: number | null;
}

export interface PorPedir {
  productId: string; nombre: string; unidad: string; sede: { id: string; nombre: string };
  hay: number; minimo: number; necesitaCitas: number; faltan: number; yaPedido: number; motivo: 'citas' | 'minimo';
  proveedor: { id: string; nombre: string; precio: number | null; currencyCode: string | null; unidadCompra: string | null; factor: number } | null;
}

export interface AjustesCompras { modo: ModoCompra; impuestoPct: number; avisarFaltantes: boolean; terminos: string | null }

export interface Sugerencia {
  id: string; nombre: string; contacto: string | null; whatsapp: string | null; correo: string | null; web: string | null;
  descripcion: string | null; ciudades: string[]; marcas: string[]; productos: { id: string; nombre: string }[];
}

export interface LineaNueva { productId: string; cantidad: number; precio?: number | null; impuestoPct?: number | null; descripcion?: string | null }

export const conSede = (ruta: string, sede?: string) => (sede ? `${ruta}${ruta.includes('?') ? '&' : '?'}sede=${sede}` : ruta);

export const comprasApi = {
  ajustes: () => api.get<AjustesCompras>('/compras/ajustes'),
  correo: () => api.get<CorreoCompras>('/compras/correo'),
  conectarCorreo: (d: { correo: string; nombre?: string; clave?: string; imapHost?: string; imapPuerto?: number }) => api.put<CorreoCompras>('/compras/correo', d),
  revisarCorreo: () => api.post<CorreoCompras>('/compras/correo/revisar', {}),
  quitarCorreo: () => api.delete<CorreoCompras>('/compras/correo'),
  guardarAjustes: (a: Partial<AjustesCompras>) => api.put<AjustesCompras>('/compras/ajustes', a),

  proveedores: (sede?: string) => api.get<Proveedor[]>(conSede('/compras/proveedores', sede)),
  proveedor: (id: string) => api.get<DetalleProveedor>(`/compras/proveedores/${id}`),
  crearProveedor: (p: Partial<Proveedor>) => api.post<Proveedor>('/compras/proveedores', p),
  editarProveedor: (id: string, p: Partial<Proveedor>) => api.patch<Proveedor>(`/compras/proveedores/${id}`, p),
  borrarProveedor: (id: string) => api.delete<{ archivado?: boolean; borrado?: boolean }>(`/compras/proveedores/${id}`),

  resumenProductos: () => api.get<Record<string, { cuantos: number; preferido: string | null }>>('/compras/productos/resumen'),
  deProducto: (productId: string) => api.get<(Vinculo & { proveedor: { id: string; nombre: string; whatsapp: string | null; correo: string | null; currencyCode: string | null } })[]>(`/compras/productos/${productId}/proveedores`),
  guardarVinculo: (v: Partial<Vinculo> & { proveedorId: string; productId: string }) => api.put<Vinculo>('/compras/vinculos', v),
  quitarVinculo: (id: string) => api.delete<{ ok: true }>(`/compras/vinculos/${id}`),

  porPedir: (sede?: string) => api.get<PorPedir[]>(conSede('/compras/por-pedir', sede)),
  armar: (d: { locationId?: string | null; origen?: string; items: { productId: string; faltan: number; proveedorId?: string | null }[] }) =>
    api.post<{ ordenes: { id: string; numero: string; proveedor: string; nueva: boolean }[]; sinProveedor: { productId: string; nombre: string }[] }>('/compras/armar', d),

  resumen: (sede?: string) => api.get<Resumen>(conSede('/compras/resumen', sede)),
  pedidos: (f: { sede?: string; filtro?: string; estado?: string; proveedorId?: string; q?: string }) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
    return api.get<FilaPedido[]>(`/compras/ordenes${p.toString() ? `?${p}` : ''}`);
  },
  pedido: (id: string) => api.get<Pedido>(`/compras/ordenes/${id}`),
  crear: (d: { proveedorId: string; locationId?: string | null; lineas: LineaNueva[]; origen?: string }) => api.post<Pedido>('/compras/ordenes', d),
  editar: (id: string, d: Partial<{ proveedorId: string; locationId: string; lineas: LineaNueva[]; fechaLimite: string | null; entregaEsperada: string | null; referenciaProveedor: string | null; terminos: string | null }>) =>
    api.patch<Pedido>(`/compras/ordenes/${id}`, d),
  estado: (id: string, estado: EstadoCompra, motivo?: string) => api.post<Pedido>(`/compras/ordenes/${id}/estado`, { estado, motivo }),
  duplicar: (id: string) => api.post<Pedido>(`/compras/ordenes/${id}/duplicar`, {}),
  mensaje: (id: string, como?: 'cotizacion' | 'orden') => api.get<{ texto: string; whatsapp: string | null; correo: string | null; esCotizacion: boolean }>(`/compras/ordenes/${id}/mensaje${como ? `?como=${como}` : ''}`),
  enviar: (id: string, d: { canal: CanalEnvio; como?: 'cotizacion' | 'orden'; mensaje?: string }) => api.post<{ enlace: string | null; orden: Pedido }>(`/compras/ordenes/${id}/enviar`, d),
  recibir: (id: string, d: { lineas: { lineaId: string; cantidad: number; costo?: number | null; lote?: string | null; vence?: string | null }[]; cerrarResto?: boolean }) =>
    api.post<Pedido>(`/compras/ordenes/${id}/recibir`, d),
  nota: (id: string, d: { texto: string; tipo?: 'nota' | 'mensaje_entrante'; canal?: string }) => api.post<Pedido>(`/compras/ordenes/${id}/notas`, d),
  /** Lalan le contesta al proveedor con lo que dice la dueña (literal: sale tal cual) */
  indicar: (id: string, texto: string, literal = false) => api.post<Pedido>(`/compras/ordenes/${id}/indicar`, { texto, literal }),
  /** Lalan le pide precio al proveedor y sigue ella la conversación */
  lalanPide: (id: string) => api.post<{ canal: 'whatsapp' | 'correo'; orden: Pedido }>(`/compras/ordenes/${id}/lalan-pide`, {}),
  adjuntar: (id: string, archivos: File[]) => {
    const f = new FormData();
    archivos.forEach((a) => f.append('archivos', a));
    return subirArchivo<Pedido>(`/compras/ordenes/${id}/adjuntos`, f);
  },
  quitarAdjunto: (id: string) => api.delete<{ ok: true }>(`/compras/adjuntos/${id}`),
  /** El PDF en una pestaña nueva (en el teléfono abre el visor para imprimir o compartir) */
  abrirPdf: async (id: string, como?: 'cotizacion' | 'orden') => {
    const url = await blobProtegido(`/compras/ordenes/${id}/pdf${como ? `?como=${como}` : ''}`);
    const w = window.open(url, '_blank');
    if (!w) window.location.href = url;
  },
  descargarPdf: (id: string, numero: string) => descargarArchivo(`/compras/ordenes/${id}/pdf`, `${numero}.pdf`),
  abrirAdjunto: async (id: string) => {
    const url = await blobProtegido(`/compras/adjuntos/${id}`);
    window.open(url, '_blank');
  },

  sugerencias: (productId?: string) => api.get<{ activo: boolean; sugerencias: Sugerencia[]; sinPais?: boolean }>(`/compras/sugerencias${productId ? `?productId=${productId}` : ''}`),
  adoptar: (id: string, productos: string[]) => api.post<{ proveedorId: string }>(`/compras/sugerencias/${id}/agregar`, { productos }),
};

/** Para abrir un pedido al llegar a Compras desde otra pantalla (Mi semana, Catálogo, un aviso) */
/** El correo del salón que Lalan usa para compras (la contraseña nunca vuelve) */
export type CorreoCompras =
  | { conectado: false }
  | { conectado: true; correo: string; nombre: string | null; imapHost: string; imapPuerto: number; activo: boolean; revisadoEn: string | null; error: string | null };

export const ABRIR_PEDIDO = 'lalan_abrir_pedido';
/** La notificación de un pedido pide abrirlo con la pantalla ya abierta */
export const EVENTO_ABRIR_PEDIDO = 'lalan:abrir-pedido';
/** La pestaña de Compras con la que abrir ("por-pedir") */
export const VISTA_COMPRAS = 'lalan_vista_compras';

export const cantidadTexto = (n: number) => n.toLocaleString('es-DO', { maximumFractionDigits: 3 });
export const dinero = (simbolo: string, n: number) => `${simbolo}${n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const unidadTexto = (u?: string | null) => (!u || u === 'unit' ? 'unid.' : u);
