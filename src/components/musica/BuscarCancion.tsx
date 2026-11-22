import React, { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ListPlus, Loader2, Mic, Play, Search, Square, X } from 'lucide-react';
import { api, subirArchivo } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { conSedeLocal, sedeLocal } from '../../services/sedeLocal';
import { useEscucha } from '../../hooks/useEscucha';
import { ajustesLalan } from '../../utils/ajustesLalan';
import { contextoDeAudio, prepararAudio } from '../../utils/vozLalan';
import { estadoMusica, soyElAnfitrion } from '../../services/musica';
import { tocarAqui } from '../ui/GlobalYouTubePlayer';

/** Una canción tal como la devuelve la búsqueda */
export interface CancionEncontrada {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  durationSeconds: number | null;
}

/** Lo que responde el servidor al poner una canción */
export interface CancionPuesta {
  ok: true;
  id: string | null;
  modo: 'ahora' | 'cola';
  sede: string;
  sedeId: string;
  pista: CancionEncontrada;
  altavoz: string | null;
  sonando: boolean;
  yaSonaba: boolean;
  yaEnCola?: boolean;
  posicion: number;
}

/** `sede`: la de la canción que se cambia (la tarjeta de Lalan); sin ella, la del local */
export const ponerCancion = (videoId: string, modo: 'ahora' | 'cola', reemplaza?: string | null, sede?: string | null) =>
  api.post<CancionPuesta>('/lounge/musica/poner', { videoId, modo, sede: sede || sedeLocal() || undefined, ...(reemplaza ? { reemplaza } : {}) });

/** Lo que se le dice a la dueña después de poner una canción: dónde quedó, sin rodeos */
export function textoDePuesta(r: CancionPuesta): string {
  if (r.yaSonaba) return 'Ya estaba sonando.';
  if (!r.altavoz) return r.modo === 'ahora'
    ? `Quedó primera en la cola de ${r.sede}. Sonará cuando enciendas la pantalla de música o el reproductor.`
    : `Quedó en la cola de ${r.sede}, puesto ${r.posicion}. Sonará cuando enciendas la música.`;
  if (r.modo === 'ahora') return `Sonando ahora en ${r.altavoz}.`;
  if (r.yaEnCola) return `Ya estaba en la cola, puesto ${r.posicion}.`;
  return r.posicion <= 1 ? 'Va después de la que suena.' : `En la cola, puesto ${r.posicion}.`;
}

const duracion = (s: number | null) => {
  if (!s) return '';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

/**
 * El buscador de canciones del reproductor. Se escribe o se dice el nombre
 * (el micrófono pasa la voz a texto y busca solo), y cada resultado se toca
 * YA o se deja en la cola. Suena en la pantalla de música de la sede del
 * local (o en el altavoz que esté encendido), no en este teléfono.
 *
 * Buscar cuesta cuota de YouTube, así que no se busca a cada letra: se busca
 * al dar Enter, al tocar la lupa o al terminar de hablar.
 */
export const BuscarCancion: React.FC = () => {
  const { showToast } = useApp();
  const [texto, setTexto] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<CancionEncontrada[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Lo que ya se puso desde esta búsqueda (videoId → qué pasó) */
  const [puestas, setPuestas] = useState<Record<string, string>>({});
  const [poniendo, setPoniendo] = useState<string | null>(null);
  const [pasandoVoz, setPasandoVoz] = useState(false);
  const entradaRef = useRef<HTMLInputElement>(null);

  const buscar = useCallback(async (q: string) => {
    const limpio = q.trim();
    if (limpio.length < 2) return;
    setBuscando(true);
    setAviso(null);
    setPuestas({});
    try {
      const r = await api.get<{ configurado: boolean; agotado?: boolean; tracks: CancionEncontrada[] }>(
        conSedeLocal(`/lounge/musica/buscar?q=${encodeURIComponent(limpio)}`),
      );
      setResultados(r.tracks ?? []);
      if (!r.configurado) setAviso('YouTube no está configurado en Lalan todavía.');
      else if (r.agotado) setAviso('Se acabaron por hoy las búsquedas de YouTube. Mañana vuelven; mientras, pega el enlace de la canción.');
      else if (!r.tracks?.length) setAviso(`No encontré «${limpio}». Prueba con el nombre y el artista.`);
    } catch (e: any) {
      setResultados([]);
      setAviso(e?.message ?? 'No se pudo buscar. Inténtalo de nuevo.');
    } finally {
      setBuscando(false);
    }
  }, []);

  const escucha = useEscucha({
    esperaMs: 1200,
    ajustes: ajustesLalan,
    contexto: contextoDeAudio,
    onFrase: async (audio) => {
      setPasandoVoz(true);
      try {
        const f = new FormData();
        f.append('audio', audio, `cancion.${audio.type.includes('mp4') ? 'm4a' : 'webm'}`);
        const r = await subirArchivo<{ texto: string }>('/lounge/musica/escuchar', f);
        setTexto(r.texto);
        void buscar(r.texto);
      } catch (e: any) {
        setAviso(e?.message ?? 'No te entendí. Inténtalo otra vez o escríbela.');
      } finally {
        setPasandoVoz(false);
      }
    },
    onNada: () => setAviso('No te oí. Toca el micrófono y di la canción y el artista.'),
    onError: (m) => setAviso(m.replace('Escríbeme abajo', 'Escríbela arriba').replace('o escríbeme abajo', 'o escríbela')),
  });
  const escuchando = escucha.estado === 'escuchando';

  const microfono = () => {
    if (escuchando) { escucha.terminar(true); return; }
    setAviso(null);
    prepararAudio();
    void escucha.empezar();
  };

  const poner = async (c: CancionEncontrada, modo: 'ahora' | 'cola') => {
    setPoniendo(`${c.videoId}:${modo}`);
    /* Si ESTE aparato es el altavoz, la canción arranca aquí mismo, en el
       toque: el iPhone no deja sonar un video si el play llega después por
       la red. Con solo la radio sonando, «A la cola» también suena ya (la
       radio no es una cola; el servidor hace lo mismo). */
    const e = estadoMusica();
    const soloRadio = e.sonando && !e.pista?.videoId;
    if (soyElAnfitrion() && (modo === 'ahora' || soloRadio)) tocarAqui(c.videoId, c.title);
    try {
      const r = await ponerCancion(c.videoId, modo);
      const dicho = textoDePuesta(r);
      setPuestas((p) => ({ ...p, [c.videoId]: dicho }));
      showToast(r.modo === 'ahora' ? 'Poniendo la canción' : 'A la cola', `${c.title}. ${dicho}`, r.altavoz || r.yaSonaba ? 'success' : 'info');
    } catch (e: any) {
      showToast('No se pudo poner', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally {
      setPoniendo(null);
    }
  };

  const limpiar = () => {
    setTexto('');
    setResultados(null);
    setAviso(null);
    setPuestas({});
    entradaRef.current?.focus();
  };

  return (
    <div className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs">
      <form
        onSubmit={(e) => { e.preventDefault(); void buscar(texto); }}
        className="flex items-center gap-2"
        role="search"
      >
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            ref={entradaRef}
            type="search"
            enterKeyHint="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={escuchando ? 'Te escucho… di la canción' : 'Busca una canción o di su nombre'}
            aria-label="Buscar canción"
            className="w-full h-11 pl-9 pr-9 rounded-xl bg-slate-100 dark:bg-neutral-800 text-[0.9375rem] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[var(--primary)]/40 [&::-webkit-search-cancel-button]:hidden"
          />
          {!!texto && !escuchando && (
            <button type="button" onClick={limpiar} aria-label="Borrar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={microfono}
          disabled={pasandoVoz}
          aria-label={escuchando ? 'Terminar de escuchar' : 'Buscar con la voz'}
          aria-pressed={escuchando}
          className={`relative shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors cursor-pointer disabled:opacity-60 ${
            escuchando ? 'bg-rose-500 text-white' : 'bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/15'
          }`}
        >
          {escuchando && (
            <span
              className="absolute inset-0 rounded-xl bg-rose-500/40"
              style={{ transform: `scale(${1 + Math.min(0.35, escucha.nivel * 4)})`, transition: 'transform 80ms linear' }}
            />
          )}
          <span className="relative">
            {pasandoVoz ? <Loader2 className="w-5 h-5 animate-spin" /> : escuchando ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-5 h-5" />}
          </span>
        </button>
      </form>

      <AnimatePresence initial={false}>
        {(buscando || aviso || (resultados && resultados.length > 0)) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-2">
              {buscando && (
                <div className="flex items-center gap-2 px-1 py-2 text-[0.8125rem] text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Buscando en YouTube…
                </div>
              )}
              {!buscando && aviso && (
                <p className="px-1 text-[0.8125rem] text-slate-500 dark:text-neutral-400">{aviso}</p>
              )}
              {!buscando && resultados?.map((c) => {
                const hecho = puestas[c.videoId];
                return (
                  <div key={c.videoId} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-2 rounded-xl bg-slate-50 dark:bg-neutral-800/60">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img src={c.thumbnail} alt="" loading="lazy" className="w-16 h-12 rounded-lg object-cover shrink-0 bg-slate-200 dark:bg-neutral-700" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.875rem] font-semibold leading-snug text-slate-900 dark:text-white line-clamp-2">{c.title}</p>
                      <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 truncate">
                        {c.channel}{c.durationSeconds ? ` · ${duracion(c.durationSeconds)}` : ''}
                      </p>
                      {hecho && (
                        <p className="mt-0.5 text-[0.75rem] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 shrink-0" /> <span className="line-clamp-2">{hecho}</span>
                        </p>
                      )}
                    </div>
                    </div>
                    <div className="shrink-0 grid grid-cols-2 sm:flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => void poner(c, 'ahora')}
                        disabled={!!poniendo}
                        className="h-9 px-3 rounded-lg bg-[var(--primary)] text-white text-[0.8125rem] font-bold flex items-center justify-center gap-1 shadow-sm shadow-[var(--primary)]/25 active:scale-[0.97] transition-transform cursor-pointer disabled:opacity-60"
                      >
                        {poniendo === `${c.videoId}:ahora` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                        Tocar ya
                      </button>
                      <button
                        type="button"
                        onClick={() => void poner(c, 'cola')}
                        disabled={!!poniendo}
                        className="h-9 px-3 rounded-lg border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 text-[0.8125rem] font-semibold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-60"
                      >
                        {poniendo === `${c.videoId}:cola` ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListPlus className="w-4 h-4" />}
                        A la cola
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
