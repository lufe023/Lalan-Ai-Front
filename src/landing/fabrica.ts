/**
 * La cadena de montaje de «Por dentro», en isométrico: el mensaje sale del
 * WhatsApp como una caja que corre por una cinta y para en seis puestos.
 * En cada puesto una ayudante robot de Lalan hace su parte (recibe, agenda,
 * inventario de la sede, especialista, caja y el informe para la dueña).
 *
 * La escena se dibuja aquí en SVG con proyección isométrica. La mueven los
 * mismos botones de ejemplo del teléfono: pagina.js avisa con «lalan:escena».
 * Al verse por primera vez arranca sola y luego pasa al siguiente ejemplo
 * mientras nadie toque un botón. En pantallas angostas la cámara sigue a la
 * caja. Con «reducir movimiento» se ve quieta y terminada.
 */

type Paso = { estacion: string; texto: string; ojo?: boolean };
type Escena = { pedido: string; letra: string; pasos: Paso[] };

const ESCENAS: Record<string, Escena> = {
  noche: {
    pedido: 'Carmen · manicure + masaje, mañana en la tarde',
    letra: 'C',
    pasos: [
      { estacion: 'recibe', texto: 'Nota de voz de Carmen, entendida' },
      { estacion: 'agenda', texto: 'Mañana 2:00 y 2:30 libres' },
      { estacion: 'inventario', texto: 'Esmalte y aceite apartados · Sede Naco' },
      { estacion: 'equipo', texto: 'Valentina a las 2 · Carla a las 2:30' },
      { estacion: 'caja', texto: 'RD$ 2,950 por cobrar · café con leche' },
      { estacion: 'informe', texto: '«2 citas nuevas mientras dormías»' },
    ],
  },
  cambio: {
    pedido: 'Carmen · mover el manicure del martes a hoy',
    letra: 'C',
    pasos: [
      { estacion: 'recibe', texto: 'Carmen no pudo venir el martes' },
      { estacion: 'agenda', texto: 'Martes liberado · hoy 4:00 libre' },
      { estacion: 'inventario', texto: 'Los insumos pasan a hoy · Sede Naco' },
      { estacion: 'equipo', texto: 'Valentina avisada: Carmen a las 4' },
      { estacion: 'caja', texto: 'La misma venta, no se duplica' },
      { estacion: 'informe', texto: '«Cita movida, sin hueco perdido»' },
    ],
  },
  duena: {
    pedido: 'Carmen y su hija · graduación, mañana temprano',
    letra: 'C',
    pasos: [
      { estacion: 'recibe', texto: 'Nota de voz: son 2 personas' },
      { estacion: 'agenda', texto: 'Mañana temprano está llena', ojo: true },
      { estacion: 'informe', texto: '«¿Les abres más temprano?»', ojo: true },
      { estacion: 'agenda', texto: 'Alanny dijo sí: 8:00, antes de abrir' },
      { estacion: 'inventario', texto: 'Peinado y uñas ×2 · Sede Naco' },
      { estacion: 'equipo', texto: 'Alanny y su equipo, a las 8' },
      { estacion: 'caja', texto: '4 servicios listos para cobrar' },
      { estacion: 'informe', texto: '«Graduación de Carmen agendada»' },
    ],
  },
  informe: {
    pedido: 'Alanny · «Lalan, ¿cómo nos fue hoy?»',
    letra: 'A',
    pasos: [
      { estacion: 'recibe', texto: 'Alanny pregunta desde su número' },
      { estacion: 'agenda', texto: '14 atendidas · 11 para mañana' },
      { estacion: 'inventario', texto: 'Poco esmalte rojo en Naco' },
      { estacion: 'equipo', texto: 'Valentina llena desde las 2' },
      { estacion: 'caja', texto: 'RD$ 38,450 entre las 2 sedes' },
      { estacion: 'informe', texto: 'Informe enviado a tu WhatsApp' },
    ],
  },
};
const ORDEN = ['noche', 'cambio', 'duena', 'informe'];
const LINEA = ['recibe', 'agenda', 'inventario', 'equipo', 'caja', 'informe'];
const NOMBRE: Record<string, string> = { recibe: 'Recibe', agenda: 'Agenda', inventario: 'Inventario', equipo: 'Equipo', caja: 'Caja', informe: 'Para ti' };
const ICONO: Record<string, string> = { recibe: '💬', agenda: '📅', inventario: '🧴', equipo: '💅', caja: '🧾', informe: '📲' };

// ── Proyección isométrica ──
const U = 34;
const C = 0.866;
const OX = 96;
const OY = 168;
const ANCHO = 760;
const ALTO = 470;
type P = [number, number];
function iso(x: number, y: number, z: number): P {
  return [(x - y) * U * C + OX, (x + y) * U * 0.5 - z * U + OY];
}
const pts = (l: P[]) => l.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

/** Las tres caras que se ven de un bloque: la de +x (derecha abajo), la de +y (izquierda abajo) y la tapa */
function puntosBloque(x: number, y: number, z: number, w: number, d: number, h: number): string[] {
  return [
    pts([iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)]),
    pts([iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)]),
    pts([iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)]),
  ];
}
function bloque(x: number, y: number, z: number, w: number, d: number, h: number, cls: string): string {
  const [lado, frente, tapa] = puntosBloque(x, y, z, w, d, h);
  return `<g class="${cls}"><polygon class="cara-lado" points="${lado}"/><polygon class="cara-frente" points="${frente}"/><polygon class="cara-tapa" points="${tapa}"/></g>`;
}

const ROBOT = `<line class="r-antena-palo" x1="32" y1="7" x2="32" y2="15"/><circle class="r-antena" cx="32" cy="6" r="3.4"/><g class="r-brazo r-izq"><path d="M18 50 Q9 54 8 62"/><circle cx="8" cy="63" r="3"/></g><g class="r-brazo r-der"><path d="M46 50 Q55 54 56 62"/><circle cx="56" cy="63" r="3"/></g><rect class="r-cuerpo" x="18" y="45" width="28" height="20" rx="8"/><rect class="r-cabeza" x="11" y="14" width="42" height="29" rx="13"/><rect class="r-visor" x="17" y="20" width="30" height="15" rx="7.5"/><g class="r-ojos"><circle cx="26" cy="27.5" r="2.8"/><circle cx="38" cy="27.5" r="2.8"/></g><circle class="r-pecho" cx="32" cy="55" r="3.2"/>`;

const X_PUESTO = (i: number) => 1.6 + i * 3;
const X_INICIO = -1.2;
const X_FIN = 17.6;

function dibujarEscena(): string {
  const partes: string[] = [];
  // El piso: una tarima que hace de diorama
  partes.push(bloque(-3.4, -4.4, -0.35, 22.4, 6, 0.35, 'piso'));
  // Los puestos van detrás de la cinta, de izquierda a derecha
  LINEA.forEach((k, i) => {
    const x = X_PUESTO(i);
    const [nx, ny] = iso(x + 0.1, -2.9, 2.55);
    const [rx, ry] = iso(x + 0.2, -1.65, 0);
    // El panel: la cara que mira a la cinta lleva el ícono
    const [px, py] = iso(x - 0.55, -2.7, 0.85);
    partes.push(`<g class="puesto-iso" data-estacion="${k}">
      ${bloque(x - 1, -3.6, 0, 2, 1.25, 0.85, 'mesa')}
      ${bloque(x - 0.55, -3.0, 0.85, 1.1, 0.3, 1.05, 'panel')}
      <text class="panel-icono" transform="matrix(${C},0.5,0,1,${px.toFixed(1)},${py.toFixed(1)})" x="${(0.55 * U).toFixed(1)}" y="${(-0.3 * U).toFixed(1)}">${ICONO[k]}</text>
      <g class="robot-iso" transform="translate(${(rx - 32).toFixed(1)} ${(ry - 74).toFixed(1)}) scale(1)">${ROBOT}</g>
      <g class="numero-iso" transform="translate(${nx.toFixed(1)} ${ny.toFixed(1)})"><circle r="13"/><text y="4.5">${i + 1}</text></g>
    </g>`);
  });
  // El teléfono de donde sale la caja
  partes.push(bloque(-2.6, -0.75, 0, 0.4, 1.5, 2.7, 'telefono-iso'));
  const [tx, ty] = iso(-2.2, 0.6, 0.6);
  partes.push(`<text class="telefono-iso-icono" transform="matrix(${C},-0.5,0,1,${tx.toFixed(1)},${ty.toFixed(1)})" x="8" y="-30">💬</text>`);
  // La cinta: patas, marco y rodillos
  for (let x = -1.2; x < X_FIN; x += 3) partes.push(bloque(x, 0.45, 0, 0.22, 0.22, 0.45, 'pata'));
  partes.push(bloque(X_INICIO - 0.6, -0.85, 0.45, X_FIN - X_INICIO + 0.9, 1.7, 0.28, 'cinta-iso'));
  partes.push('<g class="rodillos" id="rodillos"></g>');
  partes.push('<g class="caja-iso" id="caja-iso"><polygon class="cara-lado"/><polygon class="cara-frente"/><polygon class="cara-tapa"/><text class="caja-letra"></text></g>');
  partes.push('<g class="avion-iso" id="avion-iso"><path d="M0 0 L26 -9 L9 3 Z M9 3 L12 11 L14 1"/></g>');
  return `<svg viewBox="0 0 ${ANCHO} ${ALTO}" aria-hidden="true">${partes.join('')}</svg>`;
}

const dormir = (ms: number) => new Promise<void>((ok) => window.setTimeout(ok, ms));

export function iniciarFabrica(): void {
  const fabrica = document.getElementById('fabrica');
  const escenaEl = document.getElementById('escena-iso');
  const pedido = document.getElementById('cadena-pedido');
  const fin = document.getElementById('cadena-fin');
  const actual = document.getElementById('paso-actual');
  if (!fabrica || !escenaEl || !pedido || !fin || !actual) return;
  escenaEl.innerHTML = dibujarEscena();
  const svg = escenaEl.querySelector('svg')!;
  // El cuadro justo de la escena: el piso, el teléfono y los números de arriba
  let vb = { x: 0, y: 0, w: ANCHO, h: ALTO };
  try {
    const cajas = Array.from(svg.querySelectorAll<SVGGraphicsElement>('.piso, .telefono-iso, .numero-iso')).map((e) => e.getBBox());
    const x0 = Math.min(...cajas.map((c) => c.x)) - 8, y0 = Math.min(...cajas.map((c) => c.y)) - 8;
    const x1 = Math.max(...cajas.map((c) => c.x + c.width)) + 8, y1 = Math.max(...cajas.map((c) => c.y + c.height)) + 8;
    if (x1 > x0 && y1 > y0) vb = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  } catch { /* sin medidas: se queda el cuadro de fábrica */ }
  svg.setAttribute('viewBox', `${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}`);
  const rodillos = svg.querySelector<SVGGElement>('#rodillos')!;
  const caja = svg.querySelector<SVGGElement>('#caja-iso')!;
  const avion = svg.querySelector<SVGGElement>('#avion-iso')!;
  const puestos = new Map<string, SVGGElement>();
  svg.querySelectorAll<SVGGElement>('.puesto-iso').forEach((g) => puestos.set(g.dataset.estacion!, g));
  const chips = new Map<string, HTMLElement>();
  fabrica.querySelectorAll<HTMLElement>('.pasos-iso [data-estacion]').forEach((li) => chips.set(li.dataset.estacion!, li));

  const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || /[?&]calor=/.test(location.search);

  // ── Rodillos: rayas sobre la cinta que avanzan mientras corre ──
  let corrimiento = 0;
  function pintarRodillos(): void {
    const l: string[] = [];
    const desfase = ((corrimiento % 0.5) + 0.5) % 0.5;
    for (let x = X_INICIO - 0.5 + desfase; x < X_FIN + 0.2; x += 0.5) {
      const a = iso(x, -0.8, 0.74), b = iso(x, 0.8, 0.74);
      l.push(`M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`);
    }
    rodillos.innerHTML = `<path d="${l.join('')}"/>`;
  }

  // ── Cámara: en pantallas angostas la escena se corre para que la caja quede al centro ──
  let cajaX = X_INICIO;
  function seguirCamara(): void {
    const ancho = escenaEl!.clientWidth;
    const w = svg.getBoundingClientRect().width;
    if (w <= ancho + 2) { svg.style.transform = ''; return; }
    const escala = w / vb.w;
    const [cx] = iso(cajaX, 0, 0);
    const dx = Math.min(0, Math.max(ancho - w, ancho / 2 - (cx - vb.x) * escala));
    svg.style.transform = `translateX(${dx.toFixed(1)}px)`;
  }

  // ── La caja ──
  function ponerCaja(x: number): void {
    cajaX = x;
    const [lado, frente, tapa] = puntosBloque(x - 0.42, -0.42, 0.74, 0.84, 0.84, 0.66);
    const caras = caja.querySelectorAll('polygon');
    caras[0].setAttribute('points', lado);
    caras[1].setAttribute('points', frente);
    caras[2].setAttribute('points', tapa);
    // La letra va pintada en la tapa, acostada como la caja
    const [lx, ly] = iso(x, 0, 1.4);
    caja.querySelector('text')!.setAttribute('transform', `matrix(${C},0.5,-${C},0.5,${lx.toFixed(1)},${ly.toFixed(1)})`);
    seguirCamara();
  }

  // ── Viaje por la cinta, con los rodillos andando ──
  async function viajar(hasta: number): Promise<void> {
    const desde = cajaX;
    const ms = Math.min(1500, Math.max(380, Math.abs(hasta - desde) * 210));
    const t0 = performance.now();
    await new Promise<void>((ok) => {
      function cuadro(t: number) {
        const k = Math.min(1, Math.max(0, (t - t0) / ms));
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const x = desde + (hasta - desde) * e;
        corrimiento += x - cajaX;
        ponerCaja(x);
        pintarRodillos();
        if (k < 1) requestAnimationFrame(cuadro); else ok();
      }
      requestAnimationFrame(cuadro);
    });
  }

  function pintar(k: string, clase: '' | 'trabaja' | 'listo', texto: string, ojo = false): void {
    const g = puestos.get(k), li = chips.get(k);
    [g, li].forEach((el) => {
      if (!el) return;
      el.classList.remove('trabaja', 'listo', 'ojo');
      if (clase) el.classList.add(clase);
      if (ojo) el.classList.add('ojo');
    });
    const t = li?.querySelector<HTMLElement>('.estado-txt');
    if (t && t.textContent !== texto) {
      t.textContent = texto;
      t.animate?.([{ opacity: 0, translate: '0 6px' }, { opacity: 1, translate: '0 0' }], { duration: 380, easing: 'cubic-bezier(.2,.9,.25,1.2)' });
    }
  }
  function decir(k: string, texto: string): void {
    actual!.textContent = '';
    const b = document.createElement('b'); b.textContent = String(LINEA.indexOf(k) + 1);
    const s = document.createElement('span'); s.textContent = NOMBRE[k];
    const em = document.createElement('em'); em.textContent = texto;
    actual!.append(b, ' ', s, ' ', em);
    actual!.animate?.([{ opacity: 0, translate: '-10px 0' }, { opacity: 1, translate: '0 0' }], { duration: 380, easing: 'cubic-bezier(.2,.9,.25,1.2)' });
  }

  async function volarAvion(): Promise<void> {
    const [x, y] = iso(X_PUESTO(5) + 0.2, -2.9, 2.2);
    avion.classList.add('se-ve');
    await avion.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(.6)`, opacity: 0 },
        { transform: `translate(${x + 40}px, ${y - 40}px) scale(1)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${x + 150}px, ${y - 120}px) scale(.8)`, opacity: 0 },
      ],
      { duration: 1300, easing: 'cubic-bezier(.4,0,.3,1)' },
    ).finished.catch(() => undefined);
    avion.classList.remove('se-ve');
  }

  // ── Una vuelta de la cadena ──
  let vuelta = 0;
  async function correr(nombre: string): Promise<void> {
    const escena = ESCENAS[nombre];
    if (!escena) return;
    const mia = ++vuelta;
    pedido!.textContent = escena.pedido;
    caja.querySelector('text')!.textContent = escena.letra;
    fin!.classList.remove('se-ve');
    LINEA.forEach((k) => pintar(k, '', 'Esperando…'));
    decir('recibe', 'Llega un mensaje por WhatsApp…');
    fabrica!.classList.add('corre');
    ponerCaja(X_INICIO);
    caja.classList.add('se-ve');
    await dormir(450);
    for (const paso of escena.pasos) {
      if (mia !== vuelta) return;
      await viajar(X_PUESTO(LINEA.indexOf(paso.estacion)));
      if (mia !== vuelta) return;
      pintar(paso.estacion, 'trabaja', 'Trabajando…');
      decir(paso.estacion, 'Trabajando…');
      if (paso.estacion === 'informe') void volarAvion();
      await dormir(1050);
      if (mia !== vuelta) return;
      pintar(paso.estacion, 'listo', paso.texto, paso.ojo);
      decir(paso.estacion, paso.texto);
      await dormir(250);
    }
    if (mia !== vuelta) return;
    await viajar(X_FIN);
    if (mia !== vuelta) return;
    caja.classList.remove('se-ve');
    fabrica!.classList.remove('corre');
    fin!.classList.add('se-ve');
    siguienteSola(nombre);
  }

  // ── Vueltas solas: mientras nadie toque un botón y la sección se vea ──
  let sola = true;
  let seVe = false;
  let espera = 0;
  function siguienteSola(nombre: string): void {
    window.clearTimeout(espera);
    if (!sola) return;
    espera = window.setTimeout(function intentar() {
      if (!sola) return;
      if (!seVe) { espera = window.setTimeout(intentar, 1500); return; }
      const sig = ORDEN[(ORDEN.indexOf(nombre) + 1) % ORDEN.length];
      document.querySelector<HTMLButtonElement>(`[data-escena="${sig}"]`)?.click();
    }, 6500);
  }
  document.querySelectorAll<HTMLButtonElement>('[data-escena]').forEach((b) => {
    b.addEventListener('click', (e) => { if (e.isTrusted) sola = false; });
  });

  // Quieta: todo terminado y la caja al final de la cinta
  pintarRodillos();
  LINEA.forEach((k, i) => pintar(k, 'listo', ESCENAS.noche.pasos[i].texto));
  decir('informe', ESCENAS.noche.pasos[5].texto);
  ponerCaja(X_FIN);
  window.addEventListener('resize', seguirCamara);

  if (quieto || !('animate' in Element.prototype) || !('IntersectionObserver' in window)) return;

  document.addEventListener('lalan:escena', (e) => {
    void correr((e as CustomEvent<{ nombre: string }>).detail.nombre);
  });
  let primera = true;
  new IntersectionObserver((es) => {
    seVe = es[0].isIntersecting;
    if (seVe && primera) {
      primera = false;
      // Deja que el teléfono llegue (punteros.ts) y arranca con el primer ejemplo
      window.setTimeout(() => {
        if (vuelta === 0) document.querySelector<HTMLButtonElement>('[data-escena="noche"]')?.click();
      }, 1900);
    }
  }, { threshold: 0.3 }).observe(fabrica);
}
