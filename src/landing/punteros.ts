/**
 * Punteros que traen las cosas: al bajar, los cuatro cuadros de «Un día
 * cualquiera» llegan al mismo tiempo arrastrados por un puntero de ratón cada
 * uno, y el teléfono de WhatsApp entra desde fuera de la página con el suyo.
 * Cuando los botones de ejemplo se ven, saltan, llaman con un halo y un puntero
 * llega a tocar uno, para que se note que se pueden tocar. Se reproduce una sola vez.
 *
 * Con «reducir movimiento», sin IntersectionObserver o si ya está en pantalla
 * al cargar, todo se ve quieto en su sitio.
 */

const FLECHA =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 2.5 19.5 14l-6.7.9 3.9 7.4-3.1 1.6-3.9-7.5L5 21.3Z"/></svg>';

function puntero(): HTMLSpanElement {
  const p = document.createElement('span');
  p.className = 'puntero agarra';
  p.setAttribute('aria-hidden', 'true');
  p.innerHTML = FLECHA;
  return p;
}

const esperar = (a: Animation) => a.finished.catch(() => undefined);

/** El puntero suelta (un clic), se aparta y se va */
async function soltar(p: HTMLElement, dx = 34, dy = 46): Promise<void> {
  p.classList.remove('agarra');
  await esperar(p.animate([{ scale: '0.86' }, { scale: '1' }], { duration: 160, easing: 'ease-out' }));
  await esperar(
    p.animate([{ translate: '0 0', opacity: 1 }, { translate: `${dx}px ${dy}px`, opacity: 0 }], {
      duration: 520, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards',
    }),
  );
  p.remove();
}

/** Lleva el elemento desde (x, y, giro) hasta su sitio con un arco y un pequeño asiento */
function traer(el: HTMLElement, x: number, y: number, giro: number, ms: number): Animation {
  return el.animate(
    [
      { transform: `translate(${x}px, ${y}px) rotate(${giro}deg)` },
      { transform: `translate(${x * 0.3}px, ${y * 0.25 - 26}px) rotate(${giro * 0.35}deg)`, offset: 0.6 },
      { transform: 'translate(0, -8px) rotate(0deg)', offset: 0.88 },
      { transform: 'none' },
    ],
    { duration: ms, easing: 'cubic-bezier(.25,.6,.2,1)' },
  );
}

async function arrastrarDia(dia: HTMLElement): Promise<void> {
  const tarjetas = Array.from(dia.children) as HTMLElement[];
  const caja = dia.getBoundingClientRect();
  const centro = caja.left + caja.width / 2;
  dia.classList.remove('por-arrastrar');
  dia.classList.add('arrastrando');
  const vuelos = tarjetas.map(async (t, i) => {
    const r = t.getBoundingClientRect();
    const lado = r.left + r.width / 2 < centro ? -1 : 1;
    // Desde fuera del lado que le toca; las de arriba bajan, las de abajo suben
    const x = lado * (window.innerWidth * 0.55) + (r.left + r.width / 2 - centro) * 0.6;
    const y = (i % 2 ? 1 : -1) * (120 + i * 30);
    const p = puntero();
    t.append(p);
    t.classList.add('en-vuelo');
    await esperar(traer(t, x, y, lado * 7, 1500));
    t.classList.remove('en-vuelo');
    await soltar(p, lado * 30, 50);
  });
  await Promise.all(vuelos);
  dia.classList.remove('arrastrando');
}

async function arrastrarTelefono(caja: HTMLElement): Promise<void> {
  const tel = caja.querySelector<HTMLElement>('.telefono');
  const botones = caja.querySelector<HTMLElement>('.escenarios');
  if (!tel) return;
  const r = tel.getBoundingClientRect();
  // Entra desde fuera de la página, por la derecha
  const x = window.innerWidth - r.left + 40;
  const p = puntero();
  p.classList.add('en-telefono');
  tel.append(p);
  caja.classList.add('sin-botones');
  caja.classList.remove('por-arrastrar');
  await esperar(traer(tel, x, -90, 9, 1600));

  // Suelta y se va; los botones de ejemplo se invitan cuando estén a la vista
  await soltar(p, 40, -30);
  caja.classList.remove('sin-botones');
  if (botones) cuandoSeVea(botones, () => void invitarBotones(caja, botones));
}

function cuandoSeVea(el: HTMLElement, hacer: () => void): void {
  const obs = new IntersectionObserver((es) => {
    if (!es[0].isIntersecting) return;
    obs.disconnect();
    hacer();
  }, { threshold: 0.9 });
  obs.observe(el);
}

/** Los botones saltan y llaman; un puntero llega de lado y toca uno (sin elegirlo) */
async function invitarBotones(caja: HTMLElement, botones: HTMLElement): Promise<void> {
  botones.classList.add('invita');
  botones.addEventListener('click', () => botones.classList.remove('invita'), { once: true });
  window.setTimeout(() => botones.classList.remove('invita'), 12000);
  const objetivo = botones.querySelector<HTMLElement>('button:not([aria-pressed="true"])');
  if (!objetivo) return;
  const base = caja.getBoundingClientRect();
  const a = objetivo.getBoundingClientRect();
  const p = puntero();
  p.classList.remove('agarra');
  caja.append(p);
  const x = a.left - base.left + a.width * 0.55;
  const y = a.top - base.top + a.height * 0.5;
  p.style.left = `${x}px`;
  p.style.top = `${y}px`;
  await new Promise((ok) => window.setTimeout(ok, 500));
  await esperar(p.animate([{ translate: '160px 90px', opacity: 0 }, { translate: '0 0', opacity: 1 }], {
    duration: 900, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'backwards',
  }));
  objetivo.classList.add('toque-falso');
  await esperar(p.animate([{ scale: '1' }, { scale: '0.82' }, { scale: '1' }], { duration: 280 }));
  window.setTimeout(() => objetivo.classList.remove('toque-falso'), 500);
  await soltar(p, 30, 50);
}

export function iniciarPunteros(): void {
  const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (quieto || !('IntersectionObserver' in window) || !('animate' in Element.prototype)) return;
  if (/[?&]calor=/.test(location.search)) return;
  document.querySelectorAll<HTMLElement>('[data-arrastre]').forEach((el) => {
    // Lo que ya se ve al cargar se queda quieto: no parpadea
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    el.classList.add('por-arrastrar');
    const obs = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return;
      obs.disconnect();
      if (el.dataset.arrastre === 'dia') void arrastrarDia(el);
      else void arrastrarTelefono(el);
    }, { threshold: 0.3 });
    obs.observe(el);
  });
}
