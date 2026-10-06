/**
 * "Conectar solo Instagram": la dueña entra con su usuario de Instagram (sin
 * Facebook ni página). En la computadora se abre en una ventana aparte; en el
 * teléfono (y en la app instalada) se va en la misma pestaña y vuelve a Lalan
 * por /instagram-conectado → /app/?ig_code=…
 */
import { api } from '../services/api';

/** Lo que manda /instagram-conectado a la ventana de Lalan */
interface RespuestaVentana { tipo: 'lalan-instagram'; code: string; state: string; error: string }

const ESPERA_CERRADA_MS = 500;

const enComputadora = () => window.matchMedia?.('(pointer: fine)').matches && !window.matchMedia?.('(display-mode: standalone)').matches;

function esperarVentana(ventana: Window): Promise<RespuestaVentana> {
  return new Promise((resolve, reject) => {
    const alRecibir = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.tipo !== 'lalan-instagram') return;
      limpiar(); resolve(e.data as RespuestaVentana);
    };
    const reloj = window.setInterval(() => {
      if (ventana.closed) { limpiar(); reject(new Error('Cerraste la ventana de Instagram antes de terminar.')); }
    }, ESPERA_CERRADA_MS);
    const limpiar = () => { window.removeEventListener('message', alRecibir); window.clearInterval(reloj); };
    window.addEventListener('message', alRecibir);
  });
}

export async function terminarConexionInstagram(code: string, state: string) {
  return api.post<{ conectado: boolean; instagram: string }>('/bots/conexion/instagram', { code, state });
}

/**
 * Abre la ventana de Instagram y termina la conexión. Devuelve la cuenta
 * conectada ("@salon"), o null si se fue en la misma pestaña (la termina
 * RetornoInstagram al volver).
 */
export async function conectarSoloInstagram(sede?: string): Promise<string | null> {
  // La ventana se abre YA (con el toque); si se abriera después de pedir la URL, el navegador la bloquea
  const ventana = enComputadora() ? window.open('', 'lalan-instagram', 'width=520,height=720') : null;
  try {
    const { url } = await api.get<{ url: string }>(`/bots/conexion/instagram/url${sede ? `?sede=${encodeURIComponent(sede)}` : ''}`);
    if (!ventana) { window.location.assign(url); return null; }
    ventana.location.href = url;
    const r = await esperarVentana(ventana);
    if (!r.code) throw new Error(r.error ? `Instagram: ${r.error}` : 'No se completó la conexión con Instagram.');
    return (await terminarConexionInstagram(r.code, r.state)).instagram;
  } catch (e) {
    ventana?.close();
    throw e;
  }
}
