import React, { useEffect, useRef } from 'react';
import { X, Maximize2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

/**
 * Reproductor de YouTube global y controlable.
 *
 * Dos problemas resueltos aquí:
 *
 * 1. PERSISTENCIA — el <iframe> vive en este componente, montado una sola vez
 *    en App.tsx fuera del switch de pantallas, así la reproducción sobrevive al
 *    navegar. Nunca movemos el nodo en el DOM (mover un iframe lo recarga):
 *    solo cambiamos posición y tamaño por CSS sobre un contenedor `fixed`.
 *
 * 2. CONTROL — con un iframe simple no hay siguiente/anterior ni evento de
 *    "canción terminó". Por eso usamos el IFrame Player API, que expone
 *    loadVideoById / playVideo / pauseVideo / seekTo y onStateChange.
 */

const MINI_W = 208;
const MINI_H = 117; // 16:9
const MINI_MARGIN = 20;
const SAMPLE_MS = 80;

/** Carga https://www.youtube.com/iframe_api una sola vez para toda la app */
function loadYouTubeApi(): Promise<any> {
  const w = window as any;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (!w.__lalanYtApiPromise) {
    w.__lalanYtApiPromise = new Promise((resolve) => {
      const previous = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(w.YT);
      };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    });
  }
  return w.__lalanYtApiPromise;
}

export const GlobalYouTubePlayer: React.FC = () => {
  const {
    youtubeAnchorEl, navigateTo,
    ytPlayerRef, ytQueue, ytIndex, ytVolume, ytMuted,
    setYtQueue, setYtPlaying, setYtReady, setYtTime, setYtDuration,
    ytNext,
  } = useApp();

  const boxRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef({ t: 0, top: -1, left: -1, w: -1, h: -1 });

  // ytNext cambia de identidad al cambiar la cola; lo leemos por ref para que
  // el listener de onStateChange (registrado una sola vez) siempre use el actual.
  const nextRef = useRef(ytNext);
  useEffect(() => { nextRef.current = ytNext; }, [ytNext]);

  const hasQueue = ytQueue.length > 0;

  // ── Crear el player una única vez ────────────────────────────────────
  useEffect(() => {
    let destroyed = false;
    loadYouTubeApi().then((YT) => {
      if (destroyed || !hostRef.current || ytPlayerRef.current) return;
      // OJO: YT.Player REEMPLAZA el nodo que recibe por un <iframe>.
      const player = new YT.Player(hostRef.current, {
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 0, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: (e: any) => {
            ytPlayerRef.current = e.target;
            setYtReady(true);
            try { e.target.setVolume(ytVolume); } catch { /* noop */ }
          },
          onStateChange: (e: any) => {
            if (e.data === YT.PlayerState.ENDED) { nextRef.current(); return; }
            setYtPlaying(e.data === YT.PlayerState.PLAYING);
            if (e.data === YT.PlayerState.PLAYING) {
              try { setYtDuration(e.target.getDuration() || 0); } catch { /* noop */ }
            }
          },
          // Video bloqueado o borrado → saltamos al siguiente en vez de trabarnos
          onError: () => nextRef.current(),
        },
      });
      if (destroyed) { try { player.destroy(); } catch { /* noop */ } }
    });

    return () => {
      destroyed = true;
      try { ytPlayerRef.current?.destroy?.(); } catch { /* noop */ }
      ytPlayerRef.current = null;
      setYtReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cargar la pista cuando cambia el índice o la cola ────────────────
  useEffect(() => {
    const p = ytPlayerRef.current;
    const track = ytQueue[ytIndex];
    if (!p || !track) return;
    try {
      p.loadVideoById(track.videoId);
      setYtDuration(track.durationSeconds ?? 0);
    } catch { /* el player aún no está listo; el onReady lo recogerá */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytIndex, ytQueue]);

  // ── Progreso ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasQueue) return;
    const id = window.setInterval(() => {
      const p = ytPlayerRef.current;
      if (!p?.getCurrentTime) return;
      try {
        setYtTime(p.getCurrentTime() || 0);
        const d = p.getDuration?.() || 0;
        if (d) setYtDuration(d);
      } catch { /* noop */ }
    }, 500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasQueue]);

  // ── Posicionamiento: acoplado al Lounge o mini ────────────────────────
  useEffect(() => {
    if (!hasQueue) return;
    let raf = 0;

    const apply = (now: number) => {
      raf = requestAnimationFrame(apply);
      const box = boxRef.current;
      if (!box) return;

      const last = lastRef.current;
      if (now - last.t < SAMPLE_MS) return;
      last.t = now;

      const el = youtubeAnchorEl;
      const docked = !!(el && el.isConnected && el.offsetParent !== null);

      let top: number, left: number, w: number, h: number;
      if (docked) {
        const r = el!.getBoundingClientRect();
        top = r.top; left = r.left; w = r.width; h = r.height;
      } else {
        w = MINI_W;
        h = MINI_H;
        top = window.innerHeight - MINI_H - MINI_MARGIN;
        left = window.innerWidth - MINI_W - MINI_MARGIN;
      }

      if (top !== last.top || left !== last.left || w !== last.w || h !== last.h) {
        box.style.top = `${top}px`;
        box.style.left = `${left}px`;
        box.style.width = `${w}px`;
        box.style.height = `${h}px`;
        box.style.borderRadius = docked ? '16px' : '12px';
        last.top = top; last.left = left; last.w = w; last.h = h;
      }
    };

    raf = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(raf);
  }, [hasQueue, youtubeAnchorEl]);

  // Mantener volumen/mute sincronizados
  useEffect(() => {
    const p = ytPlayerRef.current;
    if (!p) return;
    try {
      p.setVolume?.(ytVolume);
      if (ytMuted) p.mute?.(); else p.unMute?.();
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytVolume, ytMuted]);

  const isDocked = !!(youtubeAnchorEl && youtubeAnchorEl.isConnected);

  return (
    <div
      ref={boxRef}
      // Se mantiene montado siempre (el player no puede recrearse sin cortar
      // la reproducción); cuando no hay cola simplemente se esconde.
      className={`fixed z-[60] overflow-hidden bg-black shadow-2xl ring-1 ring-white/10 ${hasQueue ? '' : 'opacity-0 pointer-events-none'}`}
      style={{
        top: window.innerHeight - MINI_H - MINI_MARGIN,
        left: window.innerWidth - MINI_W - MINI_MARGIN,
        width: MINI_W,
        height: MINI_H,
        borderRadius: 12,
      }}
      aria-hidden={!hasQueue}
    >
      <div ref={hostRef} className="w-full h-full" />

      {hasQueue && !isDocked && (
        <div className="absolute top-1 right-1 flex gap-1">
          <button
            onClick={() => navigateTo('lounge')}
            title="Volver al Lounge"
            className="w-6 h-6 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center backdrop-blur-sm transition cursor-pointer"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
          <button
            onClick={() => setYtQueue([])}
            title="Cerrar reproductor"
            className="w-6 h-6 rounded-full bg-black/70 hover:bg-red-600 text-white flex items-center justify-center backdrop-blur-sm transition cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
