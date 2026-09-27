/**
 * Medición anónima de la landing.
 *
 * Sin cookies y sin guardar la IP: el servidor solo recibe qué se vio y
 * dónde se tocó. Los eventos se juntan y salen en tandas; el último envío va
 * con sendBeacon al cerrar la pestaña (como texto plano, así el navegador no
 * necesita pedir permiso de CORS en ese momento).
 */
import { API, MODO_CALOR } from './api';

export type TipoEvento =
  | 'seccion' | 'clic' | 'historia_inicio' | 'historia_sonido' | 'historia_final' | 'historia_pantalla_completa'
  | 'historia_repetir' | 'piloto_abierto' | 'piloto_enviado' | 'entrar' | 'whatsapp';

interface Evento { tipo: TipoEvento; seccion?: string; x?: number; y?: number; detalle?: string }

const CADA_MS = 8000;
const UMBRAL_SECCION = 0.35;
const LARGO_DETALLE = 60;

let visitaId: string | null = null;
const cola: Evento[] = [];
let visibleDesde = document.visibilityState === 'visible' ? performance.now() : 0;
let acumuladoMs = 0;
let scrollMax = 0;
let ultimoEnvio = { dur: -1, scroll: -1 };

export function visitaActual(): string | null { return visitaId; }

export function registrar(e: Evento): void {
  if (MODO_CALOR) return;
  cola.push(e);
}

function sesion(): string {
  const nueva = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now());
  try {
    let s = sessionStorage.getItem('lalan_sesion');
    if (!s) { s = nueva(); sessionStorage.setItem('lalan_sesion', s); }
    return s;
  } catch { return nueva(); }
}

function duracionSeg(): number {
  const ahora = document.visibilityState === 'visible' && visibleDesde ? performance.now() - visibleDesde : 0;
  return Math.round((acumuladoMs + ahora) / 1000);
}

function carga() {
  const dur = duracionSeg();
  const eventos = cola.splice(0, 60);
  if (!eventos.length && dur === ultimoEnvio.dur && scrollMax === ultimoEnvio.scroll) return null;
  ultimoEnvio = { dur, scroll: scrollMax };
  return JSON.stringify({ visitaId, duracionSeg: dur, scrollMax, eventos });
}

function enviar(alCerrar = false) {
  if (!visitaId) return;
  const cuerpo = carga();
  if (!cuerpo) return;
  const url = `${API}/public/landing/eventos`;
  if (alCerrar && navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([cuerpo], { type: 'text/plain' }));
    return;
  }
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: cuerpo, keepalive: true }).catch(() => {});
}

function seccionDe(el: Element | null): Element | null {
  return el ? el.closest('section[id], header.barra, footer#pie') : null;
}
export function idDeSeccion(el: Element): string {
  if (el.matches('header.barra')) return 'barra';
  return el.id || 'otra';
}

function escuchar() {
  // Tiempo con la página a la vista
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (visibleDesde) acumuladoMs += performance.now() - visibleDesde;
      visibleDesde = 0;
      enviar(true);
    } else {
      visibleDesde = performance.now();
    }
  });
  window.addEventListener('pagehide', () => enviar(true));

  // Hasta dónde baja
  const medirScroll = () => {
    const alto = document.documentElement.scrollHeight;
    const p = Math.min(100, Math.round(((window.scrollY + window.innerHeight) / alto) * 100));
    if (p > scrollMax) scrollMax = p;
  };
  window.addEventListener('scroll', medirScroll, { passive: true });
  medirScroll();

  // Qué secciones vio (una vez cada una)
  if ('IntersectionObserver' in window) {
    const vistas = new Set<string>();
    const obs = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        const id = idDeSeccion(e.target);
        if (vistas.has(id)) return;
        vistas.add(id);
        registrar({ tipo: 'seccion', seccion: id });
      });
    }, { threshold: UMBRAL_SECCION });
    document.querySelectorAll('main section[id]').forEach((s) => obs.observe(s));
  }

  // Dónde toca (para el mapa de calor) y qué botón
  document.addEventListener('click', (ev) => {
    const destino = ev.target as Element | null;
    const sec = seccionDe(destino);
    if (!sec) return;
    const r = sec.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width;
    const y = (ev.clientY - r.top) / r.height;
    const control = destino?.closest('a, button, label, summary');
    const texto = control ? (control.getAttribute('aria-label') || control.textContent || '').trim().replace(/\s+/g, ' ').slice(0, LARGO_DETALLE) : undefined;
    registrar({ tipo: 'clic', seccion: idDeSeccion(sec), x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)), detalle: texto || undefined });
    const href = control?.getAttribute('href') || '';
    if (/wa\.me|whatsapp/i.test(href)) registrar({ tipo: 'whatsapp', seccion: idDeSeccion(sec) });
    if (href.startsWith('/app')) registrar({ tipo: 'entrar', seccion: idDeSeccion(sec) });
  }, { capture: true });

  // La historia avisa cuando empieza, termina, suena…
  const tipos: Record<string, TipoEvento> = {
    inicio: 'historia_inicio', final: 'historia_final', sonido: 'historia_sonido',
    pantalla_completa: 'historia_pantalla_completa', repetir: 'historia_repetir',
  };
  document.getElementById('historia-escena')?.addEventListener('historia', (e) => {
    const t = tipos[(e as CustomEvent<string>).detail];
    if (t) registrar({ tipo: t, seccion: 'historia' });
  });

  setInterval(() => enviar(false), CADA_MS);
}

export async function iniciarMedicion(): Promise<void> {
  if (MODO_CALOR || (navigator as Navigator & { webdriver?: boolean }).webdriver) return;
  const q = new URLSearchParams(location.search);
  try {
    const r = await fetch(`${API}/public/landing/visita`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sesion: sesion(),
        ruta: location.pathname.slice(0, 200),
        referente: document.referrer || undefined,
        utmSource: q.get('utm_source') || undefined,
        utmMedium: q.get('utm_medium') || undefined,
        utmCampaign: q.get('utm_campaign') || undefined,
        idioma: navigator.language?.slice(0, 16),
        ancho: Math.round(window.innerWidth),
      }),
    });
    if (!r.ok) return;
    visitaId = ((await r.json()) as { visitaId: string | null }).visitaId;
  } catch {
    return;
  }
  if (visitaId) escuchar();
}
