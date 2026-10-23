/**
 * Hablarle encima a Lalan, como en el modo de voz de Gemini: mientras ella
 * habla, el micrófono queda atento. Si la persona habla, Lalan se pausa y la
 * escucha. Si fue un ruido, una tos o un "ajá" corto, Lalan sigue donde iba.
 * Si de verdad dijo algo, Lalan se calla y la frase se entrega como cualquier
 * pregunta hablada.
 *
 * Lo difícil es el eco: el micrófono también oye a Lalan. El teléfono le
 * quita casi todo (echoCancellation), y lo que queda se mide mientras ella
 * habla: para pausarla, la voz tiene que ser varias veces más fuerte que ese
 * eco (la "sensibilidad" de Plataforma).
 *
 * No depende de React ni de la sesión: lo usan la pantalla de Lalan y la
 * asistente de la landing.
 */

export interface AjustesInterrupcion {
  /** Voz seguida que hace falta para pausar a Lalan */
  vozParaPausarMs: number;
  /** Silencio, ya pausada, para que siga si no dijo nada */
  retomarTrasMs: number;
  /** Cuántas veces más fuerte que el eco de Lalan tiene que ser la voz */
  sensibilidad: number;
  /** Silencio que da la frase por terminada cuando sí tomó la palabra */
  esperaMs: number;
}

export interface Interrupcion {
  /** Ya tomó la palabra: Lalan se calló y se está escuchando la frase */
  enTurno(): boolean;
  /** Se apaga todo y se suelta el micrófono (lo grabado se descarta) */
  soltar(): void;
}

const FORMATOS = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
const TIC_MS = 50;
/** Al empezar a hablar Lalan solo se mide su eco: nadie la interrumpe en la primera sílaba */
const CALIBRAR_MS = 450;
/** Volumen mínimo que cuenta como voz, aunque no haya eco */
const VOZ_MINIMA = 0.02;
/** Un hueco así de corto dentro de una palabra no corta la cuenta */
const HUECO_MS = 160;
/** El eco es lo más alto de lo último que se oyó mientras ella hablaba (~1,2 s) */
const VENTANA_ECO = 24;
const PERCENTIL_ECO = 0.9;
/** Ya pausada: con menos voz que esto en total fue un ruido o un "ajá" corto */
const VOZ_REAL_MS = 700;
/** Lo más que dura una frase que interrumpe */
const MAXIMO_MS = 60_000;

/**
 * Empieza a vigilar mientras Lalan habla. Devuelve null si no hay micrófono
 * o permiso: Lalan sigue hablando como siempre.
 */
export async function vigilarInterrupcion(o: {
  ajustes: AjustesInterrupcion;
  contexto: AudioContext | null;
  /** Lalan se pausa (puede seguir) */
  pausar(): void;
  /** No dijo nada: Lalan sigue donde iba */
  seguir(): void;
  /** Dijo algo de verdad: Lalan se calla del todo */
  tomarTurno(): void;
  /** La frase completa, cuando se calla */
  alTerminar(audio: Blob): void;
  /** Volumen de quien habla (0 a 1), para la esfera, mientras se le escucha */
  alNivel?(v: number): void;
  /** Si Lalan suena ahora (mientras llega su audio o entre frases no hay eco que medir) */
  suena?(): boolean;
}): Promise<Interrupcion | null> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined' || !o.contexto) return null;
  let flujo: MediaStream;
  try {
    flujo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch { return null; }
  const ctx = o.contexto;
  void ctx.resume().catch(() => undefined);
  let fuente: MediaStreamAudioSourceNode;
  const analizador = ctx.createAnalyser();
  analizador.fftSize = 1024;
  try { fuente = ctx.createMediaStreamSource(flujo); fuente.connect(analizador); }
  catch { flujo.getTracks().forEach((t) => t.stop()); return null; }

  type Estado = 'atento' | 'pausada' | 'turno' | 'fin';
  let estado: Estado = 'atento';
  const inicio = Date.now();
  let calibrarHasta = inicio + CALIBRAR_MS;
  const ecos: number[] = [];
  let grabador: MediaRecorder | null = null;
  let trozos: Blob[] = [];
  /** Cuándo empezó la voz que puede pausarla, y cuándo se oyó por última vez */
  let desde = 0;
  let ultimaVoz = 0;
  let hablado = 0;
  let turnoDesde = 0;
  const datos = new Uint8Array(1024);
  const formato = FORMATOS.find((f) => MediaRecorder.isTypeSupported?.(f));

  // Se graba desde la primera sílaba (no desde que se confirma), así no se pierde el comienzo
  const grabar = () => {
    trozos = [];
    try {
      grabador = new MediaRecorder(flujo, formato ? { mimeType: formato } : undefined);
      grabador.ondataavailable = (e) => { if (e.data.size) trozos.push(e.data); };
      grabador.start(250);
    } catch { grabador = null; }
  };
  const descartar = () => {
    const g = grabador;
    grabador = null;
    trozos = [];
    if (g && g.state !== 'inactive') { g.ondataavailable = null; try { g.stop(); } catch { /* noop */ } }
  };
  const soltar = () => {
    estado = 'fin';
    window.clearInterval(tic);
    descartar();
    try { fuente.disconnect(); } catch { /* noop */ }
    flujo.getTracks().forEach((t) => t.stop());
  };
  const entregar = () => {
    const g = grabador;
    grabador = null;
    window.clearInterval(tic);
    estado = 'fin';
    const cerrar = () => { try { fuente.disconnect(); } catch { /* noop */ } flujo.getTracks().forEach((t) => t.stop()); };
    if (!g || g.state === 'inactive') { cerrar(); return; }
    g.onstop = () => {
      cerrar();
      if (trozos.length) o.alTerminar(new Blob(trozos, { type: g.mimeType || trozos[0].type || 'audio/mp4' }));
    };
    g.stop();
  };

  const tic = window.setInterval(() => {
    const ahora = Date.now();
    analizador.getByteTimeDomainData(datos);
    let suma = 0;
    for (const d of datos) { const x = (d - 128) / 128; suma += x * x; }
    const v = Math.sqrt(suma / datos.length);
    const a = o.ajustes;

    if (estado === 'atento') {
      if (!desde) { ecos.push(v); if (ecos.length > VENTANA_ECO) ecos.shift(); }
      // Callada (esperando su audio o entre frases): cuando vuelva a sonar, primero se mide su eco
      if (o.suena && !o.suena()) {
        calibrarHasta = Math.max(calibrarHasta, ahora + CALIBRAR_MS);
        if (desde) { desde = 0; descartar(); }
        return;
      }
      if (ahora < calibrarHasta) return;
      const orden = [...ecos].sort((x, y) => x - y);
      const eco = orden[Math.floor(orden.length * PERCENTIL_ECO)] ?? 0;
      const umbral = Math.max(VOZ_MINIMA, eco * a.sensibilidad);
      if (v > umbral) {
        if (!desde) { desde = ahora; hablado = 0; grabar(); }
        ultimaVoz = ahora;
        hablado += TIC_MS;
        if (ahora - desde >= a.vozParaPausarMs) { estado = 'pausada'; o.pausar(); }
      } else if (desde && ahora - ultimaVoz > HUECO_MS) {
        // Fue un golpe o una risa de fondo: no llegó a pausarla
        desde = 0;
        descartar();
      }
      return;
    }

    // Lalan ya no suena: el umbral es el eco que había (sin multiplicar)
    const orden = [...ecos].sort((x, y) => x - y);
    const umbral = Math.max(VOZ_MINIMA, (orden[Math.floor(orden.length * PERCENTIL_ECO)] ?? 0) * 1.2);
    o.alNivel?.(Math.min(1, v * 6));
    if (v > umbral) { ultimaVoz = ahora; hablado += TIC_MS; }
    const callado = ahora - ultimaVoz;

    if (estado === 'pausada') {
      if (hablado >= VOZ_REAL_MS) { estado = 'turno'; turnoDesde = ahora; o.tomarTurno(); return; }
      if (callado > a.retomarTrasMs) {
        // No dijo nada: sigue donde iba y se vuelve a medir el eco
        estado = 'atento';
        desde = 0;
        descartar();
        o.alNivel?.(0);
        calibrarHasta = ahora + CALIBRAR_MS / 2;
        o.seguir();
      }
      return;
    }

    if (estado === 'turno' && (callado > a.esperaMs || ahora - turnoDesde > MAXIMO_MS)) entregar();
  }, TIC_MS);

  return { enTurno: () => estado === 'turno', soltar };
}

/** Lo que se dice para acompañar sin pedir nada (igual que el servidor: asistente.contrato.ts) */
export const SOLO_ASENTIR = /^(?:(?:aj[aá]|a+h+[aá]?|o+k+(?:ay|ey|i)?|vale|ya|s[ií]+|claro|aj[aá] ?aj[aá]|u+h+ ?u+m+|m+h*m+|e+h+|ujum|mjm|aha|perfecto|bien|dale|entiendo)[\s.,!¡?¿]*)+$/i;
