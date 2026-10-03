import { useCallback, useEffect, useRef, useState } from 'react';

/** Los formatos que graban los navegadores (iPhone: mp4; Chrome/Android: webm) */
const FORMATOS = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
/** Silencio después de hablar que da por terminada la frase */
const SILENCIO_FINAL_MS = 1500;
/** Si en este tiempo no dijo nada, se deja de escuchar */
const SIN_VOZ_MS = 7000;
/** Lo más que dura una pregunta */
const MAXIMO_MS = 60_000;
/** Lo primero se usa para medir el ruido del lugar */
const CALIBRAR_MS = 300;
const TIC_MS = 60;
/** Volumen mínimo que cuenta como voz (aunque el lugar esté en silencio total) */
const VOZ_MINIMA = 0.018;

export type EstadoEscucha = 'quieta' | 'escuchando';

/**
 * Escuchar a la dueña como Siri: se toca, habla, y cuando se calla un
 * segundo y medio la grabación se corta sola y se entrega. El corte se
 * decide aquí, en el teléfono (gratis): solo viaja la frase.
 */
export function useEscucha(opts: {
  onFrase: (audio: Blob) => void;
  onNada: () => void;
  onError: (mensaje: string) => void;
}) {
  const [estado, setEstado] = useState<EstadoEscucha>('quieta');
  /** Volumen de ahora (0 a 1), para animar la esfera */
  const [nivel, setNivel] = useState(0);
  const r = useRef<{
    grabador: MediaRecorder | null; flujo: MediaStream | null; ctx: AudioContext | null; analizador: AnalyserNode | null;
    tic: number | null; trozos: Blob[]; inicio: number; ultimaVoz: number; hablo: boolean; ruido: number; muestras: number[]; cancelado: boolean;
  }>({ grabador: null, flujo: null, ctx: null, analizador: null, tic: null, trozos: [], inicio: 0, ultimaVoz: 0, hablo: false, ruido: 0, muestras: [], cancelado: false });
  const op = useRef(opts);
  op.current = opts;

  const soltar = useCallback(() => {
    const s = r.current;
    if (s.tic) window.clearInterval(s.tic);
    s.tic = null;
    s.flujo?.getTracks().forEach((t) => t.stop());
    s.flujo = null;
    s.analizador = null;
    void s.ctx?.close().catch(() => undefined);
    s.ctx = null;
    setNivel(0);
    setEstado('quieta');
  }, []);

  /** Termina: con enviar=false se descarta lo grabado */
  const terminar = useCallback((enviar = true) => {
    const s = r.current;
    const g = s.grabador;
    s.grabador = null;
    s.cancelado = !enviar;
    if (!g || g.state === 'inactive') { soltar(); return; }
    g.onstop = () => {
      const blob = s.trozos.length ? new Blob(s.trozos, { type: g.mimeType || s.trozos[0].type || 'audio/mp4' }) : null;
      s.trozos = [];
      const hablo = s.hablo;
      soltar();
      if (s.cancelado) return;
      if (!blob || !hablo) { op.current.onNada(); return; }
      op.current.onFrase(blob);
    };
    g.stop();
  }, [soltar]);

  const empezar = useCallback(async () => {
    if (r.current.grabador) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      op.current.onError('Este navegador no deja usar el micrófono. Escríbeme abajo.');
      return;
    }
    const s = r.current;
    // El contexto de audio se crea en el mismo toque (el iPhone lo exige así)
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) s.ctx = new Ctx();
    } catch { s.ctx = null; }
    setEstado('escuchando');
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      s.flujo = flujo;
      if (s.ctx) {
        const a = s.ctx.createAnalyser();
        a.fftSize = 1024;
        s.ctx.createMediaStreamSource(flujo).connect(a);
        s.analizador = a;
        void s.ctx.resume().catch(() => undefined);
      }
      const formato = FORMATOS.find((f) => MediaRecorder.isTypeSupported?.(f));
      const g = new MediaRecorder(flujo, formato ? { mimeType: formato } : undefined);
      s.trozos = [];
      g.ondataavailable = (e) => { if (e.data.size) s.trozos.push(e.data); };
      g.start(250);
      s.grabador = g;
      s.inicio = Date.now();
      s.ultimaVoz = 0;
      s.hablo = false;
      s.ruido = 0;
      s.muestras = [];
      const datos = new Uint8Array(1024);
      s.tic = window.setInterval(() => {
        const ahora = Date.now();
        const pasado = ahora - s.inicio;
        let v = 0;
        if (s.analizador) {
          s.analizador.getByteTimeDomainData(datos);
          let suma = 0;
          for (const d of datos) { const x = (d - 128) / 128; suma += x * x; }
          v = Math.sqrt(suma / datos.length);
        }
        setNivel(Math.min(1, v * 6));
        if (!s.analizador) {
          // Sin medidor de volumen: se corta a mano o por tiempo
          if (pasado > MAXIMO_MS) terminar(true);
          s.hablo = true;
          return;
        }
        if (pasado < CALIBRAR_MS) { s.muestras.push(v); return; }
        if (!s.ruido) s.ruido = s.muestras.length ? s.muestras.reduce((a, b) => a + b, 0) / s.muestras.length : 0.005;
        const umbral = Math.max(VOZ_MINIMA, s.ruido * 2.5);
        if (v > umbral) { s.hablo = true; s.ultimaVoz = ahora; }
        if (s.hablo && ahora - s.ultimaVoz > SILENCIO_FINAL_MS) terminar(true);
        else if (!s.hablo && pasado > SIN_VOZ_MS) terminar(true);
        else if (pasado > MAXIMO_MS) terminar(true);
      }, TIC_MS);
    } catch {
      soltar();
      op.current.onError('Sin permiso para el micrófono. Actívalo en los ajustes del teléfono para esta app, o escríbeme abajo.');
    }
  }, [soltar, terminar]);

  useEffect(() => () => {
    const s = r.current;
    s.cancelado = true;
    try { s.grabador?.stop(); } catch { /* noop */ }
    if (s.tic) window.clearInterval(s.tic);
    s.flujo?.getTracks().forEach((t) => t.stop());
    void s.ctx?.close().catch(() => undefined);
  }, []);

  return { estado, nivel, empezar, terminar };
}
