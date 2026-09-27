import { useEffect, useRef } from 'react';
import { apiFetch } from '../services/api';

/**
 * Cómo se usa la app por dentro, para el mapa de calor del super admin.
 *
 * Se guarda qué pantalla se abre (y cuánto se estuvo en la anterior) y dónde
 * se toca, en posición relativa. NUNCA el texto de lo tocado: solo etiquetas
 * pensadas para eso (data-medir, aria-label, title o id). Así no viaja el
 * nombre de ninguna clienta.
 */
type Zona = 'contenido' | 'pantalla' | 'menu';
interface Evento { tipo: 'pantalla' | 'clic'; pantalla: string; zona?: Zona; x?: number; y?: number; detalle?: string; valor?: number }

const CADA_MS = 15_000;
const LARGO_DETALLE = 60;

function dispositivo(): 'movil' | 'tableta' | 'pc' {
  const w = window.innerWidth;
  return w < 640 ? 'movil' : w < 1024 ? 'tableta' : 'pc';
}

function etiqueta(el: Element | null): string | undefined {
  const c = el?.closest('[data-medir], button, a, [role="button"], input, select, textarea, label');
  if (!c) return undefined;
  const v = c.getAttribute('data-medir') || c.getAttribute('aria-label') || c.getAttribute('title') || c.id
    || (c instanceof HTMLInputElement || c instanceof HTMLTextAreaElement ? c.placeholder : '');
  return v ? v.trim().slice(0, LARGO_DETALLE) : undefined;
}

export function useUsoApp(pantalla: string, activo: boolean): void {
  const cola = useRef<Evento[]>([]);
  const actual = useRef({ pantalla, desde: Date.now() });

  const enviar = () => {
    if (!cola.current.length) return;
    const eventos = cola.current.splice(0, 80);
    void apiFetch('/uso-app', { method: 'POST', body: JSON.stringify({ dispositivo: dispositivo(), eventos }), keepalive: true }).catch(() => {});
  };

  // Cada cambio de pantalla
  useEffect(() => {
    if (!activo) return;
    const antes = actual.current;
    const segundos = Math.round((Date.now() - antes.desde) / 1000);
    cola.current.push({ tipo: 'pantalla', pantalla, valor: antes.pantalla === pantalla ? 0 : Math.min(segundos, 86400) });
    actual.current = { pantalla, desde: Date.now() };
  }, [pantalla, activo]);

  useEffect(() => {
    if (!activo) return;
    const alTocar = (ev: MouseEvent) => {
      const el = ev.target as Element | null;
      if (!el) return;
      const menu = el.closest('[data-menu]');
      const pant = el.closest('[data-pantalla]');
      let zona: Zona = 'pantalla';
      let caja: Element | null = pant;
      let x: number | undefined; let y: number | undefined;
      if (menu) { zona = 'menu'; caja = menu; }
      const desplazable = !menu ? el.closest('[data-desplazable]') : null;
      if (desplazable) {
        const r = desplazable.getBoundingClientRect();
        zona = 'contenido';
        x = (ev.clientX - r.left) / r.width;
        y = (ev.clientY - r.top + desplazable.scrollTop) / Math.max(desplazable.scrollHeight, 1);
      } else if (caja) {
        const r = caja.getBoundingClientRect();
        x = (ev.clientX - r.left) / r.width;
        y = (ev.clientY - r.top) / r.height;
      }
      if (x === undefined || y === undefined) return;
      cola.current.push({ tipo: 'clic', pantalla: menu ? 'menu' : actual.current.pantalla, zona, x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)), detalle: etiqueta(el) });
    };
    const alOcultar = () => { if (document.visibilityState === 'hidden') enviar(); };
    document.addEventListener('click', alTocar, { capture: true });
    document.addEventListener('visibilitychange', alOcultar);
    const t = window.setInterval(enviar, CADA_MS);
    return () => { document.removeEventListener('click', alTocar, { capture: true }); document.removeEventListener('visibilitychange', alOcultar); window.clearInterval(t); enviar(); };
  }, [activo]);
}
