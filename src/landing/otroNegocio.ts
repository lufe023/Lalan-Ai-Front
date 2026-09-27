/**
 * «No tengo salón»: alguien con otro negocio que quiere su asistente.
 * No se vende nada todavía: se mide qué tipo de negocio lo pide más.
 */
import { API } from './api';
import { visitaActual } from './medicion';

interface Opcion { id: string; descripcion: string }
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function chips(caja: HTMLElement, opciones: Opcion[], nombre: string) {
  const tipo = caja.dataset.tipo === 'radio' ? 'radio' : 'checkbox';
  caja.innerHTML = '';
  opciones.forEach((o) => {
    const l = document.createElement('label');
    const i = document.createElement('input'); i.type = tipo; i.name = nombre; i.value = o.id;
    const s = document.createElement('span'); s.textContent = o.descripcion;
    l.append(i, s); caja.appendChild(l);
  });
}

function telefonoValido(t: string): boolean {
  const d = t.replace(/\D/g, '');
  return d.length >= 10 && d.length <= 15;
}

export async function iniciarOtroNegocio(): Promise<void> {
  const form = $<HTMLFormElement>('form-otro');
  if (!form) return;
  const aviso = $<HTMLParagraphElement>('o-aviso');
  const boton = $<HTMLButtonElement>('o-enviar');
  try {
    const r = await fetch(`${API}/public/landing/formulario`);
    if (r.ok) {
      const c = await r.json();
      chips($('o-tipo'), c.tiposNegocio ?? [], 'o-tipo');
      chips($('o-que'), c.queAutomatizar ?? [], 'o-que');
    }
  } catch { /* sin servidor: queda el WhatsApp */ }
  const decir = (texto: string, error = false) => { aviso.textContent = texto; aviso.classList.toggle('error', error); };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const marcados = (n: string) => Array.from(form.querySelectorAll<HTMLInputElement>(`input[name="${n}"]:checked`)).map((i) => i.value);
    const tipoNegocio = marcados('o-tipo')[0];
    const telefono = $<HTMLInputElement>('o-telefono').value.trim();
    if (!tipoNegocio) { decir('Elige qué tipo de negocio tienes.', true); return; }
    if (!telefonoValido(telefono)) { decir('Revisa tu WhatsApp: escribe el número completo.', true); $('o-telefono').focus(); return; }
    boton.disabled = true; boton.textContent = 'Enviando…'; decir('');
    try {
      const r = await fetch(`${API}/public/landing/otro-negocio`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoNegocio, telefono, queAutomatizar: marcados('o-que'),
          negocio: $<HTMLInputElement>('o-negocio').value.trim() || undefined,
          detalle: $<HTMLTextAreaElement>('o-detalle').value.trim() || undefined,
          visitaId: visitaActual() ?? undefined,
          web: $<HTMLInputElement>('o-web').value || undefined,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error((d && (Array.isArray(d.message) ? d.message[0] : d.message)) || 'No se pudo enviar.');
      }
      form.hidden = true;
      const listo = $('otro-listo'); listo.hidden = false; listo.focus();
    } catch (err) {
      decir(`${(err as Error).message} Puedes escribirnos directo por WhatsApp al 809-229-9444.`, true);
    } finally {
      boton.disabled = false; boton.textContent = 'Quiero mi asistente';
    }
  });
}
