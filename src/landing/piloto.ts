/**
 * El formulario de los 2 meses gratis (por dentro sigue llamándose "piloto":
 * así lo cuentan la medición y Plataforma).
 *
 * Las opciones (tamaño del equipo, servicios, planes…) las da el servidor:
 * así la lista vive en un solo sitio. Si el servidor no responde, el
 * formulario queda con lo esencial y siempre está el WhatsApp a mano.
 */
import { API } from './api';
import { registrar, visitaActual } from './medicion';

interface Opcion { id: string; descripcion: string }
interface Catalogos { tamanosEquipo: Opcion[]; servicios: Opcion[]; planes: Opcion[]; comoNosConocio: Opcion[] }

const WHATSAPP_LALAN = '18092299444';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function pintarChips(caja: HTMLElement, opciones: Opcion[], nombre: string) {
  const tipo = caja.dataset.tipo === 'radio' ? 'radio' : 'checkbox';
  caja.innerHTML = '';
  opciones.forEach((o) => {
    const l = document.createElement('label');
    const i = document.createElement('input');
    i.type = tipo; i.name = nombre; i.value = o.id;
    const s = document.createElement('span'); s.textContent = o.descripcion;
    l.append(i, s); caja.appendChild(l);
  });
  caja.closest('fieldset')!.hidden = !opciones.length;
}

function pintarSelect(sel: HTMLSelectElement, opciones: Opcion[]) {
  opciones.forEach((o) => { const op = document.createElement('option'); op.value = o.id; op.textContent = o.descripcion; sel.appendChild(op); });
  sel.closest('div')!.hidden = !opciones.length;
}

/** 10 dígitos que empiezan por 809, 829 u 849 (o con el 1 delante) */
function telefonoValido(t: string): boolean {
  let d = t.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  return d.length === 10 && /^(809|829|849)/.test(d);
}

export async function iniciarPiloto(): Promise<void> {
  const form = $<HTMLFormElement>('form-piloto');
  if (!form) return;
  const aviso = $<HTMLParagraphElement>('p-aviso');
  const boton = $<HTMLButtonElement>('p-enviar');

  let catalogos: Catalogos = { tamanosEquipo: [], servicios: [], planes: [], comoNosConocio: [] };
  try {
    const r = await fetch(`${API}/public/landing/formulario`);
    if (r.ok) catalogos = await r.json();
  } catch { /* sin servidor: quedan los campos esenciales */ }
  pintarChips($('p-tamano'), catalogos.tamanosEquipo, 'tamano');
  pintarChips($('p-servicios'), catalogos.servicios, 'servicios');
  pintarSelect($<HTMLSelectElement>('p-plan'), catalogos.planes);
  pintarSelect($<HTMLSelectElement>('p-como'), catalogos.comoNosConocio);

  let abierto = false;
  form.addEventListener('focusin', () => {
    if (abierto) return;
    abierto = true;
    registrar({ tipo: 'piloto_abierto', seccion: 'piloto' });
  });

  const decir = (texto: string, error = false) => { aviso.textContent = texto; aviso.classList.toggle('error', error); };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = $<HTMLInputElement>('p-nombre').value.trim();
    const salon = $<HTMLInputElement>('p-salon').value.trim();
    const telefono = $<HTMLInputElement>('p-telefono').value.trim();
    if (!nombre || !salon || !telefono) { decir('Escribe tu nombre, el de tu salón y tu WhatsApp para continuar.', true); return; }
    if (!telefonoValido(telefono)) { decir('Revisa tu WhatsApp: son 10 dígitos y empieza por 809, 829 u 849.', true); $('p-telefono').focus(); return; }
    if (!$<HTMLInputElement>('p-acepto').checked) { decir('Marca la casilla para que podamos escribirte por WhatsApp.', true); return; }

    const marcados = (nombreCampo: string) => Array.from(form.querySelectorAll<HTMLInputElement>(`input[name="${nombreCampo}"]:checked`)).map((i) => i.value);
    const cuerpo = {
      nombre, salon, telefono,
      ciudad: $<HTMLInputElement>('p-ciudad').value.trim() || undefined,
      tamanoEquipo: marcados('tamano')[0],
      servicios: marcados('servicios'),
      planInteres: $<HTMLSelectElement>('p-plan').value || undefined,
      comoNosConocio: $<HTMLSelectElement>('p-como').value || undefined,
      mensaje: $<HTMLTextAreaElement>('p-mensaje').value.trim() || undefined,
      visitaId: visitaActual() ?? undefined,
      web: $<HTMLInputElement>('p-web').value || undefined,
    };

    boton.disabled = true; boton.textContent = 'Enviando…'; decir('');
    try {
      const r = await fetch(`${API}/public/landing/piloto`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error((d && (Array.isArray(d.message) ? d.message[0] : d.message)) || 'No se pudo enviar.');
      }
      const mensaje = `Hola, soy ${nombre} de ${salon}. Acabo de pedir mis 2 meses gratis de Lalan AI.`;
      $<HTMLAnchorElement>('piloto-wa').href = `https://wa.me/${WHATSAPP_LALAN}?text=${encodeURIComponent(mensaje)}`;
      $('piloto-gracias').textContent = `¡Listo, ${nombre.split(' ')[0]}! Ya pediste tus 2 meses gratis`;
      form.hidden = true;
      const listo = $('piloto-listo'); listo.hidden = false; listo.focus();
    } catch (err) {
      const mensaje = `Hola, soy ${nombre} de ${salon}. Mi WhatsApp es ${telefono}. Quiero mis 2 meses gratis de Lalan AI.`;
      decir(`${(err as Error).message} Puedes escribirnos directo por WhatsApp al 809-229-9444.`, true);
      const a = document.createElement('a');
      a.className = 'boton claro chico'; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Enviar por WhatsApp';
      a.href = `https://wa.me/${WHATSAPP_LALAN}?text=${encodeURIComponent(mensaje)}`;
      aviso.appendChild(document.createElement('br')); aviso.appendChild(a);
    } finally {
      boton.disabled = false; boton.textContent = 'Quiero mis 2 meses gratis';
    }
  });
}
