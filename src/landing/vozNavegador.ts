/**
 * La voz del navegador (gratis): la usa la asistente de la landing cuando
 * Plataforma elige "Navegador", y Plataforma para probarla.
 */

/** Las voces cargan tarde en Chrome: se espera un momento a que lleguen */
function vocesDisponibles(): Promise<SpeechSynthesisVoice[]> {
  const ya = speechSynthesis.getVoices();
  if (ya.length) return Promise.resolve(ya);
  return new Promise((listo) => {
    const fin = () => listo(speechSynthesis.getVoices());
    speechSynthesis.addEventListener('voiceschanged', fin, { once: true });
    setTimeout(fin, 1200);
  });
}

/** La primera de las preferidas que tenga el aparato; si no, cualquiera en español (mejor la de RD/EE. UU./México) */
export async function elegirVozNavegador(preferidas: string[]): Promise<SpeechSynthesisVoice | null> {
  const voces = await vocesDisponibles();
  for (const nombre of preferidas) {
    const n = nombre.toLowerCase();
    const v = voces.find((x) => x.name.toLowerCase() === n) ?? voces.find((x) => x.name.toLowerCase().includes(n));
    if (v) return v;
  }
  const espanol = voces.filter((v) => v.lang.toLowerCase().startsWith('es'));
  return espanol.find((v) => /es-(do|us|mx|419)/i.test(v.lang)) ?? espanol[0] ?? null;
}

/**
 * Cómo suena el nombre: se escribe "Lalan" pero se dice "Lalán" (lo elige
 * Plataforma → Lalan → La voz). Igual que el servidor (asistente-voz.service.ts).
 */
export function pronunciar(texto: string, como: string | null | undefined): string {
  const dicho = (como ?? '').trim();
  return dicho ? texto.replace(/\blalan\b/gi, dicho) : texto;
}

/** Emojis y lo que los arma (tono de piel, unión, variación, banderas, teclas): la voz no los dice. Igual que el servidor */
const EMOJIS = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}\u200D\uFE0E\uFE0F\u20E3]/gu;
export function sinEmojis(texto: string): string {
  return texto.replace(EMOJIS, '').replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
}

export const hayVozNavegador = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Dice el texto; termina (o falla) cuando acaba de hablar */
export async function decirConNavegador(texto: string, preferidas: string[], velocidad = 1, pronuncia = 'Lalán'): Promise<void> {
  if (!hayVozNavegador()) throw new Error('Este navegador no tiene voz');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(pronunciar(sinEmojis(texto.replace(/[*_#`>~|]/g, '')), pronuncia));
  const voz = await elegirVozNavegador(preferidas);
  if (voz) { u.voice = voz; u.lang = voz.lang; } else u.lang = 'es-DO';
  u.rate = velocidad;
  await new Promise<void>((listo, falla) => {
    u.onend = () => listo();
    u.onerror = (e) => (e.error === 'interrupted' || e.error === 'canceled' ? listo() : falla(new Error(e.error)));
    speechSynthesis.speak(u);
  });
}
