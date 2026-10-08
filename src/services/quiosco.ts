import { ErrorPublico, URL_API } from './api';

/**
 * El quiosco de la entrada habla con el servidor SIN sesión: lleva su
 * propio token (el que recibió al vincularse) en la cabecera X-Quiosco.
 * Vive en este aparato y en ningún otro sitio.
 */

const LLAVE_TOKEN = 'lalan.quiosco.token';

export const tokenQuiosco = {
  leer: (): string | null => { try { return localStorage.getItem(LLAVE_TOKEN); } catch { return null; } },
  guardar: (t: string) => { try { localStorage.setItem(LLAVE_TOKEN, t); } catch { /* sin almacenamiento */ } },
  borrar: () => { try { localStorage.removeItem(LLAVE_TOKEN); } catch { /* sin almacenamiento */ } },
};

async function pedir<T>(ruta: string, opciones: { method?: 'GET' | 'POST'; body?: unknown; conToken?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = tokenQuiosco.leer();
  if (opciones.conToken !== false && token) headers['X-Quiosco'] = token;
  let res: Response;
  try {
    res = await fetch(`${URL_API}/public/quiosco${ruta}`, {
      method: opciones.method ?? 'GET', headers,
      body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
    });
  } catch {
    throw new ErrorPublico('Sin conexión. Revisa el internet de la tablet.', 0);
  }
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    const m = cuerpo?.message;
    const texto = typeof m === 'string' ? m : typeof m?.message === 'string' ? m.message : Array.isArray(m) ? m.join(' · ') : '';
    throw new ErrorPublico(texto || 'Algo salió mal. Inténtalo de nuevo.', res.status);
  }
  return res.json() as Promise<T>;
}

export interface InicioQuiosco {
  salon: string;
  sede: string;
  asistente: string;
  quiosco: string;
  categorias: { id: string; nombre: string; icono: string | null; color: string | null }[];
  servicios: { id: string; nombre: string; categoria: string; minutos: number; precio: string | null; icono: string | null }[];
  especialistas: { id: string; nombre: string; avatar: string | null; categorias: string[] | null; enEspera: number }[];
  gustos: { tipo: string; titulo: string; icono: string | null; opciones: { id: string; valor: string }[] }[];
  menu: { id: string; nombre: string; precio: string | null; cortesia: boolean }[];
}

export type Busqueda =
  | { encontrada: false }
  | { encontrada: true; nombre: string; cita: { hora: string; servicio: string; especialista: string | null } | null; turno: string | null; gustoIds: string[] };

export interface ResultadoLlegada {
  turno: string;
  nombre: string;
  especialista: string | null;
  zona: string | null;
  antes: number;
  nueva: boolean;
  yaEstaba: boolean;
}

export const quioscoApi = {
  solicitar: () => pedir<{ codigo: string; secreto: string; expira: string }>('/solicitud', { method: 'POST', conToken: false }),
  recoger: (codigo: string, secreto: string) =>
    pedir<{ listo: false } | { listo: true; token: string }>('/recoger', { method: 'POST', body: { codigo, secreto }, conToken: false }),
  vincular: (codigo: string) => pedir<{ token: string }>('/vincular', { method: 'POST', body: { codigo }, conToken: false }),
  inicio: () => pedir<InicioQuiosco>('/inicio'),
  buscar: (telefono: string) => pedir<Busqueda>('/buscar', { method: 'POST', body: { telefono } }),
  llegada: (dto: {
    telefono: string; nombre?: string; conCita?: boolean; servicioIds?: string[];
    especialistaId?: string | null; gustoIds?: string[]; productoIds?: string[];
  }) => pedir<ResultadoLlegada>('/llegada', { method: 'POST', body: dto }),
};

/** La dirección que abre el teléfono de la dueña al escanear el QR del quiosco */
export const urlAprobarQuiosco = (codigo: string) =>
  `${window.location.origin}${window.location.pathname}#/quiosco-aprobar/${codigo}`;

/** La dirección que se abre en la tablet para convertirla en quiosco */
export const urlDelQuiosco = () => `${window.location.origin}${window.location.pathname}#/quiosco`;
