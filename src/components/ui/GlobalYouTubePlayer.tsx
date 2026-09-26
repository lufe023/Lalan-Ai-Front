import React, { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { estadoMusica, soyElAnfitrion } from '../../services/musica';

/** Otro aparato es el líder: este, si suena, solo lo SIGUE y no mueve la cola */
const sigoAOtro = () => !!estadoMusica().anfitrion && !soyElAnfitrion();

/**
 * Reproductor de YouTube global y controlable.
 *
 * Tres problemas resueltos aquí:
 *
 * 1. PERSISTENCIA — el <iframe> vive en este componente, montado una sola vez
 *    en App.tsx fuera del switch de pantallas, así la reproducción sobrevive al
 *    navegar. Nunca movemos el nodo en el DOM (mover un iframe lo recarga):
 *    solo cambiamos posición y tamaño por CSS.
 *
 * 2. CONTROL — con un iframe simple no hay siguiente/anterior ni evento de
 *    "canción terminó". Por eso usamos el IFrame Player API.
 *
 * 3. RECORTE — al ser `fixed`, el video ignoraba el recorte de su contenedor y
 *    se pintaba encima de la cabecera y de los botones. Ahora calculamos la
 *    intersección entre el ancla y su contenedor con scroll: el marco exterior
 *    ocupa solo la parte visible y el interior se desplaza dentro. Resultado:
 *    al hacer scroll el video se recorta como si estuviera dentro del cuadro,
 *    en lugar de flotar sobre la interfaz.
 */

// Fuera de la pantalla: el iframe sigue vivo y sonando, pero no se ve.
const PARKED_LEFT = -100000;

/**
 * Cuánto duran los escombros de un fallo.
 *
 * Cuando YouTube rechaza un vídeo no solo avisa con `onError`: también
 * manda el player a PAUSED, porque se rinde. Ese PAUSED parece una pausa
 * y no lo es — nadie pulsó nada. Durante esta ventana no se le hace caso.
 */
const ESCOMBROS_DE_FALLO_MS = 2500;

/**
 * Los códigos de error que significan "este vídeo no va a funcionar NUNCA
 * aquí", frente a los que pueden ser un mal momento de la red.
 *
 *   2   → el id no vale
 *   100 → borrado o privado
 *   101 y 150 → el dueño no permite incrustarlo (el caso típico: sellos)
 *
 * El 5 (error del reproductor HTML5) se queda fuera a propósito: puede ser
 * pasajero, y marcar como muerta una canción buena es peor que saltarla una
 * vez. Con el 5 se salta igual, pero sin condenar el vídeo.
 */
const FALLOS_DEFINITIVOS = [2, 100, 101, 150];

/**
 * TODOS los ancestros que recortan, no solo el primero.
 *
 * Importa porque hay varios anidados: la tarjeta del reproductor tiene
 * `overflow-hidden` y por encima está el contenedor con scroll de la página.
 * Si nos quedáramos con el primero, el video se recortaría a la tarjeta pero
 * seguiría pintándose sobre la cabecera al hacer scroll.
 *
 * La lista se calcula una vez por ancla (getComputedStyle es caro); luego cada
 * cuadro solo leemos sus rectángulos.
 */
function clippersOf(el: HTMLElement | null): HTMLElement[] {
  const out: HTMLElement[] = [];
  let node = el?.parentElement ?? null;
  while (node && node !== document.body) {
    const { overflow, overflowX, overflowY } = getComputedStyle(node);
    if (/(auto|scroll|hidden|clip)/.test(overflow + overflowX + overflowY)) out.push(node);
    node = node.parentElement;
  }
  return out;
}

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
    youtubeAnchorEl,
    ytPlayerRef, ytQueue, ytIndex, ytVolume, ytMuted,
    setYtPlaying, setYtReady, setYtTime, setYtDuration,
    ytNext, ytOnEnded,
    ytPlaying, recordLoungeEvent, reportBrokenTrack, marcarPistaRota,
  } = useApp();

  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  // Estos callbacks cambian de identidad al cambiar la cola o el modo de
  // repetición; los leemos por ref para que el listener de onStateChange
  // (registrado una sola vez) siempre use la versión actual.
  const endedRef = useRef(ytOnEnded);
  useEffect(() => { endedRef.current = ytOnEnded; }, [ytOnEnded]);
  const nextRef = useRef(ytNext);
  useEffect(() => { nextRef.current = ytNext; }, [ytNext]);
  const reportBrokenRef = useRef(reportBrokenTrack);
  useEffect(() => { reportBrokenRef.current = reportBrokenTrack; }, [reportBrokenTrack]);
  const marcarRotaRef = useRef(marcarPistaRota);
  useEffect(() => { marcarRotaRef.current = marcarPistaRota; }, [marcarPistaRota]);

  /**
   * Qué canción está cargada AHORA MISMO, para que onError sepa a quién
   * reportar. No es lo mismo que `loadedIdRef` (un id): aquí hace falta el
   * objeto completo, con su `clientId`, para poder avisar al backend.
   */
  const currentTrackRef = useRef<any>(null);

  /**
   * Freno para una cola entera de vídeos que no se pueden reproducir.
   *
   * Cada error salta al siguiente; si TODOS fallan —pasa con colas armadas
   * a mano con enlaces rotos— ese salto se vuelve una vuelta sin fin. Tras
   * dar una vuelta completa sin conseguir sonar nada, se para en vez de
   * seguir golpeando la cuota de la API y el navegador.
   */
  const fallosRef = useRef(0);
  const largoRef = useRef(0);
  useEffect(() => { largoRef.current = ytQueue.length; }, [ytQueue.length]);

  /**
   * "¿Debe la próxima canción arrancar sola?" — empieza en falso (nadie
   * pidió nada al abrir el Lounge) y solo lo confirma una reproducción
   * REAL o lo apaga una pausa REAL.
   */
  const autoplayIntentRef = useRef(false);

  /** Cuándo falló el último vídeo, para distinguir la pausa de verdad de
   *  la que es solo el player rindiéndose. */
  const ultimoFalloRef = useRef(0);

  /** ¿La carga en curso pretendía sonar? Lo escribe el efecto de carga,
   *  en seco. A diferencia del estado del player, el propio fallo no lo
   *  puede ensuciar: por eso es lo que mira `onError` para decidir si el
   *  salto tiene que encadenar sonando. */
  const intentandoSonarRef = useRef(false);

  /** Orden explícita: la próxima canción que se cargue TIENE que sonar.
   *  La enciende un salto por error y la consume el efecto de carga. */
  const forzarPlayRef = useRef(false);

  /** El temporizador que comprueba que la canción de verdad arrancó */
  const empujonRef = useRef(0);

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
            // Fin natural: ytOnEnded decide si repite la misma o avanza
            if (e.data === YT.PlayerState.ENDED) { if (!sigoAOtro()) endedRef.current(); return; }
            setYtPlaying(e.data === YT.PlayerState.PLAYING);
            if (e.data === YT.PlayerState.PLAYING) {
              fallosRef.current = 0; // sonó algo: la racha de fallos se acabó
              autoplayIntentRef.current = true;
              try { setYtDuration(e.target.getDuration() || 0); } catch { /* noop */ }
            } else if (e.data === YT.PlayerState.PAUSED) {
              /* CUIDADO CON ESTE PAUSED.
                 Cuando YouTube rechaza un vídeo, el player acaba en PAUSED
                 él solo: se rinde. Si eso contara como "el usuario pausó",
                 la canción siguiente se cargaría en pausa — que es
                 exactamente lo que se veía. Una pausa que llega pisándole
                 los talones a un error no es una pausa de nadie. */
              if (Date.now() - ultimoFalloRef.current > ESCOMBROS_DE_FALLO_MS) {
                autoplayIntentRef.current = false;
              }
            }
          },
          // Vídeo bloqueado o borrado → saltamos al siguiente en vez de
          // trabarnos. Si lo que se estaba intentando era SONAR, el salto
          // lleva orden explícita de sonar: no se deduce del estado del
          // player, que este mismo fallo acaba de ensuciar.
          onError: (e: any) => {
            // Un seguidor con un vídeo que este aparato no puede reproducir se
            // queda callado: saltar (o pedir "siguiente" al salón) movería la
            // canción de todos por un problema de uno solo.
            if (sigoAOtro()) return;
            ultimoFalloRef.current = Date.now();

            const codigo = Number(e?.data);
            const rota = currentTrackRef.current;

            /* Solo se condena el vídeo cuando el código dice que está muerto
               de verdad. Un tropiezo de red se salta, pero no se marca: una
               canción buena tachada para siempre es peor que saltarla hoy. */
            if (rota && FALLOS_DEFINITIVOS.includes(codigo)) {
              marcarRotaRef.current?.(rota.videoId);
              reportBrokenRef.current?.(rota);
            }

            fallosRef.current += 1;
            if (fallosRef.current > Math.max(3, largoRef.current)) return; // dimos la vuelta y nada suena: paramos

            if (intentandoSonarRef.current) forzarPlayRef.current = true;
            nextRef.current();
          },
        },
      });
      if (destroyed) { try { player.destroy(); } catch { /* noop */ } }
    });

    return () => {
      destroyed = true;
      try { ytPlayerRef.current?.destroy?.(); } catch { /* noop */ }
      ytPlayerRef.current = null;
      loadedIdRef.current = null;
      setYtReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cargar la pista cuando REALMENTE cambia de canción ───────────────
  //
  // Antes este efecto dependía de [ytIndex, ytQueue] y llamaba a
  // loadVideoById sin más. Al sumar una clienta la cola es un array nuevo, el
  // efecto se re-ejecutaba y recargaba EL MISMO video, reiniciándolo desde
  // cero. Por eso ahora recordamos cuál está cargado y solo actuamos si de
  // verdad cambió: sumar o quitar gente reordena la fila sin tocar lo que suena.
  const loadedIdRef = useRef<string | null>(null);
  const fadeRef = useRef<number | null>(null);
  const volRef = useRef(ytVolume);
  const mutedRef = useRef(ytMuted);
  useEffect(() => { volRef.current = ytVolume; }, [ytVolume]);
  useEffect(() => { mutedRef.current = ytMuted; }, [ytMuted]);

  const cancelFade = () => {
    if (fadeRef.current) { cancelAnimationFrame(fadeRef.current); fadeRef.current = null; }
  };

  /** Rampa de volumen; se usa para que el cambio de canción no sea un corte seco */
  const fadeVolume = (p: any, from: number, to: number, ms: number) =>
    new Promise<void>((resolve) => {
      cancelFade();
      const t0 = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / ms);
        try { p.setVolume(Math.round(from + (to - from) * k)); } catch { /* noop */ }
        if (k < 1) fadeRef.current = requestAnimationFrame(step);
        else { fadeRef.current = null; resolve(); }
      };
      fadeRef.current = requestAnimationFrame(step);
    });

  useEffect(() => {
    const p = ytPlayerRef.current;
    if (!p) return;

    const track = ytQueue[ytIndex];
    if (!track) {
      // Cola vacía: quitaron todas las fuentes, así que paramos de verdad
      // en lugar de dejar sonando la canción anterior.
      if (loadedIdRef.current !== null) {
        cancelFade();
        try { p.stopVideo?.(); } catch { /* noop */ }
        loadedIdRef.current = null;
        setYtPlaying(false);
        setYtTime(0);
        setYtDuration(0);
      }
      return;
    }

    if (loadedIdRef.current === track.videoId) return; // ya es la que suena

    const first = loadedIdRef.current === null;
    loadedIdRef.current = track.videoId;
    currentTrackRef.current = track;

    /* La decisión de sonar se toma AQUÍ, en seco, antes de cualquier
       espera. Leerla después del fundido era parte del problema: en esos
       350 ms el player suelta estados —los escombros del vídeo que acaba
       de fallar— que le daban la vuelta a la respuesta, y la canción
       entraba en pausa. */
    const desdeFallo = forzarPlayRef.current;
    const debeSonar = autoplayIntentRef.current || desdeFallo;
    forzarPlayRef.current = false;
    intentandoSonarRef.current = debeSonar;

    window.clearTimeout(empujonRef.current);

    let cancelled = false;
    (async () => {
      const target = mutedRef.current ? 0 : volRef.current;
      try {
        /* Fade OUT de lo anterior. No lo hay en el primer arranque, ni
           cuando venimos de un vídeo que nunca llegó a sonar: bajarle el
           volumen al silencio solo retrasa la canción que sí funciona. */
        if (!first && !desdeFallo) await fadeVolume(p, target, 0, 350);
        if (cancelled) return;

        // NADA DE AUTOPLAY, por defecto.
        //
        // `loadVideoById` arranca el video solo: al entrar al Lounge la
        // música empezaba sin que nadie la pidiera, y encima el navegador
        // suele bloquear ese primer play con sonido. `cueVideoById` deja la
        // canción cargada y quieta, esperando que le den al play.
        //
        // Se usa loadVideoById en los dos casos en que la música ya venía
        // en marcha: la canción que termina y pasa a la siguiente, y el
        // salto por encima de un vídeo roto. Ahí hay que encadenar.
        if (debeSonar) p.loadVideoById(track.videoId);
        else p.cueVideoById(track.videoId);

        setYtDuration(track.durationSeconds ?? 0);

        if (desdeFallo) {
          // Saltando un vídeo muerto no hay nada que fundir: solo asegurar
          // que el volumen no se quedó en el suelo del fundido anterior.
          try { p.setVolume(target); } catch { /* noop */ }
        } else {
          await fadeVolume(p, 0, target, 700);   // Fade IN de la nueva
        }
      } catch { /* el player aún no está listo; el onReady lo recogerá */ }
    })();

    /* EL EMPUJÓN.
     *
     * `loadVideoById` debería arrancar solo, y casi siempre lo hace. Pero
     * viniendo de un vídeo que YouTube acaba de rechazar, el player se
     * queda a veces con la canción cargada y quieta — la siguiente
     * seleccionada en la lista, esperando un play que nadie tendría que
     * levantarse a dar. Así que no nos fiamos: un segundo después se mira
     * el estado REAL y, si no suena, se le dice que suene. Antes hubo
     * gesto del usuario, así que el navegador lo permite.
     *
     * Solo cuando la intención era sonar. Una canción puesta en cola a
     * propósito se queda en cola.
     */
    if (debeSonar) {
      empujonRef.current = window.setTimeout(() => {
        if (cancelled || loadedIdRef.current !== track.videoId) return;
        const pp = ytPlayerRef.current;
        if (!pp) return;

        let estado = -1;
        try { estado = pp.getPlayerState?.() ?? -1; } catch { /* noop */ }
        // 1 = reproduciendo, 3 = cargando. Cualquier otra cosa es "no suena".
        if (estado !== 1 && estado !== 3) {
          try { pp.playVideo?.(); } catch { /* noop */ }
        }

        // Y que no se quede sonando en silencio si un fundido quedó a medias
        try {
          const quiere = mutedRef.current ? 0 : volRef.current;
          if (quiere >= 5 && (pp.getVolume?.() ?? quiere) < 5) pp.setVolume?.(quiere);
        } catch { /* noop */ }
      }, 1200);
    }

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytIndex, ytQueue]);

  useEffect(() => () => {
    cancelFade();
    window.clearTimeout(empujonRef.current);
  }, []);

  // ── Bitácora: qué canción sonó de verdad ─────────────────────────────
  // Solo registramos lo que se escuchó más de 45 s. Sin ese umbral la
  // bitácora se llenaría de saltos y el dato no serviría para nada.
  // El backend además descarta repeticiones del mismo video en 20 minutos.
  const loggedRef = useRef<string | null>(null);

  useEffect(() => {
    const track = ytQueue[ytIndex];
    if (!track || !ytPlaying) return;
    if (loggedRef.current === track.videoId) return;

    const t = setTimeout(() => {
      loggedRef.current = track.videoId;
      // Fire and forget: si falla, la música ni se entera
      void recordLoungeEvent?.({
        kind: 'track_played',
        label: track.title,
        refId: track.videoId,
        clientId: track.clientId ?? null,
        clientName: track.clientName ?? null,
        metadata: { channel: track.channel ?? null, seconds: 45 },
      });
    }, 45_000);

    return () => clearTimeout(t);
  }, [ytQueue, ytIndex, ytPlaying, recordLoungeEvent]);



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

  // ── Posición y recorte, cada cuadro ──────────────────────────────────
  // Medimos en cada frame (no cada 80ms): así el video viaja EXACTAMENTE
  // sincronizado con el scroll y no da los saltos que se veían antes.
  useEffect(() => {
    let raf = 0;
    const last = { top: -1, left: -1, w: -1, h: -1, ox: -1, oy: -1, iw: -1, ih: -1 };

    // Calculado una sola vez por ancla
    const clippers = clippersOf(youtubeAnchorEl);
    const radius = youtubeAnchorEl
      ? getComputedStyle(youtubeAnchorEl).borderRadius || '0px'
      : '0px';
    if (boxRef.current) boxRef.current.style.borderRadius = radius;

    const park = (box: HTMLDivElement) => {
      if (last.left === PARKED_LEFT) return;
      box.style.left = `${PARKED_LEFT}px`;
      box.style.top = '0px';
      last.left = PARKED_LEFT;
      last.top = 0;
    };

    const apply = () => {
      raf = requestAnimationFrame(apply);
      const box = boxRef.current;
      const inner = innerRef.current;
      if (!box || !inner) return;

      const el = youtubeAnchorEl;
      if (!hasQueue || !el || !el.isConnected || el.offsetParent === null) {
        park(box);
        return;
      }

      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) { park(box); return; }

      // Ventana visible = ancla ∩ cada ancestro que recorta ∩ pantalla
      let top = Math.max(r.top, 0);
      let left = Math.max(r.left, 0);
      let right = Math.min(r.right, window.innerWidth);
      let bottom = Math.min(r.bottom, window.innerHeight);
      for (const c of clippers) {
        const cr = c.getBoundingClientRect();
        if (cr.top > top) top = cr.top;
        if (cr.left > left) left = cr.left;
        if (cr.right < right) right = cr.right;
        if (cr.bottom < bottom) bottom = cr.bottom;
      }
      const w = right - left;
      const h = bottom - top;

      // Totalmente fuera de la zona visible → escondemos, no tapamos nada
      if (w < 2 || h < 2) { park(box); return; }

      if (top !== last.top || left !== last.left || w !== last.w || h !== last.h) {
        box.style.top = `${top}px`;
        box.style.left = `${left}px`;
        box.style.width = `${w}px`;
        box.style.height = `${h}px`;
        last.top = top; last.left = left; last.w = w; last.h = h;
      }

      // El interior conserva el tamaño completo del ancla y se desplaza
      // dentro del marco recortado.
      const ox = r.left - left;
      const oy = r.top - top;
      if (ox !== last.ox || oy !== last.oy || r.width !== last.iw || r.height !== last.ih) {
        inner.style.transform = `translate(${ox}px, ${oy}px)`;
        inner.style.width = `${r.width}px`;
        inner.style.height = `${r.height}px`;
        last.ox = ox; last.oy = oy; last.iw = r.width; last.ih = r.height;
      }
    };

    raf = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(raf);
  }, [hasQueue, youtubeAnchorEl]);

  // Mantener volumen/mute sincronizados
  useEffect(() => {
    const p = ytPlayerRef.current;
    if (!p) return;
    // Si el salón mueve el volumen a mitad de un fundido, manda el salón
    cancelFade();
    try {
      p.setVolume?.(ytVolume);
      if (ytMuted) p.mute?.(); else p.unMute?.();
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytVolume, ytMuted]);

  return (
    // z-30: por debajo de cabeceras, barras y modales (z-50), de modo que la
    // interfaz siempre queda por encima del video.
    <div
      ref={boxRef}
      className="fixed z-30 overflow-hidden bg-black pointer-events-auto"
      style={{ top: 0, left: PARKED_LEFT, width: 1, height: 1 }}
    >
      <div ref={innerRef} className="absolute top-0 left-0 will-change-transform">
        <div ref={hostRef} className="w-full h-full" />
      </div>
    </div>
  );
};
