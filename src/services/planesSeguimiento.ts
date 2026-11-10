import { api } from './api';

/** Abrir la ficha de una clienta con su plan desplegado (desde Mi semana o un aviso) */
export const ABRIR_PLAN = 'lalan.abrirPlan';

export type TipoPaso = 'cita' | 'mensaje' | 'tarea';
export type EstadoPlan = 'activo' | 'pausado' | 'terminado' | 'abandonado';
export type TipoEntrada = 'sesion' | 'mensaje' | 'respuesta' | 'nota';

export interface PasoPlantilla { dia: number; tipo: TipoPaso; titulo: string; serviceId?: string | null; mensaje?: string | null; servicio?: string | null }

export interface Plantilla {
  id: string; nombre: string; descripcion: string | null; duracionDias: number;
  pasos: PasoPlantilla[]; mediciones: string[]; precio: number | null; currencyCode: string; plantilla: string | null; activos: number;
}
export interface ModeloPlan { clave: string; nombre: string; descripcion: string; negocios: string[]; duracionDias: number; pasos: number; mediciones: string[] }
export interface Plantillas { moneda: string; plantillas: Plantilla[]; modelos: ModeloPlan[] }

export interface Agendada { id: string; startsAt: string }
export interface AlertaPlan { id: string; nota: string; fecha: string }

export interface ResumenPlan {
  id: string; nombre: string; estado: EstadoPlan; inicio: string;
  cliente: { id: string; nombre: string; telefono: string | null };
  sede: { id: string; nombre: string };
  staffId: string | null;
  avance: { hechos: number; total: number; diaDelPlan: number; duracion: number };
  proximo: { indice: number; titulo: string; tipo: TipoPaso; fecha: string; agendada: Agendada | null } | null;
  atrasado: boolean;
  atrasados: { indice: number; titulo: string; fecha: string }[];
  alertas: AlertaPlan[];
  necesitaAtencion: boolean;
  pasosSemana: { indice: number; titulo: string; tipo: TipoPaso; fecha: string; hecho: boolean; agendada: Agendada | null }[];
  paquete: { precio: number; moneda: string | null; pagado: number; saldo: number } | null;
}

export interface PasoDelPlan {
  indice: number; dia: number; tipo: TipoPaso; titulo: string; fecha: string; hecho: boolean; hechoEn: string | null;
  serviceId: string | null; servicio: string | null; duracion: number | null; mensaje: string | null;
  appointmentId: string | null; agendada: Agendada | null;
}
export interface EntradaBitacora {
  id: string; fecha: string; tipo: TipoEntrada; autor: string | null; paso: number | null; nota: string;
  mediciones: Record<string, number | string> | null; alerta: boolean; appointmentId: string | null;
}
export interface PagoPlan { id: string; fecha: string; monto: number; metodo: string; por: string | null; enCaja: boolean }

export interface PlanCompleto extends ResumenPlan {
  especialista: string | null;
  objetivo: string | null;
  rutinaCasa: string | null;
  mediciones: string[];
  pasos: PasoDelPlan[];
  bitacora: EntradaBitacora[];
  evolucion: { nombre: string; puntos: { fecha: string; valor: number }[] }[];
  pagos: PagoPlan[];
}

export interface AtencionPlanes {
  activos: number;
  conAviso: ResumenPlan[];
  atrasados: ResumenPlan[];
  estaSemana: ({ planId: string; cliente: ResumenPlan['cliente']; sede: ResumenPlan['sede']; plan: string } & ResumenPlan['pasosSemana'][number])[];
}

const B = '/planes-seguimiento';
const sedeQ = (sede?: string) => (sede ? `?sede=${encodeURIComponent(sede)}` : '');

export const planesApi = {
  plantillas: () => api.get<Plantillas>(`${B}/plantillas`),
  desdeModelo: (clave: string, precio?: number | null) => api.post<{ id: string }>(`${B}/plantillas/desde-modelo`, { clave, precio: precio ?? null }),
  crearPlantilla: (d: Partial<Plantilla>) => api.post<{ id: string }>(`${B}/plantillas`, d),
  actualizarPlantilla: (id: string, d: Partial<Plantilla>) => api.patch<{ id: string }>(`${B}/plantillas/${id}`, d),
  quitarPlantilla: (id: string) => api.delete<{ id: string }>(`${B}/plantillas/${id}`),

  atencion: (sede?: string) => api.get<AtencionPlanes>(`${B}/atencion${sedeQ(sede)}`),
  deCliente: (clientId: string) => api.get<PlanCompleto[]>(`${B}/cliente/${clientId}`),
  empezar: (d: { clientId: string; planId: string; inicio?: string; staffId?: string | null; locationId?: string | null; objetivo?: string | null; rutinaCasa?: string | null; precio?: number | null }) =>
    api.post<PlanCompleto>(B, d),
  actualizar: (id: string, d: { estado?: EstadoPlan; objetivo?: string | null; rutinaCasa?: string | null; staffId?: string | null; precio?: number | null }) =>
    api.patch<PlanCompleto>(`${B}/${id}`, d),
  paso: (id: string, i: number, d: { hecho?: boolean; fecha?: string; arrastrar?: boolean }) => api.put<PlanCompleto>(`${B}/${id}/pasos/${i}`, d),
  anotar: (id: string, d: { tipo: TipoEntrada; nota: string; paso?: number | null; mediciones?: Record<string, number | string> | null; alerta?: boolean }) =>
    api.post<PlanCompleto>(`${B}/${id}/bitacora`, d),
  quitarEntrada: (entradaId: string) => api.delete<PlanCompleto>(`${B}/bitacora/${entradaId}`),
  atender: (entradaId: string) => api.put<PlanCompleto>(`${B}/bitacora/${entradaId}/atendida`, {}),
  pagar: (id: string, monto: number, metodo: string) => api.post<PlanCompleto>(`${B}/${id}/pagos`, { monto, metodo }),
};

export const fechaCorta = (f: string) => new Date(`${f.slice(0, 10)}T12:00:00`).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' });
export const dinero = (n: number, moneda?: string | null) => `${moneda === 'USD' ? 'US$' : moneda === 'EUR' ? '€' : moneda === 'DOP' ? 'RD$' : '$'}${n.toLocaleString('es-DO', { maximumFractionDigits: 2 })}`;
