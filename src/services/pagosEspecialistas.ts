import { api } from './api';

/**
 * Pagos a especialistas: cómo se le paga a cada una en cada sede, qué se
 * le descuenta, y el corte de cada periodo. Todo va con la sede (`?sede=`):
 * una especialista puede ir a comisión en una sede y alquilar en otra.
 */

export type Modalidad = 'sueldo' | 'comision' | 'mixto' | 'mayor_de' | 'alquiler';
export type Periodo = 'semanal' | 'quincenal' | 'mensual';
export type TipoDeduccion = 'porcentaje' | 'escalones' | 'monto' | 'prestamo' | 'una_vez';

export const MODALIDADES: { id: Modalidad; nombre: string; explica: string }[] = [
  { id: 'comision', nombre: 'Comisión', explica: 'Gana un % de cada servicio que hace.' },
  { id: 'sueldo', nombre: 'Sueldo fijo', explica: 'Le pagas lo mismo cada periodo, haga lo que haga.' },
  { id: 'mixto', nombre: 'Sueldo + comisión', explica: 'Un sueldo base más un % de lo que hace.' },
  { id: 'mayor_de', nombre: 'Mínimo garantizado', explica: 'Gana su comisión, pero nunca menos que el mínimo.' },
  { id: 'alquiler', nombre: 'Alquila silla', explica: 'Cobra para ella y te paga una renta fija.' },
];

export const PERIODOS: { id: Periodo; nombre: string }[] = [
  { id: 'semanal', nombre: 'Cada semana' },
  { id: 'quincenal', nombre: 'Cada quincena' },
  { id: 'mensual', nombre: 'Cada mes' },
];

export const TIPOS_DEDUCCION: { id: TipoDeduccion; nombre: string; ejemplo: string }[] = [
  { id: 'porcentaje', nombre: 'Porcentaje', ejemplo: 'SFS, AFP' },
  { id: 'monto', nombre: 'Monto fijo', ejemplo: 'Uso de plataforma, uniforme' },
  { id: 'prestamo', nombre: 'Préstamo en cuotas', ejemplo: 'Se detiene al pagarse' },
  { id: 'una_vez', nombre: 'Una sola vez', ejemplo: 'Daño, multa' },
  { id: 'escalones', nombre: 'Impuesto por escalones', ejemplo: 'ISR' },
];

export interface ReglaComision { id?: string; serviceId?: string | null; productId?: string | null; categoria?: string | null; porcentaje: number }

export interface Acuerdo {
  id?: string;
  staffId?: string | null;
  locationId?: string;
  modalidad: Modalidad;
  periodo: Periodo;
  sueldoBase?: number | null;
  comisionServicio?: number | null;
  comisionProducto?: number | null;
  baseComision: 'cobrado' | 'lista';
  rentaMonto?: number | null;
  propinasCompletas: boolean;
  currencyCode?: string;
  reglas?: ReglaComision[];
  etiqueta?: string;
}

export interface EspecialistaPago {
  id: string;
  name: string;
  role: string;
  acuerdo: Acuerdo | null;
  usaPlantilla: boolean;
  etiqueta: string;
  deducciones: { id: string; nombre: string }[];
}

export interface Acuerdos {
  sede: { id: string; nombre: string };
  plantilla: Acuerdo | null;
  especialistas: EspecialistaPago[];
}

export interface Asignacion { id: string; staffId: string; monto: number | null; saldo: number | null; nota?: string | null; activa: boolean }

export interface Deduccion {
  id: string;
  nombre: string;
  tipo: TipoDeduccion;
  porcentaje: number | null;
  monto: number | null;
  tope: number | null;
  escalones?: { desde: number; hasta?: number | null; porcentaje: number; fijo?: number | null }[] | null;
  antesDeImpuesto: boolean;
  parteSalon: number | null;
  paraTodas: boolean;
  borrador: boolean;
  currencyCode: string;
  asignaciones: Asignacion[];
}

export interface LineaRecibo {
  id?: string;
  tipo: 'sueldo' | 'comision_servicio' | 'comision_producto' | 'propina' | 'cobrado_propio' | 'renta' | 'deduccion' | 'adelanto' | 'ajuste' | 'aporte_salon';
  concepto: string;
  monto: number;
  base?: number | null;
  porcentaje?: number | null;
  fecha?: string | null;
  saleId?: string | null;
  appointmentId?: string | null;
}

export interface Borrador {
  staff: { id: string; name: string };
  sede: { id: string; nombre: string };
  sinAcuerdo?: boolean;
  desde?: string;
  hasta?: string;
  periodo?: Periodo;
  acuerdo?: Acuerdo;
  usaPlantilla?: boolean;
  currencyCode: string;
  cerrado?: { id: string; estado: 'cerrado' | 'pagado'; neto: number } | null;
  lineas?: LineaRecibo[];
  bruto?: number;
  comisiones?: number;
  sueldo?: number;
  propinas?: number;
  descuentos?: number;
  neto?: number;
  aportesSalon?: number;
  servicios?: number;
  productos?: number;
  facturado?: number;
  avisos?: string[];
}

export interface FilaResumen {
  staff: { id: string; name: string; role: string };
  sinAcuerdo: boolean;
  desde: string | null;
  hasta: string | null;
  etiqueta: string;
  modalidad: Modalidad | null;
  bruto: number;
  propinas: number;
  descuentos: number;
  neto: number;
  servicios: number;
  facturado: number;
  avisos: string[];
  cerrado: { id: string; estado: 'cerrado' | 'pagado'; neto: number } | null;
}

export interface Resumen {
  sede: { id: string; nombre: string };
  currencyCode: string;
  filas: FilaResumen[];
  totales: { neto: number; porCerrar: number };
}

export interface Corte {
  id: string;
  staffId: string;
  staffName: string;
  desde: string;
  hasta: string;
  estado: 'cerrado' | 'pagado';
  modalidad: Modalidad;
  currencyCode: string;
  bruto: number;
  propinas: number;
  descuentos: number;
  neto: number;
  aportesSalon: number;
  medio?: string | null;
  referencia?: string | null;
  pagadoEn?: string | null;
  lineas?: LineaRecibo[];
}

const conSede = (ruta: string, sede?: string, extra?: Record<string, string | undefined>) => {
  const q = new URLSearchParams();
  if (sede) q.set('sede', sede);
  for (const [k, v] of Object.entries(extra ?? {})) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `${ruta}?${s}` : ruta;
};

const R = '/pagos-especialistas';

export const pagos = {
  acuerdos: (sede?: string) => api.get<Acuerdos>(conSede(`${R}/acuerdos`, sede)),
  guardarAcuerdo: (sede: string | undefined, a: Acuerdo) => api.put<Acuerdo>(`${R}/acuerdos`, { ...a, locationId: sede || undefined }),
  quitarAcuerdo: (sede: string | undefined, staffId: string) => api.delete(conSede(`${R}/acuerdos/${staffId}`, sede)),

  deducciones: (sede?: string) => api.get<Deduccion[]>(conSede(`${R}/deducciones`, sede)),
  crearDeduccion: (sede: string | undefined, d: Partial<Deduccion>) => api.post<Deduccion>(`${R}/deducciones`, { ...d, locationId: sede || undefined }),
  editarDeduccion: (id: string, d: Partial<Deduccion>) => api.patch<Deduccion>(`${R}/deducciones/${id}`, d),
  quitarDeduccion: (id: string) => api.delete(`${R}/deducciones/${id}`),
  sembrarRD: (sede?: string) => api.post<Deduccion[]>(conSede(`${R}/deducciones/republica-dominicana`, sede), {}),
  asignar: (deduccionId: string, a: { staffId: string; monto?: number | null; saldo?: number | null; nota?: string | null }) =>
    api.post<{ id: string }>(`${R}/deducciones/${deduccionId}/especialistas`, a),
  desasignar: (asignacionId: string) => api.delete(`${R}/asignaciones/${asignacionId}`),

  resumen: (sede?: string, fecha?: string) => api.get<Resumen>(conSede(`${R}/resumen`, sede, { fecha })),
  borrador: (staffId: string, sede?: string, fecha?: string) => api.get<Borrador>(conSede(`${R}/borrador/${staffId}`, sede, { fecha })),
  cerrar: (staffId: string, sede?: string, fecha?: string) => api.post<Corte>(`${R}/cortes`, { staffId, sede: sede || undefined, fecha }),
  cortes: (sede?: string, staffId?: string) => api.get<Corte[]>(conSede(`${R}/cortes`, sede, { staffId })),
  corte: (id: string) => api.get<Corte>(`${R}/cortes/${id}`),
  pagar: (id: string, medio: 'efectivo' | 'transferencia' | 'otro', referencia?: string) =>
    api.post<Corte>(`${R}/cortes/${id}/pagar`, { medio, referencia }),
};

/** "1 – 15 oct" */
export function rango(desde?: string | null, hasta?: string | null): string {
  if (!desde || !hasta) return '';
  const f = (s: string, mes: boolean) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    return fecha.toLocaleDateString('es-DO', mes ? { day: 'numeric', month: 'short' } : { day: 'numeric' });
  };
  const mismoMes = desde.slice(0, 7) === hasta.slice(0, 7);
  return `${f(desde, !mismoMes)} – ${f(hasta, true)}`;
}

/** Un día del periodo anterior o siguiente, para moverse entre cortes */
export function moverPeriodo(desde: string, hasta: string, hacia: -1 | 1): string {
  const base = hacia < 0 ? desde : hasta;
  const [y, m, d] = base.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d) + hacia * 86400000);
  return f.toISOString().slice(0, 10);
}

export const NOMBRE_LINEA: Record<LineaRecibo['tipo'], string> = {
  sueldo: 'Sueldo',
  comision_servicio: 'Comisión',
  comision_producto: 'Venta de producto',
  propina: 'Propina',
  cobrado_propio: 'Cobrado a su nombre',
  renta: 'Renta',
  deduccion: 'Deducción',
  adelanto: 'Adelanto',
  ajuste: 'Ajuste',
  aporte_salon: 'Aporte del salón',
};
