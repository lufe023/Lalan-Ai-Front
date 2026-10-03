import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronUp, Lock, Mic, Send, Trash2 } from 'lucide-react';

/** Lo más que dura una nota de voz */
const MAXIMO_SEGUNDOS = 120;
/** Menos que esto es un toque, no una nota */
const MINIMO_MS = 600;
/** Cuánto hay que arrastrar a la izquierda para cancelar, o hacia arriba para dejarla grabando */
const DESLIZAR_CANCELAR_PX = 110;
const DESLIZAR_BLOQUEAR_PX = 70;

/** Los formatos que graban los navegadores (iPhone: mp4; Chrome/Android: webm) */
const FORMATOS = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];

type Estado = 'inactivo' | 'grabando' | 'bloqueado';

const reloj = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * El micrófono del chat, como en WhatsApp:
 *  · Mantén presionado para grabar; al soltar, se envía.
 *  · Desliza a la izquierda para cancelar.
 *  · Desliza hacia arriba para dejarla grabando sola (candado): entonces se
 *    envía con el botón, o sola al llegar a los 2 minutos.
 */
export const GrabadorVoz: React.FC<{
  onListo: (audio: Blob) => void | Promise<void>;
  onAviso: (titulo: string, detalle: string) => void;
  deshabilitado?: boolean;
  /** Morado cuando la nota es una indicación para Lalan */
  color?: string;
  etiqueta: string;
}> = ({ onListo, onAviso, deshabilitado, color = 'bg-[var(--primary)]', etiqueta }) => {
  const [estado, setEstado] = useState<Estado>('inactivo');
  const [segundos, setSegundos] = useState(0);
  const [arrastre, setArrastre] = useState({ x: 0, y: 0 });

  const grabador = useRef<MediaRecorder | null>(null);
  const flujo = useRef<MediaStream | null>(null);
  const trozos = useRef<Blob[]>([]);
  const inicioMs = useRef(0);
  const origen = useRef({ x: 0, y: 0 });
  const estadoRef = useRef<Estado>('inactivo');
  const soltado = useRef(false);
  const tic = useRef<number | null>(null);

  const cambiar = (e: Estado) => { estadoRef.current = e; setEstado(e); };

  const apagarMicrofono = () => {
    flujo.current?.getTracks().forEach((t) => t.stop());
    flujo.current = null;
    if (tic.current) window.clearInterval(tic.current);
    tic.current = null;
  };

  /** Termina la grabación: enviar = true la manda; false la descarta */
  const terminar = (enviar: boolean) => {
    const r = grabador.current;
    grabador.current = null;
    cambiar('inactivo');
    setArrastre({ x: 0, y: 0 });
    if (!r || r.state === 'inactive') { apagarMicrofono(); return; }
    const corto = Date.now() - inicioMs.current < MINIMO_MS;
    r.onstop = () => {
      apagarMicrofono();
      if (!enviar) return;
      if (corto) { onAviso('Mantén presionado para grabar', 'Suelta para enviar. Desliza hacia arriba para dejarla grabando.'); return; }
      const tipo = r.mimeType || trozos.current[0]?.type || 'audio/mp4';
      void onListo(new Blob(trozos.current, { type: tipo }));
    };
    r.stop();
  };

  const empezar = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onAviso('No se puede grabar aquí', 'Este navegador no permite grabar audio. Actualiza el teléfono o usa Safari/Chrome.');
      return;
    }
    soltado.current = false;
    cambiar('grabando');
    setSegundos(0);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      flujo.current = s;
      // Si soltó antes de que el micrófono estuviera listo, no se graba nada
      if (soltado.current && estadoRef.current !== 'bloqueado') { apagarMicrofono(); cambiar('inactivo'); return; }
      const formato = FORMATOS.find((f) => MediaRecorder.isTypeSupported?.(f));
      const r = new MediaRecorder(s, formato ? { mimeType: formato } : undefined);
      trozos.current = [];
      r.ondataavailable = (e) => { if (e.data.size) trozos.current.push(e.data); };
      r.start(250);
      grabador.current = r;
      inicioMs.current = Date.now();
      tic.current = window.setInterval(() => {
        const s2 = Math.floor((Date.now() - inicioMs.current) / 1000);
        setSegundos(s2);
        if (s2 >= MAXIMO_SEGUNDOS) terminar(true);
      }, 250);
    } catch {
      apagarMicrofono();
      cambiar('inactivo');
      onAviso('Sin permiso para el micrófono', 'Actívalo en los ajustes del teléfono para esta app y vuelve a intentar.');
    }
  };

  // Si se cierra el chat a mitad de una grabación, se descarta
  useEffect(() => () => { grabador.current?.stop(); apagarMicrofono(); }, []);

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
    if (-x > DESLIZAR_CANCELAR_PX) { soltado.current = true; terminar(false); return; }
    if (-y > DESLIZAR_BLOQUEAR_PX) { cambiar('bloqueado'); setArrastre({ x: 0, y: 0 }); }
  };

  const alSoltar = () => {
    soltado.current = true;
    if (estadoRef.current === 'grabando') terminar(true);
  };

  const grabando = estado !== 'inactivo';

  return (
    <>
      {grabando && (
        <div className="absolute inset-0 z-10 flex items-center gap-3 px-4 bg-white dark:bg-neutral-950 border-t border-slate-200/70 dark:border-neutral-800/80" aria-live="polite">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" aria-hidden="true" />
          <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{reloj(segundos)}</span>
          {estado === 'grabando' ? (
            <span className="flex-1 flex items-center gap-1 text-[0.8125rem] text-slate-500 dark:text-neutral-400" style={{ transform: `translateX(${arrastre.x * 0.6}px)` }}>
              <ChevronLeft className="w-4 h-4" /> Desliza para cancelar
            </span>
          ) : (
            <>
              <span className="flex-1 text-[0.8125rem] text-slate-500 dark:text-neutral-400">Grabando… (máx. 2 min)</span>
              <button type="button" onClick={() => terminar(false)} aria-label="Descartar la nota de voz"
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer">
                <Trash2 className="w-5 h-5" />
              </button>
            </>
          )}
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

      {estado === 'bloqueado' ? (
        <button type="button" onClick={() => terminar(true)} aria-label="Enviar la nota de voz"
          className={`relative z-20 w-10 h-10 rounded-2xl ${color} text-white flex items-center justify-center shrink-0 cursor-pointer shadow-sm`}>
          <Send className="w-4 h-4" />
        </button>
      ) : (
        <button type="button" aria-label={etiqueta} title={etiqueta} disabled={deshabilitado}
          onPointerDown={alPresionar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar}
          onContextMenu={(e) => e.preventDefault()}
          className={`relative z-20 w-10 h-10 rounded-2xl ${color} text-white flex items-center justify-center shrink-0 cursor-pointer shadow-sm select-none touch-none disabled:opacity-40 transition-transform ${estado === 'grabando' ? 'scale-125' : ''}`}
          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}>
          <Mic className="w-4 h-4" />
        </button>
      )}
    </>
  );
};
