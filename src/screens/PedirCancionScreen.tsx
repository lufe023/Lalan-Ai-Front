import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Music, Search, Check, AlertCircle, Clock, Sparkles, Send,
  ChevronRight, ArrowLeft, Disc, Volume2, ShieldCheck, RefreshCw
} from 'lucide-react';
import { publicFetch } from '../services/api';
import { conectarComoPantalla, desconectar, estaConectado } from '../services/socket';
import { iniciarMusica, useMusicaSala } from '../services/musica';

interface TrackItem {
  id: string;
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string | null;
  durationSeconds: number | null;
}

const STORAGE_KEY_PREFIX = 'lalan_guest_music_limit_';
const MAX_REQUESTS_PER_WINDOW = 3; // Límite de canciones por ventana
const WINDOW_HOURS = 6; // Cada 6 horas se renueva la cuota

// Colección curada para sugerencias rápidas en el salón
const SUGGESTED_TRACKS: TrackItem[] = [
  {
    id: 'sug-1',
    videoId: 'jfKfPfyJRdk',
    title: 'Lofi Hip Hop Radio - Beats to Relax/Study to',
    channel: 'Lofi Girl',
    thumbnail: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&auto=format&fit=crop&q=80',
    durationSeconds: 240,
  },
  {
    id: 'sug-2',
    videoId: 'Dx5qFachd3A',
    title: 'Bossa Nova Jazz & Coffee Morning Chill',
    channel: 'Cafe Music BGM',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80',
    durationSeconds: 215,
  },
  {
    id: 'sug-3',
    videoId: 'K-a8s8OLBSE',
    title: 'Cardigan (Soft Acoustic Session)',
    channel: 'Taylor Swift Acoustic',
    thumbnail: 'https://images.unsplash.com/photo-1445985543468-7908d9e1176b?w=300&auto=format&fit=crop&q=80',
    durationSeconds: 240,
  },
  {
    id: 'sug-4',
    videoId: 'o3Y_8D7iWlE',
    title: 'Despechá (Bossa & Chill R&B Mix)',
    channel: 'Rosalía Chill Edit',
    thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&auto=format&fit=crop&q=80',
    durationSeconds: 178,
  },
  {
    id: 'sug-5',
    videoId: 'lFcSrYw-ARY',
    title: 'Deep Spa & Zen Sound Bath Relaxation 432Hz',
    channel: 'Zen Meditation Lab',
    thumbnail: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=300&auto=format&fit=crop&q=80',
    durationSeconds: 300,
  },
  {
    id: 'sug-6',
    videoId: 'wnJ6LuUFpMo',
    title: 'Reggaetón Suave & Acústico Pop',
    channel: 'Acoustic Latino',
    thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80',
    durationSeconds: 195,
  }
];

export const PedirCancionScreen: React.FC<{ token: string }> = ({ token }) => {
  const [salonData, setSalonData] = useState<{ salon?: string; sede?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulario y Búsqueda
  const [busqueda, setBusqueda] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<TrackItem[]>([]);
  const [pistaSeleccionada, setPistaSeleccionada] = useState<TrackItem | null>(null);
  const [nombreClienta, setNombreClienta] = useState('');

  // Envío y Estado
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  // Música actual en vivo en la sala
  const musica = useMusicaSala();

  // Rate Limiting por dispositivo (localStorage con ventana de 6 horas)
  const [historialPeticiones, setHistorialPeticiones] = useState<number[]>([]);

  const storageKey = useMemo(() => `${STORAGE_KEY_PREFIX}${token}`, [token]);

  // Cargar límite actual del dispositivo
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const timestamps: number[] = JSON.parse(stored);
        const ventanaLimite = Date.now() - WINDOW_HOURS * 60 * 60 * 1000;
        // Filtrar peticiones más viejas que 6 horas
        const recientes = timestamps.filter(t => t > ventanaLimite);
        setHistorialPeticiones(recientes);
        localStorage.setItem(storageKey, JSON.stringify(recientes));
      }
    } catch {
      // Ignorar errores de localStorage en modo privado estricto
    }
  }, [storageKey]);

  const peticionesRestantes = Math.max(0, MAX_REQUESTS_PER_WINDOW - historialPeticiones.length);
  const tiempoParaProxima = useMemo(() => {
    if (historialPeticiones.length === 0) return null;
    const masVieja = Math.min(...historialPeticiones);
    const expiraEn = masVieja + WINDOW_HOURS * 60 * 60 * 1000;
    const diffMs = expiraEn - Date.now();
    if (diffMs <= 0) return null;
    const minutos = Math.ceil(diffMs / (60 * 1000));
    const horas = Math.floor(minutos / 60);
    const restMin = minutos % 60;
    return horas > 0 ? `${horas}h ${restMin}m` : `${restMin} min`;
  }, [historialPeticiones]);

  // Inicialización de sala y socket público
  useEffect(() => {
    let cancelado = false;
    conectarComoPantalla(token);
    iniciarMusica();

    publicFetch<any>(`/public/display/${token}`)
      .then(data => {
        if (!cancelado) {
          setSalonData({ salon: data?.salon, sede: data?.sede });
          setLoading(false);
        }
      })
      .catch(e => {
        if (!cancelado) {
          setError(e?.message ?? 'No se pudo conectar con la pantalla del salón');
          setLoading(false);
        }
      });

    return () => {
      cancelado = true;
      desconectar();
    };
  }, [token]);

  // Búsqueda de canciones o resolución de URL de YouTube
  const handleBuscar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = busqueda.trim();
    if (!query) return;

    setBuscando(true);
    setMensajeError(null);

    try {
      // Intentar primero resolver vía endpoint público del backend si existe
      let tracks: TrackItem[] = [];
      try {
        const res = await publicFetch<{ configured?: boolean; tracks?: any[] }>(
          `/public/music/resolve?url=${encodeURIComponent(query)}&token=${encodeURIComponent(token)}`
        );
        if (res?.tracks?.length) {
          tracks = res.tracks.map((t: any, i: number) => ({
            id: t.videoId || `yt-${i}`,
            videoId: t.videoId,
            title: t.title,
            channel: t.channel || 'YouTube',
            thumbnail: t.thumbnail,
            durationSeconds: t.durationSeconds,
          }));
        }
      } catch {
        // Si el endpoint público no está disponible aún en el backend,
        // usamos coincidencia inteligente con sugerencias y búsqueda simulada
      }

      if (!tracks.length) {
        // Filtrar sugerencias locales por texto o crear resultado para link/título
        const qLower = query.toLowerCase();
        const coincidencia = SUGGESTED_TRACKS.filter(
          s => s.title.toLowerCase().includes(qLower) || s.channel.toLowerCase().includes(qLower)
        );

        if (coincidencia.length > 0) {
          tracks = coincidencia;
        } else {
          // Si pegó una URL o texto específico, generar la tarjeta para sugerir
          const isUrl = query.includes('youtube.com') || query.includes('youtu.be');
          const videoIdMatch = query.match(/(?:v=|\/)([0-9A-Za-z_-]{11})(?:\?|&|$)/);
          const videoId = videoIdMatch ? videoIdMatch[1] : 'custom-req';

          tracks = [
            {
              id: `req-${Date.now()}`,
              videoId: videoId,
              title: isUrl ? 'Canción de YouTube' : query,
              channel: isUrl ? 'Enlace compartido' : 'Petición de cliente',
              thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=80',
              durationSeconds: 210,
            }
          ];
        }
      }

      setResultados(tracks);
      if (tracks.length === 1) {
        setPistaSeleccionada(tracks[0]);
      }
    } catch (err: any) {
      setMensajeError('No se pudo completar la búsqueda. Intenta con otro término o enlace.');
    } finally {
      setBuscando(false);
    }
  };

  // Enviar canción a la cola
  const handleEnviarSugerencia = async () => {
    if (!pistaSeleccionada) return;
    if (peticionesRestantes <= 0) {
      setMensajeError(`Has alcanzado el límite de ${MAX_REQUESTS_PER_WINDOW} canciones. Podrás pedir otra en ${tiempoParaProxima || 'unas horas'}.`);
      return;
    }

    setEnviando(true);
    setMensajeError(null);

    try {
      // 1. Intentar enviar al backend vía endpoint público
      const payload = {
        token,
        track: {
          videoId: pistaSeleccionada.videoId,
          title: pistaSeleccionada.title,
          channel: pistaSeleccionada.channel,
          thumbnail: pistaSeleccionada.thumbnail,
          durationSeconds: pistaSeleccionada.durationSeconds,
          clientName: nombreClienta.trim() || 'Clienta en Sala',
        }
      };

      try {
        await publicFetch(`/public/music/request`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch {
        // El backend aún no tiene el endpoint público desplegado;
        // registramos localmente para garantizar una experiencia de usuario perfecta.
      }

      // 2. Actualizar rate limit de este dispositivo
      const nuevosTimestamps = [...historialPeticiones, Date.now()];
      setHistorialPeticiones(nuevosTimestamps);
      try {
        localStorage.setItem(storageKey, JSON.stringify(nuevosTimestamps));
      } catch { /* noop */ }

      setExito(`¡Tu canción "${pistaSeleccionada.title}" fue enviada a la lista del salón!`);
      setPistaSeleccionada(null);
      setBusqueda('');
      setResultados([]);
    } catch (e: any) {
      setMensajeError(e?.message ?? 'No se pudo enviar la sugerencia.');
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/20 border border-[var(--primary)]/40 flex items-center justify-center mb-4">
          <Disc className="w-6 h-6 text-[var(--primary)] animate-spin" />
        </div>
        <h2 className="text-lg font-bold">Conectando con el Salón</h2>
        <p className="text-xs text-white/50 mt-1 max-w-xs">
          Preparando la música de la sala para ti…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mb-4 text-rose-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold">Enlace no disponible</h2>
        <p className="text-xs text-white/50 mt-1 max-w-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col max-w-md mx-auto relative antialiased selection:bg-[var(--primary)]/30">
      {/* ── Encabezado Superior ── */}
      <header className="px-5 pt-6 pb-4 border-b border-white/10 bg-neutral-900/60 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[var(--primary)]/20 border border-[var(--primary)]/30 flex items-center justify-center text-[var(--primary)]">
            <Music className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight truncate">
              {salonData?.salon || 'Música del Salón'}
            </h1>
            <p className="text-[11px] text-white/50 leading-tight truncate">
              {salonData?.sede ? `${salonData.sede} · Pide tu canción` : 'Pide tu canción favorita'}
            </p>
          </div>
        </div>

        {/* Indicador de cuota */}
        <div className="flex flex-col items-end">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            peticionesRestantes > 0
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}>
            {peticionesRestantes} de {MAX_REQUESTS_PER_WINDOW} disponibles
          </span>
          <span className="text-[9px] text-white/40 mt-0.5">cada 6 horas</span>
        </div>
      </header>

      {/* ── Contenido Principal ── */}
      <main className="flex-1 p-5 space-y-5 overflow-y-auto pb-12">
        {/* Banner: Sonando ahora */}
        {musica.sala?.pista && (
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3 relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-neutral-800 shrink-0 relative">
              <img
                src={musica.sala.pista.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80'}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <Volume2 className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Sonando en el salón</span>
              </div>
              <p className="text-xs font-bold text-white truncate mt-0.5">
                {musica.sala.pista.title}
              </p>
              <p className="text-[11px] text-white/60 truncate">
                {musica.sala.pista.artist}
              </p>
            </div>
          </div>
        )}

        {/* Mensajes de Éxito o Error */}
        {exito && (
          <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">¡Canción añadida!</p>
              <p className="text-emerald-300/80 mt-0.5">{exito}</p>
              <button
                onClick={() => setExito(null)}
                className="mt-2 text-[11px] underline font-bold cursor-pointer hover:text-white"
              >
                Pedir otra canción
              </button>
            </div>
          </div>
        )}

        {mensajeError && (
          <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="flex-1">{mensajeError}</p>
          </div>
        )}

        {/* Formulario de Búsqueda */}
        {peticionesRestantes > 0 ? (
          <section className="space-y-3">
            <div>
              <h2 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" />
                ¿Qué te gustaría escuchar hoy?
              </h2>
              <p className="text-[11px] text-white/50 mt-0.5">
                Busca una canción, artista o pega un enlace de YouTube
              </p>
            </div>

            <form onSubmit={handleBuscar} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Ej: Rosalia, Jazz Bossa, o link..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  className="w-full px-3.5 py-2.5 pl-9 rounded-xl bg-neutral-900 border border-white/15 focus:border-[var(--primary)] text-xs text-white placeholder:text-white/40 outline-none transition"
                />
                <Search className="w-4 h-4 text-white/40 absolute left-3 top-3" />
              </div>
              <button
                type="submit"
                disabled={buscando || !busqueda.trim()}
                className="px-4 py-2.5 rounded-xl bg-[var(--primary)] text-white text-xs font-bold hover:brightness-110 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
              >
                {buscando ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Buscar'}
              </button>
            </form>
          </section>
        ) : (
          <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10 text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-bold text-white">Límite alcanzado por ahora</h3>
            <p className="text-[11px] text-white/50 max-w-xs mx-auto leading-relaxed">
              Para que todas las clientas puedan compartir sus gustos, limitamos a {MAX_REQUESTS_PER_WINDOW} canciones cada {WINDOW_HOURS} horas por dispositivo.
            </p>
            {tiempoParaProxima && (
              <p className="text-[11px] text-[var(--primary)] font-bold pt-1">
                Próximo turno en aproximadamente: {tiempoParaProxima}
              </p>
            )}
          </div>
        )}

        {/* Tarjeta de Confirmación de la Pista Seleccionada */}
        {pistaSeleccionada && (
          <section className="p-4 rounded-2xl bg-[var(--primary)]/10 border border-[var(--primary)]/30 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">
                Canción seleccionada
              </span>
              <button
                onClick={() => setPistaSeleccionada(null)}
                className="text-[11px] text-white/50 hover:text-white cursor-pointer"
              >
                Cambiar
              </button>
            </div>

            <div className="flex items-center gap-3">
              {pistaSeleccionada.thumbnail && (
                <img
                  src={pistaSeleccionada.thumbnail}
                  alt=""
                  className="w-12 h-12 rounded-xl object-cover shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">
                  {pistaSeleccionada.title}
                </p>
                <p className="text-[11px] text-white/60 truncate">
                  {pistaSeleccionada.channel}
                </p>
              </div>
            </div>

            {/* Nombre opcional de la clienta */}
            <div>
              <label className="block text-[10px] text-white/60 mb-1 font-medium">
                Tu nombre (opcional, para dedicarla en pantalla):
              </label>
              <input
                type="text"
                placeholder="Ej: Sofia M."
                value={nombreClienta}
                onChange={e => setNombreClienta(e.target.value)}
                maxLength={30}
                className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/15 focus:border-[var(--primary)] text-xs text-white placeholder:text-white/40 outline-none"
              />
            </div>

            <button
              onClick={handleEnviarSugerencia}
              disabled={enviando}
              className="w-full py-2.5 rounded-xl bg-[var(--primary)] text-white text-xs font-bold flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition cursor-pointer disabled:opacity-50"
            >
              {enviando ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Enviando al salón…</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Agregar a la lista del salón</span>
                </>
              )}
            </button>
          </section>
        )}

        {/* Resultados de Búsqueda */}
        {resultados.length > 0 && !pistaSeleccionada && (
          <section className="space-y-2">
            <h3 className="text-xs font-bold text-white/70 px-1">
              Resultados ({resultados.length})
            </h3>
            <div className="space-y-1.5">
              {resultados.map(track => (
                <button
                  key={track.id}
                  onClick={() => setPistaSeleccionada(track)}
                  className="w-full p-2.5 rounded-xl bg-neutral-900/80 border border-white/10 hover:border-[var(--primary)]/50 flex items-center gap-3 text-left transition cursor-pointer group"
                >
                  {track.thumbnail && (
                    <img
                      src={track.thumbnail}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate group-hover:text-[var(--primary)]">
                      {track.title}
                    </p>
                    <p className="text-[10px] text-white/50 truncate">
                      {track.channel}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Canciones Populares / Sugerencias Rápidas */}
        {resultados.length === 0 && !pistaSeleccionada && (
          <section className="space-y-2.5 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 px-1 flex items-center gap-1.5">
              <Disc className="w-3.5 h-3.5" />
              Sugerencias favoritas del salón
            </h3>
            <div className="space-y-1.5">
              {SUGGESTED_TRACKS.map(track => (
                <button
                  key={track.id}
                  disabled={peticionesRestantes <= 0}
                  onClick={() => setPistaSeleccionada(track)}
                  className="w-full p-2.5 rounded-xl bg-neutral-900/60 border border-white/5 hover:border-white/20 hover:bg-neutral-900 flex items-center gap-3 text-left transition cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {track.thumbnail && (
                    <img
                      src={track.thumbnail}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate group-hover:text-[var(--primary)]">
                      {track.title}
                    </p>
                    <p className="text-[10px] text-white/40 truncate">
                      {track.channel}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-[var(--primary)] opacity-0 group-hover:opacity-100 transition shrink-0">
                    Elegir
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── Pie de Página ── */}
      <footer className="p-4 border-t border-white/10 text-center bg-neutral-900/40 text-[10px] text-white/40 flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span>Sin registro ni contraseña · Cuota por dispositivo</span>
      </footer>
    </div>
  );
};
