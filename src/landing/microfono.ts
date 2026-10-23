/**
 * El micrófono de la Lalan de la landing: se toca, se habla y, cuando la
 * persona se calla, la frase se entrega sola. Es la versión sencilla de la
 * escucha de la app (hooks/useEscucha.ts): sin ajustes por aparato.
 */

const FORMATOS = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
const TIC_MS = 60;
const CALIBRAR_MS = 300;
const VOZ_MINIMA = 0.018;
const SENSIBILIDAD = 2.5;
const VENTANA_RUIDO = 42;
/** Para contar como voz tiene que durar un poquito (un golpe no es alguien hablando) */
const TICS_PARA_VOZ = 3;

export interface Escucha {
  /** Termina ya: con enviar=false se descarta lo grabado */
  terminar(enviar: boolean): void;
}

export const hayMicrofono = () => !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

/**
 * Escucha una frase. `alTerminar` recibe el audio, o null si no dijo nada
 * (o se descartó). Si no hay permiso, `alFallar` con el motivo.
 */
export async function escucharFrase(o: {
  contexto: AudioContext;
  /** Silencio que da la frase por terminada */
  esperaMs: number;
  /** Si no dice nada en este tiempo, se cierra */
  sinVozMs: number;
  maximoMs: number;
  alNivel?(v: number): void;
  alTerminar(audio: Blob | null): void;
  alFallar(mensaje: string): void;
}): Promise<Escucha | null> {
  let flujo: MediaStream;
  try {
    void o.contexto.resume().catch(() => undefined);
    flujo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch {
    o.alFallar('Sin permiso para el micrófono. Actívalo en tu navegador o escríbeme aquí 💕');
    return null;
  }
  const analizador = o.contexto.createAnalyser();
  analizador.fftSize = 1024;
  const fuente = o.contexto.createMediaStreamSource(flujo);
  fuente.connect(analizador);
  const formato = FORMATOS.find((f) => MediaRecorder.isTypeSupported?.(f));
  const grabador = new MediaRecorder(flujo, formato ? { mimeType: formato } : undefined);
  const trozos: Blob[] = [];
  grabador.ondataavailable = (e) => { if (e.data.size) trozos.push(e.data); };
  grabador.start(250);

  const inicio = Date.now();
  const muestras: number[] = [];
  let ruido = 0;
  let seguidos = 0;
  let hablo = false;
  let ultimaVoz = 0;
  let listo = false;
  const datos = new Uint8Array(1024);

  const terminar = (enviar: boolean) => {
    if (listo) return;
    listo = true;
    window.clearInterval(tic);
    o.alNivel?.(0);
    grabador.onstop = () => {
      try { fuente.disconnect(); } catch { /* noop */ }
      flujo.getTracks().forEach((t) => t.stop());
      o.alTerminar(enviar && trozos.length ? new Blob(trozos, { type: grabador.mimeType || trozos[0].type || 'audio/mp4' }) : null);
    };
    if (grabador.state === 'inactive') grabador.onstop(new Event('stop'));
    else grabador.stop();
  };

  const tic = window.setInterval(() => {
    const ahora = Date.now();
    analizador.getByteTimeDomainData(datos);
    let suma = 0;
    for (const d of datos) { const x = (d - 128) / 128; suma += x * x; }
    const v = Math.sqrt(suma / datos.length);
    o.alNivel?.(Math.min(1, v * 6));
    muestras.push(v);
    if (muestras.length > VENTANA_RUIDO) muestras.shift();
    const pasado = ahora - inicio;
    if (pasado > o.maximoMs) { terminar(true); return; }
    if (pasado < CALIBRAR_MS) return;
    const orden = [...muestras].sort((a, b) => a - b);
    const medido = Math.max(0.003, orden[Math.floor(orden.length * 0.15)] ?? 0.005);
    // El ruido baja al instante y sube despacio: la voz no se confunde con ruido
    ruido = !ruido ? Math.min(medido, 0.02) : medido < ruido ? medido : Math.min(medido, ruido * 1.004);
    const umbral = hablo ? Math.max(VOZ_MINIMA * 0.7, ruido * 1.4) : Math.max(VOZ_MINIMA, ruido * SENSIBILIDAD);
    if (v > umbral) {
      seguidos += 1;
      if (seguidos >= TICS_PARA_VOZ) hablo = true;
      if (hablo) ultimaVoz = ahora;
    } else seguidos = 0;
    if (hablo && ahora - ultimaVoz > o.esperaMs) terminar(true);
    else if (!hablo && pasado > o.sinVozMs) terminar(false);
  }, TIC_MS);

  // Tocó para enviar: ella dice que ya habló, aunque el medidor no reconociera la voz (pasa con ruido)
  return { terminar: (enviar) => terminar(enviar && (hablo || Date.now() - inicio > 900)) };
}
