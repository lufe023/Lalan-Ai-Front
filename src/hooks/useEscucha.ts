import { useCallback, useEffect, useRef, useState } from 'react';
import type { AjustesLalan } from '../utils/ajustesLalan';

/** Los formatos que graban los navegadores (iPhone: mp4; Chrome/Android: webm) */
const FORMATOS = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
/** Lo primero se usa para medir el ruido del lugar */
const CALIBRAR_MS = 300;
const TIC_MS = 60;
/** Lo que se le da al medidor de volumen para arrancar */
const ESPERA_MEDIDOR_MS = 1000;
/** Volumen mínimo que cuenta como voz (aunque el lugar esté en silencio total) */
const VOZ_MINIMA = 0.018;

export type EstadoEscucha = 'quieta' | 'escuchando';

/**
 * Escuchar a la dueña como Siri: se toca, habla, y cuando se calla un rato
 * la grabación se corta sola y se entrega. El corte se decide aquí, en el
 * teléfono (gratis): solo viaja la frase.
 *
 * El contexto de audio lo pone quien llama y vive mientras la pantalla esté
 * abierta: el iPhone solo lo deja arrancar en un toque, y así se puede volver
 * a escuchar sola cuando Lalan termina de hablar, sin otro toque.
 */
export function useEscucha(opts: {
  /** Silencio que da la frase por terminada (la pausa elegida en el aparato) */
  esperaMs: number;
  /** Los ajustes globales (Plataforma → Lalan) */
  ajustes: () => AjustesLalan;
  contexto: () => AudioContext | null;
  onFrase: (audio: Blob) => void;
  /** No dijo nada. `sola` = la escucha la abrió la app (después de hablar Lalan), no un toque */
  onNada: (sola: boolean) => void;
  onError: (mensaje: string) => void;
}) {
  const [estado, setEstado] = useState<EstadoEscucha>('quieta');
  /** Volumen de ahora (0 a 1), para animar la esfera */
  const [nivel, setNivel] = useState(0);
  /** 0 a 1: cuánto falta para dar la frase por terminada (para que se vea que va a enviar) */
  const [cierre, setCierre] = useState(0);
  const r = useRef<{
    grabador: MediaRecorder | null; flujo: MediaStream | null; fuente: MediaStreamAudioSourceNode | null; analizador: AnalyserNode | null;
    tic: number | null; trozos: Blob[]; inicio: number; primeraVoz: number; ultimaVoz: number; hablo: boolean; ruido: number; muestras: number[];
    cancelado: boolean; sola: boolean;
  }>({ grabador: null, flujo: null, fuente: null, analizador: null, tic: null, trozos: [], inicio: 0, primeraVoz: 0, ultimaVoz: 0, hablo: false, ruido: 0, muestras: [], cancelado: false, sola: false });
  const op = useRef(opts);
  op.current = opts;

  const soltar = useCallback(() => {
    const s = r.current;
    if (s.tic) window.clearInterval(s.tic);
    s.tic = null;
    try { s.fuente?.disconnect(); } catch { /* noop */ }
    s.fuente = null;
    s.analizador = null;
    // El micrófono se suelta del todo: así la voz de Lalan sale por el altavoz y no por el auricular
    s.flujo?.getTracks().forEach((t) => t.stop());
    s.flujo = null;
    setNivel(0);
    setCierre(0);
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
      if (!blob || !hablo) { op.current.onNada(s.sola); return; }
      op.current.onFrase(blob);
    };
    g.stop();
  }, [soltar]);

  /** sola = la abre la app después de que Lalan habla (si no dicen nada, se cierra sin quejarse) */
  const empezar = useCallback(async (sola = false) => {
    if (r.current.grabador) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      op.current.onError('Este navegador no deja usar el micrófono. Escríbeme abajo.');
      return;
    }
    const s = r.current;
    s.sola = sola;
    setEstado('escuchando');
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      s.flujo = flujo;
      const ctx = op.current.contexto();
      if (ctx) {
        try {
          void ctx.resume().catch(() => undefined);
          const a = ctx.createAnalyser();
          a.fftSize = 1024;
          s.fuente = ctx.createMediaStreamSource(flujo);
          s.fuente.connect(a);
          s.analizador = a;
        } catch { s.analizador = null; }
      }
      const formato = FORMATOS.find((f) => MediaRecorder.isTypeSupported?.(f));
      const g = new MediaRecorder(flujo, formato ? { mimeType: formato } : undefined);
      s.trozos = [];
      g.ondataavailable = (e) => { if (e.data.size) s.trozos.push(e.data); };
      g.start(250);
      s.grabador = g;
      s.inicio = Date.now();
      s.primeraVoz = 0;
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
        if (!s.analizador || ctx?.state !== 'running') {
          // El medidor a veces tarda un instante en arrancar
          if (s.analizador && pasado < ESPERA_MEDIDOR_MS) return;
          // Sin medidor no se sabe cuándo calla. Si la escucha la abrió la app, se cierra;
          // si la abrió un toque, se graba y se corta tocando la esfera
          if (s.sola) { terminar(false); op.current.onNada(true); return; }
          s.hablo = true;
          if (pasado > op.current.ajustes().maximoSegundos * 1000) terminar(true);
          return;
        }
        if (pasado < CALIBRAR_MS) { s.muestras.push(v); return; }
        if (!s.ruido) s.ruido = s.muestras.length ? s.muestras.reduce((a, b) => a + b, 0) / s.muestras.length : 0.005;
        const aj = op.current.ajustes();
        const maximoMs = aj.maximoSegundos * 1000;
        const umbral = Math.max(VOZ_MINIMA, s.ruido * aj.sensibilidad);
        if (v > umbral) { if (!s.hablo) s.primeraVoz = ahora; s.hablo = true; s.ultimaVoz = ahora; }
        if (s.hablo) {
          const hablado = s.ultimaVoz - s.primeraVoz;
          // Con frases muy cortas ("¿y mañana…?") se espera un poco más: quien dice dos palabras casi siempre sigue
          const espera = op.current.esperaMs + (hablado < aj.habloPocoMs ? aj.extraSiHabloPocoMs : 0);
          const callado = ahora - s.ultimaVoz;
          // El anillo empieza a llenarse a la mitad de la espera: un respiro normal no se ve
          setCierre(Math.max(0, Math.min(1, (callado - espera / 2) / (espera / 2))));
          if (callado > espera) terminar(true);
        } else if (pasado > (s.sola ? aj.sinVozSolaMs : aj.sinVozMs)) terminar(true);
        if (pasado > maximoMs) terminar(true);
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
  }, []);

  return { estado, nivel, cierre, empezar, terminar };
}
