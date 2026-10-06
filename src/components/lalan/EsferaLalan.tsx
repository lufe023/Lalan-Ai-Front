import React, { useEffect, useRef } from 'react';
import { ajustesLalan } from '../../utils/ajustesLalan';
import { nivelDeLalan, ritmoDeHabla } from '../../utils/vozLalan';

export type ModoEsfera = 'reposo' | 'escuchando' | 'pensando' | 'hablando';

/** Las formas de la esfera (catálogo: id + nombre). Las elige el super admin en Plataforma → Lalan */
export const ESTILOS_ESFERA = {
  aurora: 'Aurora',
  perla: 'Perla',
  ondas: 'Ondas',
  anillos: 'Anillos',
  particulas: 'Destellos',
  flor: 'Flor',
} as const;
export type EstiloEsfera = keyof typeof ESTILOS_ESFERA;

/** Los colores (catálogo: id + nombre). "marca" = los del salón (cambian con su tema) */
export const COLORES_ESFERA = {
  marca: 'Del salón',
  arcoiris: 'Arcoíris',
  rosa: 'Rosa',
  oro: 'Oro',
  lavanda: 'Lavanda',
  oceano: 'Océano',
  noche: 'Noche',
} as const;
export type ColorEsfera = keyof typeof COLORES_ESFERA;

interface Paleta { tonos: number[]; s: number; l: number }

/** Las capas de "Aurora": cada una gira y respira a su ritmo */
const CAPAS = [
  { vel: 0.42, fase: 0.0, radio: 0.62, puntas: 3 },
  { vel: -0.31, fase: 1.7, radio: 0.56, puntas: 4 },
  { vel: 0.27, fase: 3.1, radio: 0.52, puntas: 5 },
  { vel: -0.19, fase: 4.4, radio: 0.42, puntas: 3 },
];

function colorPrimario(): [number, number, number] {
  const crudo = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#C46B7C';
  const c = document.createElement('canvas').getContext('2d');
  if (!c) return [196, 107, 124];
  c.fillStyle = crudo;
  const m = /^#([0-9a-f]{6})$/i.exec(c.fillStyle as string);
  if (!m) return [196, 107, 124];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function aHsl([r, g, b]: [number, number, number]) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
    h *= 60;
  }
  return { h: (h + 360) % 360, s: Math.max(0.72, s), l: Math.min(0.6, Math.max(0.52, l)) };
}

function paletaDe(color: ColorEsfera): Paleta {
  switch (color) {
    case 'arcoiris': return { tonos: [330, 40, 170, 250], s: 0.85, l: 0.58 };
    case 'rosa': return { tonos: [340, 355, 320, 15], s: 0.8, l: 0.62 };
    case 'oro': return { tonos: [40, 48, 30, 55], s: 0.82, l: 0.55 };
    case 'lavanda': return { tonos: [275, 300, 250, 320], s: 0.7, l: 0.62 };
    case 'oceano': return { tonos: [195, 215, 175, 235], s: 0.78, l: 0.52 };
    case 'noche': return { tonos: [235, 262, 212, 285], s: 0.7, l: 0.46 };
    default: {
      const b = aHsl(colorPrimario());
      return { tonos: [b.h, b.h + 42, b.h - 62, b.h + 190].map((x) => (x + 360) % 360), s: b.s, l: b.l };
    }
  }
}

const hsla = (p: Paleta, i: number, dl = 0, a = 1) =>
  `hsla(${p.tonos[i % p.tonos.length]}, ${p.s * 100}%, ${Math.max(10, Math.min(90, p.l * 100 + dl))}%, ${a})`;

interface Momento { m: number; giro: number; empuje: number; escala: number; t: number; quieta: boolean }

// ── Las formas ──────────────────────────────────────────────────────

function aurora(ctx: CanvasRenderingContext2D, p: Paleta, k: Momento) {
  const { m, giro, empuje, escala } = k;
  CAPAS.forEach((capa, n) => {
    const radio = m * capa.radio * escala;
    const ang = giro * capa.vel + capa.fase;
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const rr = radio * (1 + Math.sin(a * capa.puntas + ang * 2) * (0.06 + empuje * 0.2) + Math.sin(a * 2 - ang) * (0.04 + empuje * 0.05));
      const x = m + Math.cos(a + ang) * rr;
      const y = m + Math.sin(a + ang) * rr;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(m - radio * 0.3, m - radio * 0.35, radio * 0.1, m, m, radio * 1.1);
    g.addColorStop(0, hsla(p, n, 18, 0.9));
    g.addColorStop(1, hsla(p, n, -6, 0.45));
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.72;
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  brillo(ctx, m, escala, 0.32);
}

/** Una perla tornasolada: un solo cuerpo que gira sus reflejos */
function perla(ctx: CanvasRenderingContext2D, p: Paleta, k: Momento) {
  const { m, giro, escala, empuje } = k;
  const r = m * 0.6 * escala;
  ctx.save();
  // Una perla que se ondula con la voz (en silencio, redonda)
  ctx.beginPath();
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const rr = r * (1 + empuje * (Math.sin(a * 3 + giro * 2.2) * 0.06 + Math.sin(a * 5 - giro * 3.1) * 0.035));
    const x = m + Math.cos(a) * rr, y = m + Math.sin(a) * rr;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.clip();
  const fondo = ctx.createRadialGradient(m - r * 0.35, m - r * 0.4, r * 0.1, m, m, r);
  fondo.addColorStop(0, hsla(p, 0, 30, 1));
  fondo.addColorStop(1, hsla(p, 0, -4, 1));
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, m * 2, m * 2);
  // Reflejos de colores que giran (tornasol)
  if ('createConicGradient' in ctx) {
    const cono = (ctx as CanvasRenderingContext2D & { createConicGradient: (a: number, x: number, y: number) => CanvasGradient }).createConicGradient(giro * 0.8, m, m);
    p.tonos.concat(p.tonos[0]).forEach((_, i, arr) => cono.addColorStop(i / (arr.length - 1), hsla(p, i, 14, 0.42 + empuje * 0.25)));
    ctx.fillStyle = cono;
    ctx.fillRect(0, 0, m * 2, m * 2);
  }
  ctx.restore();
  brillo(ctx, m, escala, 0.55);
}

/** Ondas como las de Siri: tres curvas que crecen con la voz */
function ondas(ctx: CanvasRenderingContext2D, p: Paleta, k: Momento) {
  const { m, giro, empuje, t, quieta } = k;
  const ancho = m * 1.8;
  const x0 = m - ancho / 2;
  const base = m * (0.13 + empuje * 0.34);
  // Un fondito redondo para que en reposo (casi una línea) se vea como un botón
  const fondo = ctx.createRadialGradient(m, m, 0, m, m, m * 0.62);
  fondo.addColorStop(0, hsla(p, 0, 24, 0.22));
  fondo.addColorStop(1, hsla(p, 0, 24, 0));
  ctx.fillStyle = fondo;
  ctx.beginPath();
  ctx.arc(m, m, m * 0.62, 0, Math.PI * 2);
  ctx.fill();
  for (let n = 0; n < 3; n++) {
    const fase = giro * (1.6 + n * 0.5) + n * 2.1;
    const amp = base * (1 - n * 0.22) * (quieta ? 1 : 0.85 + 0.15 * Math.sin(t / 700 + n));
    ctx.beginPath();
    ctx.moveTo(x0, m);
    for (let i = 0; i <= 80; i++) {
      const u = i / 80;
      const env = Math.pow(1 - Math.pow(2 * u - 1, 2), 2);
      ctx.lineTo(x0 + u * ancho, m + Math.sin(u * Math.PI * (3 + n) + fase) * amp * env);
    }
    for (let i = 80; i >= 0; i--) {
      const u = i / 80;
      const env = Math.pow(1 - Math.pow(2 * u - 1, 2), 2);
      ctx.lineTo(x0 + u * ancho, m - Math.sin(u * Math.PI * (3 + n) + fase) * amp * env * 0.6);
    }
    ctx.closePath();
    ctx.fillStyle = hsla(p, n, 6, 0.5);
    ctx.fill();
  }
  // Una línea fina que siempre se ve (en reposo es casi recta)
  ctx.beginPath();
  for (let i = 0; i <= 80; i++) {
    const u = i / 80;
    const env = Math.pow(1 - Math.pow(2 * u - 1, 2), 2);
    const y = m + Math.sin(u * Math.PI * 4 + giro * 2) * base * 0.8 * env;
    if (i) ctx.lineTo(x0 + u * ancho, y); else ctx.moveTo(x0, y);
  }
  ctx.strokeStyle = hsla(p, 0, 20, 0.9);
  ctx.lineWidth = Math.max(1.5, m * 0.025);
  ctx.stroke();
}

/** Anillos que salen del centro, como ondas en el agua */
function anillos(ctx: CanvasRenderingContext2D, p: Paleta, k: Momento) {
  const { m, giro, empuje, escala } = k;
  for (let n = 0; n < 4; n++) {
    const avance = ((giro * 0.25 + n / 4) % 1 + 1) % 1;
    const r = m * (0.3 + avance * 0.62);
    ctx.beginPath();
    ctx.arc(m, m, r, 0, Math.PI * 2);
    ctx.strokeStyle = hsla(p, n, 8, (1 - avance) * (0.45 + empuje * 0.4));
    ctx.lineWidth = Math.max(1.5, m * (0.035 + empuje * 0.03));
    ctx.stroke();
  }
  const r = m * 0.34 * escala * (1 + empuje * 0.25);
  const g = ctx.createRadialGradient(m - r * 0.3, m - r * 0.35, r * 0.1, m, m, r);
  g.addColorStop(0, hsla(p, 0, 24, 1));
  g.addColorStop(1, hsla(p, 1, -4, 1));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(m, m, r, 0, Math.PI * 2);
  ctx.fill();
  brillo(ctx, m, escala * 0.7, 0.4);
}

/** Destellos: puntitos que orbitan y se alborotan con la voz */
function particulas(ctx: CanvasRenderingContext2D, p: Paleta, k: Momento) {
  const { m, giro, empuje, escala, t } = k;
  const total = 42;
  for (let i = 0; i < total; i++) {
    const a = (i / total) * Math.PI * 2 + giro * (i % 2 ? 0.5 : -0.35);
    const ruido = Math.sin(i * 12.9 + t / 260) * 0.5 + 0.5;
    const r = m * (0.42 + 0.1 * Math.sin(i * 3 + giro * 2) + empuje * 0.25 * ruido) * escala;
    const tam = m * (0.022 + 0.03 * ruido * (0.4 + empuje));
    ctx.beginPath();
    ctx.arc(m + Math.cos(a) * r, m + Math.sin(a) * r, tam, 0, Math.PI * 2);
    ctx.fillStyle = hsla(p, i, 10, 0.55 + 0.4 * ruido);
    ctx.fill();
  }
  const g = ctx.createRadialGradient(m, m, 0, m, m, m * 0.36 * escala);
  g.addColorStop(0, hsla(p, 0, 28, 0.85));
  g.addColorStop(1, hsla(p, 2, 0, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(m, m, m * 0.36 * escala, 0, Math.PI * 2);
  ctx.fill();
}

/** Una flor: pétalos que se abren cuando habla y se recogen cuando piensa */
function flor(ctx: CanvasRenderingContext2D, p: Paleta, k: Momento) {
  const { m, giro, empuje, escala } = k;
  const petalos = 7;
  const largo = m * (0.36 + empuje * 0.16) * escala;
  for (let capa = 0; capa < 2; capa++) {
    for (let i = 0; i < petalos; i++) {
      const a = (i / petalos) * Math.PI * 2 + giro * (capa ? -0.25 : 0.35) + capa * (Math.PI / petalos);
      ctx.save();
      ctx.translate(m, m);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, -largo * (capa ? 0.55 : 0.62), largo * (capa ? 0.26 : 0.3), largo * (capa ? 0.55 : 0.62), 0, 0, Math.PI * 2);
      const g = ctx.createLinearGradient(0, 0, 0, -largo * 1.2);
      g.addColorStop(0, hsla(p, i + capa, 22, 0.85));
      g.addColorStop(1, hsla(p, i + capa + 1, -2, 0.55));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.beginPath();
  ctx.arc(m, m, m * 0.13 * escala, 0, Math.PI * 2);
  ctx.fillStyle = hsla(p, 0, 30, 1);
  ctx.fill();
  brillo(ctx, m, escala * 0.45, 0.45);
}

function brillo(ctx: CanvasRenderingContext2D, m: number, escala: number, fuerza: number) {
  const r = m * 0.5 * escala;
  const g = ctx.createRadialGradient(m - m * 0.15, m - m * 0.2, 0, m, m, r);
  g.addColorStop(0, `rgba(255,255,255,${fuerza})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(m, m, r, 0, Math.PI * 2);
  ctx.fill();
}

const FORMAS: Record<EstiloEsfera, (ctx: CanvasRenderingContext2D, p: Paleta, k: Momento) => void> = { aurora, perla, ondas, anillos, particulas, flor };

/** Cuánto tarda en seguir al sonido: sube rápido (que se note la sílaba) y baja con calma (que no tiemble) */
const SUBIDA_S = 0.06;
const BAJADA_S = 0.22;
/** Con la reacción al máximo, la forma se mueve más pero sin romperse */
const MAXIMO_EMPUJE = 1.6;

/**
 * La esfera de Lalan, como la de Siri o Gemini: reacciona al sonido.
 *  · reposo: respira despacio.
 *  · escuchando: crece y se ondula con la voz de la persona.
 *  · pensando: gira rápido y se recoge.
 *  · hablando: se mueve con la voz de Lalan, sílaba por sílaba.
 * El sonido no mueve la forma de golpe: la arrastra un resorte suave
 * (sube rápido, baja despacio), así se ve fluida y no a saltos.
 * La forma, los colores y el ritmo salen de Plataforma → Lalan (o de las
 * props, para las vistas previas). Con "reducir movimiento" casi no se mueve.
 */
export const EsferaLalan: React.FC<{
  modo: ModoEsfera; nivel?: number; pulso?: number; tamano?: number;
  estilo?: EstiloEsfera; color?: ColorEsfera; ritmo?: number;
  /** Cuánto reacciona al sonido (si no, el de Plataforma) */
  reaccion?: number;
  /** Vista previa: al "hablar" simula una voz (no hay audio de Lalan sonando) */
  simulada?: boolean;
}> = ({ modo, nivel = 0, pulso = 0, tamano = 200, estilo, color, ritmo, reaccion, simulada = false }) => {
  const lienzo = useRef<HTMLCanvasElement>(null);
  // `pulso` ya no mueve la esfera (el nivel de la voz lo lee ella misma, cuadro a cuadro); se acepta por compatibilidad
  void pulso;
  const estado = useRef({ modo, nivel, suave: 0, giro: 0, estilo, color, ritmo, reaccion, simulada });
  Object.assign(estado.current, { modo, nivel, estilo, color, ritmo, reaccion, simulada });

  useEffect(() => {
    const c = lienzo.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = tamano * dpr;
    c.height = tamano * dpr;
    ctx.scale(dpr, dpr);
    const quieta = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let paleta: Paleta | null = null;
    let colorDeLaPaleta = '';
    let anterior = performance.now();
    let cuadro = 0;

    const dibujar = (t: number) => {
      const dt = Math.min(0.05, (t - anterior) / 1000);
      anterior = t;
      const e = estado.current;
      const aj = ajustesLalan();
      const forma = (e.estilo ?? aj.estiloEsfera) as EstiloEsfera;
      const colorElegido = (e.color ?? aj.colorEsfera) as ColorEsfera;
      if (!paleta || colorDeLaPaleta !== colorElegido) { paleta = paletaDe(colorElegido); colorDeLaPaleta = colorElegido; }
      const ritmoElegido = e.ritmo ?? aj.ritmoEsfera ?? 1;
      // A qué nivel quiere ir: la voz de la persona, la de Lalan o nada
      const objetivo = e.modo === 'escuchando' ? Math.min(1, e.nivel * 1.4)
        : e.modo === 'hablando' ? (e.simulada ? ritmoDeHabla(t, t - (t % 600)) : nivelDeLalan(t)) : 0;
      const tau = objetivo > e.suave ? SUBIDA_S : BAJADA_S;
      e.suave += (objetivo - e.suave) * (1 - Math.exp(-dt / tau));
      // "Reacción a la voz" (Plataforma → Lalan): cuánto se mueve con el sonido. Con tope, para que no se deforme de más
      const reaccionElegida = e.reaccion ?? aj.reaccionEsfera ?? 1;
      const empuje = Math.min(MAXIMO_EMPUJE, e.suave * reaccionElegida) * (quieta ? 0.3 : 1);
      // Con más sonido gira un poco más rápido: la forma "fluye" con la voz en vez de solo inflarse
      const velocidad = ((e.modo === 'pensando' ? 3.2 : e.modo === 'hablando' ? 1.1 : e.modo === 'escuchando' ? 1.0 : 0.6) + empuje * 1.4) * ritmoElegido;
      if (!quieta) e.giro += dt * velocidad;
      const escala = (e.modo === 'pensando' ? 0.82 : 0.86) + empuje * 0.24 + (quieta ? 0 : Math.sin(t / 1400) * 0.02);
      const m = tamano / 2;

      ctx.clearRect(0, 0, tamano, tamano);
      // Halo
      const halo = ctx.createRadialGradient(m, m, m * 0.2, m, m, m);
      halo.addColorStop(0, hsla(paleta, 0, 0, 0.18 + empuje * 0.2));
      halo.addColorStop(1, hsla(paleta, 0, 0, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, tamano, tamano);
      (FORMAS[forma] ?? aurora)(ctx, paleta, { m, giro: e.giro, empuje, escala, t, quieta });

      cuadro = requestAnimationFrame(dibujar);
    };
    cuadro = requestAnimationFrame(dibujar);
    return () => cancelAnimationFrame(cuadro);
  }, [tamano]);

  return <canvas ref={lienzo} style={{ width: tamano, height: tamano }} aria-hidden="true" />;
};
