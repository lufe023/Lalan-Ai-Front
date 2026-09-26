import { useEffect, useRef, useState } from 'react';
import { alRecibir } from '../services/socket';
import {
  useMusicaSala, registrarAltavoz, publicarEstado, soyElAnfitrion, estadoMusica,
  programar, miAjusteMs, miAutoMs, calibrarme, PistaSala,
} from '../services/musica';
import {
  corregirSeguidor, posicionObjetivo, arrancarSincronizado, Calibrador, MemoriaSeguidor,
} from '../utils/seguirLider';
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

export function useAltavoz(opciones: { bajarAlLlamar?: boolean; tipo?: 'pantalla' | 'reproductor' } = {}) {
  const { sala, soyAnfitrion, soyAltavoz, silencioso } = useMusicaSala();
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

  /**
   * Freno para una cola entera de vídeos que no se pueden reproducir.
   *
   * Cuando YouTube rechaza uno, saltamos al siguiente. Si TODOS están
   * bloqueados —pasa con las listas llenas de vídeos de sello discográfico—,
   * ese salto se vuelve un bucle a toda velocidad: la pared parpadeando y la
   * cuota de la API ardiendo, sin que suene nada. Tras dar una vuelta
   * completa sin conseguir reproducir, se para y se queda quieto.
   */
  const fallosRef = useRef(0);
  const largoRef = useRef(0);
  largoRef.current = cola.length;

  /** Hasta cuándo no corregir al seguidor (justo después de una orden) */
  const silencioHastaRef = useRef(0);
  const memoriaSeguidorRef = useRef<MemoriaSeguidor>({ ultimoSalto: 0 });
  const calibradorRef = useRef(new Calibrador());

  // ── Obedecer a los mandos ───────────────────────────────────────────
  const aplicar = useRef<(o: any) => void>(() => {});
  aplicar.current = (orden: any) => {
    const p = playerRef.current;
    const v = orden?.valor;
    /* Play, pausa y salto llevan una HORA: todos los altavoces la reciben en
       momentos distintos y todos esperan a esa hora para ejecutarla, así que
       arrancan juntos. Después se deja un rato sin corregir: hasta que el
       líder publique lo nuevo, la corrección vería un estado viejo y
       desharía lo que se acaba de pedir. */
    const conHora = (fn: () => void) => programar(orden?.en, () => {
      silencioHastaRef.current = Date.now() + 1800;
      calibradorRef.current.reiniciar();
      try { fn(); } catch { /* el player aún no está listo */ }
    });

    /**
     * Arrancar a la vez que los demás.
     *
     * `base` es la posición que debe tener a la hora convenida (la del salto,
     * o la del líder si es un play). Sin hora —un solo altavoz encendido— no
     * hay nada que sincronizar y se hace en el acto.
     */
    const arrancar = (base: number | null) => {
      const pl = playerRef.current;
      const en = Number(orden?.en);
      calibradorRef.current.reiniciar();
      if (!Number.isFinite(en) || en <= 0) {
        if (base !== null) { try { pl?.seekTo?.(base, true); } catch { /* noop */ } }
        try { pl?.playVideo?.(); } catch { /* noop */ }
        return;
      }
      // El líder es la referencia: su ajuste es cero por definición
      const ajuste = soyElAnfitrion() ? 0 : miAjusteMs();
      silencioHastaRef.current = Date.now() + Math.max(0, en - Date.now()) + 2000;
      arrancarSincronizado(pl, base ?? posicionObjetivo(estadoMusica(), 0, en), ajuste, en, programar);
    };

    try {
      switch (orden?.accion) {
        case 'play':    arrancar(null); break;
        case 'pause':   conHora(() => playerRef.current?.pauseVideo?.()); break;
        case 'next':    mover(1); break;
        case 'prev':    mover(-1); break;
        case 'seek':    if (Number.isFinite(Number(v))) arrancar(Number(v)); break;
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
          /* Se OFRECE como altavoz, no se impone: aparece en la lista de
             altavoces y solo se enciende sola si el salón está en silencio.
             Así quien abre esta pantalla en un teléfono no pone música ni
             deja sin ella al salón. Hasta que el servidor no lo encienda,
             no se carga ni se toca nada: lo hace el efecto de abajo cuando
             `soyAltavoz`. */
          registrarAltavoz(opciones.tipo ?? 'pantalla', { suave: true });
          sinSubtitulos(e.target);
        },
        onStateChange: (e: any) => {
          if (e.data === YT.PlayerState.ENDED) { if (soyElAnfitrion()) moverRef.current(1); return; }
          if (e.data === YT.PlayerState.PLAYING) {
            // Sonó algo: la racha de fallos se acabó
            fallosRef.current = 0;
            // Los subtítulos vuelven con cada vídeo nuevo
            sinSubtitulos(e.target);
          }
        },
        // Vídeo bloqueado o borrado: saltar en vez de quedarse trabado,
        // pero solo mientras quede alguno por probar.
        onError: () => {
          // Solo el líder mueve la cola; un seguidor con un vídeo que no le
          // deja YouTube se queda callado hasta la siguiente canción
          if (!soyElAnfitrion()) return;
          fallosRef.current += 1;
          if (fallosRef.current > Math.max(3, largoRef.current)) return;
          moverRef.current(1);
        },
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
    if (!p) return;
    // Apagado en la lista no suena nada, y si lo apagaron (o lo encendió
    // otro a propósito) se calla: un televisor de más sonando solo es peor
    // que uno de menos.
    if (!soyAltavoz) {
      if (cargadoRef.current) {
        cargadoRef.current = null;
        try { p.pauseVideo?.(); } catch { /* noop */ }
      }
      return;
    }
    /* El líder carga lo que dice su cola. Un seguidor carga lo que el líder
       dice que SUENA: es la referencia, aunque su propia cola vaya
       desfasada un instante. */
    const id = soyAnfitrion ? pista?.videoId : (sala.pista?.videoId ?? pista?.videoId);
    if (!id) return;
    if (cargadoRef.current === id) return;   // ya está puesta: no reiniciarla
    cargadoRef.current = id;
    try { p.loadVideoById(id); } catch { /* noop */ }
    sinSubtitulos(p);
  }, [pista?.videoId, sala.pista?.videoId, listo, soyAltavoz, soyAnfitrion]);

  // ── Seguir al líder ─────────────────────────────────────────────────
  //
  // Cada segundo, sin red: se compara lo que hace el player con lo que dice
  // el líder que debería estar haciendo. Ver `utils/seguirLider.ts`.
  useEffect(() => {
    if (!listo || !soyAltavoz || soyAnfitrion) return;
    const id = window.setInterval(() => {
      if (Date.now() < silencioHastaRef.current) return;
      const s = estadoMusica();
      const p = playerRef.current;
      // Solo si ya está puesta la canción del líder; cambiarla es cosa del efecto de carga
      if (!p || !s.pista?.videoId || cargadoRef.current !== s.pista.videoId) return;
      const hecho = corregirSeguidor(p, s, miAjusteMs(), memoriaSeguidorRef.current);
      /* Lo que queda tras la corrección gruesa es el desfase fino: se mide
         durante unos segundos y se guarda como ajuste de este aparato. */
      if (hecho !== 'nada') calibradorRef.current.reiniciar();
      else if (s.sonando) {
        try {
          if (p.getPlayerState?.() === 1) {
            const error = posicionObjetivo(s, miAjusteMs()) - (p.getCurrentTime?.() ?? 0);
            const delta = calibradorRef.current.observar(error);
            if (delta) calibrarme(miAutoMs() + delta);
          }
        } catch { /* noop */ }
      }
      // El volumen del grupo lo manda el líder; un anuncio lo baja un rato y no se pisa
      try {
        if (!agachadoRef.current && Math.abs((p.getVolume?.() ?? s.volumen) - s.volumen) > 2) {
          volumenRef.current = s.volumen;
          p.setVolume?.(s.volumen);
        }
      } catch { /* noop */ }
    }, 1000);
    return () => window.clearInterval(id);
  }, [listo, soyAltavoz, soyAnfitrion]);

  // ── Solo imagen: sigue la canción pero no suena ─────────────────────
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    try { if (silencioso) p.mute?.(); else p.unMute?.(); } catch { /* noop */ }
  }, [silencioso, listo]);

  // ── Contar qué suena ────────────────────────────────────────────────
  const contar = useRef<() => void>(() => {});
  contar.current = () => {
    // Solo el altavoz cuenta qué suena; el servidor ignoraría a cualquier otro
    if (!soyElAnfitrion()) return;
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
