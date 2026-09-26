import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Music, Search, Check, AlertCircle, Clock, Sparkles, Send, ChevronRight,
  Disc, Volume2, ShieldCheck, RefreshCw, ListMusic, Flame, X,
} from 'lucide-react';
import { publicRequest, ErrorPublico } from '../services/api';
import { conectarComoInvitada, desconectar, alRecibir } from '../services/socket';
import { iniciarMusica, useMusicaSala } from '../services/musica';

/**
 * Lo que ve la clienta al escanear el QR de la pared.
 *
 * Todo lo que sale en esta pantalla viene del servidor: la cuota, las
 * canciones encontradas, las "favoritas del salón", el lugar en la fila. Nada
 * está inventado en el navegador — antes, si la búsqueda fallaba, se fabricaba
 * una tarjeta con el texto que la clienta había escrito y parecía que la
 * canción existía. Ahora, si no hay resultado, se dice.
 *
 * El navegador solo guarda dos cosas: el id anónimo de este aparato (para que
 * el servidor le cuente la cuota) y el nombre que puso, para no teclearlo
 * cada vez.
 */

interface Pista {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  durationSeconds: number | null;
}

interface MiPeticion {
  id: string;
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  estado: 'pending' | 'played';
  posicion: number | null;
  pedidaEn: string;
}

interface Estado {
  salon: string;
  sede: string;
  habilitado: boolean;
  limite: number;
  ventanaHoras: number;
  usadas: number;
  restantes: number;
  proximaEn: string | null;
  codigo: string;
  enFila: number;
  misPeticiones: MiPeticion[];
}

const CLAVE_APARATO = 'lalan_guest_device';
const CLAVE_NOMBRE = 'lalan_guest_name';

/** El id anónimo de este aparato: se crea una vez y se reutiliza */
function idDelAparato(): string {
  try {
    const guardado = localStorage.getItem(CLAVE_APARATO);
    if (guardado && /^[A-Za-z0-9_-]{16,64}$/.test(guardado)) return guardado;
  } catch { /* modo privado estricto: se usa uno de esta visita */ }
  const nuevo =
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
  try { localStorage.setItem(CLAVE_APARATO, nuevo); } catch { /* noop */ }
  return nuevo;
}

const mmss = (s: number | null) =>
  s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '';

/** Cuánto falta para una fecha, en palabras */
function enCuanto(iso: string | null, ahora: number): string {
  if (!iso) return 'un rato';
  const min = Math.max(1, Math.ceil((new Date(iso).getTime() - ahora) / 60_000));
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} h ${min % 60} min` : `${min} min`;
}

/** Portada que no se rompe: si la imagen falla, queda un icono en su lugar */
const Portada: React.FC<{ src?: string | null; className?: string }> = ({ src, className = 'w-12 h-12' }) => {
  const [fallo, setFallo] = useState(false);
  useEffect(() => { setFallo(false); }, [src]);
  return (
    <div className={`${className} rounded-xl overflow-hidden bg-white/5 shrink-0 flex items-center justify-center`}>
      {src && !fallo ? (
        <img src={src} alt="" loading="lazy" onError={() => setFallo(true)} className="w-full h-full object-cover" />
      ) : (
        <Music className="w-1/2 h-1/2 text-white/20" />
      )}
    </div>
  );
};

export const PedirCancionScreen: React.FC<{ token: string }> = ({ token }) => {
  const deviceId = useMemo(idDelAparato, []);

  const [estado, setEstado] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorFatal, setErrorFatal] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<Pista[] | null>(null);
  const [avisoBusqueda, setAvisoBusqueda] = useState<string | null>(null);
  const [favoritas, setFavoritas] = useState<Pista[]>([]);

  const [seleccion, setSeleccion] = useState<Pista | null>(null);
  const [nombre, setNombre] = useState(() => {
    try { return localStorage.getItem(CLAVE_NOMBRE) ?? ''; } catch { return ''; }
  });

  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Para repintar la cuenta atrás sin volver a pedir nada al servidor
  const [ahora, setAhora] = useState(Date.now());
  const musica = useMusicaSala();

  const qs = useMemo(
    () => `token=${encodeURIComponent(token)}&deviceId=${encodeURIComponent(deviceId)}`,
    [token, deviceId],
  );

  const cargarEstado = useCallback(async () => {
    try {
      const e = await publicRequest<Estado>(`/public/music/status?${qs}`);
      setEstado(e);
      setErrorFatal(null);
    } catch (e: any) {
      // 404: el enlace no existe o lo cambiaron. Cualquier otro fallo es pasajero.
      if (e instanceof ErrorPublico && e.status === 404) setErrorFatal(e.message);
      else if (!estado) setErrorFatal(e?.message ?? 'No se pudo conectar con el salón.');
    } finally {
      setCargando(false);
    }
  }, [qs, estado]);

  // Referencia para que los oyentes usen siempre la versión actual sin re-suscribirse
  const cargarRef = useRef(cargarEstado);
  cargarRef.current = cargarEstado;

  // ── Arranque: estado, favoritas, y el enlace en vivo con el salón ──
  useEffect(() => {
    let vivo = true;
    conectarComoInvitada(token);
    iniciarMusica();

    void cargarRef.current();
    publicRequest<{ tracks: Pista[] }>(`/public/music/suggestions?token=${encodeURIComponent(token)}`)
      .then(r => { if (vivo) setFavoritas(r?.tracks ?? []); })
      .catch(() => { /* sin favoritas la página funciona igual */ });

    // Cambió la fila o la cuota (la mía sonó, la dueña reinició, etc.)
    const quitar = alRecibir('musica:peticiones', () => { void cargarRef.current(); });
    // Volver de otra app o de la pantalla de bloqueo: la cuota pudo cambiar
    const alVolver = () => { if (document.visibilityState === 'visible') void cargarRef.current(); };
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      vivo = false;
      quitar();
      document.removeEventListener('visibilitychange', alVolver);
      desconectar();
    };
  }, [token]);

  // Reloj: cada medio minuto, y al vencer la espera se vuelve a preguntar
  useEffect(() => {
    const id = window.setInterval(() => {
      setAhora(Date.now());
      const prox = estado?.proximaEn ? new Date(estado.proximaEn).getTime() : 0;
      if (prox && prox <= Date.now()) void cargarRef.current();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [estado?.proximaEn]);

  const restantes = estado?.restantes ?? 0;
  const puedePedir = !!estado?.habilitado && restantes > 0;

  // ── Buscar ─────────────────────────────────────────────────────────
  const buscar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = busqueda.trim();
    if (q.length < 2 || buscando) return;
    setBuscando(true);
    setError(null);
    setExito(null);
    setAvisoBusqueda(null);
    setSeleccion(null);
    try {
      const r = await publicRequest<{ configurado: boolean; agotado?: boolean; tracks: Pista[] }>(
        `/public/music/search?token=${encodeURIComponent(token)}&q=${encodeURIComponent(q)}`,
      );
      if (!r.configurado) {
        setAvisoBusqueda('La búsqueda no está disponible en este momento. Pega el enlace de YouTube de la canción o elige una de las favoritas.');
        setResultados([]);
      } else if (r.agotado) {
        setAvisoBusqueda('La búsqueda ya descansó por hoy. Pega el enlace de YouTube de la canción o elige una de las favoritas.');
        setResultados([]);
      } else {
        setResultados(r.tracks);
        if (r.tracks.length === 0) {
          setAvisoBusqueda(`No encontramos «${q}». Prueba con el nombre de la canción y el artista, o pega un enlace de YouTube.`);
        }
      }
    } catch (err: any) {
      setResultados(null);
      setError(err?.message ?? 'No se pudo buscar. Inténtalo de nuevo.');
    } finally {
      setBuscando(false);
    }
  };

  const limpiarBusqueda = () => {
    setBusqueda('');
    setResultados(null);
    setAvisoBusqueda(null);
    setSeleccion(null);
  };

  // ── Pedir ──────────────────────────────────────────────────────────
  const pedir = async () => {
    if (!seleccion || enviando) return;
    setEnviando(true);
    setError(null);
    const dedicatoria = nombre.trim();
    try { localStorage.setItem(CLAVE_NOMBRE, dedicatoria); } catch { /* noop */ }

    try {
      const r = await publicRequest<Estado & { id: string }>('/public/music/request', {
        method: 'POST',
        body: {
          token, deviceId, videoId: seleccion.videoId,
          ...(dedicatoria ? { guestName: dedicatoria } : {}),
        },
      });
      setEstado(r);
      const mia = r.misPeticiones.find(m => m.id === r.id);
      setExito(
        mia?.posicion === 1
          ? `«${seleccion.title}» es la siguiente en sonar.`
          : mia?.posicion
          ? `«${seleccion.title}» quedó en la lista: hay ${mia.posicion - 1} ${mia.posicion === 2 ? 'petición' : 'peticiones'} antes.`
          : `«${seleccion.title}» quedó en la lista del salón.`,
      );
      setSeleccion(null);
      setBusqueda('');
      setResultados(null);
      setAvisoBusqueda(null);
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo enviar la canción.');
      // Si falló por la cuota o por repetida, el estado local puede estar viejo
      void cargarRef.current();
    } finally {
      setEnviando(false);
    }
  };

  // ── Estados de pantalla completa ───────────────────────────────────
  if (cargando) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/20 border border-[var(--primary)]/40 flex items-center justify-center mb-4">
          <Disc className="w-6 h-6 text-[var(--primary)] animate-spin" />
        </div>
        <h2 className="text-lg font-bold">Conectando con el salón</h2>
        <p className="text-sm text-white/50 mt-1 max-w-xs">Preparando la música de la sala para ti…</p>
      </div>
    );
  }

  if (errorFatal || !estado) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mb-4 text-rose-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold">Enlace no disponible</h2>
        <p className="text-sm text-white/50 mt-1 max-w-xs">
          {errorFatal ?? 'No se pudo conectar con el salón.'} Escanea de nuevo el código de la pantalla.
        </p>
        <button
          onClick={() => { setCargando(true); void cargarEstado(); }}
          className="mt-5 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-bold transition cursor-pointer"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const sonando = musica.sala?.pista;
  const enCola = estado.misPeticiones;

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-neutral-950 text-white flex flex-col antialiased selection:bg-[var(--primary)]/30">
      {/* ── Encabezado ── */}
      <header className="border-b border-white/10 bg-neutral-900/70 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 lg:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 lg:w-11 lg:h-11 rounded-xl bg-[var(--primary)]/20 border border-[var(--primary)]/30 flex items-center justify-center text-[var(--primary)] shrink-0">
              <Music className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm lg:text-base font-bold leading-tight truncate">{estado.salon}</h1>
              <p className="text-xs lg:text-sm text-white/50 leading-tight truncate">
                {estado.sede} · Pide tu canción
              </p>
            </div>
          </div>

          {estado.habilitado && (
            <div className="flex flex-col items-end shrink-0">
              <span className={`text-[11px] lg:text-xs font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${
                restantes > 0
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}>
                {restantes} de {estado.limite} disponibles
              </span>
              <span className="text-[10px] lg:text-[11px] text-white/40 mt-0.5">
                cada {estado.ventanaHoras} {estado.ventanaHoras === 1 ? 'hora' : 'horas'}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ── Contenido: una columna en el móvil, dos en pantallas grandes ── */}
      <main className="flex-1 w-full min-w-0 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-8 pb-10 grid grid-cols-1 gap-5 lg:gap-x-10 lg:gap-y-6 lg:grid-cols-2 lg:grid-rows-[auto_1fr] items-start [&>*]:min-w-0">

        {/* Sonando ahora */}
        <section className="lg:col-start-1 lg:row-start-1">
          {sonando?.titulo ? (
            <div className="p-3.5 lg:p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3.5">
              <div className="relative shrink-0">
                <Portada src={sonando.portada} className="w-14 h-14 lg:w-16 lg:h-16" />
                <div className="absolute inset-0 rounded-xl bg-black/30 flex items-center justify-center pointer-events-none">
                  <Volume2 className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] lg:text-[11px] uppercase font-bold text-white/50 tracking-wider">
                    Sonando en el salón
                  </span>
                </div>
                <p className="text-sm lg:text-base font-bold text-white truncate mt-0.5">{sonando.titulo}</p>
                <p className="text-xs lg:text-sm text-white/60 truncate">
                  {sonando.pidio ? `Pedida por ${sonando.pidio}` : sonando.artista}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 lg:p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-xs lg:text-sm text-white/40 flex items-center gap-2.5">
              <Volume2 className="w-4 h-4" /> Ahora mismo no suena nada en el salón.
            </div>
          )}
        </section>

        {/* Buscar y elegir */}
        <section className="space-y-4 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          {exito && (
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm flex items-start gap-2.5">
              <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-bold">¡Canción añadida!</p>
                <p className="text-emerald-300/80 mt-0.5 break-words">{exito}</p>
                {puedePedir && (
                  <button onClick={() => setExito(null)} className="mt-2 text-xs underline font-bold cursor-pointer hover:text-white">
                    Pedir otra canción
                  </button>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="flex-1 break-words">{error}</p>
              <button onClick={() => setError(null)} className="text-rose-300/60 hover:text-white cursor-pointer" aria-label="Cerrar">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {!estado.habilitado ? (
            <div className="p-5 rounded-2xl bg-neutral-900 border border-white/10 text-center space-y-2">
              <div className="w-11 h-11 rounded-xl bg-white/5 text-white/40 flex items-center justify-center mx-auto">
                <Music className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold">Los pedidos están cerrados por ahora</h3>
              <p className="text-xs text-white/50 max-w-xs mx-auto leading-relaxed">
                Hoy el salón elige la música. Puedes decirle a quien te atiende qué te gustaría escuchar.
              </p>
            </div>
          ) : !puedePedir ? (
            <div className="p-5 rounded-2xl bg-neutral-900 border border-white/10 text-center space-y-2">
              <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold">Ya usaste tus {estado.limite} canciones</h3>
              <p className="text-xs text-white/50 max-w-xs mx-auto leading-relaxed">
                Para que todas puedan compartir sus gustos, cada persona pide {estado.limite} cada {estado.ventanaHoras}{' '}
                {estado.ventanaHoras === 1 ? 'hora' : 'horas'}.
              </p>
              <p className="text-xs text-[var(--primary)] font-bold pt-1">
                Podrás pedir otra en {enCuanto(estado.proximaEn, ahora)}
              </p>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-sm lg:text-base font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[var(--primary)]" />
                  ¿Qué te gustaría escuchar hoy?
                </h2>
                <p className="text-xs lg:text-sm text-white/50 mt-0.5">
                  Busca una canción, artista o pega un enlace de YouTube
                </p>
              </div>

              <form onSubmit={buscar} className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  {/* 16 px a propósito: por debajo, iOS hace zoom al tocar el campo */}
                  <input
                    type="search"
                    inputMode="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    placeholder="Ej: Rosalía, Bossa Nova, o un enlace…"
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    maxLength={200}
                    className="w-full pl-10 pr-9 py-3 rounded-xl bg-neutral-900 border border-white/15 focus:border-[var(--primary)] text-base text-white placeholder:text-white/35 outline-none transition"
                  />
                  <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  {busqueda && (
                    <button
                      type="button" onClick={limpiarBusqueda} aria-label="Borrar"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={buscando || busqueda.trim().length < 2}
                  className="px-5 rounded-xl bg-[var(--primary)] text-white text-sm font-bold hover:brightness-110 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 flex items-center justify-center min-w-[5.5rem]"
                >
                  {buscando ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Buscar'}
                </button>
              </form>

              {avisoBusqueda && (
                <p className="text-xs lg:text-sm text-white/50 leading-relaxed px-1">{avisoBusqueda}</p>
              )}

              {/* Canción elegida */}
              {seleccion && (
                <div className="p-4 rounded-2xl bg-[var(--primary)]/10 border border-[var(--primary)]/30 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)]">
                      Canción seleccionada
                    </span>
                    <button onClick={() => setSeleccion(null)} className="text-xs text-white/50 hover:text-white cursor-pointer">
                      Cambiar
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <Portada src={seleccion.thumbnail} className="w-14 h-14" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white line-clamp-2 break-words">{seleccion.title}</p>
                      <p className="text-xs text-white/60 truncate">
                        {seleccion.channel}{seleccion.durationSeconds ? ` · ${mmss(seleccion.durationSeconds)}` : ''}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="pedir-nombre" className="block text-xs text-white/60 mb-1 font-medium">
                      Tu nombre (opcional, para dedicarla en pantalla):
                    </label>
                    <input
                      id="pedir-nombre"
                      type="text"
                      autoComplete="given-name"
                      placeholder="Ej: Sofía M."
                      value={nombre}
                      onChange={e => setNombre(e.target.value)}
                      maxLength={30}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-white/15 focus:border-[var(--primary)] text-base text-white placeholder:text-white/35 outline-none"
                    />
                  </div>

                  <button
                    onClick={pedir}
                    disabled={enviando}
                    className="w-full py-3 rounded-xl bg-[var(--primary)] text-white text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
                  >
                    {enviando ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /><span>Enviando al salón…</span></>
                    ) : (
                      <><Send className="w-4 h-4" /><span>Agregar a la lista del salón</span></>
                    )}
                  </button>
                </div>
              )}

              {/* Resultados de la búsqueda */}
              {!seleccion && resultados && resultados.length > 0 && (
                <ListaPistas
                  titulo={`Resultados (${resultados.length})`}
                  pistas={resultados}
                  onElegir={setSeleccion}
                />
              )}

              {/* Favoritas: solo si el salón ya tiene historial real */}
              {!seleccion && resultados === null && favoritas.length > 0 && (
                <ListaPistas
                  titulo="Favoritas del salón"
                  icono={<Flame className="w-3.5 h-3.5" />}
                  pistas={favoritas}
                  onElegir={setSeleccion}
                  discreta
                />
              )}
            </>
          )}
        </section>

        {/* Mis canciones */}
        {enCola.length > 0 && (
          <section className="lg:col-start-1 lg:row-start-2 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 px-1 flex items-center gap-1.5">
              <ListMusic className="w-3.5 h-3.5" /> Tus canciones
            </h3>
            <div className="space-y-1.5">
              {enCola.map(m => (
                <div key={m.id} className="p-2.5 rounded-xl bg-neutral-900/70 border border-white/5 flex items-center gap-3">
                  <Portada src={m.thumbnail} className="w-11 h-11" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">{m.title}</p>
                    <p className="text-xs text-white/40 truncate">{m.channel}</p>
                  </div>
                  <span className={`text-[10px] lg:text-[11px] font-bold px-2 py-1 rounded-full shrink-0 whitespace-nowrap ${
                    m.estado === 'played'
                      ? 'bg-white/5 text-white/40'
                      : m.posicion === 1
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-[var(--primary)]/15 text-[var(--primary)]'
                  }`}>
                    {m.estado === 'played' ? 'Ya sonó' : m.posicion === 1 ? 'Es la siguiente' : `En fila · ${m.posicion ?? '…'}`}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-white/30 px-1">Tu código: {estado.codigo}</p>
          </section>
        )}
      </main>

      {/* ── Pie ── */}
      <footer className="border-t border-white/10 bg-neutral-900/40 text-[11px] text-white/40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-center gap-1.5 text-center">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Sin registro ni contraseña · Cuota por dispositivo</span>
        </div>
      </footer>
    </div>
  );
};

/** Lista de canciones tocables, la misma para resultados y favoritas */
const ListaPistas: React.FC<{
  titulo: string;
  pistas: Pista[];
  onElegir: (p: Pista) => void;
  icono?: React.ReactNode;
  discreta?: boolean;
}> = ({ titulo, pistas, onElegir, icono, discreta }) => (
  <section className="space-y-2">
    <h3 className={`text-xs font-bold px-1 flex items-center gap-1.5 ${discreta ? 'uppercase tracking-wider text-white/40' : 'text-white/70'}`}>
      {icono}{titulo}
    </h3>
    <div className="space-y-1.5">
      {pistas.map(p => (
        <button
          key={p.videoId}
          onClick={() => onElegir(p)}
          className="w-full p-2.5 rounded-xl bg-neutral-900/80 border border-white/10 hover:border-[var(--primary)]/50 hover:bg-neutral-900 active:scale-[0.99] flex items-center gap-3 text-left transition cursor-pointer group"
        >
          <Portada src={p.thumbnail} className="w-12 h-12" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white line-clamp-2 break-words group-hover:text-[var(--primary)]">{p.title}</p>
            <p className="text-xs text-white/50 truncate">
              {p.channel}{p.durationSeconds ? ` · ${mmss(p.durationSeconds)}` : ''}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white shrink-0" />
        </button>
      ))}
    </div>
  </section>
);
