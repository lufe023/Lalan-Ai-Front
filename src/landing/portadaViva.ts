/**
 * La portada viva: el teléfono de la dueña va mostrando lo que Lalan hace
 * (entiende una nota de voz, agenda, avisa lo delicado, recuerda a todos) y
 * la etiqueta que lo dice se enciende al mismo tiempo. El ratón da un poco de
 * profundidad. Fuera de pantalla o con la pestaña escondida, todo se detiene.
 *
 * Sin JavaScript o con «reducir movimiento» se ven las cuatro tarjetas quietas
 * que ya trae el HTML.
 */

type Etiqueta = { el: HTMLElement; w: number; h: number; a0: number; x: number; y: number; radio: number; vel: number; fase: number; agarre: number };

type Tarjeta = { e: 1 | 2 | 3 | 4; titulo: string; texto: string; extra?: 'confirmada' | 'ficha' };

// Dos vueltas con gente distinta, para que no se sienta repetido
const GUION: Tarjeta[] = [
  { e: 1, titulo: 'Nota de voz de María', texto: '«¿Tienes algo mañana en la tarde?»' },
  { e: 2, titulo: 'Cita agendada', texto: 'Mañana, 3:00 p. m. · Manicure con Camila', extra: 'confirmada' },
  { e: 3, titulo: 'Ana Pérez: piel sensible', texto: 'El tinte de las 4:00 lleva amoníaco.', extra: 'ficha' },
  { e: 4, titulo: 'Recordatorios enviados', texto: 'A 8 clientas de mañana, a Camila y a ti: pedir acetona.' },
  { e: 1, titulo: 'Nota de voz de Carla', texto: '«¿Me haces un blower el sábado temprano?»' },
  { e: 2, titulo: 'Cita agendada', texto: 'Sábado, 9:00 a. m. · Blower con Yanet', extra: 'confirmada' },
  { e: 3, titulo: 'Luisa Marte: alérgica al látex', texto: 'Su pedicure de las 2:00 es con guantes de nitrilo.', extra: 'ficha' },
  { e: 4, titulo: 'Recordatorios enviados', texto: 'A 12 clientas del sábado, a Yanet y a ti: pagar la luz.' },
];

const ICONOS: Record<Tarjeta['e'], string> = {
  1: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>',
  2: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18m-12 6 2 2 4-4"/>',
  3: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4m0 4h.01"/>',
  4: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9m4.3 13a1.94 1.94 0 0 0 3.4 0"/>',
};

const PASO_MS = 2800;
const MAX_TARJETAS = 4;

function armar(t: Tarjeta): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'vivo-tarjeta llega' + (t.e === 3 ? ' vivo-alerta' : '');
  li.dataset.e = String(t.e);
  const icono = document.createElement('span');
  icono.className = 'vivo-icono';
  icono.innerHTML = `<svg viewBox="0 0 24 24">${ICONOS[t.e]}</svg>`;
  const cuerpo = document.createElement('div');
  const b = document.createElement('b');
  b.textContent = t.titulo;
  cuerpo.append(b);
  if (t.e === 1) {
    const onda = document.createElement('span');
    onda.className = 'vivo-onda';
    onda.innerHTML = '<i></i>'.repeat(10);
    cuerpo.append(onda);
  }
  const p = document.createElement('p');
  p.textContent = t.texto;
  cuerpo.append(p);
  if (t.extra) {
    const s = document.createElement('span');
    s.className = t.extra === 'confirmada' ? 'vivo-sello verde' : 'vivo-boton';
    s.textContent = t.extra === 'confirmada' ? 'Confirmada' : 'Ver su ficha';
    cuerpo.append(s);
  }
  li.append(icono, cuerpo);
  return li;
}

export function iniciarPortadaViva(): void {
  const collage = document.getElementById('collage-vivo');
  const lista = collage?.querySelector<HTMLOListElement>('.vivo-lista');
  if (!collage || !lista) return;
  const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (quieto) return;

  const etiquetas = Array.from(collage.querySelectorAll<HTMLElement>('.etiqueta-flot'));
  const encender = (e: number) => etiquetas.forEach((x) => x.classList.toggle('activa', x.dataset.e === String(e)));

  // Empieza vacío: las tarjetas llegan una a una cuando la entrada termina
  lista.replaceChildren();
  let paso = 0;
  let reloj: number | undefined;
  let visible = true;

  const siguiente = () => {
    const t = GUION[paso % GUION.length];
    paso++;
    const nueva = armar(t);
    // FLIP: las de arriba suben lo que mide la nueva, sin salto
    const antes = new Map(Array.from(lista.children).map((c) => [c, (c as HTMLElement).getBoundingClientRect().top]));
    lista.append(nueva);
    antes.forEach((top, c) => {
      const el = c as HTMLElement;
      const dy = top - el.getBoundingClientRect().top;
      if (!dy) return;
      el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
    // La más vieja se desvanece y luego sale
    const sobran = lista.children.length - MAX_TARJETAS;
    for (let i = 0; i < sobran; i++) {
      const vieja = lista.children[i] as HTMLElement;
      if (vieja.classList.contains('se-va')) continue;
      vieja.classList.add('se-va');
      window.setTimeout(() => vieja.remove(), 420);
    }
    encender(t.e);
  };

  const andar = () => {
    if (reloj !== undefined || !visible || document.hidden || paso === 0) return;
    reloj = window.setInterval(siguiente, PASO_MS);
  };
  const parar = () => {
    if (reloj !== undefined) window.clearInterval(reloj);
    reloj = undefined;
  };
  // ── Órbita: las etiquetas dan la vuelta despacio alrededor de la PC y el
  // teléfono, sin dejar de flotar (el flotado va en transform, la órbita en
  // translate). Cada una sale a 90° de la otra; una vuelta tarda VUELTA_MS.
  const VUELTA_MS = 40000;
  const salida: Record<string, number> = { '1': Math.PI, '2': Math.PI / 2, '3': -Math.PI / 2, '4': 0 };
  let medida = { w: 0, h: 0, tags: [] as Etiqueta[] };
  const medir = () => {
    const viejas = new Map(medida.tags.map((t) => [t.el, t]));
    medida = {
      w: collage.clientWidth,
      h: collage.clientHeight,
      tags: etiquetas.map((el, i) => {
        const v = viejas.get(el);
        return {
          el, w: el.offsetWidth, h: el.offsetHeight, a0: salida[el.dataset.e ?? '1'] ?? 0,
          x: v?.x ?? NaN, y: v?.y ?? NaN,
          // Cada mosca vuela a su manera: radio, velocidad y qué tan rápido alcanza
          // Repartidas a 90° y girando juntas, despacio: nunca se cruzan
          radio: 1 + (i % 2) * 0.12, vel: 0.55, fase: i * (Math.PI / 2), agarre: 3.2 + i * 0.6,
        };
      }),
    };
  };
  let girado = 0;
  let ultimo = 0;
  let cuadroOrbita = 0;
  // Moscas: con el ratón dentro de la portada, las etiquetas lo persiguen
  // zumbando alrededor; al salir o bajar vuelven a su órbita.
  let mosca = false;
  let raton = { x: 0, y: 0 };
  const colocar = (dt = 0) => {
    const { w, h, tags } = medida;
    const alto = h - 48; // el collage deja 48 px abajo para el teléfono
    const cx = w / 2;
    const cy = alto / 2 + 6;
    const rx = w / 2 + 6;
    const ry = alto / 2 + 16;
    const margen = w > 560 ? 24 : 0; // en el teléfono no se sale de la pantalla
    const giro = (girado / VUELTA_MS) * Math.PI * 2;
    const r = mosca ? collage.getBoundingClientRect() : null;
    const seg = girado / 1000;
    for (const t of tags) {
      let tx: number;
      let ty: number;
      if (r) {
        const ang = t.fase + seg * t.vel;
        const zum = Math.sin(seg * 7 + t.fase * 3) * 3; // el temblor de la mosca
        // Elipse ancha: las etiquetas son más anchas que altas
        tx = raton.x - r.left + Math.cos(ang) * 175 * t.radio + zum;
        ty = raton.y - r.top + Math.sin(ang) * 95 * t.radio + Math.cos(seg * 8 + t.fase) * 3;
      } else {
        const a = t.a0 + giro;
        tx = Math.min(Math.max(cx + rx * Math.cos(a), t.w / 2 - margen), w - t.w / 2 + margen);
        ty = cy + ry * Math.sin(a);
      }
      if (Number.isNaN(t.x) || !dt) {
        if (Number.isNaN(t.x)) { t.x = tx; t.y = ty; }
      } else {
        const k = 1 - Math.exp(-(dt / 1000) * (mosca ? t.agarre : 2.6));
        t.x += (tx - t.x) * k;
        t.y += (ty - t.y) * k;
      }
      t.el.style.setProperty('--ox', (t.x - t.w / 2).toFixed(1));
      t.el.style.setProperty('--oy', (t.y - t.h / 2).toFixed(1));
    }
  };
  const orbitar = (ahora: number) => {
    const dt = ultimo ? Math.min(ahora - ultimo, 100) : 0;
    girado += dt;
    ultimo = ahora;
    colocar(dt);
    cuadroOrbita = requestAnimationFrame(orbitar);
  };
  if (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
    const portada = collage.closest('section') ?? collage;
    portada.addEventListener('pointermove', (ev) => {
      raton = { x: (ev as PointerEvent).clientX, y: (ev as PointerEvent).clientY };
      mosca = true;
    });
    portada.addEventListener('pointerleave', () => { mosca = false; });
    // Al bajar, la portada se va de debajo del ratón: vuelven a su sitio
    window.addEventListener('scroll', () => {
      if (mosca && portada.getBoundingClientRect().bottom < raton.y) mosca = false;
    }, { passive: true });
  }
  medir();
  colocar();
  collage.classList.add('orbita');
  new ResizeObserver(() => { medir(); colocar(); }).observe(collage);
  document.fonts?.ready.then(() => { medir(); colocar(); });

  const actualizar = () => {
    const pausa = !visible || document.hidden;
    collage.classList.toggle('en-pausa', pausa);
    if (pausa) {
      parar();
      cancelAnimationFrame(cuadroOrbita);
      cuadroOrbita = 0;
      ultimo = 0;
    } else {
      andar();
      if (!cuadroOrbita) cuadroOrbita = requestAnimationFrame(orbitar);
    }
  };

  // La órbita arranca ya; la primera tarjeta llega cuando el teléfono ya entró
  actualizar();
  window.setTimeout(() => {
    siguiente();
    andar();
  }, 1500);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => {
      visible = es[0].isIntersecting;
      actualizar();
    }).observe(collage);
  }
  document.addEventListener('visibilitychange', actualizar);

  // Profundidad con el ratón (solo PC con ratón de verdad)
  if (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
    const portada = collage.closest('section') ?? collage;
    let cuadro = 0;
    portada.addEventListener('pointermove', (ev) => {
      const e = ev as PointerEvent;
      if (cuadro) return;
      cuadro = requestAnimationFrame(() => {
        cuadro = 0;
        const r = collage.getBoundingClientRect();
        const mx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
        const my = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
        collage.style.setProperty('--mx', mx.toFixed(3));
        collage.style.setProperty('--my', my.toFixed(3));
      });
    });
    portada.addEventListener('pointerleave', () => {
      collage.style.setProperty('--mx', '0');
      collage.style.setProperty('--my', '0');
    });
  }
}
