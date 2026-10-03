import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronUp, Lock, Mic, Pause, Play, Send, Trash2 } from 'lucide-react';

/** Lo más que dura una nota de voz (sumando los tramos) */
const MAXIMO_SEGUNDOS = 120;
/** Menos que esto es un toque, no una nota */
const MINIMO_MS = 600;
/** Cuánto hay que arrastrar a la izquierda para cancelar, o hacia arriba para dejarla grabando */
const DESLIZAR_CANCELAR_PX = 110;
const DESLIZAR_BLOQUEAR_PX = 70;
/** Cada cuánto se mide el volumen para dibujar la onda */
const TIC_MS = 100;
/** Barritas de la onda cuando está en pausa (toda la nota) y mientras graba (lo último) */
const BARRAS_PAUSA = 48;
const BARRAS_GRABANDO = 56;

/** Los formatos que graban los navegadores (iPhone: mp4; Chrome/Android: webm) */
const FORMATOS = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];

/**
 * inactivo  · nada
 * grabando  · con el dedo encima (soltar = enviar)
 * bloqueado · grabando sola (candado)
 * pausado   · con candado y en pausa: se puede escuchar, seguir grabando, borrar o enviar
 */
type Estado = 'inactivo' | 'grabando' | 'bloqueado' | 'pausado';

const reloj = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Alto de una barrita (%): la voz es baja, así que se realza; el silencio queda como un puntito */
const alto = (v: number) => `${12 + Math.min(88, Math.sqrt(Math.max(0, v - 0.008)) * 200)}%`;

/** Reduce (o estira) la lista de volúmenes a n barritas */
function repartir(niveles: number[], n: number): number[] {
  if (!niveles.length) return Array(n).fill(0);
  return Array.from({ length: n }, (_, i) => {
    const desde = Math.floor((i * niveles.length) / n);
    const hasta = Math.max(desde + 1, Math.floor(((i + 1) * niveles.length) / n));
    const grupo = niveles.slice(desde, hasta);
    return Math.max(...grupo);
  });
}

/** La onda de la nota: barritas; la parte ya escuchada va en color */
const Onda: React.FC<{ niveles: number[]; avance?: number; punto?: boolean; onTocar?: (fraccion: number) => void }> = ({ niveles, avance = 0, punto, onTocar }) => (
  <div
    className={`relative flex-1 min-w-0 h-8 flex items-center gap-[2px] ${onTocar ? 'cursor-pointer' : ''}`}
    onClick={onTocar ? (e) => {
      const caja = e.currentTarget.getBoundingClientRect();
      onTocar(Math.min(1, Math.max(0, (e.clientX - caja.left) / caja.width)));
    } : undefined}
    aria-hidden="true"
  >
    {niveles.map((v, i) => {
      const hecho = (i + 0.5) / niveles.length <= avance;
      return (
        <span key={i}
          className={`flex-1 min-w-[2px] rounded-full ${hecho ? 'bg-[var(--primary)]' : 'bg-slate-400/70 dark:bg-neutral-500'}`}
          style={{ height: alto(v) }} />
      );
    })}
    {punto && (
      <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[var(--primary)] shadow"
        style={{ left: `${Math.min(100, avance * 100)}%` }} />
    )}
  </div>
);

/**
 * El micrófono del chat, como en WhatsApp:
 *  · Mantén presionado para grabar; al soltar, se envía.
 *  · Desliza a la izquierda para cancelar.
 *  · Desliza hacia arriba para dejarla grabando sola (candado). Con el
 *    candado se puede PAUSAR, escuchar lo grabado (y saltar a cualquier
 *    punto tocando la onda), seguir grabando, borrar o enviar.
 *
 * Cada pausa cierra un tramo de audio; al enviar van todos los tramos y el
 * servidor los une en una sola nota de voz.
 */
export const GrabadorVoz: React.FC<{
  onListo: (tramos: Blob[]) => void | Promise<void>;
  onAviso: (titulo: string, detalle: string) => void;
  deshabilitado?: boolean;
  /** Morado cuando la nota es una indicación para Lalan */
  color?: string;
  etiqueta: string;
}> = ({ onListo, onAviso, deshabilitado, color = 'bg-[var(--primary)]', etiqueta }) => {
  const [estado, setEstado] = useState<Estado>('inactivo');
  const [segundos, setSegundos] = useState(0);
  const [arrastre, setArrastre] = useState({ x: 0, y: 0 });
  const [escuchando, setEscuchando] = useState(false);
  const [posicion, setPosicion] = useState(0);
  const [niveles, setNiveles] = useState<number[]>([]);

  const grabador = useRef<MediaRecorder | null>(null);
  const flujo = useRef<MediaStream | null>(null);
  const trozos = useRef<Blob[]>([]);
  /** Tramos ya cerrados (uno por cada pausa) y lo que dura cada uno */
  const tramos = useRef<Blob[]>([]);
  const duraciones = useRef<number[]>([]);
  /** Segundos de los tramos cerrados */
  const acumulado = useRef(0);
  const inicioTramo = useRef(0);
  const origen = useRef({ x: 0, y: 0 });
  const estadoRef = useRef<Estado>('inactivo');
  const soltado = useRef(false);
  const tic = useRef<number | null>(null);
  const reproductor = useRef<HTMLAudioElement | null>(null);
  const urls = useRef<string[]>([]);
  const nivelesRef = useRef<number[]>([]);
  const contexto = useRef<AudioContext | null>(null);
  const analizador = useRef<AnalyserNode | null>(null);

  const cambiar = (e: Estado) => { estadoRef.current = e; setEstado(e); };

  const pararReloj = () => { if (tic.current) window.clearInterval(tic.current); tic.current = null; };
  const apagarMicrofono = () => {
    flujo.current?.getTracks().forEach((t) => t.stop());
    flujo.current = null;
    analizador.current = null;
    // Se suelta todo el audio de grabación: así lo grabado se oye por el altavoz
    void contexto.current?.close().catch(() => undefined);
    contexto.current = null;
  };
  const pararEscucha = () => {
    reproductor.current?.pause();
    reproductor.current = null;
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
    setEscuchando(false);
    setPosicion(0);
  };
  const reiniciar = () => {
    pararReloj(); apagarMicrofono(); pararEscucha();
    grabador.current = null; tramos.current = []; duraciones.current = []; trozos.current = []; acumulado.current = 0;
    nivelesRef.current = []; setNiveles([]);
    setSegundos(0); setArrastre({ x: 0, y: 0 });
    cambiar('inactivo');
  };

  /** El contexto de audio se crea en el mismo toque (el iPhone lo exige así) */
  const prepararContexto = () => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx && !contexto.current) contexto.current = new Ctx();
    } catch { /* sin onda: graba igual */ }
  };

  /** Volumen de este momento (0 a 1) */
  const medir = () => {
    const a = analizador.current;
    if (!a) return 0.05 + Math.random() * 0.05;
    const datos = new Uint8Array(a.fftSize);
    a.getByteTimeDomainData(datos);
    let suma = 0;
    for (const d of datos) { const v = (d - 128) / 128; suma += v * v; }
    return Math.sqrt(suma / datos.length);
  };

  /** Cierra el tramo que se está grabando y devuelve cuando ya está guardado */
  const cerrarTramo = () => new Promise<void>((listo) => {
    const r = grabador.current;
    grabador.current = null;
    pararReloj();
    if (!r || r.state === 'inactive') { apagarMicrofono(); listo(); return; }
    const dura = (Date.now() - inicioTramo.current) / 1000;
    acumulado.current += dura;
    r.onstop = () => {
      if (trozos.current.length) {
        tramos.current.push(new Blob(trozos.current, { type: r.mimeType || trozos.current[0].type || 'audio/mp4' }));
        duraciones.current.push(dura);
      }
      trozos.current = [];
      apagarMicrofono();
      listo();
    };
    r.stop();
  });

  /** Termina: enviar = true manda todos los tramos; false los descarta */
  const terminar = async (enviar: boolean) => {
    const corto = estadoRef.current === 'grabando' && Date.now() - inicioTramo.current < MINIMO_MS && !tramos.current.length;
    pararEscucha();
    await cerrarTramo();
    const listos = tramos.current;
    reiniciar();
    if (!enviar) return;
    if (corto || !listos.length) { onAviso('Mantén presionado para grabar', 'Suelta para enviar. Desliza hacia arriba para dejarla grabando.'); return; }
    void onListo(listos);
  };

  /** Empieza (o sigue, después de una pausa) a grabar un tramo */
  const grabarTramo = async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onAviso('No se puede grabar aquí', 'Este navegador no permite grabar audio. Actualiza el teléfono o usa Safari/Chrome.');
      return false;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      flujo.current = s;
      try {
        if (contexto.current) {
          const a = contexto.current.createAnalyser();
          a.fftSize = 512;
          contexto.current.createMediaStreamSource(s).connect(a);
          analizador.current = a;
          void contexto.current.resume().catch(() => undefined);
        }
      } catch { analizador.current = null; }
      const formato = FORMATOS.find((f) => MediaRecorder.isTypeSupported?.(f));
      const r = new MediaRecorder(s, formato ? { mimeType: formato } : undefined);
      trozos.current = [];
      r.ondataavailable = (e) => { if (e.data.size) trozos.current.push(e.data); };
      r.start(250);
      grabador.current = r;
      inicioTramo.current = Date.now();
      tic.current = window.setInterval(() => {
        const total = acumulado.current + (Date.now() - inicioTramo.current) / 1000;
        setSegundos(total);
        nivelesRef.current.push(medir());
        setNiveles(nivelesRef.current.slice(-BARRAS_GRABANDO));
        if (total >= MAXIMO_SEGUNDOS) void terminar(true);
      }, TIC_MS);
      return true;
    } catch {
      apagarMicrofono();
      onAviso('Sin permiso para el micrófono', 'Actívalo en los ajustes del teléfono para esta app y vuelve a intentar.');
      return false;
    }
  };

  const empezar = async () => {
    soltado.current = false;
    cambiar('grabando');
    setSegundos(0);
    nivelesRef.current = []; setNiveles([]);
    prepararContexto();
    const ok = await grabarTramo();
    if (!ok) { reiniciar(); return; }
    // Soltó antes de que el micrófono estuviera listo
    if (soltado.current && estadoRef.current === 'grabando') void terminar(true);
  };

  const pausar = async () => {
    if (estadoRef.current !== 'bloqueado') return;
    await cerrarTramo();
    setSegundos(acumulado.current);
    setNiveles(repartir(nivelesRef.current, BARRAS_PAUSA));
    cambiar('pausado');
  };

  const seguir = async () => {
    if (estadoRef.current !== 'pausado') return;
    if (acumulado.current >= MAXIMO_SEGUNDOS) { onAviso('Llegaste a los 2 minutos', 'Envíala o bórrala.'); return; }
    pararEscucha();
    prepararContexto();
    cambiar('bloqueado');
    setNiveles(nivelesRef.current.slice(-BARRAS_GRABANDO));
    if (!(await grabarTramo())) { apagarMicrofono(); setNiveles(repartir(nivelesRef.current, BARRAS_PAUSA)); cambiar('pausado'); }
  };

  /** Toca lo grabado desde el segundo "desde" (los tramos, uno detrás de otro) */
  const reproducir = (desde: number) => {
    reproductor.current?.pause();
    if (!tramos.current.length) return;
    if (!urls.current.length) urls.current = tramos.current.map((t) => URL.createObjectURL(t));
    // En qué segundo de la nota empieza cada tramo
    const inicios: number[] = [];
    duraciones.current.reduce((suma, d) => { inicios.push(suma); return suma + d; }, 0);
    let i = Math.max(0, inicios.findIndex((ini, k) => desde >= ini && desde < ini + duraciones.current[k]));
    if (desde >= acumulado.current) { i = 0; desde = 0; }
    const tocar = (dentro: number) => {
      const a = new Audio(urls.current[i]);
      reproductor.current = a;
      const antes = inicios[i];
      a.ontimeupdate = () => setPosicion(Math.min(acumulado.current, antes + a.currentTime));
      a.onended = () => {
        i += 1;
        if (i < urls.current.length) tocar(0);
        else { setEscuchando(false); setPosicion(0); reproductor.current = null; }
      };
      if (dentro > 0) a.addEventListener('loadedmetadata', () => { try { a.currentTime = dentro; } catch { /* empieza al principio del tramo */ } }, { once: true });
      void a.play().catch(() => setEscuchando(false));
    };
    setEscuchando(true);
    setPosicion(desde);
    tocar(desde - inicios[i]);
  };

  const escuchar = () => {
    if (escuchando) { reproductor.current?.pause(); setEscuchando(false); return; }
    // Estaba en pausa a mitad: sigue desde ahí
    if (reproductor.current?.paused) { setEscuchando(true); void reproductor.current.play().catch(() => setEscuchando(false)); return; }
    reproducir(posicion);
  };

  /** Tocar la onda: salta a ese punto */
  const saltar = (fraccion: number) => {
    const t = fraccion * acumulado.current;
    if (escuchando) { reproducir(t); return; }
    reproductor.current?.pause();
    reproductor.current = null;
    setPosicion(t);
  };

  // Si se cierra el chat a mitad de una grabación, se descarta
  useEffect(() => () => { grabador.current?.stop(); pararReloj(); apagarMicrofono(); pararEscucha(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const alPresionar = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (deshabilitado || estadoRef.current !== 'inactivo') return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    origen.current = { x: e.clientX, y: e.clientY };
    void empezar();
  };

  const alMover = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (estadoRef.current !== 'grabando') return;
    const x = Math.min(0, e.clientX - origen.current.x);
    const y = Math.min(0, e.clientY - origen.current.y);
    setArrastre({ x, y });
    if (-x > DESLIZAR_CANCELAR_PX) { soltado.current = true; void terminar(false); return; }
    if (-y > DESLIZAR_BLOQUEAR_PX) { cambiar('bloqueado'); setArrastre({ x: 0, y: 0 }); }
  };

  const alSoltar = () => {
    soltado.current = true;
    if (estadoRef.current === 'grabando' && grabador.current) void terminar(true);
  };

  const conCandado = estado === 'bloqueado' || estado === 'pausado';
  const boton = 'w-11 h-11 rounded-full flex items-center justify-center shrink-0 cursor-pointer ios-touch';

  return (
    <>
      {/* Con el dedo encima: una sola fila, como en WhatsApp */}
      {estado === 'grabando' && (
        <div className="absolute inset-0 z-10 flex items-center gap-2 px-4 bg-white dark:bg-neutral-950 border-t border-slate-200/70 dark:border-neutral-800/80" aria-live="polite">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" aria-hidden="true" />
          <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{reloj(segundos)}</span>
          <span className="flex-1 flex items-center justify-center gap-1 text-[0.8125rem] text-slate-500 dark:text-neutral-400" style={{ transform: `translateX(${arrastre.x * 0.6}px)` }}>
            Desliza para cancelar <ChevronLeft className="w-4 h-4" />
          </span>
          <span className="w-10 shrink-0" />
        </div>
      )}

      {/* Mientras se mantiene presionado: el candado de arriba para dejarla grabando */}
      {estado === 'grabando' && (
        <div className="absolute right-3 bottom-full mb-2 z-20 w-10 py-2 rounded-full bg-white dark:bg-neutral-800 shadow-lg border border-slate-200 dark:border-neutral-700 flex flex-col items-center gap-1 text-slate-500"
          style={{ transform: `translateY(${arrastre.y * 0.5}px)` }} aria-hidden="true">
          <Lock className="w-4 h-4" />
          <ChevronUp className="w-4 h-4 animate-bounce" />
        </div>
      )}

      {/* Con candado: dos filas. Arriba el tiempo y la onda; abajo borrar · pausa/seguir · enviar */}
      {conCandado && (
        <div className="absolute inset-x-0 bottom-0 z-30 px-4 pt-3 bg-white dark:bg-neutral-950 border-t border-slate-200/70 dark:border-neutral-800/80 space-y-2"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }} aria-live="polite">
          {estado === 'bloqueado' ? (
            <div className="flex items-center gap-3 h-9">
              <span className="text-[0.9375rem] tabular-nums text-slate-700 dark:text-neutral-200 w-10">{reloj(segundos)}</span>
              <div className="flex-1 min-w-0 flex justify-end overflow-hidden">
                <div className="flex items-center gap-[2px] h-8">
                  {niveles.map((v, i) => (
                    <span key={i} className="w-[3px] rounded-full bg-slate-500/80 dark:bg-neutral-400"
                      style={{ height: alto(v) }} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 h-9">
              <button type="button" onClick={escuchar} aria-label={escuchando ? 'Pausar' : 'Escuchar lo grabado'}
                className="w-8 h-8 flex items-center justify-center shrink-0 text-slate-700 dark:text-neutral-200 cursor-pointer">
                {escuchando ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              </button>
              <Onda niveles={niveles} avance={segundos ? posicion / segundos : 0} punto onTocar={saltar} />
              <span className="text-[0.9375rem] tabular-nums text-slate-700 dark:text-neutral-200 w-10 text-right">
                {reloj(escuchando || posicion ? posicion : segundos)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button type="button" onClick={() => void terminar(false)} aria-label="Borrar la nota de voz"
              className={`${boton} text-slate-600 dark:text-neutral-300 hover:text-red-500`}>
              <Trash2 className="w-6 h-6" />
            </button>
            {estado === 'bloqueado' ? (
              <button type="button" onClick={() => void pausar()} aria-label="Pausar la grabación"
                className={`${boton} text-red-500`}>
                <span className="w-7 h-7 rounded-full border-2 border-red-500 flex items-center justify-center"><Pause className="w-3.5 h-3.5 fill-current" /></span>
              </button>
            ) : (
              <button type="button" onClick={() => void seguir()} aria-label="Seguir grabando"
                className={`${boton} text-red-500`}>
                <Mic className="w-6 h-6" />
              </button>
            )}
            <button type="button" onClick={() => void terminar(true)} aria-label="Enviar la nota de voz"
              className={`${boton} ${color} text-white shadow-sm`}>
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <button type="button" aria-label={etiqueta} title={etiqueta} disabled={deshabilitado || conCandado}
        onPointerDown={alPresionar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar}
        onContextMenu={(e) => e.preventDefault()}
        className={`relative z-20 w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer ${color} text-white shadow-sm select-none touch-none disabled:opacity-40 transition-transform ${estado === 'grabando' ? 'scale-125' : ''}`}
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}>
        <Mic className="w-4 h-4" />
      </button>
    </>
  );
};
