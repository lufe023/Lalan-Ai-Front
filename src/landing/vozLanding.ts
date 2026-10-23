/**
 * La voz de la Lalan de la landing, frase por frase: la primera frase se
 * pide sola (llega rápido y empieza a hablar antes) y el resto mientras
 * suena. Se puede pausar sin cortarla (cuando le hablan encima) y seguir
 * donde iba.
 */
import { API } from './api';
import { elegirVozNavegador, hayVozNavegador, pronunciar, sinEmojis } from './vozNavegador';

export interface ConfigVoz { motor: 'apagada' | 'navegador' | 'nube'; voces: string[]; velocidad: number; pronuncia?: string }

/** Lo más que se pide de una vez al servidor después de la primera frase */
const LARGO_TROZO = 380;

/**
 * Los pedazos que se dicen, cortados por frases. Cada uno es un pedazo
 * EXACTO del texto: el servidor solo dice lo que Lalan ya contestó.
 */
export function trozosDe(texto: string): string[] {
  const cortes: number[] = [];
  const re = /[.!?…]+["»)]?\s+/g;
  for (let m = re.exec(texto); m; m = re.exec(texto)) cortes.push(m.index + m[0].length);
  cortes.push(texto.length);
  const salida: string[] = [];
  let desde = 0;
  let hasta = 0;
  for (const c of cortes) {
    // La primera frase va sola; luego se juntan hasta LARGO_TROZO
    if (hasta > desde && (salida.length === 0 || c - desde > LARGO_TROZO)) {
      salida.push(texto.slice(desde, hasta).trim());
      desde = hasta;
    }
    hasta = c;
  }
  if (hasta > desde) salida.push(texto.slice(desde, hasta).trim());
  return salida.filter(Boolean);
}

/** Un wav mudo de un instante: tocarlo en un toque "abre" el reproductor en el iPhone */
function wavMudo(): string {
  const n = 800;
  const b = new DataView(new ArrayBuffer(44 + n));
  const t = (o: number, s: string) => { for (let i = 0; i < s.length; i++) b.setUint8(o + i, s.charCodeAt(i)); };
  t(0, 'RIFF'); b.setUint32(4, 36 + n, true); t(8, 'WAVE'); t(12, 'fmt ');
  b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true); b.setUint32(24, 8000, true);
  b.setUint32(28, 8000, true); b.setUint16(32, 1, true); b.setUint16(34, 8, true); t(36, 'data'); b.setUint32(40, n, true);
  for (let i = 0; i < n; i++) b.setUint8(44 + i, 128);
  let bin = '';
  for (let i = 0; i < b.byteLength; i++) bin += String.fromCharCode(b.getUint8(i));
  return `data:audio/wav;base64,${btoa(bin)}`;
}

export function crearVoz(conversacion: () => string) {
  let turno = 0;
  let pausada = false;
  let alSeguir: (() => void) | null = null;
  let reproductor: HTMLAudioElement | null = null;
  let pedidos: AbortController | null = null;
  const elReproductor = () => (reproductor ??= new Audio());
  const hastaQueSiga = () => (pausada ? new Promise<void>((ok) => { alSeguir = ok; }) : Promise.resolve());

  const pedir = async (texto: string, senal: AbortSignal) => {
    const r = await fetch(`${API}/public/landing/voz`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: senal,
      body: JSON.stringify({ conversacionId: conversacion(), texto }),
    });
    if (!r.ok) throw new Error(String(r.status));
    return r.blob();
  };

  const tocar = async (blob: Blob, mio: number, velocidad: number) => {
    await hastaQueSiga();
    if (mio !== turno) return;
    const a = elReproductor();
    const url = URL.createObjectURL(blob);
    await new Promise<void>((listo) => {
      const fin = () => { a.onended = null; a.onerror = null; a.onpause = null; URL.revokeObjectURL(url); listo(); };
      a.onended = fin;
      a.onerror = fin;
      a.onpause = () => { if (mio !== turno) fin(); };
      a.src = url;
      a.playbackRate = velocidad;
      void a.play().catch(fin);
    });
  };

  const conNube = async (partes: string[], mio: number, cfg: ConfigVoz) => {
    pedidos?.abort();
    const control = new AbortController();
    pedidos = control;
    const audios = partes.map((p) => { const x = pedir(p, control.signal); x.catch(() => undefined); return x; });
    for (const audio of audios) {
      const blob = await audio;
      if (mio !== turno) return;
      await tocar(blob, mio, cfg.velocidad);
      if (mio !== turno) return;
    }
  };

  const conNavegador = async (partes: string[], mio: number, cfg: ConfigVoz) => {
    const voz = await elegirVozNavegador(cfg.voces);
    let i = 0;
    await new Promise<void>((listo) => {
      const siguiente = () => {
        if (mio !== turno || i >= partes.length) { listo(); return; }
        if (pausada) { alSeguir = siguiente; return; }
        const actual = i++;
        // Pausada a media frase: al seguir la repite entera (esta voz no se pausa bien en todos los teléfonos)
        const fin = () => { if (mio === turno && pausada) { i = actual; alSeguir = siguiente; return; } siguiente(); };
        const u = new SpeechSynthesisUtterance(pronunciar(sinEmojis(partes[actual].replace(/[*_#`>~|]/g, '')), cfg.pronuncia ?? 'Lalán'));
        if (voz) { u.voice = voz; u.lang = voz.lang; } else u.lang = 'es-DO';
        u.rate = cfg.velocidad;
        u.onend = fin;
        u.onerror = fin;
        try { speechSynthesis.speak(u); } catch { listo(); }
      };
      siguiente();
    });
  };

  const callar = () => {
    turno++;
    pausada = false;
    const f = alSeguir; alSeguir = null; f?.();
    pedidos?.abort(); pedidos = null;
    try { reproductor?.pause(); } catch { /* noop */ }
    if (hayVozNavegador()) speechSynthesis.cancel();
  };

  return {
    /** Lalan dice el texto; termina cuando acaba o la callan. Falla si la voz del servidor no está */
    async decir(texto: string, cfg: ConfigVoz): Promise<void> {
      callar();
      const mio = ++turno;
      const partes = trozosDe(texto);
      if (!partes.length) return;
      if (cfg.motor === 'nube') return conNube(partes, mio, cfg);
      if (cfg.motor === 'navegador' && hayVozNavegador()) return conNavegador(partes, mio, cfg);
    },
    callar,
    pausar() {
      if (pausada) return;
      pausada = true;
      try { if (reproductor && !reproductor.paused) reproductor.pause(); } catch { /* noop */ }
      try { if (hayVozNavegador() && speechSynthesis.speaking) speechSynthesis.cancel(); } catch { /* noop */ }
    },
    seguir() {
      if (!pausada) return;
      pausada = false;
      const a = reproductor;
      if (a && a.src && a.paused && !a.ended && a.currentTime > 0) void a.play().catch(() => undefined);
      const f = alSeguir; alSeguir = null; f?.();
    },
    /** Si suena ahora (para medir su eco cuando le hablan encima) */
    suena(): boolean {
      try { return (!!reproductor && !reproductor.paused && !reproductor.ended) || (hayVozNavegador() && speechSynthesis.speaking); } catch { return false; }
    },
    /** Se llama en un toque: después el iPhone deja sonar la voz sin otro toque */
    despertar(cfg: ConfigVoz) {
      try { const a = elReproductor(); a.src = wavMudo(); void a.play().catch(() => undefined); } catch { /* noop */ }
      if (cfg.motor === 'navegador' && hayVozNavegador()) {
        try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch { /* noop */ }
      }
    },
  };
}
