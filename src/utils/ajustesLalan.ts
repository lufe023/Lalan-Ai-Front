import { api } from '../services/api';

/**
 * Los ajustes globales de la pantalla de Lalan (los cambia el super admin en
 * Plataforma → Lalan). Mientras no llegan del servidor se usan estos, que
 * son los mismos valores por defecto del backend (asistente-ajustes.contrato.ts).
 */
export interface AjustesLalan {
  pausaCortaMs: number; pausaNormalMs: number; pausaLargaMs: number; pausaPorDefecto: 'corta' | 'normal' | 'larga';
  habloPocoMs: number; extraSiHabloPocoMs: number; sinVozMs: number; sinVozSolaMs: number; maximoSegundos: number; sensibilidad: number; ignorarFondo: number;
  seguirEscuchando: boolean; tonoAlEscuchar: boolean;
  motorVoz: 'aparato' | 'melotts' | 'aura2'; vozAura: string;
  vocesPreferidas: string; velocidadVoz: number; tonoVoz: number;
  papelTapiz: boolean; intensidadPapel: number; tamanoPapel: number; tamanoEsfera: number;
  estiloEsfera: string; colorEsfera: string; ritmoEsfera: number; reaccionEsfera: number;
}

export const AJUSTES_LALAN_POR_DEFECTO: AjustesLalan = {
  pausaCortaMs: 1800, pausaNormalMs: 2800, pausaLargaMs: 4200, pausaPorDefecto: 'normal',
  habloPocoMs: 1500, extraSiHabloPocoMs: 800, sinVozMs: 8000, sinVozSolaMs: 8000, maximoSegundos: 90, sensibilidad: 2.5, ignorarFondo: 30,
  seguirEscuchando: true, tonoAlEscuchar: true,
  motorVoz: 'aparato', vozAura: 'celeste',
  vocesPreferidas: 'Paulina, Google español de Estados Unidos, Mónica, Google español', velocidadVoz: 1.02, tonoVoz: 1.05,
  papelTapiz: true, intensidadPapel: 7, tamanoPapel: 230, tamanoEsfera: 150,
  estiloEsfera: 'aurora', colorEsfera: 'marca', ritmoEsfera: 1, reaccionEsfera: 1,
};

/** Las voces en español de Aura-2 (mismas que el servidor: asistente-ajustes.contrato.ts) */
export const VOCES_AURA = ['celeste', 'carina', 'diana', 'selena', 'estrella', 'sirio', 'nestor', 'alvaro', 'aquila', 'javier'];

let actuales: AjustesLalan = { ...AJUSTES_LALAN_POR_DEFECTO };

export function ajustesLalan(): AjustesLalan { return actuales; }

/** Se piden al abrir la pantalla; si falla, quedan los últimos (o los de por defecto) */
export async function cargarAjustesLalan(): Promise<AjustesLalan> {
  try {
    const r = await api.get<Partial<AjustesLalan>>('/asistente/ajustes');
    actuales = { ...AJUSTES_LALAN_POR_DEFECTO, ...r };
  } catch { /* sin conexión: los de antes */ }
  return actuales;
}

export type Pausa = 'corta' | 'normal' | 'larga';
export const NOMBRE_PAUSA: Record<Pausa, string> = { corta: 'Corta', normal: 'Normal', larga: 'Larga' };
export function msDePausa(p: Pausa, a: AjustesLalan = actuales): number {
  return p === 'corta' ? a.pausaCortaMs : p === 'larga' ? a.pausaLargaMs : a.pausaNormalMs;
}
