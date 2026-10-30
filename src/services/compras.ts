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

/** Cuentas por pagar de un pedido (null: no se compró, o es de antes de llevar las cuentas) */
export type EstadoDePago = 'por_pagar' | 'abonado' | 'pagado';
export interface CuentaPedido {
  pagado: number; debe: number; estado: EstadoDePago; venceEl: string | null; condicionesPago: string | null;
  /** Negativo = vencido. Null cuando ya se pagó o todavía no tiene fecha (corre al recibir) */
  diasParaVencer: number | null;
}
export interface PagoPedido { id: string; monto: number; currencyCode: string; fecha: string; forma: FormaDePago | null; referencia: string | null; nota: string | null }
export type FormaDePago = 'transferencia' | 'efectivo' | 'cheque' | 'tarjeta' | 'otro';
export const FORMAS_DE_PAGO: { id: FormaDePago; nombre: string }[] = [
  { id: 'transferencia', nombre: 'Transferencia' }, { id: 'efectivo', nombre: 'Efectivo' }, { id: 'cheque', nombre: 'Cheque' },
  { id: 'tarjeta', nombre: 'Tarjeta' }, { id: 'otro', nombre: 'Otro' },
];

/** «Lo que debo»: por proveedor, en la moneda base del salón */
export interface PorPagar {
  moneda: { code: string; simbolo: string }; total: number; vencido: number; estaSemana: number;
  proveedores: {
    id: string; nombre: string; whatsapp: string | null; debe: number; vencido: number; proximoVence: string | null;
    pedidos: {
      id: string; numero: string; estado: EstadoCompra; estadoNombre: string; llego: boolean; sede: { id: string; nombre: string };
      currencyCode: string; simbolo: string; total: number; pagado: number; debe: number; debeBase: number; estadoPago: EstadoDePago;
      condicionesPago: string | null; venceEl: string | null; diasParaVencer: number | null; referenciaProveedor: string | null;
    }[];
  }[];
}

export interface FilaPedido {
  id: string; numero: string; estado: EstadoCompra; estadoNombre: string;
  proveedor: { id: string; nombre: string }; sede: { id: string; nombre: string };
  total: number; currencyCode: string; renglones: number; fechaLimite: string | null; entregaEsperada: string | null;
  creadoEn: string; creadoPor: string | null; origen: string; manejaLalan: boolean; esperaDuena: boolean; atrasada: boolean;
  cuenta: CuentaPedido | null;
  /** Se le pidió lo mismo a otros proveedores para comparar precios */
  comparacionId: string | null;
}

export interface LineaPedido {
  id: string; productId: string; descripcion: string; cantidad: number; unidadCompra: string | null; factor: number;
  precio: number; impuestoPct: number; recibido: number; importe: number; codigo: string | null; hay: number;
  /** El precio que dio el proveedor (null = todavía no lo cotiza) y si dijo que no lo tiene */
  precioCotizado: number | null; sinExistencia: boolean;
  producto: { id: string; name: string; unit: string; fotoId: string | null } | null;
}

export interface Pedido {
  id: string; numero: string; estado: EstadoCompra; estadoNombre: string;
  sede: { id: string; nombre: string; direccion: string | null };
  proveedor: Proveedor; currencyCode: string; simbolo: string;
  subtotal: number; impuestos: number; total: number; totalBase: number | null;
  fechaLimite: string | null; entregaEsperada: string | null; confirmadaEn: string | null; recibidaEn: string | null;
  referenciaProveedor: string | null; terminos: string | null; origen: string;
  /** Dónde se entrega y quién lo recibe (sale en la hoja y en el mensaje) */
  entregarEn: string | null; recibeNombre: string | null; recibeTelefono: string | null;
  manejaLalan: boolean; esperaDuena: boolean; preguntaDuena: string | null; creadoEn: string; seEdita: boolean;
  comparacionId: string | null;
  lineas: LineaPedido[]; historial: Evento[];
  adjuntos: { id: string; nombre: string; tipo: string; tamano: number; creadoEn: string }[];
  cuenta: CuentaPedido | null; condicionesPago: string | null; pagos: PagoPedido[];
  /** El proveedor dijo que ya le pagaron y no se ha anotado: la dueña decide */
  pagoReportado: { monto: number | null; cuando: string; texto: string | null } | null;
}

export interface Resumen {
  borradores: number; cotizacionesEnviadas: number; cotizacionesAtrasadas: number; sinRecibir: number;
  recepcionAtrasada: number; esperanTuSi: number; entregasATiempo: number | null; diasDeEntrega: number | null;
  porPagar: number; pagosVencidos: number;
}

export interface PorPedir {
  productId: string; nombre: string; unidad: string; sede: { id: string; nombre: string };
  hay: number; minimo: number; necesitaCitas: number; faltan: number; yaPedido: number; motivo: 'citas' | 'minimo';
  proveedor: OpcionProveedor | null;
  /** Todos los que lo venden en esa sede (el preferido primero), para comparar precios */
  opciones: OpcionProveedor[];
}
export interface OpcionProveedor { id: string; nombre: string; precio: number | null; currencyCode: string | null; unidadCompra: string | null; factor: number }

/** Lo mismo pedido a varios proveedores, lado a lado */
export interface Oferta {
  ordenId: string; proveedorId: string; lineaId: string; cantidad: number; unidadCompra: string | null; factor: number;
  precio: number | null; currencyCode: string; porUnidadBase: number | null; importeBase: number | null; sinExistencia: boolean;
}
export interface Comparacion {
  id: string; sede: { id: string; nombre: string }; moneda: { code: string; simbolo: string };
  proveedores: {
    ordenId: string; numero: string; estado: EstadoCompra; proveedor: { id: string; nombre: string; whatsapp?: string | null; correo?: string | null; lalanHabla?: boolean };
    currencyCode: string; renglones: number; cotizados: number; sinExistencia: number; completo: boolean; total: number; totalBase: number | null;
    entregaEsperada: string | null; referenciaProveedor: string | null; manejaLalan: boolean; esperaDuena: boolean;
  }[];
  productos: { productId: string; descripcion: string; ofertas: Oferta[]; mejor: string | null; ahorro: number }[];
  cotizaron: number; enRonda: number; completa: boolean; decidida: boolean;
  sugerida: Record<string, string>; totalSugeridoBase: number; ahorroBase: number;
}
export interface PedidoDeRonda { ordenId: string; proveedor: string; canal: 'whatsapp' | 'correo' | null; motivo?: string }

export interface AjustesCompras {
  modo: ModoCompra; impuestoPct: number; avisarFaltantes: boolean; terminos: string | null;
  /** Si el plan incluye Compras automáticas (sin ellas, el modo «lalan» no se puede elegir) */
  automaticas?: boolean;
}

export interface Sugerencia {
  id: string; nombre: string; contacto: string | null; whatsapp: string | null; correo: string | null; web: string | null;
  descripcion: string | null; ciudades: string[]; marcas: string[]; productos: { id: string; nombre: string }[];
}

/** Lo que un proveedor ofreció fuera de un pedido, o que quiere un servicio */
export interface NovedadProveedor {
  id: string; tipo: 'producto' | 'promocion' | 'servicio'; titulo: string; detalle: string | null;
  precio: number | null; currencyCode: string | null; vence: string | null; canal: 'whatsapp' | 'correo'; creadoEn: string; ordenId: string | null;
  proveedor: { id: string; nombre: string; whatsapp: string | null; correo: string | null };
}

/** Lo que encuentra la búsqueda al registrar un proveedor */
export interface EmpresasEncontradas {
  plataforma: { id: string; nombre: string; rnc: string | null; direccion: string | null; web: string | null; contacto: string | null; whatsapp: string | null; correo: string | null; telefono: string | null; yaLoTienes: boolean }[];
  dgii: { rnc: string; nombre: string; comercial: string | null; actividad: string | null; yaLoTienes: boolean }[];
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

  novedades: () => api.get<NovedadProveedor[]>('/compras/novedades'),
  enlazarNovedad: (id: string, d: { productId: string; precio?: number | null; nuevo?: boolean }) => api.post<{ ok: true }>(`/compras/novedades/${id}/enlazar`, d),
  descartarNovedad: (id: string) => api.post<{ ok: true }>(`/compras/novedades/${id}/descartar`, {}),
  atenderComoCliente: (id: string) => api.post<{ ok: true; escrito: boolean }>(`/compras/novedades/${id}/como-cliente`, {}),
  empresas: (q: string) => api.get<EmpresasEncontradas>(`/compras/empresas?q=${encodeURIComponent(q)}`),
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

  /** Lo mismo a varios proveedores: un borrador por proveedor en una sola ronda */
  comparar: (d: { locationId?: string | null; origen?: string; items: { productId: string; faltan: number; proveedorIds: string[] }[] }) =>
    api.post<{ comparacionId: string; ordenes: { id: string; numero: string; proveedor: string; proveedorId: string }[] }>('/compras/comparar', d),
  comparacion: (id: string) => api.get<Comparacion>(`/compras/comparaciones/${id}`),
  /** Lalan les pide precio a todos los de la ronda */
  pedirATodos: (id: string) => api.post<{ pedidos: PedidoDeRonda[]; comparacion: Comparacion }>(`/compras/comparaciones/${id}/pedir`, {}),
  /** Lalan le pide a ese proveedor que mejore (sin decir quién dio el otro precio) */
  mejorarPrecio: (id: string, proveedorId: string) => api.post<{ ordenId: string; renglones: number; comparacion: Comparacion }>(`/compras/comparaciones/${id}/mejorar`, { proveedorId }),
  /** La dueña elige a quién le compra cada producto */
  elegir: (id: string, eleccion: { productId: string; proveedorId: string }[]) =>
    api.post<{ resultado: { ordenId: string; estado: EstadoCompra; proveedor: string }[]; comparacion: Comparacion }>(`/compras/comparaciones/${id}/elegir`, { eleccion }),

  resumen: (sede?: string) => api.get<Resumen>(conSede('/compras/resumen', sede)),
  pedidos: (f: { sede?: string; filtro?: string; estado?: string; proveedorId?: string; q?: string }) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
    return api.get<FilaPedido[]>(`/compras/ordenes${p.toString() ? `?${p}` : ''}`);
  },
  pedido: (id: string) => api.get<Pedido>(`/compras/ordenes/${id}`),
  crear: (d: { proveedorId: string; locationId?: string | null; lineas: LineaNueva[]; origen?: string }) => api.post<Pedido>('/compras/ordenes', d),
  editar: (id: string, d: Partial<{ proveedorId: string; locationId: string; lineas: LineaNueva[]; fechaLimite: string | null; entregaEsperada: string | null; referenciaProveedor: string | null; terminos: string | null; entregarEn: string | null; recibeNombre: string | null; recibeTelefono: string | null; condicionesPago: string | null; venceEl: string | null }>) =>
    api.patch<Pedido>(`/compras/ordenes/${id}`, d),
  estado: (id: string, estado: EstadoCompra, motivo?: string) => api.post<Pedido>(`/compras/ordenes/${id}/estado`, { estado, motivo }),
  porPagar: (sede?: string) => api.get<PorPagar>(conSede('/compras/por-pagar', sede)),
  pagar: (id: string, d: { monto: number; fecha?: string | null; forma?: FormaDePago | null; referencia?: string | null; nota?: string | null }) =>
    api.post<Pedido>(`/compras/ordenes/${id}/pagos`, d),
  quitarPago: (pagoId: string) => api.delete<Pedido>(`/compras/pagos/${pagoId}`),
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

  /** Lalan lee la factura (fotos o PDF) y la deja lista para revisar. No guarda nada */
  leerFactura: (archivos: File[], sede?: string) => {
    const f = new FormData();
    archivos.forEach((a) => f.append('archivos', a));
    if (sede) f.append('sede', sede);
    return subirArchivo<PropuestaFactura>('/compras/factura/leer', f);
  },
  /** La factura revisada: compra confirmada, inventario de la sede, pago o por pagar, y la factura adjunta */
  registrarFactura: (datos: RegistrarFactura, archivos: File[]) => {
    const f = new FormData();
    archivos.forEach((a) => f.append('archivos', a));
    f.append('datos', JSON.stringify(datos));
    return subirArchivo<Pedido>('/compras/factura', f);
  },

  sugerencias: (productId?: string) => api.get<{ activo: boolean; sugerencias: Sugerencia[]; sinPais?: boolean }>(`/compras/sugerencias${productId ? `?productId=${productId}` : ''}`),
  adoptar: (id: string, productos: string[]) => api.post<{ proveedorId: string }>(`/compras/sugerencias/${id}/agregar`, { productos }),
};

/** Un renglón de la factura como lo entendió Lalan, con el producto del salón si lo reconoció */
export interface RenglonFactura {
  descripcion: string;
  codigo: string | null;
  cantidad: number;
  /** Por unidad, sin impuesto */
  precio: number;
  impuestoPct: number;
  importe: number | null;
  unidadCompra: string | null;
  factor: number;
  productId: string | null;
  producto: string | null;
  reconocidoPor: 'codigo' | 'nombre' | null;
  /** Si no fue seguro: los más parecidos, para elegir con un toque */
  candidatos: { id: string; nombre: string }[];
  /** Lo que costaba la última vez con este proveedor (solo si cambió) */
  precioAnterior: number | null;
}

/** Lo que Lalan leyó de la factura, listo para que la dueña lo revise */
export interface PropuestaFactura {
  /** Qué papel era: con una orden de compra o una cotización no se da por recibido */
  documento: 'factura' | 'orden' | 'cotizacion' | 'conduce';
  sede: { id: string; nombre: string };
  proveedor: {
    id: string | null; nombre: string; nuevo: boolean; por: 'rnc' | 'nombre' | null; rnc?: string | null;
    telefono?: string | null; correo?: string | null; direccion?: string | null; plataformaId?: string | null; nombreEnFactura?: string | null;
    noVendeEnSede: boolean; condicionesPago: string | null;
  };
  referencia: string | null; numero: string | null; ncf: string | null; fecha: string | null;
  moneda: string; monedaEnFactura: string | null;
  pagada: boolean | null; formaPago: string | null; condiciones: string | null;
  renglones: RenglonFactura[];
  totales: { subtotal: number; impuestos: number; total: number; leido: { subtotal: number | null; impuestos: number | null; descuento: number | null; total: number | null }; cuadra: boolean | null };
  /** Esta factura ya se registró antes */
  yaRegistrada: { id: string; numero: string; creadoEn: string } | null;
  sinLeer: string[];
}

export interface RegistrarFactura {
  locationId: string | null;
  proveedorId: string | null;
  proveedorNuevo: { nombre: string; rnc?: string | null; telefono?: string | null; correo?: string | null; direccion?: string | null; plataformaId?: string | null } | null;
  referencia: string | null;
  fecha: string | null;
  currencyCode: string;
  condicionesPago: string | null;
  renglones: {
    productId: string | null; nuevo: { nombre: string; vende: boolean; precioVenta: number | null } | null;
    descripcion: string; codigo: string | null; unidadCompra: string | null; factor: number; cantidad: number; precio: number; impuestoPct: number;
  }[];
  recibir: boolean;
  pagada: boolean;
  formaPago: string | null;
}

/** Para abrir un pedido al llegar a Compras desde otra pantalla (Mi semana, Catálogo, un aviso) */
/** El correo del salón que Lalan usa para compras (la contraseña nunca vuelve) */
export type CorreoCompras =
  | { conectado: false }
  | { conectado: true; correo: string; nombre: string | null; imapHost: string; imapPuerto: number; activo: boolean; revisadoEn: string | null; error: string | null };

export const ABRIR_PEDIDO = 'lalan_abrir_pedido';
/** La notificación de un pedido pide abrirlo con la pantalla ya abierta */
export const EVENTO_ABRIR_PEDIDO = 'lalan:abrir-pedido';
/** Compras abre «Registrar factura» al llegar (desde la pantalla de Lalan) */
export const ABRIR_FACTURA = 'lalan_abrir_factura';
/** Con Compras ya abierta, lo mismo */
export const EVENTO_ABRIR_FACTURA = 'lalan:abrir-factura';
/** La pestaña de Compras con la que abrir ("por-pedir", "por-pagar") */
export const VISTA_COMPRAS = 'lalan_vista_compras';

export const cantidadTexto = (n: number) => n.toLocaleString('es-DO', { maximumFractionDigits: 3 });
export const dinero = (simbolo: string, n: number) => `${simbolo}${n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const unidadTexto = (u?: string | null) => (!u || u === 'unit' ? 'unid.' : u);

/** «Vence en 3 días», «Vence hoy», «Vencido hace 2 días» */
export function textoVence(c: { venceEl: string | null; diasParaVencer: number | null; debe: number }, condiciones?: string | null): string {
  if (c.debe < 0.005) return 'Pagado';
  const d = c.diasParaVencer;
  if (d == null) return condiciones ? `Vence al recibir · ${condiciones}` : 'Vence al recibir';
  if (d < 0) return `Vencido hace ${-d} día${d === -1 ? '' : 's'}`;
  if (d === 0) return 'Vence hoy';
  if (d === 1) return 'Vence mañana';
  return `Vence en ${d} días`;
}
/** Rojo vencido, ámbar esta semana, gris lo demás */
export const colorVence = (d: number | null) => (d != null && d < 0 ? 'text-rose-600 dark:text-rose-400' : d != null && d <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-neutral-400');
