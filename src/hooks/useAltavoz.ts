import { useEffect, useRef, useState } from 'react';
import { alRecibir } from '../services/socket';
import {
  useMusicaSala, reclamarAnfitrion, publicarEstado, PistaSala,
} from '../services/musica';
import { cargarApiYouTube } from '../utils/ytApi';
import { pedirPantallaCompleta, salirPantallaCompleta } from '../utils/pantallaCompleta';

/**
 * Ser el altavoz del salón.
 *
 * Lo usan DOS pantallas públicas: el reproductor dedicado y la pizarra de
 * turnos, cuando la sede la configura para que además ponga la música. Vive
 * en un solo sitio porque son ciento cincuenta líneas de player de YouTube,
 * cola, órdenes y volumen: duplicarlas garantizaba que un arreglo entrara en
 * una pantalla y no en la otra.
 *
 * Lo que NO hace: elegir la música. Esta pantalla no tiene sesión y no puede
 * pedir la cola; se la empuja por el socket quien sí la tiene. El teléfono
 * decide, la pantalla suena.
 */

/** Apagar los subtítulos: sobre un vídeo musical son ruido, no información. */
function sinSubtitulos(p: any) {
  try { p?.unloadModule?.('captions'); } catch { /* noop */ }
  try { p?.unloadModule?.('cc'); } catch { /* noop */ }
}

export function useAltavoz(opciones: { bajarAlLlamar?: boolean } = {}) {
  const { sala } = useMusicaSala();
  const [listo, setListo] = useState(false);

  /**
   * El vídeo en grande.
   *
   * Es una capa nuestra hecha con CSS, no la pantalla completa del navegador,
   * y esa es justamente la gracia: la del navegador exige un toque reciente
   * del usuario y por tanto NO se puede pedir desde el teléfono. Esta sí. Lo
   * único que no tapa es la barra de direcciones, y para eso se intenta
   * además la del navegador — si el televisor la concede, mejor; si no, se
   * ve igual de grande.
   */
  const [videoGrande, setVideoGrande] = useState(false);

  /**
   * El navegador nos dejó sonar, o no.
   *
   * Se intenta SIEMPRE arrancar solo al cargar. Muchos navegadores lo
   * permiten sin tocar nada —Chrome, cuando el sitio ya se ha usado para ver
   * vídeo unas cuantas veces, y cualquiera abierto en modo quiosco—, y en
   * ese caso el televisor arranca solo y nadie tiene que levantarse de la
   * silla. El botón de "activar" solo aparece cuando el intento falla, que
   * es la única vez que hace falta.
   */
  const [bloqueado, setBloqueado] = useState(false);

  const anclaRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const cargadoRef = useRef<string | null>(null);

  const cola: PistaSala[] = sala.cola ?? [];
  const pista = cola[sala.indice] ?? null;

  /**
   * El índice se mueve AQUÍ y no en el servidor.
   *
   * Es el altavoz quien sabe cuándo terminó una canción; el servidor no tiene
   * forma de saberlo y los mandos tampoco. Si el avance viviera en otro
   * sitio, dos aparatos podrían adelantar la cola a la vez.
   */
  const mover = (delta: number) => {
    const n = cola.length;
    if (!n) return;
    const i = ((sala.indice + delta) % n + n) % n;
    publicarEstado({ indice: i, sonando: true, posicion: 0 });
  };
  const irA = (i: number) => {
    if (i >= 0 && i < cola.length) publicarEstado({ indice: i, posicion: 0 });
  };

  /* Los eventos del player se registran UNA vez, al crearlo, así que
     capturarían el `mover` de aquel render y avanzarían siempre desde el
     índice de entonces: la cola se quedaría botando entre las dos primeras
     canciones. Por eso pasan por una referencia. */
  const moverRef = useRef(mover);
  moverRef.current = mover;

  // ── Obedecer a los mandos ───────────────────────────────────────────
  const aplicar = useRef<(o: any) => void>(() => {});
  aplicar.current = (orden: any) => {
    const p = playerRef.current;
    const v = orden?.valor;
    try {
      switch (orden?.accion) {
        case 'play':    p?.playVideo?.(); break;
        case 'pause':   p?.pauseVideo?.(); break;
        case 'next':    mover(1); break;
        case 'prev':    mover(-1); break;
        case 'seek':    if (Number.isFinite(Number(v))) p?.seekTo?.(Number(v), true); break;
        case 'volumen':
          if (Number.isFinite(Number(v))) {
            const vol = Math.max(0, Math.min(100, Number(v)));
            // Si llega mientras la música está bajada por un anuncio, se
            // guarda como el volumen al que hay que volver, no se pisa.
            volumenRef.current = vol;
            if (!agachadoRef.current) p?.setVolume?.(vol);
          }
          break;
        case 'pista':   if (Number.isFinite(Number(v))) irA(Number(v)); break;
        case 'video': {
          const quiere = v === null || v === undefined ? undefined : !!v;
          setVideoGrande(actual => {
            const nuevo = quiere === undefined ? !actual : quiere;
            // Se intenta también la del navegador, sin depender de ella
            if (nuevo) void pedirPantallaCompleta();
            else void salirPantallaCompleta();
            return nuevo;
          });
          break;
        }
        case 'pantalla':
          if (v) void pedirPantallaCompleta();
          else void salirPantallaCompleta();
          break;
      }
    } catch { /* el player aún no está listo; ya llegará otra orden */ }
  };
  useEffect(() => alRecibir('musica:orden', (o: any) => aplicar.current(o)), []);

  // ── Bajar la música mientras se llama a alguien ─────────────────────
  const volumenRef = useRef(80);
  const agachadoRef = useRef(false);
  const temporizadorRef = useRef(0);
  const bajarRef = useRef(!!opciones.bajarAlLlamar);
  bajarRef.current = !!opciones.bajarAlLlamar;

  useEffect(() => alRecibir('turno:llamado', () => {
    const p = playerRef.current;
    if (!p || !bajarRef.current) return;
    try {
      /* Si ya estaba bajada —dos turnos seguidos— NO se vuelve a leer el
         volumen actual: se leería el bajado y la música ya no subiría nunca.
         Solo se estira el tiempo. */
      if (!agachadoRef.current) {
        volumenRef.current = p.getVolume?.() ?? volumenRef.current;
        agachadoRef.current = true;
        p.setVolume?.(Math.max(5, Math.round(volumenRef.current * 0.25)));
      }
      window.clearTimeout(temporizadorRef.current);
      temporizadorRef.current = window.setTimeout(() => {
        agachadoRef.current = false;
        try { p.setVolume?.(volumenRef.current); } catch { /* noop */ }
      }, 7000);
    } catch { /* noop */ }
  }), []);

  // ── Encender: hace falta un gesto, siempre ──────────────────────────
  const encender = async () => {
    const YT = await cargarApiYouTube();
    if (!anclaRef.current || playerRef.current) { setListo(true); return; }
    const primera = cola[sala.indice]?.videoId ?? undefined;
    /* `autoplay: 0` aunque esto exista para sonar. Crear el player con
       autoplay y sin vídeo es lo que pinta la pantalla negra de "Se produjo
       un error". Lo que suena es `loadVideoById`, que arranca solo — y para
       entonces ya hubo el gesto, así que el navegador lo permite. */
    new YT.Player(anclaRef.current, {
      width: '100%', height: '100%',
      ...(primera ? { videoId: primera } : {}),
      playerVars: {
        autoplay: 0, rel: 0, modestbranding: 1, playsinline: 1,
        controls: 0, cc_load_policy: 0, iv_load_policy: 3, disablekb: 1,
      },
      events: {
        onReady: (e: any) => {
          playerRef.current = e.target;
          try { e.target.setVolume(volumenRef.current); } catch { /* noop */ }
          setListo(true);
          reclamarAnfitrion();
          sinSubtitulos(e.target);
          const id = cola[sala.indice]?.videoId;
          if (id) {
            cargadoRef.current = id;
            try { e.target.loadVideoById(id); } catch { /* noop */ }
          }
        },
        onStateChange: (e: any) => {
          if (e.data === YT.PlayerState.ENDED) { moverRef.current(1); return; }
          // Los subtítulos vuelven con cada vídeo nuevo
          if (e.data === YT.PlayerState.PLAYING) sinSubtitulos(e.target);
        },
        // Vídeo bloqueado o borrado: saltar en vez de quedarse trabado
        onError: () => moverRef.current(1),
      },
    });
  };

  /**
   * Intentar arrancar sin que nadie toque nada.
   *
   * Si a los tres segundos el player no está reproduciendo ni cargando
   * —teniendo canción puesta—, es que el navegador lo bloqueó y hay que
   * pedir el toque. Se mira el estado real del player en vez de confiar en
   * que `playVideo()` no lance error: no lanza; simplemente no suena.
   */
  const intentarSolo = async () => {
    await encender();
    window.setTimeout(() => {
      const p = playerRef.current;
      if (!p || !cargadoRef.current) return;   // sin canción no hay nada que juzgar
      let estado = -1;
      try { estado = p.getPlayerState?.() ?? -1; } catch { /* noop */ }
      // 1 = reproduciendo, 3 = cargando
      if (estado !== 1 && estado !== 3) setBloqueado(true);
    }, 3000);
  };

  // ── Poner la canción que toca ───────────────────────────────────────
  useEffect(() => {
    const p = playerRef.current;
    const id = pista?.videoId;
    if (!p || !id) return;
    if (cargadoRef.current === id) return;   // ya está puesta: no reiniciarla
    cargadoRef.current = id;
    try { p.loadVideoById(id); } catch { /* noop */ }
    sinSubtitulos(p);
  }, [pista?.videoId, listo]);

  // ── Contar qué suena ────────────────────────────────────────────────
  const contar = useRef<() => void>(() => {});
  contar.current = () => {
    const p = playerRef.current;
    let posicion = 0, duracion = 0, sonando = false;
    let volumen = volumenRef.current;
    try {
      posicion = p?.getCurrentTime?.() ?? 0;
      duracion = p?.getDuration?.() ?? 0;
      // Mientras está bajada por un anuncio se publica el volumen NORMAL:
      // si no, la barra del teléfono daría un salto cada vez que llaman a
      // alguien y parecería que el mando se mueve solo.
      volumen = agachadoRef.current ? volumenRef.current : (p?.getVolume?.() ?? volumen);
      sonando = p?.getPlayerState?.() === 1;
    } catch { /* noop */ }
    publicarEstado({
      sonando, posicion, duracion, volumen, pista, indice: sala.indice,
      // Lo que de verdad pasó con la pantalla completa, no lo que se pidió
      completa: !!document.fullscreenElement,
    });
  };
  useEffect(() => {
    if (!listo) return;
    const id = window.setInterval(() => contar.current(), 2000);
    return () => window.clearInterval(id);
  }, [listo]);

  useEffect(() => () => {
    window.clearTimeout(temporizadorRef.current);
    try { playerRef.current?.destroy?.(); } catch { /* noop */ }
    playerRef.current = null;
  }, []);

  return {
    anclaRef, encender, intentarSolo, listo, bloqueado, cola, pista, sala,
    videoGrande,
    alternarVideo: () => setVideoGrande(x => {
      const nuevo = !x;
      if (nuevo) void pedirPantallaCompleta(); else void salirPantallaCompleta();
      return nuevo;
    }),
  };
}
