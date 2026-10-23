/**
 * La ventanita de preguntas de la landing: Lalan contesta sobre Lalan,
 * lleva a la sección que hace falta y deja el formulario de la prueba gratis (o el
 * de otro negocio) lleno con lo que la persona contó. La persona siempre
 * revisa y envía ella: la asistente nunca envía nada.
 *
 * La conversación vive en sessionStorage (sobrevive a recargar la pestaña).
 *
 * La voz: un "Escúchala" en cada respuesta. Cómo suena lo elige el super
 * admin en Plataforma → Lalan: apagada, la del navegador (gratis) o la del
 * servidor (MeloTTS / Aura-2, con topes: solo las respuestas que el servidor
 * marca). Si la persona la usa una vez, las siguientes respuestas suenan
 * solas hasta que la apague en la cabecera.
 *
 * También se le puede hablar (el micrófono, si Plataforma lo deja): lo dicho
 * se pinta al instante, Lalan contesta en voz alta y vuelve a escuchar, como
 * la Lalan de la app. Mientras habla se le puede hablar encima: se pausa y,
 * si no le dijeron nada, sigue.
 */
import { API, MODO_CALOR } from './api';
import { registrar, visitaActual } from './medicion';
import { hayVozNavegador } from './vozNavegador';
import { abrirOtroNegocio } from './otroNegocio';
import { escucharFrase, hayMicrofono, type Escucha } from './microfono';
import { crearVoz, type ConfigVoz as VozDeLaPagina } from './vozLanding';
import { SOLO_ASENTIR, vigilarInterrupcion, type Interrupcion } from '../utils/interrupcion';

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
const SALUDO = '¡Holiii! 💕 Soy Lalan. Pregúntame lo que quieras: cómo te atiendo el WhatsApp del salón, la prueba gratis, todo. Cuéntame, ¿tienes tu propio salón? ✨';
const SUGERENCIAS = ['¿Qué haces por mi salón?', '¿Cuánto cuesta?', '¿Cómo es la prueba gratis?', 'No tengo salón, tengo otro negocio'];

interface ConfigVoz extends VozDeLaPagina {
  activa?: boolean;
  /** El micrófono y cómo se interrumpe a Lalan hablando (Plataforma → Lalan) */
  escucha?: boolean; interrumpir?: boolean; vozParaPausarMs?: number; retomarTrasMs?: number; sensibilidadInterrupcion?: number;
}
/** Silencio que da la frase por terminada cuando le hablan */
const ESPERA_FRASE_MS = 1600;
/** Sin decir nada: al tocar el micrófono / cuando se abre solo después de que Lalan habla */
const SIN_VOZ_MS = 9000;
const SIN_VOZ_SOLA_MS = 7000;
const MAXIMO_FRASE_MS = 45_000;
const ICONO_MIC = '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z" fill="currentColor"/></svg>';

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
      <div class="asis-oyendo-barra" role="status" hidden>
        <span><i></i> Te escucho…</span>
        <button type="button" class="asis-dejar">Dejar de escucharme</button>
      </div>
      <form class="asis-form">
        <input class="asis-entrada" type="text" maxlength="600" autocomplete="off" placeholder="Escríbeme aquí…" aria-label="Tu pregunta">
        <button type="button" class="asis-mic" aria-label="Háblale a Lalan" title="Háblale" hidden>${ICONO_MIC}</button>
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
  const mic = $<HTMLButtonElement>('.asis-mic');
  const barraOyendo = $<HTMLDivElement>('.asis-oyendo-barra');
  let sonando: HTMLButtonElement | null = null;
  let voz: ConfigVoz = { motor: 'apagada', voces: [], velocidad: 1 };
  let vozCargada: Promise<void> | null = null;
  /** El mensaje de cada burbuja (para ponerle el botón cuando llegue la configuración) */
  const deBurbuja = new WeakMap<HTMLElement, Mensaje>();
  const llevaVoz = (m: Mensaje) => m.rol === 'lalan' && (voz.motor === 'navegador' ? hayVozNavegador() : voz.motor === 'nube' && !!m.voz);
  const hablante = crearVoz(() => estado.id);
  /** Cada vez que Lalan empieza a decir algo: lo de una vez anterior ya no decide nada */
  let turnoDecir = 0;
  /** La charla va por voz: Lalan contesta hablando y vuelve a escuchar */
  let porVoz = false;
  let escucha: Escucha | null = null;
  let abriendoMic = false;
  let oido: Interrupcion | null = null;
  let ctx: AudioContext | null = null;
  /** El contexto de audio se crea en un toque (el iPhone no deja de otra forma) */
  const contexto = (): AudioContext | null => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      if (!ctx || ctx.state === 'closed') ctx = new Ctx();
      void ctx.resume().catch(() => undefined);
      return ctx;
    } catch { return null; }
  };

  const pintarModoVoz = () => { modoVoz.hidden = !estado.hablando || voz.motor === 'apagada'; };
  const pintarMic = () => { mic.hidden = !voz.escucha || !hayMicrofono(); };
  const ponerEscuchando = (si: boolean) => {
    raiz.classList.toggle('asis-oyendo', si);
    barraOyendo.hidden = !si;
    mic.setAttribute('aria-label', si ? 'Ya terminé' : 'Háblale a Lalan');
    mic.title = si ? 'Ya terminé' : 'Háblale';
    if (!si) mic.style.removeProperty('--nivel');
  };
  const soltarOido = () => { oido?.soltar(); oido = null; };
  const callar = () => {
    turnoDecir++;
    soltarOido();
    hablante.callar();
    sonando?.classList.remove('asis-sonando', 'asis-cargando'); sonando = null;
  };
  /** Un aviso corto de Lalan (no se guarda en la conversación) */
  const aviso = (texto: string) => { burbuja({ rol: 'lalan', texto }); };

  /**
   * Mientras Lalan habla (y la charla va por voz) el micrófono queda atento:
   * si le hablan encima se pausa; si no le dijeron nada, sigue.
   */
  const armarOido = (mio: number) => {
    soltarOido();
    const c = ctx;
    if (!porVoz || voz.interrumpir === false || !c || panel.hidden) return;
    void vigilarInterrupcion({
      ajustes: { vozParaPausarMs: voz.vozParaPausarMs ?? 300, retomarTrasMs: voz.retomarTrasMs ?? 1200, sensibilidad: voz.sensibilidadInterrupcion ?? 3, esperaMs: ESPERA_FRASE_MS },
      contexto: c,
      suena: hablante.suena,
      pausar: () => { hablante.pausar(); ponerEscuchando(true); },
      seguir: () => { hablante.seguir(); ponerEscuchando(false); },
      tomarTurno: () => undefined,
      alTerminar: (audio) => { oido = null; ponerEscuchando(false); void preguntarConVoz(audio, true); },
      alNivel: (v) => mic.style.setProperty('--nivel', v.toFixed(2)),
    }).then((o) => {
      if (o && mio !== turnoDecir) { o.soltar(); return; }
      oido = o;
    });
  };

  /** Lalan dice la respuesta frase por frase; si no queda voz, el botón se va y se sigue leyendo */
  const decir = async (m: Mensaje, boton: HTMLButtonElement) => {
    if (sonando === boton) { callar(); return; }
    callar();
    const mio = ++turnoDecir;
    sonando = boton; boton.classList.add('asis-sonando');
    if (voz.motor === 'nube') boton.classList.add('asis-cargando');
    // "Cargando" hasta que de verdad suena
    const suena = window.setInterval(() => { if (hablante.suena()) { boton.classList.remove('asis-cargando'); window.clearInterval(suena); } }, 120);
    if (!estado.hablando) { estado.hablando = true; guardar(estado); pintarModoVoz(); }
    registrar({ tipo: 'clic', seccion: 'asistente', detalle: voz.motor === 'navegador' ? 'voz_navegador' : 'voz' });
    armarOido(mio);
    try {
      await hablante.decir(m.texto, voz);
    } catch {
      if (mio !== turnoDecir) return;
      callar();
      // Sin voz (tope o fallo): se apaga para esta respuesta y la conversación sigue por escrito
      m.voz = false; guardar(estado); boton.remove();
      return;
    } finally {
      window.clearInterval(suena);
      boton.classList.remove('asis-cargando');
    }
    // Ya dijo otra cosa, o le tomaron la palabra: esto ya no decide nada
    if (mio !== turnoDecir || oido?.enTurno()) return;
    soltarOido();
    if (sonando === boton) { boton.classList.remove('asis-sonando'); sonando = null; }
    // Le venía hablando: ahora le toca a ella (como en la app)
    if (porVoz && !panel.hidden) void escuchar(true);
  };

  /** Abre el micrófono. `sola` = lo abre la página después de que Lalan habla (si no dice nada, se cierra sin quejarse) */
  const escuchar = async (sola = false) => {
    if (escucha || abriendoMic || ocupado) return;
    callar();
    const c = contexto();
    if (!c) { aviso('Este navegador no me deja oírte. Escríbeme aquí 💕'); return; }
    porVoz = true;
    abriendoMic = true;
    ponerEscuchando(true);
    escucha = await escucharFrase({
      contexto: c, esperaMs: ESPERA_FRASE_MS, sinVozMs: sola ? SIN_VOZ_SOLA_MS : SIN_VOZ_MS, maximoMs: MAXIMO_FRASE_MS,
      alNivel: (v) => mic.style.setProperty('--nivel', v.toFixed(2)),
      alTerminar: (audio) => {
        escucha = null;
        ponerEscuchando(false);
        if (audio) void preguntarConVoz(audio);
        else if (!sola) aviso('No te escuché 🙈 Toca el micrófono y háblame, o escríbeme aquí.');
      },
      alFallar: (motivo) => { porVoz = false; ponerEscuchando(false); aviso(motivo); },
    });
    abriendoMic = false;
    registrar({ tipo: 'clic', seccion: 'asistente', detalle: sola ? 'escucha_sola' : 'microfono' });
  };

  /** Soltar el micrófono sin cerrar la ventanita: no se vuelve a abrir solo hasta que toque el micrófono */
  const dejarDeEscuchar = () => {
    porVoz = false;
    const e = escucha; escucha = null;
    e?.terminar(false);
    if (oido) callar();
    ponerEscuchando(false);
  };

  /**
   * Lo que dijo: su burbuja sale de una vez (con puntitos mientras se pasa a
   * texto) y luego se pregunta como si lo hubiera escrito. `interrumpio`: lo
   * dijo encima de Lalan, que sigue en pausa; si no era nada, ella sigue.
   */
  const preguntarConVoz = async (audio: Blob, interrumpio = false) => {
    const pendiente = document.createElement('div');
    pendiente.className = 'asis-b asis-persona asis-entra asis-pasando';
    pendiente.innerHTML = '<span class="asis-puntos" aria-label="Pasando tu voz a texto"><i></i><i></i><i></i></span>';
    lista.appendChild(pendiente); lista.scrollTop = lista.scrollHeight;
    const f = new FormData();
    const ext = audio.type.includes('webm') ? 'webm' : audio.type.includes('ogg') ? 'ogg' : 'm4a';
    f.append('audio', audio, `pregunta.${ext}`);
    try {
      const r = await fetch(`${API}/public/landing/escuchar`, { method: 'POST', body: f });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.message || 'No pude oírte bien ahora. Escríbeme 💕');
      const texto = String(d.texto ?? '').trim();
      if (interrumpio && (!texto || SOLO_ASENTIR.test(texto))) {
        pendiente.remove();
        hablante.seguir();
        armarOido(turnoDecir);
        return;
      }
      if (interrumpio) callar();
      if (!texto) { pendiente.remove(); aviso('No te escuché bien 🙈 Toca el micrófono y háblame otra vez, o escríbeme.'); return; }
      void preguntar(texto, pendiente);
    } catch (e) {
      pendiente.remove();
      if (interrumpio) callar();
      aviso(r429((e as Error).message) ? 'Ay, ve más despacito que me mareas 😅 Dame un segundito.' : (e as Error).message || 'No pude oírte bien ahora. Escríbeme 💕');
    }
  };
  modoVoz.addEventListener('click', () => { estado.hablando = false; porVoz = false; guardar(estado); callar(); pintarModoVoz(); });
  mic.addEventListener('click', () => {
    // Escuchando: tocarlo es "ya terminé"
    if (escucha) { escucha.terminar(true); return; }
    hablante.despertar(voz);
    void escuchar();
  });
  $<HTMLButtonElement>('.asis-dejar').addEventListener('click', dejarDeEscuchar);

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
        // Apagada desde Plataforma: ni el botón se muestra
        if (c?.activa === false) { callar(); raiz.remove(); return; }
        if (c && ['apagada', 'navegador', 'nube'].includes(c.motor)) {
          voz = {
            motor: c.motor, voces: c.voces ?? [], velocidad: Number(c.velocidad) || 1, pronuncia: c.pronuncia,
            escucha: c.escucha === true, interrumpir: c.interrumpir !== false,
            vozParaPausarMs: Number(c.vozParaPausarMs) || undefined, retomarTrasMs: Number(c.retomarTrasMs) || undefined,
            sensibilidadInterrupcion: Number(c.sensibilidadInterrupcion) || undefined,
          };
        }
        if (voz.motor === 'apagada' && estado.hablando) { estado.hablando = false; guardar(estado); }
        pintarModoVoz();
        pintarMic();
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
  const cerrar = () => { dejarDeEscuchar(); callar(); panel.hidden = true; raiz.classList.remove('asis-abierta'); lanzar.setAttribute('aria-expanded', 'false'); };

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
      if (a.seccion === 'otro-negocio') abrirOtroNegocio();
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
      abrirOtroNegocio();
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

  /** `pintada`: su burbuja ya está en pantalla (lo dijo con la voz) */
  async function preguntar(texto: string, pintada?: HTMLElement) {
    texto = texto.trim();
    if (!texto || ocupado) { pintada?.remove(); return; }
    // Escrito: la charla deja de ir por voz (no se abre el micrófono solo)
    if (!pintada) { porVoz = false; dejarDeEscuchar(); callar(); }
    ocupado = true; sugerencias.innerHTML = '';
    if (!pintada) entrada.value = '';
    const m: Mensaje = { rol: 'persona', texto };
    estado.mensajes.push(m); guardar(estado);
    if (pintada) { pintada.classList.remove('asis-pasando'); pintada.innerHTML = formatear(texto); deBurbuja.set(pintada, m); }
    else burbuja(m);
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
      // Le habló con la voz, o ya pidió oírla antes: la respuesta suena sola
      if (oir && (porVoz || estado.hablando)) void decir(resp, oir);
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

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    // Escuchando y sin nada escrito: enviar es "ya terminé"
    if (escucha && !entrada.value.trim()) { escucha.terminar(true); return; }
    void preguntar(entrada.value);
  });
  // Se pregunta de una vez si está encendida y cómo habla (si Plataforma la apagó, el botón desaparece)
  void cargarVoz();
}
