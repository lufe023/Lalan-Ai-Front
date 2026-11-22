/**
 * Los avisos por WhatsApp traen `/app/?ir=…&entrar=<llave>`.
 *
 * iPhone abre los enlaces de WhatsApp en Safari, no en la app instalada
 * (Apple no deja que una app web se quede con sus enlaces), y Safari no
 * tiene la sesión de la app. La llave hace que Safari entre solo, una vez,
 * directo a la pantalla del aviso. En Android, con la app instalada desde
 * Chrome, el enlace suele abrir la app misma (ahí ya hay sesión y la llave
 * no se usa).
 */

const CLAVE_DESTINO = 'lalan.irAlEntrar';
const CLAVE_VINO = 'lalan.vinoDeEnlace';
/** Un destino guardado y no usado no debe llevarla ahí días después */
const DESTINO_VIVE_MS = 30 * 60 * 1000;
const LLAVE = /^[A-Za-z0-9_-]{43}$/;

/** Saca la llave de la dirección (que no quede en el historial) y la devuelve */
export function tomarLlaveDelEnlace(): string | null {
  try {
    const u = new URL(window.location.href);
    const llave = u.searchParams.get('entrar');
    if (!u.searchParams.has('entrar')) return null;
    u.searchParams.delete('entrar');
    window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash);
    try { sessionStorage.setItem(CLAVE_VINO, '1'); } catch { /* nada */ }
    return llave && LLAVE.test(llave) ? llave : null;
  } catch { return null; }
}

/** ¿Llegó por un enlace de un aviso? (para no ofrecerle instalar la app que ya usa) */
export function vinoDeUnEnlace(): boolean {
  try { return sessionStorage.getItem(CLAVE_VINO) === '1'; } catch { return false; }
}

/** La pantalla del enlace, para ir ahí después de entrar con la clave */
export function guardarDestino(pantalla: string) {
  try { sessionStorage.setItem(CLAVE_DESTINO, JSON.stringify({ pantalla, t: Date.now() })); } catch { /* nada */ }
}

/** La pantalla a la que iba (una sola vez) */
export function tomarDestino(): string | null {
  try {
    const raw = sessionStorage.getItem(CLAVE_DESTINO);
    sessionStorage.removeItem(CLAVE_DESTINO);
    if (!raw) return null;
    const d = JSON.parse(raw) as { pantalla?: string; t?: number };
    return d.pantalla && d.t && Date.now() - d.t < DESTINO_VIVE_MS ? d.pantalla : null;
  } catch { return null; }
}
