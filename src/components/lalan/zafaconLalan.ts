import { useSyncExternalStore } from 'react';

/**
 * El zafacón de Lalan: aparece mientras se arrastra su burbuja y, si se
 * suelta encima, Lalan se cierra. En el teléfono vive dentro del menú de
 * abajo (empuja a los botones para hacerse lugar); en la PC flota abajo al
 * centro. La burbuja y el menú se hablan por aquí.
 */
export interface EstadoZafacon { visible: boolean; sobre: boolean }

let estado: EstadoZafacon = { visible: false, sobre: false };
let elemento: HTMLElement | null = null;
const oyentes = new Set<() => void>();

export function ponerZafacon(cambio: Partial<EstadoZafacon>) {
  const nuevo = { ...estado, ...cambio };
  if (nuevo.visible === estado.visible && nuevo.sobre === estado.sobre) return;
  estado = nuevo;
  oyentes.forEach((f) => f());
}

export function useZafacon(): EstadoZafacon {
  return useSyncExternalStore((f) => { oyentes.add(f); return () => { oyentes.delete(f); }; }, () => estado);
}

/** Quien dibuja el zafacón lo registra para que la burbuja sepa dónde está */
export function registrarZafacon(el: HTMLElement | null) {
  elemento = el;
}

/** El centro del zafacón en pantalla, si se ve */
export function centroZafacon(): { cx: number; cy: number } | null {
  const r = elemento?.getBoundingClientRect();
  if (!r || r.width < 8) return null;
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
}
