import { useCallback, useEffect, useRef, useState } from 'react';
import type { AjustesLalan } from '../utils/ajustesLalan';

/** Los formatos que graban los navegadores (iPhone: mp4; Chrome/Android: webm) */
const FORMATOS = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
/** Lo primero se usa para empezar a medir el ruido del lugar */
const CALIBRAR_MS = 300;
const TIC_MS = 60;
/** Lo que se le da al medidor de volumen para arrancar */
const ESPERA_MEDIDOR_MS = 1000;
/** Volumen mínimo que cuenta como voz (aunque el lugar esté en silencio total) */
const VOZ_MINIMA = 0.018;
/**
 * El ruido del lugar se mide TODO el tiempo (no solo al principio): es el nivel
 * más bajo de los últimos segundos. Así, si la persona empieza a hablar en
 * cuanto se abre el micrófono, o pasan carros, el umbral se acomoda solo.
 */
const VENTANA_RUIDO = 42; // ~2,5 s de medidas
const PERCENTIL_RUIDO = 0.15;
/** El ruido de arranque no puede ser más que esto: si ya estaba hablando, su voz no es "ruido" */
const RUIDO_INICIAL_MAXIMO = 0.02;
/** Cuánto puede subir el ruido medido por cada medida (60 ms): ~7 % por segundo */
const SUBIDA_RUIDO = 1.004;
/** Para contar como voz tiene que durar un poquito (un pito o un golpe no es alguien hablando) */
const TICS_PARA_VOZ = 3;
/** Por encima de esto, el lugar es ruidoso: se sugiere acercar el teléfono o escribir */
const RUIDO_ALTO = 0.025;
/** Si al final no se reconoció voz pero hubo algo así de fuerte, se manda igual y que Whisper decida */
const PICO_PARA_INTENTAR = 1.6;
/** Una grabación más corta que esto no se manda (fue un toque) */
const MINIMO_PARA_MANDAR_MS = 700;

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
  /** El lugar está ruidoso (para sugerir acercar el teléfono o escribir) */
  const [ruidoso, setRuidoso] = useState(false);
  const r = useRef<{
    grabador: MediaRecorder | null; flujo: MediaStream | null; fuente: MediaStreamAudioSourceNode | null; analizador: AnalyserNode | null;
    tic: number | null; trozos: Blob[]; inicio: number; primeraVoz: number; ultimaVoz: number; hablo: boolean; muestras: number[];
    seguidos: number; pico: number; vozPropia: number; ruido: number; cancelado: boolean; sola: boolean;
  }>({ vozPropia: 0, ruido: 0, grabador: null, flujo: null, fuente: null, analizador: null, tic: null, trozos: [], inicio: 0, primeraVoz: 0, ultimaVoz: 0, hablo: false, muestras: [], seguidos: 0, pico: 0, cancelado: false, sola: false });
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

  /**
   * Termina: con enviar=false se descarta lo grabado.
   * `sola` = lo decidió el medidor (silencio, tiempo); si no, fue la persona
   * tocando la esfera: ella dice que ya habló, así que se manda aunque el
   * medidor no haya reconocido la voz (pasa en la calle, con ruido).
   */
  const terminar = useCallback((enviar = true, sola = false) => {
    const s = r.current;
    const g = s.grabador;
    s.grabador = null;
    s.cancelado = !enviar;
    if (!g || g.state === 'inactive') { soltar(); return; }
    const duro = Date.now() - s.inicio;
    g.onstop = () => {
      const blob = s.trozos.length ? new Blob(s.trozos, { type: g.mimeType || s.trozos[0].type || 'audio/mp4' }) : null;
      s.trozos = [];
      const vale = s.hablo
        || (!sola && duro > MINIMO_PARA_MANDAR_MS)
        // Escucha abierta por un toque que se acabó sin voz reconocida, pero hubo sonido: que decida Whisper
        || (sola && !s.sola && s.pico > PICO_PARA_INTENTAR && duro > 1000);
      soltar();
      if (s.cancelado) return;
      if (!blob || !vale) { op.current.onNada(s.sola); return; }
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
      // Que el medidor de volumen esté andando antes de grabar (si no, no se sabe cuándo calla)
      const ctx0 = op.current.contexto();
      if (ctx0 && ctx0.state !== 'running') await Promise.race([ctx0.resume().catch(() => undefined), new Promise((ok) => setTimeout(ok, 300))]);
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
      s.muestras = [];
      s.seguidos = 0;
      s.pico = 0;
      s.vozPropia = 0;
      s.ruido = 0;
      setRuidoso(false);
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
          if (pasado > op.current.ajustes().maximoSegundos * 1000) terminar(true, true);
          return;
        }
        s.muestras.push(v);
        if (s.muestras.length > VENTANA_RUIDO) s.muestras.shift();
        if (pasado < CALIBRAR_MS) return;
        const orden = [...s.muestras].sort((a, b) => a - b);
        const medido = Math.max(0.003, orden[Math.floor(orden.length * PERCENTIL_RUIDO)] ?? 0.005);
        // El ruido BAJA al instante pero SUBE despacio (~7 % por segundo). Así, si la
        // persona empieza a hablar de una vez (o habla seguido), su voz no se confunde
        // con "ruido"; y una tele o una calle constantes sí terminan contando como ruido.
        if (!s.ruido) s.ruido = Math.min(medido, RUIDO_INICIAL_MAXIMO);
        s.ruido = medido < s.ruido ? medido : Math.min(medido, s.ruido * SUBIDA_RUIDO);
        const ruido = s.ruido;
        if (ruido > RUIDO_ALTO) setRuidoso(true);
        s.pico = Math.max(s.pico, v / ruido);
        const aj = op.current.ajustes();
        const maximoMs = aj.maximoSegundos * 1000;
        // Para EMPEZAR a contar como voz hay que superar el umbral completo; una vez
        // que está hablando, basta menos para seguir: si retoma más bajito tras
        // una pausa (o hay ruido), el anillo se borra en cuanto vuelve a hablar
        // Voz principal: quien tiene el teléfono en la mano suena mucho más fuerte que
        // la tele o la gente alrededor. Mientras habla se mide SU volumen, y para seguir
        // escuchando hay que llegar a una parte de él: el fondo no reinicia la cuenta.
        const deFondo = (aj.ignorarFondo ?? 30) / 100;
        const umbral = s.hablo
          ? Math.max(VOZ_MINIMA * 0.7, ruido * Math.max(1.4, aj.sensibilidad * 0.6), s.vozPropia * deFondo)
          : Math.max(VOZ_MINIMA, ruido * aj.sensibilidad);
        // Su volumen: lo más alto reciente, que baja muy despacio (la mitad en ~40 s):
        // durante la pausa de pensar no debe bajar tanto que la tele vuelva a contar
        s.vozPropia = s.hablo && v > umbral ? Math.max(v, s.vozPropia * 0.999) : s.vozPropia * 0.999;
        if (v > umbral) {
          s.seguidos += 1;
          if (!s.hablo && s.seguidos >= TICS_PARA_VOZ) { s.hablo = true; s.primeraVoz = ahora - TICS_PARA_VOZ * TIC_MS; }
          if (s.hablo) s.ultimaVoz = ahora;
        } else s.seguidos = 0;
        if (s.hablo) {
          const hablado = s.ultimaVoz - s.primeraVoz;
          // Con frases muy cortas ("¿y mañana…?") se espera un poco más: quien dice dos palabras casi siempre sigue
          const espera = op.current.esperaMs + (hablado < aj.habloPocoMs ? aj.extraSiHabloPocoMs : 0);
          const callado = ahora - s.ultimaVoz;
          // El anillo empieza a llenarse a la mitad de la espera: un respiro normal no se ve
          setCierre(Math.max(0, Math.min(1, (callado - espera / 2) / (espera / 2))));
          if (callado > espera) terminar(true, true);
        } else if (pasado > (s.sola ? aj.sinVozSolaMs : aj.sinVozMs)) terminar(true, true);
        if (pasado > maximoMs) terminar(true, true);
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

  return { estado, nivel, cierre, ruidoso, empezar, terminar };
}
