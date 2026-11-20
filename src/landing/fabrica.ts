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

/** Lo que hace la cadena en cada parada */
type Junto = { estacion: string; texto: string; mete?: string };
type Paso = {
  estacion: string;
  texto: string;
  ojo?: boolean;
  /** Lo que el puesto le pone a la caja de cartón */
  mete?: string;
  /** Lo que el puesto le quita a la caja */
  saca?: string;
  /** Plata que entra (+) o sale (−) de la caja registradora */
  dinero?: number;
  /** Otros puestos que trabajan al mismo tiempo, sin que la caja pase por ellos */
  junto?: Junto[];
  /** Un robotito va al camión del proveedor y trae los productos */
  proveedor?: boolean;
  /** Lalan le pregunta a la dueña y vuelve su respuesta */
  respuesta?: string;
};
type Escena = { pedido: string; letra: string; carga?: string[]; caja?: number; pasos: Paso[] };

const ESCENAS: Record<string, Escena> = {
  noche: {
    pedido: 'Carmen · manicure + masaje, mañana en la tarde',
    letra: 'C',
    pasos: [
      { estacion: 'recibe', texto: 'Nota de voz de Carmen, entendida', mete: '🎙️' },
      { estacion: 'agenda', texto: 'Mañana 2:00 y 2:30 libres', mete: '📅', junto: [{ estacion: 'equipo', texto: 'Valentina a las 2 · Carla a las 2:30', mete: '💅' }] },
      { estacion: 'inventario', texto: 'Esmalte y aceite apartados · Sede Naco', mete: '🧴' },
      { estacion: 'caja', texto: 'Cuenta lista: RD$ 2,950 · café con leche', mete: '☕' },
      { estacion: 'informe', texto: '«2 citas nuevas mientras dormías»' },
    ],
  },
  cambio: {
    pedido: 'Carmen · mover el manicure del martes a hoy',
    letra: 'C',
    carga: ['📅', '💅'],
    pasos: [
      { estacion: 'recibe', texto: 'Carmen no pudo venir el martes' },
      { estacion: 'agenda', texto: 'Martes liberado · hoy a las 4', saca: '📅', mete: '🕓', junto: [{ estacion: 'inventario', texto: 'Los insumos pasan a hoy · Sede Naco' }] },
      { estacion: 'equipo', texto: 'Valentina avisada: Carmen a las 4' },
      { estacion: 'caja', texto: 'La misma venta, no se duplica' },
      { estacion: 'informe', texto: '«Cita movida, sin hueco perdido»' },
    ],
  },
  duena: {
    pedido: 'Carmen y su hija · graduación, mañana temprano',
    letra: 'C',
    pasos: [
      { estacion: 'recibe', texto: 'Nota de voz: son 2 personas', mete: '🎓' },
      { estacion: 'agenda', texto: 'Mañana temprano está llena', ojo: true },
      { estacion: 'informe', texto: '«¿Les abres más temprano?» · dijo sí', ojo: true, respuesta: '👍' },
      { estacion: 'agenda', texto: 'Alanny dijo sí: 8:00, antes de abrir', mete: '⏰' },
      { estacion: 'inventario', texto: 'Peinado y uñas ×2 · Sede Naco', mete: '🧴', junto: [{ estacion: 'equipo', texto: 'Alanny y su equipo, a las 8', mete: '💅' }] },
      { estacion: 'caja', texto: '4 servicios listos para cobrar', mete: '🧾' },
      { estacion: 'informe', texto: '«Graduación de Carmen agendada»' },
    ],
  },
  informe: {
    pedido: 'Alanny · «Lalan, ¿cómo nos fue hoy?»',
    letra: 'A',
    caja: 0,
    pasos: [
      { estacion: 'recibe', texto: 'Alanny pregunta desde su número' },
      { estacion: 'agenda', texto: '14 atendidas · 11 para mañana', mete: '📅', junto: [{ estacion: 'equipo', texto: 'Valentina llena desde las 2', mete: '💅' }] },
      { estacion: 'caja', texto: 'Entraron RD$ 38,450 en las 2 sedes', dinero: 38450, mete: '💵' },
      { estacion: 'inventario', texto: 'Poco esmalte rojo en Naco', ojo: true, mete: '⚠️' },
      { estacion: 'informe', texto: '«¿Pido esmalte a RD$ 3,200?» · dijo sí', ojo: true, respuesta: '👍' },
      { estacion: 'inventario', texto: 'Llegaron 12 esmaltes · Sede Naco', saca: '⚠️', proveedor: true },
      { estacion: 'caja', texto: 'Salieron RD$ 3,200 al proveedor', dinero: -3200 },
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
/** Texto pintado sobre la cara que mira a +y (la de la izquierda abajo) */
function rotulo(x: number, y: number, z: number, texto: string, cls: string): string {
  const [px, py] = iso(x, y, z);
  return `<text class="${cls}" transform="matrix(${C},0.5,0,1,${px.toFixed(1)},${py.toFixed(1)})">${texto}</text>`;
}

const ROBOT = `<line class="r-antena-palo" x1="32" y1="7" x2="32" y2="15"/><circle class="r-antena" cx="32" cy="6" r="3.4"/><g class="r-brazo r-izq"><path d="M18 50 Q9 54 8 62"/><circle cx="8" cy="63" r="3"/></g><g class="r-brazo r-der"><path d="M46 50 Q55 54 56 62"/><circle cx="56" cy="63" r="3"/></g><rect class="r-cuerpo" x="18" y="45" width="28" height="20" rx="8"/><rect class="r-cabeza" x="11" y="14" width="42" height="29" rx="13"/><rect class="r-visor" x="17" y="20" width="30" height="15" rx="7.5"/><g class="r-ojos"><circle cx="26" cy="27.5" r="2.8"/><circle cx="38" cy="27.5" r="2.8"/></g><circle class="r-pecho" cx="32" cy="55" r="3.2"/>`;

const X_PUESTO = (i: number) => 1.6 + i * 3;
const X_INICIO = -1.2;
const X_FIN = 17.6;
const Y_ROBOT = -1.65;
/** El robotito del inventario sale por el pasillo entre su mesa y la de Equipo */
const X_PASILLO = X_PUESTO(2) + 1.45;
const Y_CAMION = -5.0;
const CAMION_PARQUEA = X_PASILLO - 2.4;
const CAMION_FUERA = 27;
/** Donde va cada cosa sobre la tapa de la caja */
const SITIOS: [number, number][] = [[-0.2, -0.2], [0.2, 0.2], [0.2, -0.2], [-0.2, 0.2], [0, 0], [0, -0.3]];
const anclaRobot = (x: number, y: number): string => {
  const [rx, ry] = iso(x, y, 0);
  return `translate(${(rx - 32).toFixed(1)} ${(ry - 74).toFixed(1)})`;
};

function dibujarEscena(): string {
  const partes: string[] = [];
  // El piso: una tarima que hace de diorama, con la calle de atrás por donde llega el proveedor
  partes.push(bloque(-3.4, -6.9, -0.35, 22.4, 8.5, 0.35, 'piso'));
  partes.push(bloque(-3.4, -6.7, 0, 22.4, 1.9, 0.02, 'calle'));
  // El camión del proveedor (fuera de la escena hasta que lo llaman)
  partes.push(`<g class="camion-iso" id="camion">
    ${bloque(0.3, Y_CAMION + 0.05, 0, 0.45, 0.1, 0.32, 'rueda')}${bloque(2.5, Y_CAMION + 0.05, 0, 0.45, 0.1, 0.32, 'rueda')}
    ${bloque(0, Y_CAMION - 1.2, 0.25, 2.3, 1.2, 1.3, 'camion-carga')}
    ${bloque(2.3, Y_CAMION - 1.1, 0.25, 0.95, 1.1, 0.9, 'camion-cabina')}
    ${rotulo(0.25, Y_CAMION, 0.75, 'Proveedor', 'camion-rotulo')}
  </g>`);
  // Los puestos van detrás de la cinta, de izquierda a derecha
  LINEA.forEach((k, i) => {
    const x = X_PUESTO(i);
    const [nx, ny] = iso(x + 0.1, -2.9, 2.55);
    const [px, py] = iso(x - 0.55, -2.7, 0.85);
    // El robotito que sale al proveedor va entre Inventario y Equipo, para que lo tapen bien las mesas
    if (k === 'equipo') partes.push(`<g class="robot-iso caminante" id="caminante">${ROBOT}<text class="carga-robot" x="32" y="-4">📦</text></g>`);
    const extra = k === 'caja'
      ? (() => { const [cx, cy] = iso(x + 0.1, -2.9, 3.45); return `<g class="registradora" transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})"><rect x="-50" y="-15" width="100" height="26" rx="8"/><text id="caja-monto" y="3">RD$ 0</text></g>`; })()
      : k === 'inventario' ? '<g class="estante" id="estante"></g>' : '';
    partes.push(`<g class="puesto-iso" data-estacion="${k}">
      ${bloque(x - 1, -3.6, 0, 2, 1.25, 0.85, 'mesa')}
      ${bloque(x - 0.55, -3.0, 0.85, 1.1, 0.3, 1.05, 'panel')}
      <text class="panel-icono" transform="matrix(${C},0.5,0,1,${px.toFixed(1)},${py.toFixed(1)})" x="${(0.55 * U).toFixed(1)}" y="${(-0.3 * U).toFixed(1)}">${ICONO[k]}</text>
      ${extra}
      <g class="robot-iso" transform="${anclaRobot(x + 0.2, Y_ROBOT)}">${ROBOT}</g>
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
  partes.push('<g class="caja-iso" id="caja-iso"><g class="caja-cuerpo"><polygon class="cara-lado"/><polygon class="cara-frente"/><polygon class="cara-tapa"/><text class="caja-letra"></text></g><g class="carga" id="carga"></g></g>');
  partes.push('<g class="avion-iso" id="avion-iso"><path d="M0 0 L26 -9 L9 3 Z M9 3 L12 11 L14 1"/></g>');
  partes.push('<g id="vuelos"></g>');
  return `<svg viewBox="0 0 ${ANCHO} ${ALTO}" aria-hidden="true">${partes.join('')}</svg>`;
}

const dormir = (ms: number) => new Promise<void>((ok) => window.setTimeout(ok, ms));
const miles = (n: number) => Math.round(n).toLocaleString('en-US');

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
    const cajas = Array.from(svg.querySelectorAll<SVGGraphicsElement>('.piso, .telefono-iso, .numero-iso, .registradora')).map((e) => e.getBBox());
    const x0 = Math.min(...cajas.map((c) => c.x)) - 8, y0 = Math.min(...cajas.map((c) => c.y)) - 8;
    const x1 = Math.max(...cajas.map((c) => c.x + c.width)) + 8, y1 = Math.max(...cajas.map((c) => c.y + c.height)) + 8;
    if (x1 > x0 && y1 > y0) vb = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  } catch { /* sin medidas: se queda el cuadro de fábrica */ }
  svg.setAttribute('viewBox', `${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}`);

  const rodillos = svg.querySelector<SVGGElement>('#rodillos')!;
  const caja = svg.querySelector<SVGGElement>('#caja-iso')!;
  const cuerpo = caja.querySelector<SVGGElement>('.caja-cuerpo')!;
  const cargaEl = svg.querySelector<SVGGElement>('#carga')!;
  const avion = svg.querySelector<SVGGElement>('#avion-iso')!;
  const vuelos = svg.querySelector<SVGGElement>('#vuelos')!;
  const camion = svg.querySelector<SVGGElement>('#camion')!;
  const caminante = svg.querySelector<SVGGElement>('#caminante')!;
  const estante = svg.querySelector<SVGGElement>('#estante')!;
  const monto = svg.querySelector<SVGTextElement>('#caja-monto')!;
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

  // ── Cámara: en pantallas angostas la escena se corre para que lo que pasa quede al centro ──
  let cajaX = X_INICIO;
  let foco = X_INICIO;
  function seguirCamara(): void {
    const ancho = escenaEl!.clientWidth;
    const w = svg.getBoundingClientRect().width;
    if (w <= ancho + 2) { svg.style.transform = ''; return; }
    const escala = w / vb.w;
    const [cx] = iso(foco, -1, 0);
    const dx = Math.min(0, Math.max(ancho - w, ancho / 2 - (cx - vb.x) * escala));
    svg.style.transform = `translateX(${dx.toFixed(1)}px)`;
  }
  function enfocar(x: number): void { foco = x; seguirCamara(); }

  // ── La caja de cartón y lo que lleva encima ──
  let carga: string[] = [];
  function pintarCarga(): void {
    cargaEl.textContent = '';
    carga.forEach((e, i) => {
      const [dx, dy] = SITIOS[i % SITIOS.length];
      const [x, y] = iso(cajaX + dx, dy, 1.52 + Math.floor(i / SITIOS.length) * 0.3);
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', x.toFixed(1));
      t.setAttribute('y', y.toFixed(1));
      t.textContent = e;
      cargaEl.append(t);
    });
  }
  function sitioLibre(): P {
    const i = carga.length;
    const [dx, dy] = SITIOS[i % SITIOS.length];
    return iso(cajaX + dx, dy, 1.52 + Math.floor(i / SITIOS.length) * 0.3);
  }
  function ponerCaja(x: number): void {
    cajaX = x;
    const [lado, frente, tapa] = puntosBloque(x - 0.42, -0.42, 0.74, 0.84, 0.84, 0.66);
    const caras = cuerpo.querySelectorAll('polygon');
    caras[0].setAttribute('points', lado);
    caras[1].setAttribute('points', frente);
    caras[2].setAttribute('points', tapa);
    // La letra va pintada en el frente de la caja
    const [lx, ly] = iso(x - 0.42, 0.42, 1.0);
    cuerpo.querySelector('text')!.setAttribute('transform', `matrix(${C},0.5,0,1,${lx.toFixed(1)},${ly.toFixed(1)})`);
    pintarCarga();
    enfocar(x);
  }

  /** Una cosa vuela en arco de un punto a otro (de un panel a la caja, de la caja a la registradora…) */
  async function volar(e: string, de: P, a: P, ms = 650, cls = 'vuela'): Promise<void> {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('class', cls);
    t.textContent = e;
    vuelos.append(t);
    const alto = Math.min(de[1], a[1]) - 46;
    const mx = (de[0] + a[0]) / 2;
    await t.animate(
      [
        { transform: `translate(${de[0]}px, ${de[1]}px) scale(.6)`, opacity: 0 },
        { transform: `translate(${mx}px, ${alto}px) scale(1.25)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${a[0]}px, ${a[1]}px) scale(1)`, opacity: 1 },
      ],
      { duration: ms, easing: 'cubic-bezier(.35,0,.25,1)' },
    ).finished.catch(() => undefined);
    t.remove();
  }
  const panel = (k: string): P => iso(X_PUESTO(LINEA.indexOf(k)), -2.85, 1.7);

  async function meter(e: string, desde: string): Promise<void> {
    await volar(e, panel(desde), sitioLibre());
    carga.push(e);
    pintarCarga();
    void cuerpo.animate([{ translate: '0 0' }, { translate: '0 3px' }, { translate: '0 0' }], { duration: 260 });
  }
  async function sacar(e: string, hacia: string): Promise<void> {
    const i = carga.lastIndexOf(e);
    if (i < 0) return;
    const [dx, dy] = SITIOS[i % SITIOS.length];
    const de = iso(cajaX + dx, dy, 1.52);
    carga.splice(i, 1);
    pintarCarga();
    await volar(e, de, panel(hacia), 600, 'vuela sale');
  }

  // ── Caja registradora ──
  let enCaja = 0;
  function pintarMonto(n: number): void { monto.textContent = `RD$ ${miles(n)}`; }
  async function moverPlata(cuanto: number): Promise<void> {
    const reg = iso(X_PUESTO(4) + 0.1, -2.9, 3.45);
    const camionP = iso(CAMION_PARQUEA + 1.2, Y_CAMION - 0.6, 1.4);
    const caja5 = iso(cajaX, 0, 1.4);
    const monedas = [0, 1, 2].map((k) => dormir(k * 140).then(() => cuanto > 0 ? volar('🪙', caja5, reg, 560) : volar('🪙', reg, camionP, 760)));
    const desde = enCaja, hasta = enCaja + cuanto;
    enCaja = hasta;
    const t0 = performance.now();
    await new Promise<void>((ok) => {
      function cuadro(t: number) {
        const k = Math.min(1, (t - t0) / 900);
        pintarMonto(desde + (hasta - desde) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(cuadro); else ok();
      }
      requestAnimationFrame(cuadro);
    });
    puestos.get('caja')!.classList.add(cuanto > 0 ? 'entra-plata' : 'sale-plata');
    await Promise.all(monedas);
    window.setTimeout(() => puestos.get('caja')!.classList.remove('entra-plata', 'sale-plata'), 900);
  }

  // ── El proveedor: llega el camión, el robotito va, trae la caja de productos y el camión se va ──
  function ponerCamion(x: number): void {
    const dx = x * U * C, dy = x * U * 0.5;
    camion.setAttribute('transform', `translate(${dx.toFixed(1)} ${dy.toFixed(1)})`);
  }
  ponerCamion(CAMION_FUERA);
  async function mover(desde: number, hasta: number, ms: number, cada: (v: number) => void): Promise<void> {
    const t0 = performance.now();
    await new Promise<void>((ok) => {
      function cuadro(t: number) {
        const k = Math.min(1, Math.max(0, (t - t0) / ms));
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        cada(desde + (hasta - desde) * e);
        if (k < 1) requestAnimationFrame(cuadro); else ok();
      }
      requestAnimationFrame(cuadro);
    });
  }
  async function caminar(ruta: [number, number][], msPorTramo: number): Promise<void> {
    for (let i = 1; i < ruta.length; i++) {
      const [x0, y0] = ruta[i - 1], [x1, y1] = ruta[i];
      await mover(0, 1, msPorTramo, (k) => caminante.setAttribute('transform', anclaRobot(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k)));
    }
  }
  async function traerDelProveedor(): Promise<void> {
    const inv = puestos.get('inventario')!;
    enfocar(X_PASILLO);
    caminante.classList.remove('lleva');
    caminante.setAttribute('transform', anclaRobot(X_PUESTO(2) + 0.2, Y_ROBOT));
    const camino: [number, number][] = [[X_PUESTO(2) + 0.2, Y_ROBOT], [X_PASILLO, Y_ROBOT], [X_PASILLO, Y_CAMION + 0.5]];
    await Promise.all([
      mover(CAMION_FUERA, CAMION_PARQUEA, 1500, ponerCamion),
      dormir(500).then(() => {
        inv.classList.add('fuera');
        caminante.classList.add('se-ve', 'anda');
        return caminar(camino, 520);
      }),
    ]);
    caminante.classList.remove('anda');
    await dormir(250);
    caminante.classList.add('lleva');
    await dormir(350);
    caminante.classList.add('anda');
    await caminar(camino.slice().reverse(), 520);
    caminante.classList.remove('anda', 'lleva', 'se-ve');
    inv.classList.remove('fuera');
    // Las cajitas quedan en la mesa del inventario
    const [ex, ey] = iso(X_PUESTO(2) + 0.55, -2.5, 1.0);
    estante.innerHTML = `<text x="${ex.toFixed(1)}" y="${ey.toFixed(1)}">📦</text>`;
    void estante.animate([{ opacity: 0, translate: '0 -14px' }, { opacity: 1, translate: '0 0' }], { duration: 420, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    void mover(CAMION_PARQUEA, CAMION_FUERA, 1600, ponerCamion);
    enfocar(cajaX);
  }

  // ── Viaje por la cinta, con los rodillos andando ──
  async function viajar(hasta: number): Promise<void> {
    const desde = cajaX;
    if (Math.abs(hasta - desde) < 0.01) return;
    const ms = Math.min(1500, Math.max(380, Math.abs(hasta - desde) * 190));
    await mover(desde, hasta, ms, (x) => {
      corrimiento += x - cajaX;
      ponerCaja(x);
      pintarRodillos();
    });
    // Frena con un pequeño asiento
    void cuerpo.animate([{ translate: '0 0' }, { translate: `${hasta > desde ? 3 : -3}px 0` }, { translate: '0 0' }], { duration: 300, easing: 'ease-out' });
  }

  function pintar(k: string, clase: '' | 'trabaja' | 'listo', texto: string, ojo = false): void {
    const g = puestos.get(k), li = chips.get(k);
    [g, li].forEach((el) => {
      if (!el) return;
      el.classList.remove('trabaja', 'listo', 'ojo');
      if (clase) el.classList.add(clase);
      if (ojo) el.classList.add('ojo');
    });
    if (clase === 'listo' && g) {
      g.classList.add('salta');
      window.setTimeout(() => g.classList.remove('salta'), 650);
    }
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

  /** Sale un avioncito hacia la dueña; si trae respuesta, vuelve y la deja en la caja */
  async function volarAvion(respuesta?: string): Promise<void> {
    const [x, y] = iso(X_PUESTO(5) + 0.2, -2.9, 2.2);
    avion.classList.add('se-ve');
    await avion.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(.6)`, opacity: 0 },
        { transform: `translate(${x + 40}px, ${y - 40}px) scale(1)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${x + 150}px, ${y - 120}px) scale(.8)`, opacity: 0 },
      ],
      { duration: 1100, easing: 'cubic-bezier(.4,0,.3,1)' },
    ).finished.catch(() => undefined);
    avion.classList.remove('se-ve');
    if (!respuesta) return;
    await dormir(250);
    await volar(respuesta, [x + 150, y - 120], sitioLibre(), 800);
    carga.push(respuesta);
    pintarCarga();
  }

  // ── Una vuelta de la cadena ──
  let vuelta = 0;
  async function correr(nombre: string): Promise<void> {
    const escena = ESCENAS[nombre];
    if (!escena) return;
    const mia = ++vuelta;
    const sigue = () => mia === vuelta;
    pedido!.textContent = escena.pedido;
    cuerpo.querySelector('text')!.textContent = escena.letra;
    fin!.classList.remove('se-ve');
    LINEA.forEach((k) => pintar(k, '', 'Esperando…'));
    decir('recibe', 'Llega un mensaje por WhatsApp…');
    fabrica!.classList.add('corre');
    estante.textContent = '';
    ponerCamion(CAMION_FUERA);
    enCaja = escena.caja ?? enCaja;
    pintarMonto(enCaja);
    carga = (escena.carga ?? []).slice();
    ponerCaja(X_INICIO);
    caja.classList.add('se-ve');
    await dormir(450);
    for (const paso of escena.pasos) {
      if (!sigue()) return;
      await viajar(X_PUESTO(LINEA.indexOf(paso.estacion)));
      if (!sigue()) return;
      pintar(paso.estacion, 'trabaja', 'Trabajando…');
      decir(paso.estacion, 'Trabajando…');
      (paso.junto ?? []).forEach((j) => pintar(j.estacion, 'trabaja', 'Trabajando…'));
      if (paso.ojo) void cuerpo.animate([{ rotate: '0deg' }, { rotate: '-4deg' }, { rotate: '4deg' }, { rotate: '-2deg' }, { rotate: '0deg' }], { duration: 520, transformOrigin: 'center' } as KeyframeAnimationOptions);
      // Todo lo de esta parada pasa a la vez: unas cosas entran, otras salen, otras se mueven
      const tareas: Promise<unknown>[] = [dormir(paso.proveedor ? 0 : 1050)];
      if (paso.saca) tareas.push(dormir(150).then(() => sacar(paso.saca!, paso.estacion)));
      if (paso.mete) tareas.push(dormir(paso.saca ? 800 : 420).then(() => meter(paso.mete!, paso.estacion)));
      (paso.junto ?? []).forEach((j, n) => {
        tareas.push(dormir(300 + n * 200).then(async () => {
          if (j.mete) await meter(j.mete, j.estacion); else await dormir(700);
          if (sigue()) pintar(j.estacion, 'listo', j.texto);
        }));
      });
      if (paso.dinero) tareas.push(dormir(250).then(() => moverPlata(paso.dinero!)));
      if (paso.estacion === 'informe') tareas.push(volarAvion(paso.respuesta));
      if (paso.proveedor) tareas.push(traerDelProveedor());
      await Promise.all(tareas);
      if (!sigue()) return;
      pintar(paso.estacion, 'listo', paso.texto, paso.ojo);
      decir(paso.estacion, paso.texto);
      await dormir(paso.ojo ? 500 : 260);
    }
    if (!sigue()) return;
    await viajar(X_FIN);
    if (!sigue()) return;
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

  // Quieta: todo terminado y la caja al final de la cinta con lo que juntó
  pintarRodillos();
  LINEA.forEach((k) => {
    const p = ESCENAS.noche.pasos.find((x) => x.estacion === k) ?? ESCENAS.noche.pasos[1];
    const j = ESCENAS.noche.pasos.flatMap((x) => x.junto ?? []).find((x) => x.estacion === k);
    pintar(k, 'listo', j ? j.texto : p.texto);
  });
  decir('informe', '«2 citas nuevas mientras dormías»');
  carga = ['🎙️', '📅', '💅', '🧴', '☕'];
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
      // Deja que lleguen las piezas (punteros.ts) y arranca con el primer ejemplo
      window.setTimeout(() => {
        if (vuelta === 0) document.querySelector<HTMLButtonElement>('[data-escena="noche"]')?.click();
      }, 2600);
    }
  }, { threshold: 0.3 }).observe(fabrica);
}
