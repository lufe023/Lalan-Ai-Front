import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { publicFetch } from '../services/api';
import { conectarComoPantalla, desconectar, alRecibir, estaConectado } from '../services/socket';
import {
  activarSonido, sonidoListo, campanaDeLlamada, tinDeCambio, decir, fraseDeTurno, callar,
} from '../utils/campana';
import { Bloque, COLS, FILAS, normalizar } from '../utils/pizarra';
import { iniciarMusica, useMusicaSala, EstadoSala } from '../services/musica';
import { useAltavoz } from '../hooks/useAltavoz';
import { recordarPantalla } from '../utils/pantallaRecordada';
import { pedirPantallaCompleta } from '../utils/pantallaCompleta';

/**
 * Red de seguridad, no el mecanismo principal.
 *
 * Lo que manda es el socket: el servidor avisa y la pantalla vuelve a pedir.
 * Este intervalo existe porque un socket se cae sin avisar —el wifi del
 * local, un proxy, el navegador viejo de una smart TV— y una pared congelada
 * sin que nadie lo note es peor que una que tarda medio minuto.
 */
const REFRESCO_MS = 30000;

interface TurnoPublico {
  id: string;
  code: string;
  nombre: string;
  zona: string | null;
  color: string | null;
  destino: string | null;
  desde: string;
}

interface Pantalla {
  salon: string;
  sede?: string;
  anuncio?: {
    modo: 'tono' | 'voz' | 'ambos' | 'mudo';
    voz: string | null;
    /** Esta pared pone también la música del salón */
    suena?: boolean;
    /** Bajar la música mientras se anuncia */
    bajar?: boolean;
  };
  /** Null = la pared usa el diseño de fábrica */
  bloques?: Bloque[] | null;
  actualizado: string;
  zonas: { id: string; name: string; prefix: string; color: string | null }[];
  llamando: TurnoPublico[];
  atendiendo: TurnoPublico[];
  esperando: TurnoPublico[];
}

/** Con am/pm: la pared la lee gente, no un registro del sistema. */
const laHora = () =>
  new Date().toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit', hour12: true });

const tono = (t: TurnoPublico) => t.color || '#c4697d';

/* ══════════════════════════════════════════════════════════════════════
   LOS BLOQUES — definidos AQUÍ, fuera del componente, y no dentro.

   Un componente declarado dentro de otro es un tipo NUEVO en cada render:
   React no lo reconoce, desmonta el subárbol entero y lo vuelve a montar.
   Mientras la pared solo se redibujaba una vez por minuto —cuando cambiaba
   el reloj— no se notaba; en cuanto empezó a llegar el estado de la música
   cada dos segundos, la pared entera parpadeaba como un F5. Fuera del
   componente el tipo es estable, y un render vuelve a ser solo un render.
   ══════════════════════════════════════════════════════════════════════ */

const Llamando: React.FC<{
  llamando: TurnoPublico[]; atendiendo: TurnoPublico[]; esperando: TurnoPublico[];
}> = ({ llamando, atendiendo, esperando }) => (
  <LayoutGroup id="pantalla-llamando">
    <div className="h-full flex flex-col justify-center gap-4 min-h-0">
      <AnimatePresence mode="popLayout">
        {llamando.length ? (
          llamando.slice(0, 3).map(t => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              className="rounded-3xl px-[3%] py-[2%] flex items-center gap-[4%] min-h-0"
              style={{ backgroundColor: tono(t) }}
            >
              {/* Parpadea despacio: llama la atención sin marear a quien
                  lleva media hora mirándolo */}
              <motion.div
                animate={{ opacity: [1, 0.55, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className="font-black tabular-nums tracking-tighter leading-none shrink-0"
                style={{ fontSize: 'clamp(3rem, 9vw, 9rem)' }}
              >
                {t.code}
              </motion.div>
              <div className="min-w-0">
                <div
                  className="font-bold truncate leading-tight"
                  style={{ fontSize: 'clamp(1.5rem, 4vw, 4rem)' }}
                >
                  {t.nombre}
                </div>
                {t.destino && (
                  <div
                    className="text-white/80 truncate"
                    style={{ fontSize: 'clamp(1rem, 2vw, 2rem)' }}
                  >
                    → {t.destino}
                  </div>
                )}
              </div>
            </motion.div>
          ))
        ) : (
          <motion.div
            key="nadie"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="text-center"
          >
            <div
              className="font-bold text-white/25"
              style={{ fontSize: 'clamp(2rem, 4vw, 4rem)' }}
            >
              {atendiendo.length + esperando.length ? 'Servicio en curso' : 'Bienvenida'}
            </div>
            <div className="text-white/20 mt-3" style={{ fontSize: 'clamp(0.9rem, 1.4vw, 1.5rem)' }}>
              {atendiendo.length + esperando.length
                ? 'Te llamaremos por tu número'
                : 'Acércate a recepción para tomar tu turno'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </LayoutGroup>
);

const EnAtencion: React.FC<{ atendiendo: TurnoPublico[] }> = ({ atendiendo }) => (
  <div className="h-full flex flex-col min-h-0">
    <h2 className="text-[0.8vw] min-text-xs font-bold uppercase tracking-[0.2em] text-white/35 mb-3 shrink-0">
      En atención
    </h2>
    <LayoutGroup id="pantalla-atendiendo">
      <div className="flex-1 min-h-0 overflow-hidden space-y-2">
        <AnimatePresence initial={false}>
          {atendiendo.map(t => (
            <motion.div
              key={t.id}
              layout="position"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2"
            >
              <span
                className="shrink-0 px-2.5 py-1 rounded-xl font-black tabular-nums"
                style={{ backgroundColor: tono(t), fontSize: 'clamp(1rem, 1.6vw, 1.8rem)' }}
              >
                {t.code}
              </span>
              <span
                className="font-semibold truncate flex-1"
                style={{ fontSize: 'clamp(1rem, 1.5vw, 1.7rem)' }}
              >
                {t.nombre}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        {!atendiendo.length && (
          <p className="text-white/20" style={{ fontSize: 'clamp(0.9rem, 1.2vw, 1.3rem)' }}>
            Ningún sillón ocupado.
          </p>
        )}
      </div>
    </LayoutGroup>
  </div>
);

/* La cola desaparece entera cuando está vacía: un martes tranquilo la pared
   se ve como si el bloque no existiera. */
const Esperando: React.FC<{ esperando: TurnoPublico[] }> = ({ esperando }) => (
  !esperando.length ? null : (
    <div className="h-full flex flex-col min-h-0">
      <h2 className="text-[0.8vw] font-bold uppercase tracking-[0.2em] text-white/35 mb-2 shrink-0">
        En espera · {esperando.length}
      </h2>
      <div className="flex flex-wrap gap-2 overflow-hidden">
        {esperando.slice(0, 16).map(t => (
          <span
            key={t.id}
            className="px-3 py-1 rounded-xl font-bold tabular-nums border"
            style={{
              borderColor: tono(t), color: tono(t),
              fontSize: 'clamp(0.9rem, 1.4vw, 1.6rem)',
            }}
          >
            {t.code}
          </span>
        ))}
        {esperando.length > 16 && (
          <span className="px-2 py-1 font-bold text-white/30">
            +{esperando.length - 16}
          </span>
        )}
      </div>
    </div>
  )
);

const Reloj: React.FC<{ hora: string; error: string | null; enVivo: boolean }> = ({
  hora, error, enVivo,
}) => (
  <div className="h-full flex flex-col items-end justify-center">
    <div className="font-bold tabular-nums leading-none" style={{ fontSize: 'clamp(1.5rem, 3.2vw, 3.5rem)' }}>
      {hora}
    </div>
    {error ? (
      <div className="text-rose-400 font-semibold text-[0.8vw]">{error}</div>
    ) : (
      /* Diminuto a propósito: a quien espera no le importa, pero permite
         saber de un vistazo si la pared está en vivo. */
      <div className="flex items-center gap-1.5 mt-1">
        <span className={`w-1.5 h-1.5 rounded-full ${enVivo ? 'bg-emerald-400' : 'bg-white/20'}`} />
        <span className="text-white/25 text-[0.7vw]">{enVivo ? 'en vivo' : 'sin enlace'}</span>
      </div>
    )}
  </div>
);

const Marca: React.FC<{ salon?: string; sede?: string }> = ({ salon, sede }) => (
  <div className="h-full flex flex-col justify-center min-w-0">
    <h1 className="font-bold tracking-tight truncate leading-tight" style={{ fontSize: 'clamp(1.2rem, 2.4vw, 2.6rem)' }}>
      {salon ?? 'Lalan AI'}
    </h1>
    <p className="text-white/40 truncate" style={{ fontSize: 'clamp(0.8rem, 1.1vw, 1.2rem)' }}>
      {sede ? `${sede} · Turnos en sala` : 'Turnos en sala'}
    </p>
  </div>
);

const Texto: React.FC<{ b: Bloque }> = ({ b }) => (
  <div className="h-full flex items-center justify-center text-center px-2">
    <p className="text-white/70 leading-snug" style={{ fontSize: 'clamp(0.9rem, 1.6vw, 1.8rem)' }}>
      {b.config?.texto ?? ''}
    </p>
  </div>
);

/**
 * Qué suena.
 *
 * Dos modos, y la diferencia es de dónde sale el audio:
 *
 *  · La pared solo MIRA — el altavoz es otro aparato. Muestra la portada.
 *  · La pared SUENA — la sede la configuró como altavoz. Entonces el vídeo
 *    de YouTube vive detrás de la portada y del tamaño de la portada: tiene
 *    que ser un elemento de verdad, con medidas de verdad, porque un iframe
 *    de un píxel o escondido lo pausan los navegadores para ahorrar batería.
 *    La portada va encima, así que se ve una portada y se oye la música. El
 *    botón lo agranda a pantalla completa para quien quiera el vídeo.
 */
const Musica: React.FC<{
  sala: EstadoSala;
  hayAnfitrion: boolean;
  suena: boolean;
  anclaRef: React.RefObject<HTMLDivElement>;
  completa: boolean;
  alternar: () => void;
}> = ({ sala, hayAnfitrion, suena, anclaRef, completa, alternar }) => {
  const pista = sala.pista;
  const pct = sala.duracion > 0 ? Math.min(100, (sala.posicion / sala.duracion) * 100) : 0;

  if (!hayAnfitrion && !suena) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-white/15" style={{ fontSize: 'clamp(0.8rem, 1.1vw, 1.2rem)' }}>
          Sin música
        </span>
      </div>
    );
  }

  /* El ancla se monta SIEMPRE que esta pared sea el altavoz, tenga o no
     canción puesta: el player necesita existir antes de la primera. */
  const video = suena ? (
    <div
      className={completa
        ? 'fixed inset-0 z-50 bg-black cursor-pointer'
        : 'h-[70%] aspect-square rounded-[0.8vw] overflow-hidden shrink-0 relative bg-white/5'}
      onClick={completa ? alternar : undefined}
      title={completa ? 'Toca para salir de pantalla completa' : undefined}
    >
      <div ref={anclaRef} className="absolute inset-0 pointer-events-none" />
      {/* Fuera de pantalla completa la portada tapa el vídeo: se ve una
          portada limpia y el player sigue vivo debajo. */}
      {!completa && pista?.portada && (
        <img src={pista.portada} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {completa && (
        <button
          onClick={alternar}
          className="absolute top-6 right-6 w-14 h-14 rounded-2xl bg-black/40 backdrop-blur text-white/50 hover:text-white hover:bg-black/70 flex items-center justify-center transition cursor-pointer"
          title="Salir de pantalla completa"
        >
          <Minimize2 className="w-6 h-6" />
        </button>
      )}
    </div>
  ) : pista?.portada ? (
    <img
      src={pista.portada}
      alt=""
      className="h-[70%] aspect-square object-cover rounded-[0.8vw] shrink-0"
    />
  ) : null;

  return (
    <div className="h-full flex items-center gap-[1.2vw] min-w-0">
      {video}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-[0.5vw]">
          {/* Las tres barritas solo se mueven si de verdad está sonando:
              una pared que baila con la música en pausa miente. */}
          <span className="flex items-end gap-[0.15vw] h-[1vw]">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className={`w-[0.22vw] bg-emerald-400 rounded-full ${sala.sonando ? 'animate-pulse' : ''}`}
                style={{
                  height: `${[60, 100, 75][i]}%`,
                  animationDelay: `${i * 150}ms`,
                  opacity: sala.sonando ? 1 : 0.3,
                }}
              />
            ))}
          </span>
          <span className="text-emerald-400/70 uppercase tracking-widest font-semibold"
                style={{ fontSize: 'clamp(0.55rem, 0.7vw, 0.85rem)' }}>
            {sala.sonando ? 'Sonando' : 'En pausa'}
          </span>
        </div>
        <div className="font-bold truncate leading-tight mt-[0.3vh]"
             style={{ fontSize: 'clamp(0.9rem, 1.5vw, 1.7rem)' }}>
          {pista?.titulo ?? 'Sin cola'}
        </div>
        <div className="text-white/40 truncate"
             style={{ fontSize: 'clamp(0.7rem, 1vw, 1.1rem)' }}>
          {pista?.artista ?? '—'}
        </div>
        {sala.duracion > 0 && (
          <div className="mt-[0.6vh] h-[0.35vh] rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-emerald-400/70 transition-[width] duration-1000 ease-linear"
                 style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      {suena && !completa && (
        <button
          onClick={alternar}
          className="shrink-0 w-[2.6vw] h-[2.6vw] min-w-9 min-h-9 rounded-xl text-white/25 hover:text-white hover:bg-white/10 flex items-center justify-center transition cursor-pointer"
          title="Ver el vídeo en pantalla completa"
        >
          <Maximize2 className="w-[1.2vw] h-[1.2vw] min-w-4 min-h-4" />
        </button>
      )}
    </div>
  );
};

/**
 * La pantalla de pared.
 *
 * Se mira de pie y de lejos, así que casi todo aquí es tamaño. Lo que se
 * pinta y dónde ya no está escrito en este archivo: viene del diseño que la
 * sede guardó, y cada bloque se coloca en una cuadrícula de 12x8.
 *
 * No tiene sesión ni menú a propósito. Es una URL con un token y nada más;
 * quien la abra no puede navegar a ninguna otra parte del sistema.
 */
export const PantallaTurnos: React.FC<{ token: string }> = ({ token }) => {
  const [datos, setDatos] = useState<Pantalla | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hora, setHora] = useState(laHora);
  const [enVivo, setEnVivo] = useState(false);
  const [conSonido, setConSonido] = useState(false);
  const fallosRef = useRef(0);
  const llamandoRef = useRef<string[] | null>(null);
  const atendiendoRef = useRef<string[] | null>(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await publicFetch<Pantalla>(`/public/display/${token}`));
      setError(null);
      fallosRef.current = 0;
    } catch (e: any) {
      // Un corte de red de un segundo no puede vaciar el televisor: se avisa
      // recién al tercer fallo seguido, y se sigue mostrando lo último.
      fallosRef.current += 1;
      if (fallosRef.current >= 3) setError(e?.message ?? 'Sin conexión');
    }
  }, [token]);

  /* La pared escucha la música igual que escucha los turnos: por el mismo
     socket y sin sesión. Mirar, siempre; sonar, solo si la sede lo pidió. */
  const musica = useMusicaSala();
  const suena = !!datos?.anuncio?.suena;
  const altavoz = useAltavoz({ bajarAlLlamar: datos?.anuncio?.bajar !== false });
  /* El vídeo en grande lo decide el altavoz, no esta pantalla: así el mismo
     estado responde igual a un toque aquí y a una orden del teléfono. */
  const completa = altavoz.videoGrande;
  const alternar = altavoz.alternarVideo;

  useEffect(() => {
    void cargar();
    conectarComoPantalla(token);
    // Para que la aplicación instalada vuelva sola aquí al abrirse
    recordarPantalla('pantalla', token);
    iniciarMusica();
    const dejarDeEscuchar = alRecibir('sala:cambio', () => { void cargar(); });

    const id = window.setInterval(() => { void cargar(); }, REFRESCO_MS);
    const reloj = window.setInterval(() => {
      setHora(laHora());
      setEnVivo(estaConectado());
      setConSonido(sonidoListo());
    }, 1000);

    return () => {
      dejarDeEscuchar();
      // Si se cierra la pantalla a mitad de un anuncio, que no siga hablando
      callar();
      desconectar();
      window.clearInterval(id);
      window.clearInterval(reloj);
    };
  }, [cargar, token]);

  /**
   * Arrancar solo, sin que nadie toque el televisor.
   *
   * Se intenta en cuanto sabemos que esta pared es el altavoz. Si el
   * navegador lo permite —y muchos lo permiten: Chrome cuando el sitio ya se
   * usó para ver vídeo, o cualquiera en modo quiosco— la pared se enciende
   * sola y el botón no llega a aparecer nunca. Si lo bloquea, entonces sí
   * pedimos el toque, que es la única vez que hace falta.
   */
  const intentadoRef = useRef(false);
  useEffect(() => {
    if (!suena || intentadoRef.current) return;
    intentadoRef.current = true;
    void activarSonido().then(ok => setConSonido(ok));
    void altavoz.intentarSolo();
  }, [suena]);

  /**
   * Reintentar la campana en segundo plano.
   *
   * El tono de llamada usa AudioContext, que arranca dormido y a veces
   * despierta solo un poco más tarde —en cuanto el navegador considera que
   * este sitio se usa para poner audio, cosa que la propia música termina de
   * demostrar—. Reintentarlo callado cada pocos segundos consigue el permiso
   * sin pedirle a nadie que se levante de la silla.
   */
  useEffect(() => {
    if (conSonido) return;
    const id = window.setInterval(() => {
      void activarSonido().then(ok => { if (ok) setConSonido(true); });
    }, 5000);
    return () => window.clearInterval(id);
  }, [conSonido]);

  const llamando = datos?.llamando ?? [];
  const atendiendo = datos?.atendiendo ?? [];
  const esperando = datos?.esperando ?? [];

  const bloques = useMemo(() => normalizar(datos?.bloques), [datos?.bloques]);

  /**
   * Se llamó a alguien: tono, voz, las dos o nada, según lo que diga la sede.
   *
   * Se dispara por IDENTIDADES nuevas, no por el evento del socket: así el
   * anuncio sale de los datos que la pantalla ACABA de recibir —con nombre y
   * destino— y si el socket se perdiera una llamada, el refresco de respaldo
   * la anuncia igual.
   *
   * La llave lleva el MOMENTO de la llamada, no solo el id: sin eso, volver
   * a llamar a alguien que ya estaba en la lista no sonaría, y volver a
   * llamar es justo cuando más falta hace que suene.
   */
  useEffect(() => {
    const llave = (t: TurnoPublico) => `${t.id}@${t.desde}`;
    const ahora = llamando.map(llave);
    const antes = llamandoRef.current;
    llamandoRef.current = ahora;
    if (antes === null) return;

    const nuevos = llamando.filter(t => !antes.includes(llave(t)));
    if (!nuevos.length) return;

    const modo = datos?.anuncio?.modo ?? 'tono';
    if (modo === 'mudo') return;

    if (modo === 'tono' || modo === 'ambos') campanaDeLlamada();
    if (modo === 'voz' || modo === 'ambos') {
      // Con las dos, la voz espera a que termine la campanada
      const retrasoMs = modo === 'ambos' ? 950 : 0;
      for (const t of nuevos.slice(0, 2)) {
        decir(fraseDeTurno(t.code, t.nombre, t.destino), {
          voz: datos?.anuncio?.voz, retrasoMs,
        });
      }
    }
  }, [llamando, datos?.anuncio?.modo, datos?.anuncio?.voz]);

  /**
   * Alguien NUEVO se sentó: un tin corto, sin llamar a nadie.
   * Se comparan identidades y no cantidades: si una termina y otra se sienta
   * entre dos refrescos, el total no cambia pero sí hay alguien nuevo.
   */
  useEffect(() => {
    const ahora = atendiendo.map(t => t.id).sort();
    const antes = atendiendoRef.current;
    atendiendoRef.current = ahora;
    if (antes === null) return;
    if (ahora.some(id => !antes.includes(id))) tinDeCambio();
  }, [atendiendo]);

  const pintar = (b: Bloque) => {
    switch (b.tipo) {
      case 'llamando':
        return <Llamando llamando={llamando} atendiendo={atendiendo} esperando={esperando} />;
      case 'en_atencion': return <EnAtencion atendiendo={atendiendo} />;
      case 'esperando':   return <Esperando esperando={esperando} />;
      case 'reloj':       return <Reloj hora={hora} error={error} enVivo={enVivo} />;
      case 'marca':       return <Marca salon={datos?.salon} sede={datos?.sede} />;
      case 'texto':       return <Texto b={b} />;
      case 'musica':
        return (
          <Musica
            sala={musica.sala}
            hayAnfitrion={musica.hayAnfitrion}
            suena={suena}
            anclaRef={altavoz.anclaRef}
            completa={completa}
            alternar={alternar}
          />
        );
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-950 text-white overflow-hidden">
      <div
        className="w-full h-full p-[2vh] gap-[1.5vh]"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${FILAS}, 1fr)`,
        }}
      >
        {bloques.map(b => (
          <div
            key={b.id}
            className="min-w-0 min-h-0"
            style={{
              gridColumn: `${b.col} / span ${b.ancho}`,
              gridRow: `${b.fila} / span ${b.alto}`,
            }}
          >
            {pintar(b)}
          </div>
        ))}
      </div>

      {/* ── Activar sonido ───────────────────────────────────────────
          NO bloquea la pantalla: si nadie lo pulsa, la pared sigue
          sirviendo, muda. Bloquearla haría que un televisor recién
          encendido se quedara en un botón hasta que alguien subiera.

          El mismo toque sirve para las dos cosas —la campana y la música—
          porque el navegador pide un gesto para cada una, y pedir dos
          botones es pedir que alguien se acuerde de pulsar el segundo. */}
      {/* El aviso aparece SOLO cuando de verdad no hay forma de sonar.
          Si esta pared pone la música y la música está sonando, el navegador
          ya nos dejó: preguntar otra vez sobraría, y encima tapando la
          pantalla de un salón donde nadie tiene ratón. */}
      {(suena ? altavoz.bloqueado : !conSonido) && (
        <button
          type="button"
          onClick={async () => {
            setConSonido(await activarSonido());
            if (suena) await altavoz.encender();
            /* Este toque es el ÚNICO momento en que el navegador concede la
               pantalla completa: exige un gesto reciente del usuario, así que
               pedida desde el teléfono la rechaza siempre. Se aprovecha el
               que ya tenemos. */
            void pedirPantallaCompleta();
          }}
          className="absolute bottom-6 left-6 z-40 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm text-left transition cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔔</span>
            <div>
              <div className="font-bold">
                {suena ? 'Activar sonido y música' : 'Activar sonido'}
              </div>
              <div className="text-sm text-white/40">Tócalo una vez al montar la pantalla</div>
            </div>
          </div>
        </button>
      )}

      {!datos && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-950">
          <span className="text-white/30 text-xl">Conectando…</span>
        </div>
      )}
    </div>
  );
};
