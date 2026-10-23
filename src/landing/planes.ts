/**
 * Los planes de la página, tal como están en Plataforma → Planes.
 *
 * Antes las tarjetas estaban escritas a mano y se desfasaron de lo que de
 * verdad trae cada plan. Ahora se piden al servidor (sin precio) y se pintan
 * aquí; lo que viene en el HTML queda solo de respaldo si el servidor no
 * contesta. Cada tarjeta lleva al formulario de la prueba gratis con su
 * plan ya elegido.
 *
 * El orden, el recomendado y la oferta de cada tarjeta los elige Plataforma
 * (Planes → Cómo salen en la página y Ofertas). Con 3 o 4 planes van en
 * columnas en la PC; en el teléfono se pasan de lado, uno a la vez.
 */
import { API } from './api';
import { botonOferta, detalleOferta, type OfertaTexto } from './textoOferta';

interface PlanPublico {
  clave: string;
  nombre: string;
  descripcion: string | null;
  anterior: string | null;
  suma: { id: string; nombre: string; descripcion: string }[];
  limites: { respuestasMes: number | null; sedes: number | null; usuarios: number | null; especialistas: number | null };
  /** El que Plataforma resalta como recomendado */
  destacado?: boolean;
  /** La prueba gratis de este plan; null = sin oferta */
  oferta?: OfertaTexto | null;
}

/** Lo que todos los planes traen: se muestra completo solo en el primero */
const BASICO = ['Lalan responde y agenda en WhatsApp', 'Entiende notas de voz', 'Agenda, especialistas y zonas', 'Ficha de cada clienta y sus gustos', 'Avisos a la dueña por WhatsApp', 'Métricas'];

const escapar = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const numero = (n: number) => n.toLocaleString('es-DO');

/**
 * Los topes como piezas que no se parten: antes iban en una sola línea con
 * puntos y el salto caía entre el número y la palabra («1» al final de una
 * línea y «usuario · 2 especialistas» en la otra).
 */
function topes(l: PlanPublico['limites']): string {
  const tope = (n: number | null, uno: string, varios: string) => (n == null ? `<b>Sin límite</b> ${varios}` : `<b>${numero(n)}</b> ${n === 1 ? uno : varios}`);
  return [
    tope(l.respuestasMes, 'respuesta de Lalan al mes', 'respuestas de Lalan al mes'),
    tope(l.sedes, 'sede', 'sedes'),
    tope(l.usuarios, 'usuario', 'usuarios'),
    tope(l.especialistas, 'especialista', 'especialistas'),
  ].map((t) => `<li>${t}</li>`).join('');
}

function tarjeta(p: PlanPublico, destacado: boolean): string {
  const items = p.anterior
    ? [`<li class="base">Todo lo del ${escapar(p.anterior)}</li>`, ...p.suma.map((m) => `<li class="nuevo" title="${escapar(m.descripcion)}">${escapar(m.nombre)}</li>`)]
    : [...BASICO, ...p.suma.map((m) => m.nombre)].map((t) => `<li>${escapar(t)}</li>`);
  const o = p.oferta;
  return `<article class="plan${destacado ? ' destacado' : ''}">
    ${destacado ? '<span class="sello-plan">Recomendado</span>' : ''}
    ${p.descripcion ? `<p class="para">${escapar(p.descripcion)}</p>` : ''}
    <h3>${escapar(p.nombre)}</h3>
    <ul class="trae">${items.join('')}</ul>
    <ul class="topes" aria-label="Topes del ${escapar(p.nombre)}">${topes(p.limites)}</ul>
    <a class="boton${destacado ? '' : ' claro'}" href="#piloto" data-plan="${escapar(p.clave)}">${escapar(o ? botonOferta(o) : `Quiero el ${p.nombre}`)}</a>
    ${o ? `<p class="letra-chica">${escapar(detalleOferta(o))}</p>` : ''}
  </article>`;
}

/** La oferta de cada plan, para decirla en el formulario al elegirlo */
const ofertas = new Map<string, OfertaTexto>();

function decirOferta() {
  const select = document.getElementById('p-plan') as HTMLSelectElement | null;
  const linea = document.getElementById('p-oferta');
  if (!select || !linea) return;
  const o = ofertas.get(select.value);
  linea.hidden = !o;
  linea.textContent = o ? `${botonOferta(o).replace('Pruébalo', 'Lo pruebas')}. ${detalleOferta(o)}` : '';
}

/** El botón de cada plan deja ese plan elegido en el formulario (y dice su oferta) */
function alElegir(contenedor: Element) {
  contenedor.addEventListener('click', (e) => {
    const boton = (e.target as Element).closest<HTMLAnchorElement>('a[data-plan]');
    const select = document.getElementById('p-plan') as HTMLSelectElement | null;
    if (!boton || !select) return;
    const clave = boton.dataset.plan ?? '';
    if ([...select.options].some((o) => o.value === clave)) select.value = clave;
    decirOferta();
  });
  document.getElementById('p-plan')?.addEventListener('change', decirOferta);
}

/** En el teléfono las tarjetas se pasan de lado: los puntos dicen cuántas hay y en cuál va */
function puntos(contenedor: HTMLElement) {
  const viejo = contenedor.nextElementSibling;
  if (viejo?.classList.contains('puntos-planes')) viejo.remove();
  const tarjetas = [...contenedor.querySelectorAll<HTMLElement>('.plan')];
  if (tarjetas.length < 2) return;
  const fila = document.createElement('div');
  fila.className = 'puntos-planes';
  fila.setAttribute('aria-hidden', 'true');
  fila.innerHTML = tarjetas.map(() => '<span></span>').join('');
  contenedor.after(fila);
  const centroDe = (t: HTMLElement) => t.offsetLeft + t.offsetWidth / 2;
  const marcar = () => {
    const centro = contenedor.scrollLeft + contenedor.clientWidth / 2;
    let cerca = 0;
    tarjetas.forEach((t, i) => { if (Math.abs(centroDe(t) - centro) < Math.abs(centroDe(tarjetas[cerca]) - centro)) cerca = i; });
    [...fila.children].forEach((pt, i) => pt.classList.toggle('activo', i === cerca));
  };
  contenedor.addEventListener('scroll', marcar, { passive: true });
  marcar();
}

export async function iniciarPlanes(): Promise<void> {
  const contenedor = document.querySelector<HTMLElement>('#planes .planes');
  if (!contenedor) return;
  alElegir(contenedor);
  contenedor.style.setProperty('--columnas', String(Math.min(4, contenedor.querySelectorAll('.plan').length) || 3));
  puntos(contenedor);
  try {
    const r = await fetch(`${API}/public/landing/planes`);
    if (!r.ok) return;
    const planes = (await r.json()) as PlanPublico[];
    if (!Array.isArray(planes) || !planes.length) return;
    // El recomendado lo elige Plataforma; si nadie lo marcó, ninguno se resalta
    contenedor.innerHTML = planes.map((p) => tarjeta(p, !!p.destacado)).join('');
    contenedor.style.setProperty('--columnas', String(Math.min(4, planes.length)));
    ofertas.clear();
    for (const p of planes) if (p.oferta) ofertas.set(p.clave, p.oferta);
    decirOferta();
    puntos(contenedor);
  } catch {
    /* sin conexión: quedan las tarjetas del HTML */
  }
}
