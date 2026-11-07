/**
 * Qué tan sana es una ganancia, igual en toda la app (la receta, el costo y
 * la tarjeta del catálogo dicen el mismo color para el mismo número).
 *
 * El margen es sobre el precio: vendes a 200 y te cuesta 100 → 50%.
 * Lo preparado (un trago, una picadera) se mide distinto que la reventa: en
 * un bar el licor suele ser cerca del 20% del precio, así que 50% es poco.
 * Revender un champú a 35% ya está bien.
 */
export type NivelDeGanancia = 'buena' | 'justa' | 'baja';

const RANGOS = {
  preparado: { buena: 0.7, justa: 0.5 },
  venta: { buena: 0.35, justa: 0.15 },
} as const;

export function nivelDeGanancia(margen: number, preparado: boolean): NivelDeGanancia {
  const r = preparado ? RANGOS.preparado : RANGOS.venta;
  return margen >= r.buena ? 'buena' : margen >= r.justa ? 'justa' : 'baja';
}

export const TEXTO_DE_NIVEL: Record<NivelDeGanancia, string> = { buena: 'Buena', justa: 'Justa', baja: 'Baja' };

export const COLOR_DE_NIVEL: Record<NivelDeGanancia, string> = {
  buena: 'text-emerald-600 dark:text-emerald-400',
  justa: 'text-amber-600 dark:text-amber-400',
  baja: 'text-rose-600 dark:text-rose-400',
};

export const PASTILLA_DE_NIVEL: Record<NivelDeGanancia, string> = {
  buena: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400',
  justa: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
  baja: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400',
};

/** Lo que dice el rango, para el «¿por qué?» */
export const RANGO_TEXTO = {
  preparado: 'En lo preparado, buena desde 70% y justa desde 50%: el insumo debería ser menos de un tercio del precio.',
  venta: 'En reventa, buena desde 35% y justa desde 15%.',
};
