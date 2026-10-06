/**
 * La ventanita de preguntas de la landing: Lalan contesta sobre Lalan,
 * lleva a la sección que hace falta y deja el formulario del piloto (o el
 * de otro negocio) lleno con lo que la persona contó. La persona siempre
 * revisa y envía ella: la asistente nunca envía nada.
 *
 * La conversación vive en sessionStorage (sobrevive a recargar la pestaña).
 *
 * La voz es a pedido: un "Escúchala" en cada respuesta. Cómo suena lo elige
 * el super admin en Plataforma → Lalan: apagada, la del navegador (gratis) o
 * la del servidor (MeloTTS / Aura-2, con topes: solo las respuestas que el
 * servidor marca). Si la persona la usa una vez, las siguientes respuestas
 * suenan solas hasta que la apague en la cabecera.
 */
import { API, MODO_CALOR } from './api';
import { registrar, visitaActual } from './medicion';
import { decirConNavegador, hayVozNavegador } from './vozNavegador';

type Rol = 'persona' | 'lalan';
interface Mensaje { rol: Rol; texto: string; voz?: boolean }
type Accion =
  | { tipo: 'ir'; seccion: string }
  | { tipo: 'formulario'; cual: 'piloto' | 'otro_negocio'; datos: Record<string, string> };

const CLAVE = 'lalan-asistente';
const WHATSAPP = '18092299444';
/** Lo que se le manda al servidor (las últimas) */
const MENSAJES_AL_SERVIDOR = 20;
/** Cuándo aparece el globito de invitación (una vez por pestaña) */
const INVITACION_MS = 14_000;
/** Cuánto se deja leer la respuesta antes de mover la página */
const ESPERA_LECTURA_MS = 900;
const ESPERA_LECTURA_MOVIL_MS = 3200;
const SALUDO = '¡Holiii! 💕 Soy Lalan. Pregúntame lo que quieras: cómo te atiendo el WhatsApp del salón, el piloto gratis, todo. Cuéntame, ¿tienes tu propio salón? ✨';
const SUGERENCIAS = ['¿Qué haces por mi salón?', '¿Cuánto cuesta?', '¿Cómo es lo del piloto gratis?', 'No tengo salón, tengo otro negocio'];

interface ConfigVoz { motor: 'apagada' | 'navegador' | 'nube'; voces: string[]; velocidad: number }

interface Estado { id: string; mensajes: Mensaje[]; invitado: boolean; hablando?: boolean }

function leer(): Estado {
  try {
    const e = JSON.parse(sessionStorage.getItem(CLAVE) || 'null') as Estado | null;
    if (e?.id && Array.isArray(e.mensajes)) return e;
  } catch { /* nada guardado */ }
  return { id: crypto.randomUUID(), mensajes: [], invitado: false };
}
function guardar(e: Estado) { try { sessionStorage.setItem(CLAVE, JSON.stringify(e)); } catch { /* sin almacenamiento */ } }

const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Texto seguro, con el WhatsApp del equipo como enlace y **negritas** */
function formatear(t: string): string {
  return escapar(t)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(\+?1?[\s-]?809[\s-]?229[\s-]?9444)/g, `<a href="https://wa.me/${WHATSAPP}" target="_blank" rel="noopener">$1</a>`)
    .replace(/\n/g, '<br>');
}

const LOGO = `<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M52 18V74H94" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 42V98H72" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function iniciarAsistente(): void {
  if (MODO_CALOR) return;
  const estado = leer();

  const raiz = document.createElement('div');
  raiz.className = 'asis';
  raiz.innerHTML = `
    <div class="asis-invita" hidden><button type="button" class="asis-invita-x" aria-label="Cerrar">×</button>
      <span>Amiga, ¿te cuento cómo llenar tu agenda mientras duermes? 💅</span></div>
    <button type="button" class="asis-lanzar" aria-expanded="false" aria-controls="asis-panel">
      <span class="asis-logo">${LOGO}</span><span class="asis-lanzar-txt">¿Preguntas? Habla con Lalan</span><i class="asis-punto" hidden></i>
    </button>
    <section class="asis-panel" id="asis-panel" role="dialog" aria-label="Habla con Lalan" hidden>
      <header class="asis-cab">
        <span class="asis-logo">${LOGO}</span>
        <span class="asis-cab-txt"><b>Lalan</b><small><i></i> en línea · te contesto al momento</small></span>
        <button type="button" class="asis-voz-modo" aria-pressed="true" title="Apagar la voz" hidden>🔊</button>
        <button type="button" class="asis-cerrar" aria-label="Cerrar">×</button>
      </header>
      <div class="asis-mensajes" aria-live="polite"></div>
      <div class="asis-sugerencias"></div>
      <form class="asis-form">
        <input class="asis-entrada" type="text" maxlength="600" autocomplete="off" placeholder="Escríbeme aquí…" aria-label="Tu pregunta">
        <button type="submit" class="asis-enviar" aria-label="Enviar"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 11.5 21 3l-8.5 18-2-7.5z" fill="currentColor"/></svg></button>
      </form>
      <p class="asis-nota">¿Prefieres hablar con alguien del equipo? <a href="https://wa.me/${WHATSAPP}" target="_blank" rel="noopener">WhatsApp</a></p>
    </section>`;
  document.body.appendChild(raiz);

  const $ = <T extends HTMLElement>(s: string) => raiz.querySelector(s) as T;
  const panel = $<HTMLElement>('.asis-panel');
  const lanzar = $<HTMLButtonElement>('.asis-lanzar');
  const lista = $<HTMLDivElement>('.asis-mensajes');
  const sugerencias = $<HTMLDivElement>('.asis-sugerencias');
  const form = $<HTMLFormElement>('.asis-form');
  const entrada = $<HTMLInputElement>('.asis-entrada');
  const invita = $<HTMLDivElement>('.asis-invita');
  const punto = $<HTMLElement>('.asis-punto');
  let ocupado = false;
  const modoVoz = $<HTMLButtonElement>('.asis-voz-modo');
  let audio: HTMLAudioElement | null = null;
  let sonando: HTMLButtonElement | null = null;
  let voz: ConfigVoz = { motor: 'apagada', voces: [], velocidad: 1 };
  let vozCargada: Promise<void> | null = null;
  /** El mensaje de cada burbuja (para ponerle el botón cuando llegue la configuración) */
  const deBurbuja = new WeakMap<HTMLElement, Mensaje>();
  const llevaVoz = (m: Mensaje) => m.rol === 'lalan' && (voz.motor === 'navegador' ? hayVozNavegador() : voz.motor === 'nube' && !!m.voz);

  const pintarModoVoz = () => { modoVoz.hidden = !estado.hablando || voz.motor === 'apagada'; };
  const callar = () => {
    audio?.pause(); audio = null;
    if (hayVozNavegador()) speechSynthesis.cancel();
    sonando?.classList.remove('asis-sonando'); sonando = null;
  };
  /** Celeste dice la respuesta; si no queda voz, el botón se va y se sigue leyendo */
  const decir = async (m: Mensaje, boton: HTMLButtonElement) => {
    if (sonando === boton) { callar(); return; }
    callar();
    sonando = boton; boton.classList.add('asis-sonando', 'asis-cargando');
    try {
      if (voz.motor === 'navegador') {
        boton.classList.remove('asis-cargando');
        const terminada = decirConNavegador(m.texto, voz.voces, voz.velocidad);
        if (!estado.hablando) { estado.hablando = true; guardar(estado); pintarModoVoz(); }
        registrar({ tipo: 'clic', seccion: 'asistente', detalle: 'voz_navegador' });
        await terminada;
        if (sonando === boton) callar();
        return;
      }
      const r = await fetch(`${API}/public/landing/voz`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversacionId: estado.id, texto: m.texto }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const url = URL.createObjectURL(await r.blob());
      if (sonando !== boton) { URL.revokeObjectURL(url); return; }
      audio = new Audio(url);
      audio.playbackRate = voz.velocidad;
      audio.addEventListener('ended', () => { URL.revokeObjectURL(url); if (sonando === boton) callar(); });
      await audio.play();
      if (!estado.hablando) { estado.hablando = true; guardar(estado); pintarModoVoz(); }
      registrar({ tipo: 'clic', seccion: 'asistente', detalle: 'voz' });
    } catch {
      if (sonando === boton) callar();
      // Sin voz (tope o fallo): se apaga para esta respuesta y la conversación sigue por escrito
      m.voz = false; guardar(estado); boton.remove();
    } finally {
      boton.classList.remove('asis-cargando');
    }
  };
  modoVoz.addEventListener('click', () => { estado.hablando = false; guardar(estado); callar(); pintarModoVoz(); });

  const burbuja = (m: Mensaje, animar = true) => {
    const b = document.createElement('div');
    b.className = `asis-b asis-${m.rol}${animar ? ' asis-entra' : ''}`;
    b.innerHTML = formatear(m.texto);
    deBurbuja.set(b, m);
    const boton = ponerBoton(b, m);
    lista.appendChild(b);
    lista.scrollTop = lista.scrollHeight;
    return boton;
  };
  const ponerBoton = (b: HTMLElement, m: Mensaje): HTMLButtonElement | null => {
    let boton: HTMLButtonElement | null = null;
    if (llevaVoz(m) && !b.querySelector('.asis-oir')) {
      boton = document.createElement('button');
      boton.type = 'button'; boton.className = 'asis-oir'; boton.setAttribute('aria-label', 'Escúchala');
      boton.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" fill="currentColor"/></svg><span>Escúchala</span>';
      const bt = boton;
      bt.addEventListener('click', () => void decir(m, bt));
      b.appendChild(bt);
    }
    return boton;
  };
  /** Lo que eligió Plataforma (una vez por visita); luego se ponen los botones que falten */
  const cargarVoz = () => {
    vozCargada ??= fetch(`${API}/public/landing/voz`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c: ConfigVoz | null) => {
        if (c && ['apagada', 'navegador', 'nube'].includes(c.motor)) voz = { motor: c.motor, voces: c.voces ?? [], velocidad: Number(c.velocidad) || 1 };
        if (voz.motor === 'apagada' && estado.hablando) { estado.hablando = false; guardar(estado); }
        pintarModoVoz();
        lista.querySelectorAll<HTMLElement>('.asis-b').forEach((b) => { const m = deBurbuja.get(b); if (m) ponerBoton(b, m); });
      })
      .catch(() => undefined);
    return vozCargada;
  };
  const pintarSugerencias = () => {
    sugerencias.innerHTML = '';
    if (estado.mensajes.some((m) => m.rol === 'persona')) return;
    SUGERENCIAS.forEach((s) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = s;
      b.addEventListener('click', () => void preguntar(s));
      sugerencias.appendChild(b);
    });
  };

  const abrir = () => {
    panel.hidden = false; raiz.classList.add('asis-abierta');
    lanzar.setAttribute('aria-expanded', 'true'); invita.hidden = true; punto.hidden = true;
    if (!lista.childElementCount) {
      burbuja({ rol: 'lalan', texto: SALUDO }, true);
      estado.mensajes.forEach((m) => burbuja(m, false));
      pintarSugerencias();
    }
    pintarModoVoz();
    void cargarVoz();
    if (window.matchMedia('(pointer: fine)').matches) entrada.focus();
    registrar({ tipo: 'clic', seccion: 'asistente', detalle: 'abrir' });
  };
  const cerrar = () => { callar(); panel.hidden = true; raiz.classList.remove('asis-abierta'); lanzar.setAttribute('aria-expanded', 'false'); };

  lanzar.addEventListener('click', () => (panel.hidden ? abrir() : cerrar()));
  $<HTMLButtonElement>('.asis-cerrar').addEventListener('click', cerrar);
  invita.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('.asis-invita-x')) { invita.hidden = true; return; } abrir(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) cerrar(); });

  // Una invitación suave, una sola vez por pestaña, si no ha abierto la ventanita
  if (!estado.invitado) {
    setTimeout(() => {
      if (!panel.hidden) return;
      invita.hidden = false; estado.invitado = true; guardar(estado);
    }, INVITACION_MS);
  }

  /** En el teléfono la ventanita tapa la página: se esconde para que vea a dónde la llevamos */
  const dejarVer = () => {
    if (window.matchMedia('(max-width: 640px)').matches) { cerrar(); punto.hidden = false; }
  };

  const llenar = (id: string, valor?: string) => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (el && valor && !el.value) { el.value = valor; el.dispatchEvent(new Event('input', { bubbles: true })); }
  };

  const ejecutar = (a: Accion) => {
    if (a.tipo === 'ir') {
      document.getElementById(a.seccion)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      dejarVer();
      return;
    }
    const d = a.datos ?? {};
    const destino = a.cual === 'piloto' ? 'piloto' : 'otro-negocio';
    if (a.cual === 'piloto') {
      llenar('p-nombre', d.nombre); llenar('p-salon', d.negocio); llenar('p-telefono', d.telefono);
      llenar('p-ciudad', d.ciudad); llenar('p-mensaje', d.detalle);
    } else {
      llenar('o-telefono', d.telefono); llenar('o-negocio', d.negocio); llenar('o-detalle', d.detalle);
    }
    const seccion = document.getElementById(destino);
    seccion?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const formulario = document.getElementById(a.cual === 'piloto' ? 'form-piloto' : 'form-otro');
    formulario?.classList.add('asis-resaltado');
    setTimeout(() => formulario?.classList.remove('asis-resaltado'), 2600);
    // El primer campo obligatorio que falta, listo para escribir
    const falta = formulario?.querySelector<HTMLInputElement>('input[required]:not([type=checkbox]):placeholder-shown, input[required]:not([type=checkbox])[value=""]');
    setTimeout(() => falta?.focus({ preventScroll: true }), 700);
    registrar({ tipo: 'clic', seccion: 'asistente', detalle: `formulario_${a.cual}` });
    dejarVer();
  };

  async function preguntar(texto: string) {
    texto = texto.trim();
    if (!texto || ocupado) return;
    ocupado = true; entrada.value = ''; sugerencias.innerHTML = '';
    const m: Mensaje = { rol: 'persona', texto };
    estado.mensajes.push(m); guardar(estado); burbuja(m);
    const escribiendo = document.createElement('div');
    escribiendo.className = 'asis-b asis-lalan asis-escribiendo'; escribiendo.innerHTML = '<i></i><i></i><i></i>';
    lista.appendChild(escribiendo); lista.scrollTop = lista.scrollHeight;
    try {
      const r = await fetch(`${API}/public/landing/asistente`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversacionId: estado.id, visitaId: visitaActual() ?? undefined, mensajes: estado.mensajes.slice(-MENSAJES_AL_SERVIDOR).map(({ rol, texto }) => ({ rol, texto })) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.message || 'No pude responder ahora.');
      escribiendo.remove();
      const resp: Mensaje = { rol: 'lalan', texto: String(d.texto || ''), ...(d.voz ? { voz: true } : {}) };
      estado.mensajes.push(resp); guardar(estado);
      const oir = burbuja(resp);
      // Ya pidió oírla antes: la respuesta nueva suena sola
      if (oir && estado.hablando) void decir(resp, oir);
      // Primero se lee la respuesta, luego se mueve la página (en el teléfono la ventanita tapa todo: más tiempo para leer)
      const espera = window.matchMedia('(max-width: 640px)').matches ? ESPERA_LECTURA_MOVIL_MS : ESPERA_LECTURA_MS;
      (d.acciones as Accion[] | undefined)?.forEach((a, i) => setTimeout(() => ejecutar(a), espera + i * 300));
    } catch (e) {
      escribiendo.remove();
      const msg = (e as Error).message || '';
      burbuja({ rol: 'lalan', texto: r429(msg) ? 'Ay, ve más despacito que me mareas 😅 Dame un segundito y vuelve a escribirme.'
        : msg.includes('WhatsApp') ? msg : 'Ay, se me fue la señal 😅 Escríbele al equipo por WhatsApp al 809-229-9444 y te atienden enseguida 💕' });
    } finally {
      ocupado = false;
    }
  }
  const r429 = (m: string) => /too many|demasiad/i.test(m);

  form.addEventListener('submit', (e) => { e.preventDefault(); void preguntar(entrada.value); });
}
