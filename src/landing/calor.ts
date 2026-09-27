/**
 * Mapa de calor: solo cuando el panel de plataforma abre la landing con
 * ?calor=pc|movil|tableta. Pide los clics con la sesión del super admin
 * (misma web, mismo almacenamiento que la app) y los dibuja encima de cada
 * sección, en la misma posición relativa donde se tocó.
 */
import { API, leerToken, MODO_CALOR } from './api';

interface Clic { seccion: string; x: number; y: number }

const RADIO = 28;
/** Del azul (poco) al rojo (mucho) */
const PALETA: [number, [number, number, number]][] = [
  [0, [59, 130, 246]], [0.35, [34, 197, 94]], [0.65, [250, 204, 21]], [1, [239, 68, 68]],
];

function color(v: number): [number, number, number] {
  for (let i = 1; i < PALETA.length; i++) {
    const [p1, c1] = PALETA[i], [p0, c0] = PALETA[i - 1];
    if (v <= p1) {
      const k = (v - p0) / (p1 - p0);
      return [0, 1, 2].map((j) => Math.round(c0[j] + (c1[j] - c0[j]) * k)) as [number, number, number];
    }
  }
  return PALETA[PALETA.length - 1][1];
}

function dibujar(el: HTMLElement, puntos: Clic[]) {
  const w = el.offsetWidth, h = el.offsetHeight;
  if (!w || !h) return;
  const c = document.createElement('canvas');
  c.className = 'calor-lienzo'; c.width = w; c.height = h;
  const x = c.getContext('2d')!;
  // Primero la intensidad en gris, luego se colorea
  puntos.forEach((p) => {
    const g = x.createRadialGradient(p.x * w, p.y * h, 0, p.x * w, p.y * h, RADIO);
    g.addColorStop(0, 'rgba(0,0,0,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(p.x * w - RADIO, p.y * h - RADIO, RADIO * 2, RADIO * 2);
  });
  const img = x.getImageData(0, 0, w, h);
  let max = 1;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > max) max = img.data[i];
  for (let i = 0; i < img.data.length; i += 4) {
    const a = img.data[i + 3];
    if (!a) continue;
    const [r, g, b] = color(a / max);
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = Math.min(220, 60 + a * 1.4);
  }
  x.putImageData(img, 0, 0);
  el.appendChild(c);
}

export async function iniciarCalor(): Promise<void> {
  if (!MODO_CALOR) return;
  document.documentElement.classList.add('modo-calor');
  const barra = document.createElement('div');
  barra.className = 'calor-barra';
  barra.textContent = 'Cargando el mapa de calor…';
  document.body.appendChild(barra);
  const token = leerToken();
  if (!token) { barra.textContent = 'Entra a la app como super admin para ver el mapa de calor.'; return; }
  const q = new URLSearchParams(location.search);
  const params = new URLSearchParams({ dispositivo: MODO_CALOR });
  if (q.get('desde')) params.set('desde', q.get('desde')!);
  if (q.get('hasta')) params.set('hasta', q.get('hasta')!);
  try {
    const r = await fetch(`${API}/plataforma/landing/clics?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(r.status === 403 ? 'Solo el super admin puede ver el mapa de calor.' : 'No se pudo cargar el mapa.');
    const clics: Clic[] = await r.json();
    const porSeccion = new Map<string, Clic[]>();
    clics.forEach((c) => { const l = porSeccion.get(c.seccion) ?? []; l.push(c); porSeccion.set(c.seccion, l); });
    // Esperar a que la página termine de acomodarse (fuentes, 3D) para medir bien
    await document.fonts?.ready;
    porSeccion.forEach((puntos, id) => {
      const el = (id === 'barra' ? document.querySelector('header.barra') : document.getElementById(id)) as HTMLElement | null;
      if (el) dibujar(el, puntos);
    });
    const nombre = MODO_CALOR === 'pc' ? 'PC' : MODO_CALOR === 'movil' ? 'móvil' : 'tableta';
    barra.innerHTML = '';
    barra.append(`${clics.length.toLocaleString('es-DO')} clics · ${nombre}`, document.createElement('i'), 'poco → mucho');
  } catch (e) {
    barra.textContent = (e as Error).message;
  }
}
