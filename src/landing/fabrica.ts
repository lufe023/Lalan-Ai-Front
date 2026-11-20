/**
 * La cadena de montaje de «Por dentro»: el mensaje sale del WhatsApp de
 * ejemplo como una ficha que corre por una cinta, y en cada estación una
 * ayudante robot de Lalan hace su parte (recibe, agenda, inventario de la
 * sede, especialista, caja y el informe para la dueña).
 *
 * La mueven los mismos botones de ejemplo del teléfono: pagina.js avisa con
 * el evento «lalan:escena». Al verse por primera vez arranca sola con el
 * primer ejemplo y luego pasa al siguiente mientras nadie toque un botón.
 * Fuera de pantalla no arranca otra vuelta. Con «reducir movimiento» se ve
 * quieta, con las estaciones ya terminadas.
 */

type Paso = { estacion: string; texto: string; ojo?: boolean };
type Escena = { pedido: string; ficha: string; pasos: Paso[] };

const ESCENAS: Record<string, Escena> = {
  noche: {
    pedido: 'Carmen · manicure + masaje, mañana en la tarde',
    ficha: 'C',
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
    ficha: 'C',
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
    ficha: 'C',
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
    ficha: 'A',
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

const dormir = (ms: number) => new Promise<void>((ok) => window.setTimeout(ok, ms));
type Punto = { x: number; y: number };

export function iniciarFabrica(): void {
  const fabrica = document.getElementById('fabrica');
  const cinta = document.querySelector<SVGSVGElement>('#cinta');
  const ficha = document.getElementById('ficha-cinta');
  const pedido = document.getElementById('cadena-pedido');
  const fin = document.getElementById('cadena-fin');
  if (!fabrica || !cinta || !ficha || !pedido || !fin) return;
  const base = cinta.querySelector<SVGPathElement>('.cinta-base')!;
  const rodillos = cinta.querySelector<SVGPathElement>('.cinta-rodillos')!;
  const estaciones = new Map<string, HTMLElement>();
  fabrica.querySelectorAll<HTMLElement>('[data-estacion]').forEach((e) => estaciones.set(e.dataset.estacion!, e));
  const tel = fabrica.querySelector<HTMLElement>('.telefono');

  const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || /[?&]calor=/.test(location.search);

  // ── La cinta: del teléfono a la bandeja de cada estación, en orden ──
  function centro(el: Element): Punto {
    const r = el.getBoundingClientRect();
    const b = fabrica!.getBoundingClientRect();
    return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 };
  }
  function puntosDe(orden: string[]): Punto[] {
    return orden.map((k) => centro(estaciones.get(k)!.querySelector('.bandeja')!));
  }
  /** Desde la salida del teléfono hasta la primera estación y luego por las demás */
  function ruta(orden: string[]): Punto[] {
    const docks = puntosDe(orden);
    if (!tel) return docks;
    const t = tel.getBoundingClientRect();
    const b = fabrica!.getBoundingClientRect();
    const d1 = docks[0];
    // Teléfono a la izquierda (PC) o arriba (teléfono): la cinta sale por el lado que da a la cadena
    const salida = t.right - b.left < d1.x - 10
      ? { x: t.right - b.left - 6, y: Math.min(Math.max(d1.y, t.top - b.top + 60), t.bottom - b.top - 60) }
      : { x: d1.x, y: t.bottom - b.top - 6 };
    const codo = salida.y === d1.y || salida.x === d1.x ? [] : [{ x: (salida.x + d1.x) / 2, y: salida.y }, { x: (salida.x + d1.x) / 2, y: d1.y }];
    return [salida, ...codo, ...docks];
  }
  function dibujarCinta(): void {
    const b = fabrica!.getBoundingClientRect();
    cinta!.setAttribute('viewBox', `0 0 ${b.width} ${b.height}`);
    cinta!.setAttribute('width', String(b.width));
    cinta!.setAttribute('height', String(b.height));
    const pts = ruta(LINEA);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    base.setAttribute('d', d);
    rodillos.setAttribute('d', d);
  }

  // ── La ficha viaja en línea recta de un punto a otro (los tramos de la cinta son rectos) ──
  let fichaEn: Punto = { x: 0, y: 0 };
  function ponerFicha(p: Punto): void {
    fichaEn = p;
    ficha!.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
  }
  async function viajar(destinos: Punto[]): Promise<void> {
    for (const d of destinos) {
      const dist = Math.hypot(d.x - fichaEn.x, d.y - fichaEn.y);
      const ms = Math.min(900, Math.max(260, dist * 1.7));
      const desde = fichaEn;
      await ficha!.animate(
        [
          { transform: `translate(${desde.x}px, ${desde.y}px) translate(-50%, -50%)` },
          { transform: `translate(${d.x}px, ${d.y}px) translate(-50%, -50%)` },
        ],
        { duration: ms, easing: 'cubic-bezier(.45,0,.3,1)' },
      ).finished.catch(() => undefined);
      ponerFicha(d);
    }
  }

  function pintarEstado(est: HTMLElement, texto: string): void {
    const t = est.querySelector<HTMLElement>('.estado-txt');
    if (!t || t.textContent === texto) return;
    t.textContent = texto;
    t.animate?.([{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }], { duration: 420, easing: 'cubic-bezier(.2,.9,.25,1.2)' });
  }

  // ── Una vuelta de la cadena ──
  let vuelta = 0;
  async function correr(nombre: string): Promise<void> {
    const escena = ESCENAS[nombre];
    if (!escena) return;
    const mia = ++vuelta;
    dibujarCinta();
    pedido!.textContent = escena.pedido;
    ficha!.textContent = escena.ficha;
    fin!.classList.remove('se-ve');
    estaciones.forEach((e) => {
      e.classList.remove('listo', 'trabaja', 'ojo');
      pintarEstado(e, 'Esperando…');
    });
    const inicio = ruta(['recibe']);
    ponerFicha(inicio[0]);
    fabrica!.classList.add('corre');
    ficha!.classList.add('se-ve');
    await dormir(500); // el primer mensaje llega al teléfono
    let antes = 'tel';
    for (const paso of escena.pasos) {
      if (mia !== vuelta) return;
      const est = estaciones.get(paso.estacion)!;
      // Desde el teléfono pasa por el codo; entre estaciones, por la bandeja de las que hay en medio
      const tramo = antes === 'tel' ? ruta([paso.estacion]).slice(1) : tramoEntre(antes, paso.estacion);
      await viajar(tramo);
      if (mia !== vuelta) return;
      est.classList.remove('listo', 'ojo');
      est.classList.add('trabaja');
      pintarEstado(est, 'Trabajando…');
      await dormir(1050);
      if (mia !== vuelta) return;
      est.classList.remove('trabaja');
      est.classList.add('listo');
      if (paso.ojo) est.classList.add('ojo');
      pintarEstado(est, paso.texto);
      antes = paso.estacion;
    }
    ficha!.classList.remove('se-ve');
    fabrica!.classList.remove('corre');
    fin!.classList.add('se-ve');
    if (mia === vuelta) siguienteSola(nombre);
  }
  function tramoEntre(a: string, b: string): Punto[] {
    const i = LINEA.indexOf(a), j = LINEA.indexOf(b);
    const paso = j > i ? 1 : -1;
    const ks: string[] = [];
    for (let k = i + paso; paso > 0 ? k <= j : k >= j; k += paso) ks.push(LINEA[k]);
    return puntosDe(ks);
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

  let cuadro = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(cuadro);
    cuadro = requestAnimationFrame(dibujarCinta);
  });
  dibujarCinta();
  // Las fuentes y las imágenes mueven las estaciones al cargar
  window.addEventListener('load', dibujarCinta);

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
  }, { threshold: 0.35 }).observe(fabrica);

}
