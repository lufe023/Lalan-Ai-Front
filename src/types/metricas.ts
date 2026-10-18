/** Espejo de metricas.contrato.ts del backend: lo que devuelve GET /metrics */

export type PeriodoMetricas = 'day' | 'week' | 'month';

export interface Comparado {
  actual: number;
  anterior: number;
  /** % de cambio; null cuando antes no hubo nada con qué comparar */
  variacion: number | null;
}

export type CanalDeCita = 'vitrina' | 'whatsapp' | 'instagram' | 'messenger' | 'agenda' | 'sin_registro';

export interface FilaVisitas {
  clave: string;
  nombre: string;
  visitas: number;
  porcentaje: number;
}

export interface ResumenVitrina {
  visitas: number;
  /** Citas reservadas desde la Vitrina en el período (sin las canceladas) */
  reservas: number;
  /** De cada 100 visitas, cuántas terminaron en reserva */
  conversion: number;
  porOrigen: FilaVisitas[];
  porDispositivo: FilaVisitas[];
  porDia: { dia: string; visitas: number }[];
}

export interface Barra {
  clave: string;
  nombre: string;
  citas: number;
  monto: number;
  porcentaje: number;
}

export interface ResumenMetricas {
  periodo: { id: PeriodoMetricas; descripcion: string; comparaCon: string; desde: string; hasta: string; zona: string };
  moneda: string;
  /** Monedas de precios de citas sin tasa registrada: esos montos se sumaron sin convertir */
  monedasSinTasa?: string[];
  agente: string;
  generadoEn: string;
  dinero: {
    cobrado: Comparado;
    propinas: number;
    ticketPromedio: Comparado;
    porCobrar: number;
    comandasAbiertas: number;
    agendadoPorVenir: number;
    diasPorVenir: number;
  };
  citas: {
    atendidas: Comparado;
    enAgenda: number;
    porAtender: number;
    canceladas: number;
    noVinieron: number;
    tasaInasistencia: number;
    llegadas: { conHora: number; aTiempo: number; tarde: number; antes: number; promedioMinutosTarde: number };
  };
  asistente: {
    citasAgendadas: Comparado;
    parteDeLasCitas: number;
    montoAtendido: number;
    montoPorVenir: number;
    conversaciones: number;
    respuestas: Comparado;
    respuestasFueraDeHorario: number;
    segundosEnResponder: number | null;
    pasadasAPersona: number;
    fallos: number;
  };
  porHora: { hora: number; etiqueta: string; citas: number }[];
  porDiaSemana: { dia: number; nombre: string; citas: number }[];
  servicios: Barra[];
  equipo: (Barra & { minutos: number })[];
  /** tipo: 'asistente' | 'equipo' | 'vitrina' | 'sin_registro' */
  quienAgendo: (Barra & { esAsistente: boolean; tipo?: string })[];
  /** Por dónde entraron las citas creadas en el período */
  desdeDonde?: (Barra & { canal: CanalDeCita })[];
  /** Visitas y reservas de la Vitrina; null si no hay Vitrina publicada ni visitas */
  vitrina?: ResumenVitrina | null;
  productos: Barra[];
  clientas: {
    atendidas: number;
    nuevas: number;
    recurrentes: number;
    mejores: { id: string; nombre: string; monto: number; visitas: number }[];
    enRiesgo: { total: number; diasSinVenir: number; lista: { id: string; nombre: string; dias: number; visitas: number }[] };
  };
}
