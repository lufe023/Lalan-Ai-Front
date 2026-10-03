import React, { useEffect, useRef } from 'react';

export type ModoEsfera = 'reposo' | 'escuchando' | 'pensando' | 'hablando';

/** Las capas de la esfera: cada una gira y respira a su ritmo */
const CAPAS = [
  { tono: 0, vel: 0.42, fase: 0.0, radio: 0.62, puntas: 3 },
  { tono: 42, vel: -0.31, fase: 1.7, radio: 0.56, puntas: 4 },
  { tono: -62, vel: 0.27, fase: 3.1, radio: 0.52, puntas: 5 },
  { tono: 190, vel: -0.19, fase: 4.4, radio: 0.42, puntas: 3 },
];

function colorPrimario(): [number, number, number] {
  const crudo = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#C46B7C';
  const c = document.createElement('canvas').getContext('2d');
  if (!c) return [196, 107, 124];
  c.fillStyle = crudo;
  const hex = c.fillStyle as string;
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
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

/**
 * La esfera de Lalan, como la de Siri: capas de color que giran.
 *  · reposo: respira despacio.
 *  · escuchando: crece con la voz de la persona.
 *  · pensando: gira rápido y se recoge.
 *  · hablando: late con las palabras de Lalan.
 * Con "reducir movimiento" del sistema queda quieta (solo cambia de tamaño).
 */
export const EsferaLalan: React.FC<{ modo: ModoEsfera; nivel?: number; pulso?: number; tamano?: number }> = ({ modo, nivel = 0, pulso = 0, tamano = 200 }) => {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const estado = useRef({ modo, nivel, pulso, energia: 0, giro: 0, ultimoPulso: 0 });
  estado.current.modo = modo;
  estado.current.nivel = nivel;
  if (pulso !== estado.current.ultimoPulso) { estado.current.ultimoPulso = pulso; estado.current.energia = Math.min(1, estado.current.energia + 0.55); }

  useEffect(() => {
    const c = lienzo.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = tamano * dpr;
    c.height = tamano * dpr;
    ctx.scale(dpr, dpr);
    const base = aHsl(colorPrimario());
    const quieta = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let anterior = performance.now();
    let cuadro = 0;

    const dibujar = (t: number) => {
      const dt = Math.min(0.05, (t - anterior) / 1000);
      anterior = t;
      const e = estado.current;
      const velocidad = e.modo === 'pensando' ? 3.2 : e.modo === 'hablando' ? 1.6 : e.modo === 'escuchando' ? 1.3 : 0.6;
      if (!quieta) e.giro += dt * velocidad;
      e.energia = Math.max(0, e.energia - dt * 2.2);
      const empuje = e.modo === 'escuchando' ? Math.min(1, e.nivel * 1.4) : e.modo === 'hablando' ? e.energia : 0;
      const escala = (e.modo === 'pensando' ? 0.82 : 0.9) + empuje * 0.16 + (quieta ? 0 : Math.sin(t / 1400) * 0.02);

      const m = tamano / 2;
      ctx.clearRect(0, 0, tamano, tamano);
      // Halo
      const halo = ctx.createRadialGradient(m, m, m * 0.2, m, m, m);
      halo.addColorStop(0, `hsla(${base.h}, ${base.s * 100}%, ${base.l * 100}%, ${0.18 + empuje * 0.2})`);
      halo.addColorStop(1, `hsla(${base.h}, ${base.s * 100}%, ${base.l * 100}%, 0)`);
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, tamano, tamano);

      for (const capa of CAPAS) {
        const radio = m * capa.radio * escala;
        const ang = e.giro * capa.vel + capa.fase;
        ctx.beginPath();
        const pasos = 48;
        for (let i = 0; i <= pasos; i++) {
          const a = (i / pasos) * Math.PI * 2;
          const onda = Math.sin(a * capa.puntas + ang * 2) * (0.07 + empuje * 0.12) + Math.sin(a * 2 - ang) * 0.04;
          const rr = radio * (1 + onda);
          const x = m + Math.cos(a + ang) * rr;
          const y = m + Math.sin(a + ang) * rr;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.closePath();
        const h = (base.h + capa.tono + 360) % 360;
        const g = ctx.createRadialGradient(m - radio * 0.3, m - radio * 0.35, radio * 0.1, m, m, radio * 1.1);
        g.addColorStop(0, `hsla(${h}, ${base.s * 100}%, ${Math.min(80, base.l * 100 + 18)}%, 0.9)`);
        g.addColorStop(1, `hsla(${h}, ${base.s * 100}%, ${base.l * 100 - 6}%, 0.45)`);
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.72;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // Brillo del centro
      const brillo = ctx.createRadialGradient(m - m * 0.15, m - m * 0.2, 0, m, m, m * 0.5 * escala);
      brillo.addColorStop(0, 'rgba(255,255,255,0.32)');
      brillo.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = brillo;
      ctx.beginPath();
      ctx.arc(m, m, m * 0.5 * escala, 0, Math.PI * 2);
      ctx.fill();

      cuadro = requestAnimationFrame(dibujar);
    };
    cuadro = requestAnimationFrame(dibujar);
    return () => cancelAnimationFrame(cuadro);
  }, [tamano]);

  return <canvas ref={lienzo} style={{ width: tamano, height: tamano }} aria-hidden="true" />;
};
