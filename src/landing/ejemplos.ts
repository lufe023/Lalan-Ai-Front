/**
 * Los ejemplos de lo que trae cada plan: en la tarjeta, cada línea que tiene
 * una foto o un video se toca y se abre aquí, en grande, sin salir de la
 * página. Las fotos y los videos los sube Plataforma → Planes → Ejemplos.
 *
 * Algunos vienen de serie con la página (EJEMPLOS_DE_SERIE): salen mientras
 * Plataforma no suba otro para esa característica.
 */
import { API } from './api';

/** Un ejemplo listo para mostrar */
export interface Ejemplo {
  foto: string;
  video: string | null;
  leyenda: string | null;
}

interface EjemploServidor { id: string; leyenda: string | null; video: boolean; duracionSeg: number | null }

/** El video de Compras (Plataforma lo puede cambiar subiendo otro) */
const COMPRAS: Ejemplo = { foto: '/landing/ejemplos/compras.jpg', video: '/landing/ejemplos/compras.mp4', leyenda: 'Compras con Lalan en 50 segundos' };
export const EJEMPLOS_DE_SERIE: Record<string, Ejemplo[]> = { compras: [COMPRAS], compras_lalan: [COMPRAS] };

/** Los ejemplos por característica (id del módulo o de lo básico) */
export async function cargarEjemplos(): Promise<Record<string, Ejemplo[]>> {
  const mapa: Record<string, Ejemplo[]> = { ...EJEMPLOS_DE_SERIE };
  try {
    const r = await fetch(`${API}/public/landing/ejemplos`);
    if (!r.ok) return mapa;
    const datos = (await r.json()) as Record<string, EjemploServidor[]>;
    for (const [id, lista] of Object.entries(datos ?? {})) {
      if (!Array.isArray(lista) || !lista.length) continue;
      mapa[id] = lista.map((e) => ({
        foto: `${API}/public/landing/ejemplos/${e.id}`,
        video: e.video ? `${API}/public/landing/ejemplos/${e.id}/video` : null,
        leyenda: e.leyenda,
      }));
    }
  } catch {
    /* sin conexión: quedan los de serie */
  }
  return mapa;
}

const escapar = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

let visor: HTMLDialogElement | null = null;
/** Lo que hace la página al elegir un plan (lo deja marcado en el formulario) */
let alElegirPlan: ((clave: string) => void) | null = null;

function crearVisor(): HTMLDialogElement {
  const d = document.createElement('dialog');
  d.className = 'visor-ejemplo';
  d.setAttribute('aria-labelledby', 'visor-ejemplo-titulo');
  d.innerHTML = `<div class="visor-caja">
    <header><div><p class="visor-plan"></p><h3 id="visor-ejemplo-titulo"></h3></div>
    <button type="button" class="visor-cerrar" aria-label="Cerrar">×</button></header>
    <div class="visor-medio"></div>
    <p class="visor-leyenda"></p>
    <div class="visor-miniaturas" role="tablist" aria-label="Más ejemplos"></div>
    <a class="boton visor-boton" href="#piloto"></a>
  </div>`;
  const cerrar = () => d.close();
  d.querySelector('.visor-cerrar')!.addEventListener('click', cerrar);
  // Tocar fuera de la caja también cierra
  d.addEventListener('click', (e) => { if (e.target === d) cerrar(); });
  // Al cerrar, el video se calla
  d.addEventListener('close', () => { d.querySelector('video')?.pause(); });
  // El botón lleva al formulario con el plan elegido: se cierra para que se vea el desplazamiento
  d.querySelector('.visor-boton')!.addEventListener('click', (e) => {
    const clave = (e.currentTarget as HTMLElement).dataset.plan;
    d.close();
    if (clave) alElegirPlan?.(clave);
  });
  document.body.append(d);
  return d;
}

function mostrar(d: HTMLDialogElement, e: Ejemplo) {
  const medio = d.querySelector<HTMLElement>('.visor-medio')!;
  medio.innerHTML = e.video
    ? `<video src="${escapar(e.video)}" poster="${escapar(e.foto)}" controls playsinline preload="metadata"></video>`
    : `<img src="${escapar(e.foto)}" alt="${escapar(e.leyenda ?? '')}">`;
  const leyenda = d.querySelector<HTMLElement>('.visor-leyenda')!;
  leyenda.textContent = e.leyenda ?? '';
  leyenda.hidden = !e.leyenda;
  // Se abrió con un toque: el video puede sonar sin otro clic
  void d.querySelector('video')?.play().catch(() => undefined);
}

/**
 * Abre el visor con los ejemplos de una característica. `plan` es la tarjeta
 * de donde se abrió: su botón deja ese plan elegido en el formulario.
 */
export function abrirEjemplo(nombre: string, ejemplos: Ejemplo[], plan: { clave: string; nombre: string } | null, elegir?: (clave: string) => void) {
  if (!ejemplos.length) return;
  alElegirPlan = elegir ?? null;
  visor ??= crearVisor();
  const d = visor;
  d.querySelector('#visor-ejemplo-titulo')!.textContent = nombre;
  const etiquetaPlan = d.querySelector<HTMLElement>('.visor-plan')!;
  etiquetaPlan.textContent = plan ? `Viene en el ${plan.nombre}` : '';
  etiquetaPlan.hidden = !plan;
  const boton = d.querySelector<HTMLAnchorElement>('.visor-boton')!;
  boton.hidden = !plan;
  if (plan) { boton.dataset.plan = plan.clave; boton.textContent = `Quiero el ${plan.nombre}`; }
  const miniaturas = d.querySelector<HTMLElement>('.visor-miniaturas')!;
  miniaturas.hidden = ejemplos.length < 2;
  miniaturas.innerHTML = ejemplos.map((e, i) => `<button type="button" role="tab" aria-selected="${i === 0}" aria-label="Ejemplo ${i + 1}${e.video ? ' (video)' : ''}"><img src="${escapar(e.foto)}" alt="">${e.video ? '<span aria-hidden="true">▶</span>' : ''}</button>`).join('');
  miniaturas.querySelectorAll<HTMLButtonElement>('button').forEach((b, i) => b.addEventListener('click', () => {
    miniaturas.querySelectorAll('button').forEach((x, j) => x.setAttribute('aria-selected', String(i === j)));
    mostrar(d, ejemplos[i]);
  }));
  mostrar(d, ejemplos[0]);
  if (!d.open) d.showModal();
}
