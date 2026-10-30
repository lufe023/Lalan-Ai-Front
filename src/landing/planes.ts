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
import { botonOferta, detalleOferta, partesOferta, type OfertaTexto } from './textoOferta';
import { abrirEjemplo, cargarEjemplos, type Ejemplo } from './ejemplos';

interface PlanPublico {
  clave: string;
  nombre: string;
  descripcion: string | null;
  anterior: string | null;
  suma: { id: string; nombre: string; descripcion: string }[];
  limites: { respuestasMes: number | null; sedes: number | null; usuarios: number | null; especialistas: number | null; preguntasDia?: number | null };
  /** Lo que se puede hacer con las respuestas del mes (falta si el servidor es de antes) */
  respuestas?: { acumula: boolean; adelanto: number; extra: boolean; alAgotarse: 'persona' | 'menu' };
  /** El precio al mes, solo si Plataforma lo marcó como público */
  precio?: { monto: number; moneda: string } | null;
  /** El que Plataforma resalta como recomendado */
  destacado?: boolean;
  /** La prueba gratis de este plan; null = sin oferta */
  oferta?: OfertaTexto | null;
}

/**
 * Lo que todos los planes traen: se muestra completo solo en el primero. Los
 * ids son los de LO_BASICO en el servidor (planes.contrato.ts), para colgarles
 * ejemplos desde Plataforma.
 */
const BASICO: { id: string; nombre: string }[] = [
  { id: 'base_whatsapp', nombre: 'Lalan responde y agenda en WhatsApp' },
  { id: 'base_notas_voz', nombre: 'Entiende notas de voz' },
  { id: 'base_agenda', nombre: 'Agenda, especialistas y zonas' },
  { id: 'base_clientas', nombre: 'Ficha de cada clienta y sus gustos' },
  { id: 'base_avisos', nombre: 'Avisos a la dueña por WhatsApp' },
  { id: 'base_metricas', nombre: 'Métricas' },
];

/** Los ejemplos por característica (Plataforma → Planes → Ejemplos, más los de serie) */
let ejemplos: Record<string, Ejemplo[]> = {};
/** El nombre de cada característica, para el título del visor */
const nombres = new Map<string, string>();

const escapar = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const numero = (n: number) => n.toLocaleString('es-DO');

/**
 * Los topes como piezas que no se parten: antes iban en una sola línea con
 * puntos y el salto caía entre el número y la palabra («1» al final de una
 * línea y «usuario · 2 especialistas» en la otra). Las respuestas del mes
 * salen arriba, en su propio bloque, cuando el servidor dice qué se puede
 * hacer con ellas.
 */
function topes(l: PlanPublico['limites'], conRespuestas: boolean): string {
  const tope = (n: number | null, uno: string, varios: string) => (n == null ? `<b>Sin límite</b> ${varios}` : `<b>${numero(n)}</b> ${n === 1 ? uno : varios}`);
  return [
    conRespuestas ? null : tope(l.respuestasMes, 'respuesta de Lalan al mes', 'respuestas de Lalan al mes'),
    tope(l.sedes, 'sede', 'sedes'),
    tope(l.usuarios, 'usuario', 'usuarios'),
    tope(l.especialistas, 'especialista', 'especialistas'),
    l.preguntasDia != null ? tope(l.preguntasDia, 'pregunta al día a Lalan en tu app', 'preguntas al día a Lalan en tu app') : null,
  ].filter(Boolean).map((t) => `<li>${t}</li>`).join('');
}

/**
 * Las respuestas del mes y lo que deja hacer el plan con ellas: pasar lo que
 * sobra, adelantar del mes siguiente y comprar más sin subir de plan. Lo que
 * el plan no trae también se dice, apagado, para que se note la diferencia
 * entre una tarjeta y la otra.
 */
function cupo(p: PlanPublico): string {
  const r = p.respuestas;
  if (!r) return '';
  const n = p.limites.respuestasMes;
  const cabeza = n == null
    ? '<p class="cupo-numero"><b>Sin límite</b> de respuestas de Lalan</p>'
    : `<p class="cupo-numero"><b>${numero(n)}</b> respuestas de Lalan al mes</p>`;
  if (n == null) return `<div class="cupo">${cabeza}</div>`;
  const fila = (si: boolean, conTexto: string, sinTexto: string) => `<li class="${si ? 'si' : 'no'}">${escapar(si ? conTexto : sinTexto)}</li>`;
  const filas = [
    fila(r.acumula, 'Lo que sobra pasa al mes siguiente', 'Lo que sobra no pasa al mes siguiente'),
    fila(r.adelanto > 0, `Adelantas hasta ${numero(r.adelanto)} del mes siguiente`, 'Sin adelantar del mes siguiente'),
    fila(r.extra, 'Compras más sin cambiar de plan', 'Sin respuestas extra'),
    `<li class="info">${escapar(r.alAgotarse === 'menu' ? 'Si se acaban, Lalan contesta con un menú sin IA' : 'Si se acaban, tu equipo sigue el chat')}</li>`,
  ];
  return `<div class="cupo">${cabeza}<ul class="cupo-flex">${filas.join('')}</ul></div>`;
}

/** La primera frase de la descripción de un módulo, para que la lista no se alargue */
const primeraFrase = (t: string) => t.split(/(?<=\.)\s/)[0];

/** «Pruébalo» / «2 meses gratis» (grande) / «con Plan Lounge» (pequeño) */
function botonEnTresLineas(o: OfertaTexto): string {
  const t = partesOferta(o);
  return `<span class="arriba">${escapar(t.arriba)}</span><span class="grande">${escapar(t.grande)}</span><span class="abajo">${escapar(t.abajo)}</span>`;
}

const WHATSAPP_EQUIPO = '18092299444';

/** El precio si Plataforma lo publica; si no, «Precio a tu medida · Escríbenos» a WhatsApp con el plan */
function precio(p: PlanPublico): string {
  // Un plan de 0 con el precio público dice «Gratis», no «RD$0»
  if (p.precio && p.precio.monto <= 0) return '<p class="precio-plan"><b>Gratis</b></p>';
  if (p.precio) {
    const simbolo = p.precio.moneda === 'DOP' ? 'RD$' : p.precio.moneda === 'USD' ? 'US$' : `${p.precio.moneda} `;
    return `<p class="precio-plan"><b>${simbolo}${numero(Math.round(p.precio.monto))}</b> <span>/ mes</span></p>`;
  }
  const texto = encodeURIComponent(`Hola, quiero saber el precio del ${p.nombre} de Lalan AI.`);
  return `<p class="precio-plan consulta">Precio a tu medida · <a href="https://wa.me/${WHATSAPP_EQUIPO}?text=${texto}" target="_blank" rel="noopener">Escríbenos</a></p>`;
}

function tarjeta(p: PlanPublico, destacado: boolean): string {
  // Cada cosa nueva con su explicación corta (solo el nombre dejaba las tarjetas como vacías).
  // Si el plan suma muchas, van solo los nombres: la lista ya es larga
  const conDetalle = p.suma.length <= 4;
  // Lo que tiene un ejemplo se toca y abre la foto o el video ahí mismo
  const conEjemplo = (id: string, nombre: string, contenido: string) => {
    const lista = ejemplos[id];
    if (!lista?.length) return contenido;
    nombres.set(id, nombre);
    const tipo = lista.some((e) => e.video) ? 'Ver video' : 'Ver ejemplo';
    return `<button type="button" class="ver-ejemplo" data-ejemplo="${escapar(id)}" data-plan-clave="${escapar(p.clave)}" data-plan-nombre="${escapar(p.nombre)}">${contenido}<span class="ver">${tipo}</span></button>`;
  };
  const nuevo = (m: PlanPublico['suma'][number]) => `<li class="nuevo">${conEjemplo(m.id, m.nombre, `<span><b>${escapar(m.nombre)}</b>${conDetalle && m.descripcion ? `<small>${escapar(primeraFrase(m.descripcion))}</small>` : ''}</span>`)}</li>`;
  const items = p.anterior
    ? [`<li class="base">Todo lo del ${escapar(p.anterior)}</li>`, ...p.suma.map(nuevo)]
    : [...BASICO.map((b) => `<li>${conEjemplo(b.id, b.nombre, `<span>${escapar(b.nombre)}</span>`)}</li>`), ...p.suma.map(nuevo)];
  const o = p.oferta;
  return `<article class="plan${destacado ? ' destacado' : ''}">
    ${destacado ? '<span class="sello-plan">Recomendado</span>' : ''}
    ${p.descripcion ? `<p class="para">${escapar(p.descripcion)}</p>` : ''}
    <h3>${escapar(p.nombre)}</h3>
    ${precio(p)}
    ${cupo(p)}
    <p class="trae-titulo">Qué trae</p>
    <ul class="trae">${items.join('')}</ul>
    <ul class="topes" aria-label="Topes del ${escapar(p.nombre)}">${topes(p.limites, !!p.respuestas)}</ul>
    <a class="boton${destacado ? '' : ' claro'}${o ? ' oferta' : ''}" href="#piloto" data-plan="${escapar(p.clave)}"${o ? ` aria-label="${escapar(botonOferta(o))}"` : ''}>${o ? botonEnTresLineas(o) : escapar(`Quiero el ${p.nombre}`)}</a>
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
function elegirPlan(clave: string) {
  const select = document.getElementById('p-plan') as HTMLSelectElement | null;
  if (!select) return;
  if ([...select.options].some((o) => o.value === clave)) select.value = clave;
  decirOferta();
}

function alElegir(contenedor: Element) {
  contenedor.addEventListener('click', (e) => {
    const ver = (e.target as Element).closest<HTMLButtonElement>('button[data-ejemplo]');
    if (ver) {
      const id = ver.dataset.ejemplo ?? '';
      const plan = ver.dataset.planClave ? { clave: ver.dataset.planClave, nombre: ver.dataset.planNombre ?? '' } : null;
      abrirEjemplo(nombres.get(id) ?? '', ejemplos[id] ?? [], plan, elegirPlan);
      return;
    }
    const boton = (e.target as Element).closest<HTMLAnchorElement>('a[data-plan]');
    if (boton) elegirPlan(boton.dataset.plan ?? '');
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

/**
 * El ejemplo de temporada (noviembre flojo, diciembre lleno) con los números
 * de un plan de verdad: el primero que pasa lo que sobra, mejor si también
 * deja adelantar. Si ningún plan publicado hace nada de esto, la sección no
 * sale, para no prometer lo que no hay.
 */
function temporada(planes: PlanPublico[]) {
  const seccion = document.getElementById('respuestas');
  const caja = document.getElementById('temporada');
  if (!seccion || !caja || !planes.some((p) => p.respuestas)) return;
  const flexibles = planes.filter((p) => p.respuestas && p.limites.respuestasMes && (p.respuestas.acumula || p.respuestas.adelanto > 0 || p.respuestas.extra));
  seccion.hidden = !flexibles.length;
  const plan = flexibles.find((p) => p.respuestas!.acumula && p.respuestas!.adelanto > 0) ?? flexibles.find((p) => p.respuestas!.acumula);
  if (!plan) { caja.hidden = true; return; }
  caja.hidden = false;
  const r = plan.respuestas!;
  const base = plan.limites.respuestasMes!;
  const usoNov = Math.round((base * 0.6) / 10) * 10;
  const sobra = base - usoNov;
  const poner = (clave: string, texto: string) => caja.querySelectorAll(`[data-t="${clave}"]`).forEach((el) => { el.textContent = texto; });
  poner('plan', plan.nombre);
  poner('base', numero(base));
  poner('usoNov', numero(usoNov));
  poner('sobra', numero(sobra));
  poner('dic', numero(base + sobra));
  const mas = [r.adelanto > 0 ? `adelantas hasta ${numero(r.adelanto)} de enero` : null, r.extra ? 'compras más' : null].filter(Boolean).join(' o ');
  const siNo = caja.querySelector<HTMLElement>('[data-t="siNoAlcanza"]');
  if (siNo) siNo.textContent = mas ? `, y si no alcanza ${mas}` : '';
  const enero = caja.querySelector<HTMLElement>('[data-t="enero"]');
  if (enero) enero.hidden = r.adelanto <= 0;
}

export async function iniciarPlanes(): Promise<void> {
  const contenedor = document.querySelector<HTMLElement>('#planes .planes');
  if (!contenedor) return;
  alElegir(contenedor);
  contenedor.style.setProperty('--columnas', String(Math.min(4, contenedor.querySelectorAll('.plan').length) || 3));
  puntos(contenedor);
  try {
    // Los ejemplos no frenan las tarjetas: si fallan, salen sin ellos
    const [r, conEjemplos] = await Promise.all([fetch(`${API}/public/landing/planes`), cargarEjemplos()]);
    ejemplos = conEjemplos;
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
    temporada(planes);
  } catch {
    /* sin conexión: quedan las tarjetas del HTML */
  }
}
