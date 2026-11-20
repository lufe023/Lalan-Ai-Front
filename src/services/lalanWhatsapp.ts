import { useEffect, useState } from 'react';
import { api } from './api';

/**
 * Lalan por WhatsApp: cada persona de la administración conecta su número
 * (número de confianza) y habla con la misma Lalan de la app desde su
 * WhatsApp. Cada número tiene sus sedes: una, varias o todas.
 */

export interface NumeroSalon { numero: string; nombre: string | null }

export interface MiWhatsappLalan {
  conectado: boolean;
  /** "•••• 4567" */
  numero: string | null;
  /** El WhatsApp del salón al que se le escribe; null = el salón no tiene WhatsApp conectado */
  salon: NumeroSalon | null;
  /** Hasta cuándo Lalan le puede escribir gratis (null = cerrada: hay que escribirle primero) */
  ventanaHasta: string | null;
  avisos: boolean;
  sedes: { id: string; nombre: string }[];
  todas: boolean;
  esperandoCodigo: boolean;
}

export interface EnlaceConectar { enlace: string; texto: string; salon: NumeroSalon; venceEn: string }

export interface PersonaDeConfianza {
  userId: string;
  nombre: string;
  rol: string;
  conectado: boolean;
  numero: string | null;
  /** Las sedes de su número ([] = todas las que ve) */
  sedes: string[];
  /** Las sedes que puede tener (las que ve en la app) */
  puede: string[];
  /** Por WhatsApp, ¿Lalan le habla de esta sede? */
  estaSede: boolean;
  esperandoCodigo: boolean;
  ventanaHasta: string | null;
}

export const lalanWhatsapp = {
  mio: () => api.get<MiWhatsappLalan>('/lalan-whatsapp/mio'),
  conectarMio: () => api.post<EnlaceConectar>('/lalan-whatsapp/mio/conectar', {}),
  cambiarMio: (c: { avisos?: boolean }) => api.patch<MiWhatsappLalan>('/lalan-whatsapp/mio', c),
  quitarMio: () => api.delete<MiWhatsappLalan>('/lalan-whatsapp/mio'),
  deLaSede: (sede: string) => api.get<{ salon: NumeroSalon | null; personas: PersonaDeConfianza[] }>(`/lalan-whatsapp/confianza?sede=${encodeURIComponent(sede)}`),
  cambiarSedes: (userId: string, sedes: string[]) => api.patch<{ ok: true; sedes: string[] }>(`/lalan-whatsapp/confianza/${userId}`, { sedes }),
  enlaceDe: (userId: string, sedes?: string[]) => api.post<EnlaceConectar>(`/lalan-whatsapp/confianza/${userId}/enlace`, sedes ? { sedes } : {}),
  quitarDe: (userId: string) => api.delete<{ ok: true }>(`/lalan-whatsapp/confianza/${userId}`),
};

/** wa.me con el texto escrito: abre su WhatsApp (la app o WhatsApp Web) en el chat del salón */
export const enlaceWaMe = (numero: string, texto?: string) =>
  `https://wa.me/${numero.replace(/\D/g, '')}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;

/** ¿Lalan le puede escribir ahora por WhatsApp? */
export const ventanaAbierta = (hasta: string | null | undefined) => !!hasta && new Date(hasta).getTime() > Date.now();

/**
 * Para abrir la ventana de 24 h: el texto con que ella empieza la charla
 * sobre un aviso. Al enviarlo, Lalan ya le puede contestar y escribirle.
 */
export const textoParaAviso = (titulo: string) => `Cuéntame qué pasa con: ${titulo}`;

/** Lo que se pide con un toque para que Lalan escriba (la dueña solo envía) */
export const TEXTO_HOLA = 'Hola Lalan, ¿qué hay de nuevo?';

/** Lo que guarda la app para no preguntar cada vez (cada fila de la campana lo usa) */
let cache: { datos: Promise<MiWhatsappLalan | null>; en: number } | null = null;
const VIDA_CACHE_MS = 60_000;
export function miWhatsappLalan(forzar = false): Promise<MiWhatsappLalan | null> {
  if (!forzar && cache && Date.now() - cache.en < VIDA_CACHE_MS) return cache.datos;
  const datos = lalanWhatsapp.mio().catch(() => null);
  cache = { datos, en: Date.now() };
  return datos;
}
export const olvidarMiWhatsappLalan = () => { cache = null; };

/** Para las pantallas: su WhatsApp con Lalan (null mientras carga o si no aplica) */
export function useMiWhatsappLalan(activo = true): MiWhatsappLalan | null {
  const [d, setD] = useState<MiWhatsappLalan | null>(null);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    void miWhatsappLalan().then(x => { if (vivo) setD(x); });
    return () => { vivo = false; };
  }, [activo]);
  return d;
}
