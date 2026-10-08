/**
 * Los planes de la página, tal como están en Plataforma → Planes.
 *
 * Antes las tarjetas estaban escritas a mano y se desfasaron de lo que de
 * verdad trae cada plan. Ahora se piden al servidor (sin precio) y se pintan
 * aquí; lo que viene en el HTML queda solo de respaldo si el servidor no
 * contesta. Cada tarjeta lleva al formulario de los 2 meses gratis con su
 * plan ya elegido.
 */
import { API } from './api';

interface PlanPublico {
  clave: string;
  nombre: string;
  descripcion: string | null;
  anterior: string | null;
  suma: { id: string; nombre: string; descripcion: string }[];
  limites: { respuestasMes: number | null; sedes: number | null; usuarios: number | null; especialistas: number | null };
}

/** Lo que todos los planes traen: se muestra completo solo en el primero */
const BASICO = ['Lalan responde y agenda en WhatsApp', 'Entiende notas de voz', 'Agenda, especialistas y zonas', 'Ficha de cada clienta y sus gustos', 'Avisos a la dueña por WhatsApp', 'Métricas'];

const escapar = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const numero = (n: number) => n.toLocaleString('es-DO');

function topes(l: PlanPublico['limites']): string {
  const partes = [
    l.respuestasMes != null ? `Hasta ${numero(l.respuestasMes)} respuestas de Lalan al mes` : 'Respuestas de Lalan sin límite',
    l.sedes != null ? `${numero(l.sedes)} ${l.sedes === 1 ? 'sede' : 'sedes'}` : 'sedes sin límite',
    l.usuarios != null ? `${numero(l.usuarios)} ${l.usuarios === 1 ? 'usuario' : 'usuarios'}` : 'usuarios sin límite',
    l.especialistas != null ? `${numero(l.especialistas)} ${l.especialistas === 1 ? 'especialista' : 'especialistas'}` : 'especialistas sin límite',
  ];
  return partes.join(' · ');
}

function tarjeta(p: PlanPublico, destacado: boolean): string {
  const items = p.anterior
    ? [`<li>Todo lo del ${escapar(p.anterior)}</li>`, ...p.suma.map((m) => `<li class="nuevo" title="${escapar(m.descripcion)}">${escapar(m.nombre)}</li>`)]
    : [...BASICO, ...p.suma.map((m) => m.nombre)].map((t) => `<li>${escapar(t)}</li>`);
  return `<article class="plan${destacado ? ' destacado' : ''}">
    ${p.descripcion ? `<p class="para">${escapar(p.descripcion)}</p>` : ''}
    <h3>${escapar(p.nombre)}</h3>
    <ul>${items.join('')}</ul>
    <p class="nota">${topes(p.limites)}</p>
    <a class="boton" href="#piloto" data-plan="${escapar(p.clave)}">Pruébalo 2 meses gratis</a>
  </article>`;
}

/** El botón de cada plan deja ese plan elegido en el formulario */
function alElegir(contenedor: Element) {
  contenedor.addEventListener('click', (e) => {
    const boton = (e.target as Element).closest<HTMLAnchorElement>('a[data-plan]');
    const select = document.getElementById('p-plan') as HTMLSelectElement | null;
    if (!boton || !select) return;
    const clave = boton.dataset.plan ?? '';
    if ([...select.options].some((o) => o.value === clave)) select.value = clave;
  });
}

export async function iniciarPlanes(): Promise<void> {
  const contenedor = document.querySelector('#planes .planes');
  if (!contenedor) return;
  alElegir(contenedor);
  try {
    const r = await fetch(`${API}/public/landing/planes`);
    if (!r.ok) return;
    const planes = (await r.json()) as PlanPublico[];
    if (!Array.isArray(planes) || !planes.length) return;
    // El del medio se destaca (con tres planes, el de en medio es el que más se elige)
    const medio = planes.length >= 3 ? Math.floor(planes.length / 2) : -1;
    contenedor.innerHTML = planes.map((p, i) => tarjeta(p, i === medio)).join('');
  } catch {
    /* sin conexión: quedan las tarjetas del HTML */
  }
}
