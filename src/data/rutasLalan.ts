import { api } from '../services/api';
import type { GuiaApp, PasoGuia } from './guias';
import { etiqueta } from '../hooks/useUsoApp';

/**
 * Las rutas del Llévame grabadas en Plataforma → Lalan → Lo que sabe hacer.
 *
 * Mandan sobre las de `guias.ts` con el mismo id, y las tareas nuevas solo
 * existen aquí. Se piden una vez por sesión de la app.
 */
interface RutaServidor { id: string; nombre: string; porSede: boolean; ruta: PasoGuia[] }

let rutas: Map<string, GuiaApp> | null = null;
let pidiendo: Promise<void> | null = null;
const EVENTO = 'lalan:rutas';

function aGuia(r: RutaServidor): GuiaApp | null {
  const primero = r.ruta[0];
  if (!primero?.pantalla) return null;
  return {
    id: r.id,
    nombre: r.nombre,
    pantalla: primero.pantalla,
    // En Ajustes, si se grabó desde el menú la guía empieza por el menú
    ajustes: primero.pantalla === 'settings' && !primero.seccion,
    cambiaSede: r.porSede,
    pasos: r.ruta,
  };
}

export function cargarRutas(): Promise<void> {
  if (rutas) return Promise.resolve();
  pidiendo ??= api.get<RutaServidor[]>('/asistente/guias')
    .then((lista) => {
      rutas = new Map((lista ?? []).map(aGuia).filter((g): g is GuiaApp => !!g).map((g) => [g.id, g]));
    })
    .catch(() => { rutas = new Map(); })
    .finally(() => { pidiendo = null; window.dispatchEvent(new Event(EVENTO)); });
  return pidiendo;
}

/** Plataforma acaba de guardar una ruta: la próxima guía las vuelve a pedir */
export function olvidarRutas() { rutas = null; void cargarRutas(); }

/** null = todavía no llegaron */
export const rutasCargadas = () => rutas !== null;
export const rutaGrabada = (id: string): GuiaApp | null => rutas?.get(id) ?? null;
export const EVENTO_RUTAS = EVENTO;

/** Lo que se busca por nombre: lo mismo que el mapa de calor sabe nombrar */
const TOCABLES = '[data-medir], button, a, [role="button"], input, select, textarea, label';

/**
 * El nombre de un botón para encontrarlo otra vez: el nombre fijo del mapa de
 * calor o, si no tiene, su texto corto («Ver Paletas»). Esto no se manda a
 * ningún lado: se compara en el mismo aparato.
 */
export function nombreDe(el: Element): string | undefined {
  const fijo = etiqueta(el);
  if (fijo) return fijo;
  const t = ((el as HTMLElement).innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();
  return t && t.length <= 60 ? t : undefined;
}

/**
 * Dónde está lo que señala un paso. Primero la marca fija, luego el n-ésimo
 * elemento con ese nombre. El punto grabado lo resuelve `puntoDelPaso`.
 */
export function elementoDelPaso(p: PasoGuia): HTMLElement | null {
  if (p.ancla) {
    const el = document.querySelector<HTMLElement>(`[data-guia="${CSS.escape(p.ancla)}"]`);
    if (el) return el;
  }
  if (p.etiqueta) {
    const iguales = [...document.querySelectorAll<HTMLElement>(TOCABLES)].filter((el) => nombreDe(el) === p.etiqueta && el.getBoundingClientRect().width > 0);
    return iguales[p.indice ?? 0] ?? iguales[0] ?? null;
  }
  return null;
}

/** Lo que se desplaza de la pantalla del paso (donde se midió el punto) */
export function desplazableDe(pantalla: string | undefined): HTMLElement | null {
  return document.querySelector<HTMLElement>(pantalla ? `[data-pantalla="${pantalla}"] [data-desplazable]` : '[data-pantalla]:not([data-motion-pop-id]) [data-desplazable]');
}

/** El punto grabado: dónde queda en la pantalla y cuánto hay que desplazar para verlo */
export function puntoDelPaso(p: PasoGuia): { caja: DOMRect; contenedor: HTMLElement; arriba: number } | null {
  // Con nombre o marca, el punto solo es de referencia: señalar otra cosa sería peor que decir "no lo veo"
  if (p.ancla || p.etiqueta || p.x === undefined || p.y === undefined) return null;
  const c = desplazableDe(p.pantalla);
  if (!c) return null;
  const r = c.getBoundingClientRect();
  const x = r.left + p.x * r.width;
  const yContenido = p.y * Math.max(c.scrollHeight, 1);
  const lado = 44;
  return { caja: new DOMRect(x - lado / 2, r.top + yContenido - c.scrollTop - lado / 2, lado, lado), contenedor: c, arriba: yContenido };
}

/** Para el grabador: el n-ésimo de los que se llaman igual */
export function indiceConNombre(el: HTMLElement, nombre: string): number {
  const iguales = [...document.querySelectorAll<HTMLElement>(TOCABLES)].filter((x) => nombreDe(x) === nombre && x.getBoundingClientRect().width > 0);
  return Math.max(0, iguales.indexOf(el));
}

export const SELECTOR_TOCABLES = TOCABLES;
