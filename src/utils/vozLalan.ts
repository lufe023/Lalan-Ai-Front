/**
 * La voz de Lalan en su pantalla: la del propio teléfono o computadora
 * (speechSynthesis). Gratis y sin claves. Las voces las instala el sistema,
 * así que cada aparato guarda la suya.
 *
 * Las preferidas, en orden (las que mejor suenan, probadas por Luis):
 *  · iPhone / Mac: Paulina (español de México).
 *  · Chrome en Windows o Android: "Google español de Estados Unidos".
 * Si no está ninguna, cualquier voz en español.
 */
import { alCargarVoces, hayVoz, vocesDisponibles } from './campana';

const CLAVE_VOZ = 'lalan_asistente_voz';
const CLAVE_CALLADA = 'lalan_asistente_callada';
const PREFERIDAS = [/paulina/i, /google español de estados unidos/i, /m[oó]nica/i, /google español/i];
const IDIOMAS = ['es-mx', 'es-us', 'es-do', 'es-419', 'es-es'];
/** Chrome corta las frases largas a los ~15 s: se dice frase por frase */
const LARGO_TROZO = 180;

export { alCargarVoces, hayVoz };

export function vocesEnEspanol(): SpeechSynthesisVoice[] {
  return vocesDisponibles().filter((v) => v.lang?.toLowerCase().startsWith('es'));
}

export function vozGuardada(): string | null {
  try { return localStorage.getItem(CLAVE_VOZ); } catch { return null; }
}
export function guardarVoz(nombre: string | null) {
  try { if (nombre) localStorage.setItem(CLAVE_VOZ, nombre); else localStorage.removeItem(CLAVE_VOZ); } catch { /* sin almacenamiento: usa la preferida */ }
}
export function estaCallada(): boolean {
  try { return localStorage.getItem(CLAVE_CALLADA) === '1'; } catch { return false; }
}
export function callarSiempre(si: boolean) {
  try { if (si) localStorage.setItem(CLAVE_CALLADA, '1'); else localStorage.removeItem(CLAVE_CALLADA); } catch { /* noop */ }
}

/** La voz que se usará: la guardada, si no la mejor que haya */
export function vozDeLalan(): SpeechSynthesisVoice | null {
  const voces = vocesEnEspanol();
  if (!voces.length) return vocesDisponibles()[0] ?? null;
  const guardada = vozGuardada();
  const exacta = guardada ? voces.find((v) => v.name === guardada) : null;
  if (exacta) return exacta;
  for (const p of PREFERIDAS) { const v = voces.find((x) => p.test(x.name)); if (v) return v; }
  for (const l of IDIOMAS) { const v = voces.find((x) => x.lang.toLowerCase() === l); if (v) return v; }
  return voces[0];
}

/**
 * El iPhone solo deja hablar después de un toque. Se llama al tocar la
 * esfera: una frase vacía "abre" la voz para lo que venga después.
 */
export function despertarVoz() {
  if (!hayVoz()) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch { /* noop */ }
}

function trozos(texto: string): string[] {
  const frases = texto.replace(/\s+/g, ' ').trim().match(/[^.!?¿¡]+[.!?]*|[¿¡][^?!]+[?!]/g) ?? [texto];
  const salida: string[] = [];
  let actual = '';
  for (const f of frases.map((x) => x.trim()).filter(Boolean)) {
    if ((actual + ' ' + f).trim().length > LARGO_TROZO && actual) { salida.push(actual); actual = f; }
    else actual = `${actual} ${f}`.trim();
  }
  if (actual) salida.push(actual);
  return salida;
}

let turno = 0;

/**
 * Lalan dice el texto. Devuelve cuando termina (o cuando la cortan).
 * `alHablar` se llama con cada palabra: sirve para animar la esfera.
 */
export function decirComoLalan(texto: string, alHablar?: () => void): Promise<void> {
  callarLalan();
  if (!hayVoz() || !texto.trim()) return Promise.resolve();
  const mio = ++turno;
  const voz = vozDeLalan();
  const partes = trozos(texto);
  return new Promise((listo) => {
    let i = 0;
    const siguiente = () => {
      if (mio !== turno || i >= partes.length) { listo(); return; }
      const u = new SpeechSynthesisUtterance(partes[i++]);
      if (voz) { u.voice = voz; u.lang = voz.lang; } else u.lang = 'es-MX';
      u.rate = 1.02;
      u.pitch = 1.05;
      u.onboundary = () => alHablar?.();
      u.onend = siguiente;
      u.onerror = siguiente;
      try { window.speechSynthesis.speak(u); } catch { listo(); }
    };
    siguiente();
  });
}

/** Cortar a Lalan al instante (la dueña tocó la esfera o se fue) */
export function callarLalan() {
  turno++;
  try { window.speechSynthesis?.cancel?.(); } catch { /* noop */ }
}

export function lalanHablando(): boolean {
  try { return !!window.speechSynthesis?.speaking; } catch { return false; }
}
