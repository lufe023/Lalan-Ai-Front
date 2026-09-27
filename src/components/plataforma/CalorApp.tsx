import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

/**
 * El mapa de calor DENTRO de la app. El panel de plataforma abre
 * /app/?calor=app&pantalla=calendar&dispositivo=pc en un marco; aquí se
 * piden los toques de esa pantalla y se pintan encima, en su misma posición
 * relativa (sobre lo que se desplaza, o sobre lo visible).
 */
interface Punto { zona: string; x: number; y: number }

const RADIO = 26;
const PALETA: [number, [number, number, number]][] = [[0, [59, 130, 246]], [0.35, [34, 197, 94]], [0.65, [250, 204, 21]], [1, [239, 68, 68]]];
function color(v: number): [number, number, number] {
  for (let i = 1; i < PALETA.length; i++) {
    const [p1, c1] = PALETA[i], [p0, c0] = PALETA[i - 1];
    if (v <= p1) { const k = (v - p0) / (p1 - p0); return [0, 1, 2].map((j) => Math.round(c0[j] + (c1[j] - c0[j]) * k)) as [number, number, number]; }
  }
  return PALETA[PALETA.length - 1][1];
}

function pintar(caja: HTMLElement, puntos: Punto[], alto: number) {
  const w = caja.clientWidth, h = alto;
  if (!w || !h || !puntos.length) return;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;pointer-events:none;z-index:60;mix-blend-mode:multiply`;
  const x = c.getContext('2d')!;
  puntos.forEach((p) => {
    const g = x.createRadialGradient(p.x * w, p.y * h, 0, p.x * w, p.y * h, RADIO);
    g.addColorStop(0, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(p.x * w - RADIO, p.y * h - RADIO, RADIO * 2, RADIO * 2);
  });
  const img = x.getImageData(0, 0, w, h);
  let max = 1;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > max) max = img.data[i];
  for (let i = 0; i < img.data.length; i += 4) {
    const a = img.data[i + 3]; if (!a) continue;
    const [r, g, b] = color(a / max);
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = Math.min(220, 60 + a * 1.4);
  }
  x.putImageData(img, 0, 0);
  if (getComputedStyle(caja).position === 'static') caja.style.position = 'relative';
  caja.appendChild(c);
}

export const CalorApp: React.FC<{ pantalla: string; dispositivo: string; desde?: string; negocio?: string }> = ({ pantalla, dispositivo, desde, negocio }) => {
  const [texto, setTexto] = useState('Cargando el mapa de calor…');
  useEffect(() => {
    let vivo = true;
    const q = new URLSearchParams({ pantalla, dispositivo, ...(desde ? { desde } : {}), ...(negocio ? { negocio } : {}) });
    api.get<Punto[]>(`/plataforma/app/clics?${q}`).then((puntos) => {
      if (!vivo) return;
      // Esperar a que la pantalla termine de cargar sus datos y acomodarse
      window.setTimeout(() => {
        const contenido = document.querySelector<HTMLElement>(`[data-pantalla="${pantalla}"] [data-desplazable]`);
        const visible = document.querySelector<HTMLElement>(`[data-pantalla="${pantalla}"]`);
        if (contenido) pintar(contenido, puntos.filter((p) => p.zona === 'contenido'), contenido.scrollHeight);
        if (visible) pintar(visible, puntos.filter((p) => p.zona === 'pantalla'), visible.clientHeight);
        setTexto(`${puntos.length.toLocaleString('es-DO')} toques en esta pantalla`);
      }, 1500);
    }).catch((e) => setTexto((e as Error).message));
    return () => { vivo = false; };
  }, [pantalla, dispositivo, desde, negocio]);
  return (
    <div className="fixed left-1/2 bottom-4 -translate-x-1/2 z-[300] px-4 py-2 rounded-full bg-[#1C1216] text-white text-[12px] font-bold shadow-lg flex items-center gap-3">
      {texto}<i className="inline-block w-24 h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#3B82F6,#22C55E,#FACC15,#EF4444)' }} />poco → mucho
    </div>
  );
};
