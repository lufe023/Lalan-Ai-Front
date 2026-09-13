import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from 'motion/react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Music,
  Coffee,
  Sparkles,
  Heart,
  Search,
  Plus,
  ExternalLink,
  Check,
  User,
  Radio,
  SlidersHorizontal,
  Clock,
  Flame,
  Wind,
  Smile,
  Disc3,
  Youtube,
  Maximize2,
  BookmarkPlus,
  X,
  Pencil,
  ChevronUp,
  ChevronDown,
  Trash2,
  RefreshCw,
  Receipt,
  Gift,
  Minus,
  Tag,
  Split,
  UserPlus,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api, apiFetch } from '../services/api';
import { LoungeTrack } from '../types';
import { MUSIC_VIBES, POPULAR_BEVERAGES, POPULAR_SNACKS } from '../data/mockData';
import { MandoSala } from '../components/ui/MandoSala';
import { PageContent } from '../components/ui/PageContent';
import { PosPanel } from '../components/pos/PosPanel';

/** Una preferencia ya asignada a la clienta */
type PrefItem = {
  id: string;
  preferenceId: string;
  value: string;
  intensity: number | null;
};

/** Una categoría del catálogo del salón, con sus opciones */
type CatalogoCat = {
  id: string;
  name: string;
  type: string;
  icon: string | null;
  preferences: { id: string; value: string }[];
};

/** Ambiente de cabina — vive en clients.hospitalityPrefs, no es un catálogo */
const AMBIENTE_CAMPOS = [
  { key: 'temperaturePreference', label: 'Temperatura', icon: 'wind',  opciones: ['Fresca', 'Neutra', 'Cálida'] },
  { key: 'roomAroma',             label: 'Aromaterapia', icon: 'flame', opciones: ['Lavanda', 'Vainilla', 'Cítrico', 'Eucalipto', 'Coco', 'Sándalo'] },
  { key: 'conversationLevel',     label: 'Interacción',  icon: 'smile', opciones: ['silenciosa', 'amigable', 'muy_conversadora'] },
] as const;

/**
 * Agrupa los eventos por día para el modo Historial.
 * Los eventos ya vienen ordenados del backend (más nuevo primero), así que
 * basta con recorrerlos en orden y abrir un grupo cuando cambia la fecha.
 */
function agruparPorDia(eventos: { id: string; createdAt: string; [k: string]: any }[]) {
  const hoy = new Date().toDateString();
  const ayer = new Date(Date.now() - 86400000).toDateString();
  const grupos: { dia: string; items: typeof eventos }[] = [];

  for (const ev of eventos) {
    const d = new Date(ev.createdAt);
    const clave = d.toDateString();
    const etiqueta =
      clave === hoy ? 'Hoy'
      : clave === ayer ? 'Ayer'
      : d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });

    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === etiqueta) ultimo.items.push(ev);
    else grupos.push({ dia: etiqueta, items: [ev] });
  }
  return grupos;
}

export const LoungePlayerScreen: React.FC = () => {
  const {
    loungeTracks,
    currentTrackIndex,
    currentTrack,
    isPlayingLounge,
    activeLoungeClient,
    loungeEvents, loungeEventsLoading, loungeEventsHasMore,
    loadLoungeEvents,
    playTrack,
    togglePlayLounge,
    nextLoungeTrack,
    prevLoungeTrack,
    addTrackToLounge,
    removeLoungeTrack,
    setActiveLoungeClient,
    clients,
    updateClient,
    products,
    services,
    priceLists, loadPriceLists,
    appointments,
    navigateTo,
    showToast,
    // Consumo de la cita (POS)
    activeSale, saleBusy, openSale, addSaleItem, removeSaleItem,
    setSaleItemQty, toggleSaleItemCourtesy, setSalePriceList, paySale, closeSale,
    openFolios, loadOpenFolios, selectFolio, newCounterFolio, moveSaleItem,
    currencies, baseCurrency, loadCurrencies,
    // El ancla le dice al reproductor global dónde acoplarse
    setYtLoungeAnchor, ytShowVideo, setYtShowVideo, ytFullscreen,
    // Cola compartida entre varias clientas
    loungeClients, toggleLoungeClient, ytBlocks, setYtBlocks, ytMixMode, setYtMixMode,
    // Listas fijas y del salón
    playlists, selectedPlaylistIds, loadPlaylists, togglePlaylistSelected,
    createPlaylist, deletePlaylist, addTracksToPlaylist, setLoungeClients,
    updatePlaylist, reorderPlaylistTracks, removeTrackFromPlaylist,
    // Cola de YouTube controlable (IFrame Player API)
    ytQueue, ytOrder, ytIndex, ytPlaying, ytShuffle, ytRepeatMode, ytMuted, ytVolume,
    ytTime, ytDuration, setYtQueue, ytPlayIndex, ytToggle, ytNext, ytPrev,
    ytSeek, ytSetVolume, ytToggleMute, toggleYtShuffle, cycleYtRepeat,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'player' | 'hospitality' | 'explore'>('player');
  const [progressSec, setProgressSec] = useState<number>(34);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(80);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [isRepeat, setIsRepeat] = useState<boolean>(false);

  // Search state for YouTube / Spotify
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchSource, setSearchSource] = useState<'all' | 'youtube' | 'spotify'>('all');
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // YouTube iframe player state (el embed vive en AppContext — ver GlobalYouTubePlayer)
  const [youtubeUrl, setYoutubeUrl] = useState<string>('');
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Client dropdown modal/popover
  const [showClientSelector, setShowClientSelector] = useState<boolean>(false);

  // El parseo de enlaces vive ahora en el backend (/lounge/youtube/resolve),
  // porque además de extraer el ID necesita traer título, canal y duración.

  /**
   * Carga lo que el salón pegue en el reproductor controlable.
   * El backend resuelve videos y playlists a pistas con título y duración
   * (1 unidad de cuota), así la cola queda navegable como cualquier otra.
   */
  const loadIntoQueue = useCallback(async (input: string) => {
    setYoutubeError(null);
    if (!input.trim()) return;
    setLoadingUrl(true);
    try {
      const res = await api.get<{ configured: boolean; tracks: any[] }>(
        `/lounge/youtube/resolve?url=${encodeURIComponent(input.trim())}`,
      );
      if (res.tracks?.length) {
        setYtQueue(res.tracks);
        setSource('youtube');
        setYoutubeUrl('');
      } else if (!res.configured) {
        setYoutubeError('Falta YOUTUBE_API_KEY en el backend.');
      } else {
        setYoutubeError('No se pudo reconocer el enlace. Pega una URL de YouTube (video o playlist).');
      }
    } catch (e: any) {
      setYoutubeError(`No se pudo cargar: ${e?.message ?? 'error desconocido'}`);
    } finally {
      setLoadingUrl(false);
    }
  }, [setYtQueue]);

  const handleLoadYoutube = useCallback(() => { loadIntoQueue(youtubeUrl); }, [loadIntoQueue, youtubeUrl]);

  // Genre tiles with curated YouTube playlist/video IDs
  const GENRE_TILES = [
    { emoji: '🎵', label: 'Lofi Chill', desc: 'Ambiente relajado y productivo', videoId: 'jfKfPfyJRdk' },
    { emoji: '☕', label: 'Jazz & Bossa', desc: 'Clásico para salones premium', videoId: 'Dx5qFachd3A' },
    { emoji: '💆', label: 'Spa & Zen', desc: 'Meditación y bienestar', videoId: 'lFcSrYw-ARY' },
    { emoji: '🌺', label: 'Pop Suave', desc: 'Hits populares en versión chill', videoId: '36YnV9STBqc' },
    { emoji: '🔥', label: 'Reggaetón', desc: 'Energía latina para el salón', videoId: 'wnJ6LuUFpMo' },
    { emoji: '🎸', label: 'Indie & Acoustic', desc: 'Alternativo y folk relajado', videoId: 'tRcPA7Fzebw' },
  ] as const;

  // Mock songs pool for search simulation
  const EXTERNAL_SEARCH_MOCKS = [
    {
      title: 'Texas Sun (Soul & Warm Waves)',
      artist: 'Leon Bridges & Khruangbin',
      album: 'Texas Sun EP',
      durationSeconds: 252,
      coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&auto=format&fit=crop&q=80',
      vibe: 'Lofi Chillhop & Neo-Soul',
      source: 'spotify' as const,
      spotifyUri: 'spotify:track:texas-sun',
    },
    {
      title: 'Cardigan (Soft Acoustic Session)',
      artist: 'Taylor Swift',
      album: 'Folklore Studio Sessions',
      durationSeconds: 240,
      coverUrl: 'https://images.unsplash.com/photo-1445985543468-7908d9e1176b?w=300&auto=format&fit=crop&q=80',
      vibe: 'Pop Acústico & Warm Folk',
      source: 'youtube' as const,
      youtubeId: 'K-a8s8OLBSE',
    },
    {
      title: 'Despechá (Slowed & Reverb Bossa Mix)',
      artist: 'Rosalía',
      album: 'Motomami Chill Editions',
      durationSeconds: 178,
      coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&auto=format&fit=crop&q=80',
      vibe: 'Hits Pop Suaves & R&B',
      source: 'youtube' as const,
      youtubeId: 'o3Y_8D7iWlE',
    },
    {
      title: 'Weightless (Deep Relaxation 432Hz)',
      artist: 'Marconi Union',
      album: 'Ambient 1',
      durationSeconds: 310,
      coverUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=300&auto=format&fit=crop&q=80',
      vibe: 'Spa Zen & Sound Bath',
      source: 'spotify' as const,
    },
    {
      title: 'Sunday Morning (Velvet Jazz)',
      artist: 'Maroon 5 (Acoustic Jazz Cover)',
      album: 'Acoustic Lounge Sessions',
      durationSeconds: 220,
      coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80',
      vibe: 'Bossa Nova & French Indie',
      source: 'youtube' as const,
    },
  ];

  // Al salir del Lounge soltamos el ancla → el iframe global pasa a mini
  useEffect(() => () => setYtLoungeAnchor(null), [setYtLoungeAnchor]);

  // ── Preferencias REALES de la clienta (sistema /preferences) ──────────
  // Antes esto leía activeLoungeClient.hospitality.musicVibe (campo mock),
  // por eso siempre sugería "Lofi Chill" sin importar lo que registraras.
  // Guardamos el grupo completo (id, preferenceId, intensidad), no solo el
  // texto: la pestaña Bebidas & Aperitivos necesita poder agregar y quitar,
  // y para eso hace falta el preferenceId.
  const [prefGroups, setPrefGroups] = useState<Record<string, PrefItem[]>>({});

  const cargarPrefs = useCallback(async (clientId: string) => {
    const data = await api.get<any[]>(`/preferences/clients/${clientId}`);
    const porTipo: Record<string, PrefItem[]> = {};
    for (const g of data ?? []) {
      const tipo = g?.category?.type;
      if (!tipo) continue;
      porTipo[tipo] = (g.items ?? [])
        .map((i: any) => ({
          id: i?.id,
          preferenceId: i?.preference?.id,
          value: i?.preference?.value,
          intensity: i?.intensity ?? null,
        }))
        .filter((i: PrefItem) => !!i.value && !!i.preferenceId);
    }
    return porTipo;
  }, []);

  useEffect(() => {
    if (!activeLoungeClient) { setPrefGroups({}); return; }
    let cancelled = false;
    cargarPrefs(activeLoungeClient.id)
      .then(g => { if (!cancelled) setPrefGroups(g); })
      .catch(() => { if (!cancelled) setPrefGroups({}); });
    return () => { cancelled = true; };
  }, [activeLoungeClient?.id, cargarPrefs]);

  const refrescarPrefs = useCallback(async () => {
    if (!activeLoungeClient) return;
    try { setPrefGroups(await cargarPrefs(activeLoungeClient.id)); } catch { /* sin ruido */ }
  }, [activeLoungeClient?.id, cargarPrefs]);

  const prefMusic = useMemo(() => (prefGroups.music ?? []).map(i => i.value), [prefGroups]);
  const prefDrinks = useMemo(() => (prefGroups.drink ?? []).map(i => i.value), [prefGroups]);


// ── Demanda vs oferta ─────────────────────────────────────────────────
  // Los gustos de bebida y comida van juntos: para la manicurista "lo que le
  // gusta" es una sola lista, no dos.
  const gustosConsumibles = useMemo(
    () => [...(prefGroups.drink ?? []), ...(prefGroups.food ?? [])],
    [prefGroups],
  );

  // El buscador de gustos necesita comparar sin tildes; el resto de la
  // lógica de venta se mudó a PosPanel, que se monta más abajo.
  const normalizar = (t: string) =>
    t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  /** ¿Hay algo en el catálogo que satisfaga este gusto? */
  const productoQueSatisface = useCallback((gusto: string) => {
    const a = normalizar(gusto);
    const palabras = (t: string) => t.split(/[^a-z0-9]+/).filter(w => w.length >= 4);
    const deA = new Set(palabras(a));
    return (products ?? []).find(p => {
      if (p.category !== 'beverage' && p.category !== 'snack') return false;
      const b = normalizar(p.name);
      if (a === b || a.includes(b) || b.includes(a)) return true;
      return palabras(b).some(w => deA.has(w));
    }) ?? null;
  }, [products]);

  // ── Bitácora ──────────────────────────────────────────────────────────
  const [bitacoraRango, setBitacoraRango] = useState<'today' | 'all'>('today');
  const [bitacoraSoloClienta, setBitacoraSoloClienta] = useState(false);

  useEffect(() => {
    if (activeTab !== 'hospitality') return;
    loadLoungeEvents({
      range: bitacoraRango,
      clientId: bitacoraSoloClienta ? activeLoungeClient?.id : undefined,
    });
  }, [activeTab, bitacoraRango, bitacoraSoloClienta, activeLoungeClient?.id, loadLoungeEvents]);

  // ── Catálogo del salón, para poder agregar sin salir de la pantalla ───
  const [catalogo, setCatalogo] = useState<CatalogoCat[]>([]);
  const [pickerTipo, setPickerTipo] = useState<'drink' | 'food' | null>(null);
  const [guardandoPref, setGuardandoPref] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get<CatalogoCat[]>('/preferences/categories')
      .then(cats => { if (!cancelled) setCatalogo(cats ?? []); })
      .catch(() => { if (!cancelled) setCatalogo([]); });
    return () => { cancelled = true; };
  }, []);

  const opcionesDisponibles = useCallback((tipo: string) => {
    const yaTiene = new Set((prefGroups[tipo] ?? []).map(i => i.preferenceId));
    return catalogo
      .filter(c => c.type === tipo)
      .flatMap(c => c.preferences ?? [])
      .filter(p => !yaTiene.has(p.id));
  }, [catalogo, prefGroups]);

  const agregarPref = useCallback(async (preferenceId: string) => {
    if (!activeLoungeClient) return;
    setGuardandoPref(true);
    try {
      await api.post(`/preferences/clients/${activeLoungeClient.id}`, {
        preferenceId, intensity: 4, source: 'manual',
      });
      await refrescarPrefs();
    } catch {
      showToast('No se pudo agregar', 'Inténtalo de nuevo.', 'warning');
    } finally {
      setGuardandoPref(false);
    }
  }, [activeLoungeClient?.id, refrescarPrefs, showToast]);

  const quitarPref = useCallback(async (preferenceId: string) => {
    if (!activeLoungeClient) return;
    try {
      await api.delete(`/preferences/clients/${activeLoungeClient.id}/${preferenceId}`);
      await refrescarPrefs();
    } catch {
      showToast('No se pudo quitar', 'Inténtalo de nuevo.', 'warning');
    }
  }, [activeLoungeClient?.id, refrescarPrefs, showToast]);

  // ── Ambiente de cabina ────────────────────────────────────────────────
  const ambiente = (activeLoungeClient?.hospitality ?? {}) as Record<string, any>;
  const [guardandoAmbiente, setGuardandoAmbiente] = useState<string | null>(null);

  /** Rota al siguiente valor de la lista; si no hay nada puesto, empieza por el primero */
  const rotarAmbiente = useCallback(async (campo: string, opciones: readonly string[]) => {
    if (!activeLoungeClient) return;
    const actual = ambiente[campo];
    const i = opciones.indexOf(actual);
    const siguiente = opciones[(i + 1) % opciones.length];
    setGuardandoAmbiente(campo);
    try {
      const nuevo = { ...ambiente, [campo]: siguiente };
      // updateClient refresca también la lista de Clientas, no solo esta pantalla
      await updateClient(activeLoungeClient.id, { hospitality: nuevo } as any);
      setActiveLoungeClient({ ...activeLoungeClient, hospitality: nuevo } as any);
    } catch {
      showToast('No se pudo guardar', 'El ambiente no cambió.', 'warning');
    } finally {
      setGuardandoAmbiente(null);
    }
  }, [activeLoungeClient, ambiente, setActiveLoungeClient, updateClient, showToast]);

  // Texto de la sugerencia: preferencias reales primero, mock como respaldo
  // Sin inventar: si no hay preferencia registrada, lo decimos.
  const suggestedMusic = prefMusic[0] ?? 'sin género registrado';
  const suggestedDrink = prefDrinks[0] ?? 'sin bebida registrada';

  // ── COLA AUTOMÁTICA ───────────────────────────────────────────────────
  // Al elegir una clienta el backend resuelve sus preferencias musicales a
  // pistas reales de YouTube (con título, canal, miniatura y duración) y las
  // cargamos en el reproductor global, que las encadena solo.
  const [queueInfo, setQueueInfo] = useState<{
    loading: boolean; items: { value: string; tracks: any[] }[];
    total: number; reason?: string; configured: boolean;
  }>({ loading: false, items: [], total: 0, configured: true });

  // Canal activo del reproductor. Spotify entra aquí cuando se integre.
  const [source, setSource] = useState<'radio' | 'youtube'>('radio');

  // Si el sistema pide menos movimiento, el reordenamiento es instantáneo
  const reduceMotion = useReducedMotion();

  /**
   * Key estable por CANCIÓN, no por posición.
   *
   * El aleatorio solo permuta ytOrder: ytQueue no cambia, así que la posición
   * dentro de la cola servía de identidad y la animación salía perfecta.
   * Cambiar el modo de mezcla es otra cosa: rearma ytQueue entero, y entonces
   * la posición 3 pasa a ser otra canción. React veía la misma fila con otro
   * contenido, no un movimiento, y la lista se reorganizaba de golpe.
   *
   * Con el videoId como identidad, Framer reconoce cada fila en la cola nueva
   * y la desliza hasta su sitio. El sufijo es para las canciones repetidas
   * (dos clientas con el mismo tema): sin él compartirían key.
   */
  const ytKeys = useMemo(() => {
    const vistas = new Map<string, number>();
    return ytQueue.map(t => {
      const n = (vistas.get(t.videoId) ?? 0) + 1;
      vistas.set(t.videoId, n);
      return n > 1 ? `${t.videoId}#${n}` : t.videoId;
    });
  }, [ytQueue]);

  // OJO: nada de un ref "ya lo hice para esta clienta" aquí. Con StrictMode
  // React monta → limpia → vuelve a montar: el primer pase quedaba cancelado y
  // el segundo salía por el guard, así que loading nunca volvía a false y el
  // panel se quedaba en "Armando la lista…" para siempre.
  // Listas guardadas: se cargan una vez al entrar al Lounge
  useEffect(() => { loadPlaylists(); }, [loadPlaylists]);

  // Guardar canciones en una lista.
  // `saveTargets` es la única fuente: lleva una canción (la que suena) o varias
  // (las marcadas en la cola). Así el panel de guardado es uno solo.
  const [saveTargets, setSaveTargets] = useState<any[] | null>(null);
  const [newListName, setNewListName] = useState('');
  const [savingTo, setSavingTo] = useState<string | null>(null);

  // Editor de listas: qué lista se está editando y el nombre en curso
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const editingList = playlists.find(p => p.id === editingListId) ?? null;

  const openEditor = useCallback((pl: any) => {
    setEditingListId(pl.id);
    setEditName(pl.name);
  }, []);

  /** Sube o baja una canción una posición */
  const moveTrack = useCallback((dir: -1 | 1, videoId: string) => {
    if (!editingList) return;
    const ids = editingList.tracks.map(t => t.videoId);
    const i = ids.indexOf(videoId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorderPlaylistTracks(editingList.id, ids);
  }, [editingList, reorderPlaylistTracks]);

  // Modo selección múltiple dentro de la cola
  const [pickMode, setPickMode] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const togglePicked = useCallback((videoId: string) => {
    setPicked(prev => prev.includes(videoId) ? prev.filter(v => v !== videoId) : [...prev, videoId]);
  }, []);

  const exitPickMode = useCallback(() => { setPickMode(false); setPicked([]); }, []);

  /** Guarda las canciones pendientes en una lista y cierra el panel */
  const commitSave = useCallback(async (playlistId: string, playlistName: string) => {
    if (!saveTargets?.length) return;
    setSavingTo(playlistId);
    const res = await addTracksToPlaylist(playlistId, saveTargets);
    setSavingTo(null);
    setSaveTargets(null);
    exitPickMode();
    const added = res?.added ?? 0;
    const skipped = res?.skipped ?? 0;
    showToast(
      added ? `${added} guardada${added === 1 ? '' : 's'}` : 'Ya estaban',
      skipped
        ? `En «${playlistName}». ${skipped} ya estaba${skipped === 1 ? '' : 'n'} en la lista.`
        : `En «${playlistName}».`,
      'success',
    );
  }, [saveTargets, addTracksToPlaylist, exitPickMode, showToast]);

  // Espejo de los bloques para leerlos sin que el efecto dependa de ellos
  // (si dependiera, cada actualización lo volvería a disparar en bucle).
  const ytBlocksRef = useRef(ytBlocks);
  useEffect(() => { ytBlocksRef.current = ytBlocks; }, [ytBlocks]);

  /**
   * RESTAURAR AL ENTRAR.
   * La selección vive en el servidor: al recargar el navegador se recupera la
   * misma cola en vez de volver a sortear. Hasta que no se restaure, el
   * guardado queda bloqueado para no pisar lo guardado con un estado vacío.
   */
  const [stateRestored, setStateRestored] = useState(false);

  useEffect(() => {
    if (!clients.length) return;          // esperamos a tener las clientas
    let cancelled = false;
    (async () => {
      try {
        const st = await api.get<{
          clientIds: string[]; playlistIds: string[]; blocks: any[]; mixMode: string;
        }>('/lounge/state');
        if (cancelled) return;

        if (st?.blocks?.length) {
          const porId = new Map(clients.map(c => [c.id, c]));
          const restauradas = (st.clientIds ?? []).map(id => porId.get(id)).filter(Boolean) as any[];
          if (restauradas.length) setLoungeClients(restauradas);
          (st.playlistIds ?? []).forEach(id => togglePlaylistSelected(id));
          if (st.mixMode) setYtMixMode(st.mixMode as any);
          setYtBlocks(st.blocks);         // ← la selección exacta, sin re-sortear
          setSource('youtube');
        }
      } catch { /* sin estado guardado: empezamos limpio */ }
      finally { if (!cancelled) setStateRestored(true); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients.length]);

  // Clave estable: si el conjunto de fuentes no cambia, no repetimos la
  // petición aunque los arrays se recreen en cada render.
  const loungeClientIds = loungeClients.map(c => c.id).join(',');
  const playlistIdsKey = selectedPlaylistIds.join(',');

  /**
   * "Otras canciones": vuelve a sortear SOLO esta clienta, dejando intactas a
   * las demás. No gasta cuota de YouTube — la muestra sale del pozo que ya
   * está guardado en su preferencia.
   */
  const [renovando, setRenovando] = useState<string | null>(null);

  const renovarBloque = useCallback(async (bloque: any) => {
    setRenovando(bloque.clientId);
    try {
      const res = await api.get<{ clients: any[] }>(
        `/lounge/queue?clientIds=${encodeURIComponent(bloque.clientId)}&playlistIds=`,
      );
      const nuevo = res.clients?.[0];
      if (nuevo?.tracks?.length) {
        setYtBlocks(ytBlocksRef.current.map(b => (b.clientId === bloque.clientId ? nuevo : b)));
        showToast(
          'Música renovada',
          `Otra selección para ${bloque.clientName.split(' ')[0]}.`,
          'success',
        );
      }
    } catch { showToast('No se pudo renovar', 'Inténtalo de nuevo.', 'warning'); }
    finally { setRenovando(null); }
  }, [setYtBlocks, showToast]);

  /** Guardar la selección cada vez que cambia, ya restaurada */
  useEffect(() => {
    if (!stateRestored) return;
    const t = setTimeout(() => {
      api.put('/lounge/state', {
        clientIds: loungeClientIds ? loungeClientIds.split(',') : [],
        playlistIds: playlistIdsKey ? playlistIdsKey.split(',') : [],
        blocks: ytBlocksRef.current,
        mixMode: ytMixMode,
      }).catch(() => { /* guardar es best-effort */ });
    }, 400);                              // pequeño respiro para no guardar en cada tecla
    return () => clearTimeout(t);
  }, [stateRestored, loungeClientIds, playlistIdsKey, ytBlocks, ytMixMode]);

  /**
   * CARGA INCREMENTAL.
   *
   * Antes esto volvía a pedir la cola COMPLETA ante cualquier cambio, y como
   * el backend toma una muestra aleatoria nueva del pozo de cada clienta, al
   * quitar a una se re-sorteaban las canciones de las demás: se perdía la
   * selección que ya sonaba y la música se cortaba. Encima era una llamada
   * que no hacía falta.
   *
   * Ahora: quitar es puramente local (se filtra el bloque) y solo se pide al
   * backend lo que todavía no tenemos. Quitar a Karina deja intacta a Rosa.
   */
  useEffect(() => {
    const clientIds = loungeClientIds ? loungeClientIds.split(',') : [];
    const plIds = playlistIdsKey ? playlistIdsKey.split(',') : [];
    const deseados = [...clientIds, ...plIds];

    // Sin fuentes: vaciamos y salimos, sin tocar la red
    if (!deseados.length) {
      setQueueInfo({ loading: false, items: [], total: 0, configured: true });
      setYtBlocks([]);
      return;
    }

    // Orden de la cola = orden en que el salón los marcó
    const ordenar = (bloques: any[]) =>
      deseados.map(id => bloques.find(b => b.clientId === id)).filter(Boolean) as any[];

    const actuales = ytBlocksRef.current;
    const conservados = actuales.filter(b => deseados.includes(b.clientId));
    const yaTengo = new Set(conservados.map(b => b.clientId));
    const faltanClientes = clientIds.filter(id => !yaTengo.has(id));
    const faltanListas = plIds.filter(id => !yaTengo.has(id));

    const resumen = (bloques: any[]) => ({
      loading: false,
      items: bloques.flatMap((b: any) => (b.preferences ?? []).map((v: string) => ({ value: v, tracks: [] }))),
      total: bloques.reduce((n: number, b: any) => n + (b.tracks?.length ?? 0), 0),
      configured: true,
    });

    // Solo hubo bajas → resolvemos en memoria, sin pedir nada
    if (!faltanClientes.length && !faltanListas.length) {
      if (conservados.length !== actuales.length) {
        const ordenados = ordenar(conservados);
        setYtBlocks(ordenados);
        setQueueInfo(resumen(ordenados));
      }
      return;
    }

    let cancelled = false;
    let timedOut = false;
    // Sin esto la UI queda a merced del backend: si la petición se cuelga
    // (p.ej. la llamada a YouTube no responde) el await nunca vuelve y el
    // panel se queda en "Armando la lista…" para siempre.
    const ctrl = new AbortController();
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, 20000);

    setQueueInfo(q => ({ ...q, loading: true }));

    (async () => {
      try {
        const res = await apiFetch<{
          configured: boolean;
          clients: { clientId: string; clientName: string; tracks: any[]; preferences: string[]; reason?: string }[];
          reason?: string;
        }>(`/lounge/queue?clientIds=${encodeURIComponent(faltanClientes.join(','))}` +
           `&playlistIds=${encodeURIComponent(faltanListas.join(','))}`,
           { method: 'GET', signal: ctrl.signal });
        if (cancelled) return;

        // Lo que ya teníamos + lo recién traído, en el orden de selección
        const ordenados = ordenar([...conservados, ...(res.clients ?? [])]);
        const total = ordenados.reduce((n, b: any) => n + (b.tracks?.length ?? 0), 0);

        setQueueInfo({
          ...resumen(ordenados),
          reason: total ? undefined : res.reason,
          configured: res.configured,
        });

        if (total) {
          setYtBlocks(ordenados);
          setSource('youtube');
        }
      } catch (e: any) {
        if (cancelled) return; // desmontado / fuentes cambiadas: no tocar estado
        const msg = String(e?.message ?? '');
        const routeMissing = /cannot get/i.test(msg) || /404/.test(msg);
        setQueueInfo({
          loading: false,
          items: [],
          total: 0,
          configured: true,
          reason: timedOut
            ? 'El backend tardó más de 20s en responder. Revisa su consola.'
            : routeMissing
            ? 'El backend todavía no expone /lounge/queue — reinícialo para cargar la ruta nueva.'
            : `No se pudo armar la cola: ${msg || 'error desconocido'}`,
        });
      } finally {
        clearTimeout(timer);
      }
    })();

    // Al limpiar abortamos: así el pase descartado de StrictMode no deja una
    // petición huérfana buscando en YouTube por duplicado.
    return () => { cancelled = true; clearTimeout(timer); ctrl.abort(); };
  }, [loungeClientIds, playlistIdsKey, setYtBlocks]);

  // ── Vista unificada del reproductor ───────────────────────────────────
  // Mismos controles y mismo diseño para cualquier canal; solo cambia de
  // dónde salen los datos. Spotify se enchufa aquí añadiendo su rama.
  const ytTrack = ytQueue[ytIndex];
  const isYt = source === 'youtube' && !!ytTrack;

  const view = isYt
    ? {
        title: ytTrack.title,
        artist: ytTrack.channel || 'YouTube',
        cover: ytTrack.thumbnail ?? currentTrack.coverUrl,
        sourceLabel: 'YouTube',
        vibe: queueInfo.items[0]?.value ?? 'Gustos de la clienta',
        duration: Math.round(ytDuration || ytTrack.durationSeconds || 0),
        time: Math.round(ytTime),
        playing: ytPlaying,
        shuffle: ytShuffle,
        repeatMode: ytRepeatMode,
        muted: ytMuted,
        volume: ytVolume,
        toggle: ytToggle,
        next: ytNext,
        prev: ytPrev,
        seek: ytSeek,
        setVolume: ytSetVolume,
        toggleMute: ytToggleMute,
        toggleShuffle: toggleYtShuffle,
        toggleRepeat: cycleYtRepeat,
      }
    : {
        title: currentTrack.title,
        artist: `${currentTrack.artist}${currentTrack.album ? ` • ${currentTrack.album}` : ''}`,
        cover: currentTrack.coverUrl,
        sourceLabel: 'Lalan Radio',
        vibe: currentTrack.vibe,
        duration: currentTrack.durationSeconds,
        time: progressSec,
        playing: isPlayingLounge,
        shuffle: isShuffle,
        repeatMode: (isRepeat ? 'all' : 'off') as 'off' | 'all' | 'one',
        muted: isMuted,
        volume,
        toggle: togglePlayLounge,
        next: nextLoungeTrack,
        prev: prevLoungeTrack,
        seek: (s: number) => setProgressSec(s),
        setVolume: (v: number) => { setVolume(v); if (isMuted) setIsMuted(false); },
        toggleMute: () => setIsMuted(m => !m),
        toggleShuffle: () => setIsShuffle(s => !s),
        toggleRepeat: () => setIsRepeat(r => !r),
      };

  // Progress timer simulation
  useEffect(() => {
    let interval: number;
    if (isPlayingLounge) {
      interval = window.setInterval(() => {
        setProgressSec(prev => {
          if (prev >= currentTrack.durationSeconds) {
            nextLoungeTrack();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlayingLounge, currentTrack, nextLoungeTrack]);

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const filteredSearchResults = EXTERNAL_SEARCH_MOCKS.filter(song => {
    const matchesQuery =
      !searchQuery ||
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.vibe.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSource = searchSource === 'all' || song.source === searchSource;
    return matchesQuery && matchesSource;
  });

  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-[#F9FAFB] dark:bg-neutral-950 text-slate-900 dark:text-neutral-100 select-none">
      {/* iOS Minimalist Nav Header */}
      <div className="shrink-0 z-20 px-4 pt-3 pb-2.5 bg-[#F9FAFB]/90 dark:bg-neutral-950/90 backdrop-blur-md border-b border-slate-200/50 dark:border-neutral-900">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 dark:text-neutral-500">
                Salón Lounge & Experiencia VIP
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Música & Hospitalidad
            </h1>
          </div>

          {/* Current Client Pill Switcher */}
          <button
            onClick={() => setShowClientSelector(!showClientSelector)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs hover:border-slate-300 dark:hover:border-neutral-700 transition"
          >
            {loungeClients.length ? (
              <>
                <div className="flex -space-x-1.5">
                  {loungeClients.slice(0, 3).map(c => (
                    <img
                      key={c.id}
                      src={c.avatar}
                      alt={c.name}
                      title={c.name}
                      className="w-5 h-5 rounded-full object-cover ring-2 ring-white dark:ring-neutral-900"
                    />
                  ))}
                </div>
                <span className="text-xs font-semibold max-w-[120px] truncate text-slate-800 dark:text-neutral-200">
                  {loungeClients.length === 1
                    ? loungeClients[0].name.split(' ')[0]
                    : `${loungeClients.length} en el salón`}
                </span>
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-semibold text-slate-600 dark:text-neutral-400">
                  Elegir clientas
                </span>
              </>
            )}
            <SlidersHorizontal className="w-3 h-3 text-slate-400" />
          </button>
        </div>

        {/* Client Selector Dropdown Sheet */}
        <AnimatePresence>
          {showClientSelector && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-3 p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-lg"
            >
              <div className="text-xs font-bold text-slate-500 dark:text-neutral-400 mb-2 px-1">
                Marca a todas las que estén en el salón. La primera es la del sillón.
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {clients.map(c => {
                  const pos = loungeClients.findIndex(x => x.id === c.id);
                  const isSelected = pos >= 0;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        toggleLoungeClient(c);
                        showToast(
                          isSelected ? `${c.name.split(' ')[0]} salió del salón` : `${c.name.split(' ')[0]} en el salón`,
                          isSelected ? 'Su música se retira de la cola.' : 'Sus gustos se suman a la cola.',
                          'info',
                        );
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl transition text-left cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--primary)] text-white font-medium'
                          : 'hover:bg-slate-100 dark:hover:bg-neutral-800/60 text-slate-700 dark:text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <img src={c.avatar} alt={c.name} className="w-7 h-7 rounded-full object-cover" />
                        <div>
                          <div className="text-xs font-bold flex items-center gap-1.5">
                            {c.name}
                            {pos === 0 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/25 font-semibold">
                                En el sillón
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] opacity-80">
                            {c.totalVisits > 0 ? `${c.totalVisits} visitas` : 'Primera visita'}
                          </div>
                        </div>
                      </div>
                      {isSelected
                        ? <Check className="w-4 h-4 shrink-0" />
                        : <Plus className="w-4 h-4 shrink-0 opacity-40" />}
                    </button>
                  );
                })}
              </div>

              {(loungeClients.length > 1 || selectedPlaylistIds.length > 0) && (
                <p className="text-[10px] text-slate-400 mt-2 px-1">
                  La cola se rearma sola con cada cambio.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quién es el altavoz del salón. Va ARRIBA del selector de
            pestañas a propósito: si la música suena en otro aparato, eso
            cambia el significado de todos los botones de abajo y hay que
            saberlo antes de tocarlos. */}
        <div className="mt-3">
          <MandoSala />
        </div>

        {/* Apple-Style Segmented Control */}
        <div className="mt-3 p-0.5 rounded-xl bg-slate-200/60 dark:bg-neutral-900 border border-slate-300/40 dark:border-neutral-800 flex items-center">
          <button
            onClick={() => setActiveTab('player')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'player'
                ? 'bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            Reproductor
          </button>
          <button
            onClick={() => setActiveTab('hospitality')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'hospitality'
                ? 'bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900'
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            Bebidas & Aperitivos
          </button>
          <button
            onClick={() => setActiveTab('explore')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'explore'
                ? 'bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            YouTube
          </button>
        </div>
      </div>
      <PageContent noPadding className="pb-24">

      {/* Main Content Area */}
      <div className="px-4 pt-4 space-y-5">
        {/* TAB 1: REPRODUCTOR & NOW PLAYING */}
        {activeTab === 'player' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Active Client Personal Banner */}
            {activeLoungeClient && (
              <div className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex -space-x-2 shrink-0">
                    {loungeClients.slice(0, 4).map((c, i) => (
                      <div key={c.id} className="relative">
                        <img
                          src={c.avatar}
                          alt={c.name}
                          title={c.name}
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-white dark:ring-neutral-900"
                        />
                        {i === 0 && (
                          <span
                            title="En el sillón"
                            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--primary)] text-white text-[8px] flex items-center justify-center ring-2 ring-white dark:ring-neutral-900"
                          >
                            ★
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-slate-400 dark:text-neutral-500">
                      {loungeClients.length > 1 ? 'Sonando para el salón' : 'Sonando para la cita de'}
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {loungeClients.length > 1
                        ? loungeClients.map(c => c.name.split(' ')[0]).join(' · ')
                        : activeLoungeClient.name}
                    </div>
                    {loungeClients.length > 1 && (
                      <div className="text-[10px] text-slate-400 dark:text-neutral-500">
                        {activeLoungeClient.name.split(' ')[0]} en el sillón
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-neutral-800 text-[10px] font-semibold text-slate-600 dark:text-neutral-300">
                    <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                    {prefMusic[0] ?? 'Sin género'}
                  </span>
                </div>
              </div>
            )}

            {/* Listas guardadas — a la vista, no escondidas en el desplegable */}
            {playlists.length > 0 && (
              <div className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs">
                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-neutral-500 mb-2 px-0.5 flex items-center gap-1.5">
                  <BookmarkPlus className="w-3 h-3" />
                  Listas guardadas
                  <span className="ml-auto normal-case font-medium text-slate-400">
                    {selectedPlaylistIds.length
                      ? 'Toca de nuevo para quitarla de la cola'
                      : 'Toca para sumarla a la cola'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {playlists.map(pl => {
                    const on = selectedPlaylistIds.includes(pl.id);
                    return (
                      <button
                        key={pl.id}
                        onClick={() => togglePlaylistSelected(pl.id)}
                        title={on
                          ? `Quitar «${pl.name}» de la cola`
                          : pl.clientId ? `Lista fija de ${pl.client?.name ?? 'clienta'}` : 'Lista del salón'}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                          on
                            ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                            : 'bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-300 border-slate-200 dark:border-neutral-700 hover:border-[var(--primary)]/50'
                        }`}
                      >
                        {/* Cuando está puesta, el ✓ dice que tocar otra vez la quita */}
                        {on
                          ? <Check className="w-3 h-3 shrink-0" />
                          : <span>{pl.clientId ? '📌' : '⭐'}</span>}
                        <span className="max-w-[120px] truncate">{pl.name}</span>
                        <span className="opacity-60">{pl.tracks.length}</span>
                        <span
                          role="button"
                          tabIndex={0}
                          title="Reproducir SOLO esta lista"
                          onClick={e => {
                            e.stopPropagation();
                            // Sola: quitamos clientas y demás listas
                            setLoungeClients([]);
                            selectedPlaylistIds.forEach(id => { if (id !== pl.id) togglePlaylistSelected(id); });
                            if (!selectedPlaylistIds.includes(pl.id)) togglePlaylistSelected(pl.id);
                            showToast('Solo esta lista', `Sonará «${pl.name}» por sí sola.`, 'info');
                          }}
                          onKeyDown={e => { if (e.key === 'Enter') e.stopPropagation(); }}
                          className="ml-0.5 opacity-40 hover:opacity-100 transition"
                        >
                          ▶
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          title="Editar lista: renombrar, reordenar y quitar canciones"
                          onClick={e => { e.stopPropagation(); openEditor(pl); }}
                          onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); openEditor(pl); } }}
                          className="ml-0.5 opacity-40 hover:opacity-100 transition"
                        >
                          <Pencil className="w-3 h-3" />
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 mt-1.5 px-1">
                  <p className="text-[10px] text-slate-400 flex-1">
                    📌 fijas de una clienta · ⭐ del salón. Las fijas ya se suman solas a su clienta.
                  </p>
                  {(selectedPlaylistIds.length > 0 || loungeClients.length > 0) && (
                    <button
                      onClick={() => {
                        setLoungeClients([]);
                        selectedPlaylistIds.forEach(id => togglePlaylistSelected(id));
                        showToast('Cola vacía', 'Se quitaron todas las clientas y listas.', 'info');
                      }}
                      title="Quitar todas las clientas y listas de la cola"
                      className="shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-500 dark:text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                    >
                      Vaciar cola
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Selector de canal — aquí entra Spotify cuando se integre */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-neutral-800/70 w-fit mx-auto">
              {([
                ['radio', 'Lalan Radio', true],
                ['youtube', 'YouTube', ytQueue.length > 0],
              ] as [typeof source, string, boolean][]).map(([key, label, enabled]) => (
                <button
                  key={key}
                  disabled={!enabled}
                  onClick={() => setSource(key)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    source === key
                      ? 'bg-white dark:bg-neutral-900 text-[var(--primary)] shadow-xs'
                      : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700'
                  }`}
                >
                  {label}
                  {key === 'youtube' && ytQueue.length > 0 && (
                    <span className="ml-1 opacity-60">({ytQueue.length})</span>
                  )}
                </button>
              ))}
              <button
                disabled
                title="Próximamente"
                className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-slate-400 opacity-40 cursor-not-allowed"
              >
                Spotify
              </button>
            </div>

            {/* Apple Music Style Player Card */}
            <div className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
              {/* Subtle ambient gradient halo */}
              <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-[var(--primary)]/10 to-transparent pointer-events-none" />

              {/* Album Art with Floating Glow */}
              <div className="relative my-2">
                <motion.div
                  animate={{
                    scale: view.playing ? [1, 1.015, 1] : 1,
                  }}
                  transition={{
                    repeat: view.playing ? Infinity : 0,
                    duration: 3.5,
                    ease: 'easeInOut',
                  }}
                  className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden shadow-xl border border-slate-100 dark:border-neutral-800 relative group"
                >
                  {isYt && ytShowVideo ? (
                    // El iframe no se monta aquí: este hueco 16:9 es solo el
                    // ancla donde <GlobalYouTubePlayer /> lo posiciona encima.
                    <div className="w-full h-full bg-black flex items-center justify-center">
                      <div ref={setYtLoungeAnchor} className="w-full aspect-video" />
                    </div>
                  ) : (
                    <img
                      src={view.cover}
                      alt={view.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                  {/* Visualizer overlay */}
                  {view.playing && !(isYt && ytShowVideo) && (
                    <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md flex items-end gap-1 h-5">
                      <motion.div
                        animate={{ height: ['30%', '90%', '40%'] }}
                        transition={{ repeat: Infinity, duration: 0.6 }}
                        className="w-1 bg-white rounded-full"
                      />
                      <motion.div
                        animate={{ height: ['70%', '30%', '100%'] }}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                        className="w-1 bg-[var(--accent)] rounded-full"
                      />
                      <motion.div
                        animate={{ height: ['40%', '80%', '20%'] }}
                        transition={{ repeat: Infinity, duration: 0.7 }}
                        className="w-1 bg-white rounded-full"
                      />
                    </div>
                  )}
                </motion.div>

                {/* Portada ⇄ Video. El iframe nunca se desmonta: en modo
                    portada baja al mini reproductor de la barra y sigue sonando. */}
                {isYt && (
                  // `relative` + `w-fit mx-auto`: el par Portada/Video queda
                  // siempre centrado y el botón de pantalla completa cuelga
                  // por fuera, así aparecer o desaparecer no descentra nada.
                  <div className="relative mt-2.5 flex items-center justify-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-neutral-800/70 w-fit mx-auto">
                    {([
                      [false, 'Portada', Disc3],
                      [true, 'Video', Youtube],
                    ] as [boolean, string, any][]).map(([val, label, Icon]) => (
                      <button
                        key={label}
                        onClick={() => setYtShowVideo(val)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                          ytShowVideo === val
                            ? 'bg-white dark:bg-neutral-900 text-[var(--primary)] shadow-xs'
                            : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700'
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        {label}
                      </button>
                    ))}
                    <AnimatePresence>
                      {ytShowVideo && (
                        <motion.button
                          key="fs"
                          // OJO: el centrado vertical va en la animación, no con
                          // `-translate-y-1/2`: Framer escribe `transform` en
                          // línea y pisaría la clase de Tailwind.
                          initial={{ opacity: 0, x: -6, y: '-50%', scale: 0.9 }}
                          animate={{ opacity: 1, x: 0, y: '-50%', scale: 1 }}
                          exit={{ opacity: 0, x: -6, y: '-50%', scale: 0.9 }}
                          transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
                          onClick={ytFullscreen}
                          title="Pantalla completa"
                          className="absolute left-full ml-1.5 top-1/2 w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-neutral-800/70 text-slate-500 dark:text-neutral-400 hover:text-[var(--primary)] transition cursor-pointer"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Guardar la canción que suena en una lista */}
              {isYt && ytTrack && (
                <button
                  onClick={() => setSaveTargets([ytTrack])}
                  className="mt-2 mx-auto px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 bg-slate-100 dark:bg-neutral-800/70 text-slate-600 dark:text-neutral-300 hover:text-[var(--primary)] transition cursor-pointer"
                >
                  <BookmarkPlus className="w-3 h-3" />
                  Guardar en lista
                </button>
              )}

              {/* Title & Artist */}
              <div className="mt-4 w-full px-2">
                <div className="flex items-center justify-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                    {view.title}
                  </h2>
                </div>
                <p className="text-sm font-medium text-slate-500 dark:text-neutral-400 mt-0.5 truncate">
                  {view.artist}
                </p>

                {/* Source badge */}
                <div className="mt-2 flex items-center justify-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300">
                    {view.sourceLabel}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-[var(--primary)] bg-[var(--primary)]/10">
                    {view.vibe}
                  </span>
                  {isYt && (
                    <span className="text-[10px] font-semibold text-slate-400">
                      {ytIndex + 1}/{ytQueue.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Scrubber Progress Slider */}
              <div className="w-full mt-5 px-1">
                <div className="relative flex items-center">
                  <input
                    type="range"
                    min={0}
                    max={Math.max(1, view.duration)}
                    value={Math.min(view.time, Math.max(1, view.duration))}
                    onChange={e => view.seek(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 dark:text-neutral-500 mt-1.5 px-0.5">
                  <span>{formatTime(view.time)}</span>
                  <span>-{formatTime(Math.max(0, view.duration - view.time))}</span>
                </div>
              </div>

              {/* iOS Playback Controls */}
              <div className="w-full flex items-center justify-between max-w-xs mt-3 px-2">
                <button
                  onClick={view.toggleShuffle}
                  className={`p-2 rounded-full transition cursor-pointer ${
                    view.shuffle ? 'text-[var(--primary)]' : 'text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300'
                  }`}
                  title="Aleatorio"
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                <button
                  onClick={view.prev}
                  className="p-2.5 rounded-full text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition ios-touch cursor-pointer"
                  title="Anterior"
                >
                  <SkipBack className="w-6 h-6 fill-current" />
                </button>

                <button
                  onClick={view.toggle}
                  className="w-14 h-14 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition ios-touch cursor-pointer"
                  title={view.playing ? 'Pausar' : 'Reproducir'}
                >
                  {view.playing ? (
                    <Pause className="w-7 h-7 fill-current" />
                  ) : (
                    <Play className="w-7 h-7 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  onClick={view.next}
                  className="p-2.5 rounded-full text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition ios-touch cursor-pointer"
                  title="Siguiente"
                >
                  <SkipForward className="w-6 h-6 fill-current" />
                </button>

                <button
                  onClick={view.toggleRepeat}
                  className={`p-2 rounded-full transition cursor-pointer ${
                    view.repeatMode !== 'off'
                      ? 'text-[var(--primary)]'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300'
                  }`}
                  title={
                    view.repeatMode === 'one'
                      ? 'Repetir solo esta canción'
                      : view.repeatMode === 'all'
                      ? 'Repetir toda la lista'
                      : 'Sin repetición'
                  }
                >
                  {view.repeatMode === 'one'
                    ? <Repeat1 className="w-4 h-4" />
                    : <Repeat className="w-4 h-4" />}
                </button>
              </div>

              {/* Volume Slider */}
              <div className="w-full max-w-xs flex items-center gap-2.5 mt-4 px-3">
                <button
                  onClick={view.toggleMute}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300 cursor-pointer"
                >
                  {view.muted || view.volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={view.muted ? 0 : view.volume}
                  onChange={e => view.setVolume(Number(e.target.value))}
                  className="w-full h-1 bg-slate-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
                />
              </div>
            </div>

            {/* Upcoming Queue List (Minimal iOS Table) */}
            <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-2">
              <div className="flex items-center justify-between pb-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                  A continuación en el salón ({isYt ? ytQueue.length : loungeTracks.length})
                </h3>
                <span className="text-[11px] font-semibold text-[var(--primary)] flex items-center gap-1.5 flex-wrap justify-end">
                  {isYt && ytShuffle && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[10px]">
                      <Shuffle className="w-2.5 h-2.5" /> Orden barajado
                    </span>
                  )}
                  {isYt && ytRepeatMode === 'one' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px]">
                      <Repeat1 className="w-2.5 h-2.5" /> Repitiendo una
                    </span>
                  )}
                  {isYt && (
                    pickMode ? (
                      <span className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSaveTargets(
                            picked.map(v => ytQueue.find(t => t.videoId === v)).filter(Boolean) as any[],
                          )}
                          disabled={!picked.length}
                          className="px-2 py-0.5 rounded-full bg-[var(--primary)] text-white text-[10px] font-bold disabled:opacity-40 cursor-pointer"
                        >
                          Guardar {picked.length || ''}
                        </button>
                        <button
                          onClick={exitPickMode}
                          className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-500 text-[10px] font-bold cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setPickMode(true)}
                        title="Marcar varias canciones para guardarlas en una lista"
                        className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 text-[10px] font-bold hover:text-[var(--primary)] transition cursor-pointer"
                      >
                        Elegir varias
                      </button>
                    )
                  )}
                  {isYt ? (ytBlocks.length > 1 ? 'Cola compartida' : 'Cola de la clienta') : 'Sonido ambiental activo'}
                </span>
              </div>

              {/* Cómo repartir la música entre varias clientas.
                  Vive aquí, junto a la lista que reordena, y no en la pestaña
                  YouTube donde estaba escondido. Cambiar de modo es instantáneo:
                  la mezcla se hace en el navegador, sin volver a pedir nada. */}
              {/* Quién aporta qué, con "Otras canciones" por clienta.
                  Va aquí —en el Reproductor, junto a la cola— y no en la
                  pestaña YouTube, que es donde nadie lo iba a encontrar. */}
              {isYt && ytBlocks.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pb-1.5 border-b border-slate-100 dark:border-neutral-800/80">
                  {ytBlocks.map(b => (
                    <span
                      key={b.clientId}
                      title={b.preferences.length ? b.preferences.join(' · ') : 'Lista guardada'}
                      className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/25 flex items-center gap-1"
                    >
                      <span>{b.kind === 'playlist' ? '⭐' : ''}</span>
                      {b.clientName.split(' ')[0]}
                      <span className="opacity-60">×{b.tracks.length}</span>
                      {/* Solo las clientas se renuevan: una lista guardada es
                          una selección que el salón eligió a mano. */}
                      {b.kind !== 'playlist' && (
                        <button
                          onClick={() => renovarBloque(b)}
                          disabled={renovando === b.clientId}
                          title={`Otras canciones para ${b.clientName.split(' ')[0]}`}
                          className="ml-0.5 opacity-50 hover:opacity-100 transition cursor-pointer disabled:opacity-30"
                        >
                          <RefreshCw className={`w-3 h-3 ${renovando === b.clientId ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                    </span>
                  ))}

                  {ytBlocks.length > 1 && (
                    <span className="flex items-center gap-1 flex-wrap ml-auto">
                      <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">
                        Repartir
                      </span>
                      {([
                        ['fair', 'Turnos parejos', 'Una de cada quien, por ronda'],
                        ['chair', 'Prioridad al sillón', `Doble para ${activeLoungeClient?.name.split(' ')[0] ?? 'la primera'}`],
                        ['random', 'Al azar', 'Todo mezclado en una bolsa'],
                      ] as [typeof ytMixMode, string, string][]).map(([mode, label, hint]) => (
                        <button
                          key={mode}
                          onClick={() => setYtMixMode(mode)}
                          title={hint}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                            ytMixMode === mode
                              ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                              : 'bg-white dark:bg-neutral-900 text-slate-500 dark:text-neutral-400 border-slate-200 dark:border-neutral-700 hover:border-[var(--primary)]/50'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </span>
                  )}
                </div>
              )}

              {isYt ? (
                <LayoutGroup id="yt-queue">
                <div className="relative">
                  {/* Recorremos ytOrder, no ytQueue: con aleatorio activo la
                      lista se redibuja en el orden real en que va a sonar.
                      La key es la canción (ytKeys), NO la posición visible ni
                      la posición en la cola: la primera cambiaría al barajar y
                      la segunda al cambiar el modo de mezcla, y en ambos casos
                      React destruiría y recrearía las filas — el reordenamiento
                      se vería a saltos en vez de deslizarse. */}
                  <AnimatePresence initial={false}>
                  {(ytOrder.length === ytQueue.length ? ytOrder : ytQueue.map((_, i) => i)).map((qi, pos) => {
                    const t = ytQueue[qi];
                    if (!t) return null;
                    const isCurrent = qi === ytIndex;
                    return (
                      <motion.div
                        key={ytKeys[qi] ?? qi}
                        layout={reduceMotion ? false : 'position'}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={
                          reduceMotion
                            ? { duration: 0 }
                            : { type: 'spring', stiffness: 480, damping: 38, mass: 0.7, opacity: { duration: 0.18 } }
                        }
                        onClick={() => pickMode ? togglePicked(t.videoId) : ytPlayIndex(qi)}
                        className={`py-2.5 px-2 rounded-xl flex items-center justify-between cursor-pointer border-b border-slate-100 dark:border-neutral-800/80 last:border-b-0 ${
                          pickMode && picked.includes(t.videoId)
                            ? 'bg-[var(--primary)]/10'
                            : isCurrent
                            ? 'bg-slate-50 dark:bg-neutral-800/50 font-bold'
                            : 'hover:bg-slate-50 dark:hover:bg-neutral-800/30'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* En modo selección el número deja paso a la casilla */}
                          {pickMode ? (
                            <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition ${
                              picked.includes(t.videoId)
                                ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                                : 'border-slate-300 dark:border-neutral-600'
                            }`}>
                              {picked.includes(t.videoId) && <Check className="w-3 h-3" />}
                            </span>
                          ) : (
                            /* Posición real en la cola: con aleatorio activo
                               esto refleja el orden barajado, no el original */
                            <span className={`w-4 text-[11px] font-mono shrink-0 tabular-nums ${
                              isCurrent ? 'text-[var(--primary)] font-bold' : 'text-slate-400 dark:text-neutral-600'
                            }`}>
                              {pos + 1}
                            </span>
                          )}
                          {t.thumbnail ? (
                            <img src={t.thumbnail} alt={t.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-red-600/10 flex items-center justify-center shrink-0 text-sm">▶</div>
                          )}
                          <div className="min-w-0">
                            <div className={`text-xs truncate ${isCurrent ? 'text-[var(--primary)] font-bold' : 'text-slate-800 dark:text-neutral-200'}`}>
                              {t.title}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-neutral-500 truncate flex items-center gap-1.5">
                              <span className="truncate">{t.channel || 'YouTube'}</span>
                              {/* De quién es este gusto, cuando el salón es compartido */}
                              {ytBlocks.length > 1 && t.clientName && (
                                <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] font-bold">
                                  {t.clientName.split(' ')[0]}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isCurrent && view.playing && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold">
                              Sonando
                            </span>
                          )}
                          <span className="text-[11px] font-mono text-slate-400">
                            {t.durationSeconds ? formatTime(t.durationSeconds) : '—'}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                  </AnimatePresence>
                </div>
                </LayoutGroup>
              ) : (
              <div className="divide-y divide-slate-100 dark:divide-neutral-800/80">
                {loungeTracks.map((track, idx) => {
                  const isCurrent = idx === currentTrackIndex;
                  return (
                    <div
                      key={track.id}
                      onClick={() => playTrack(idx)}
                      className={`py-2.5 px-2 rounded-xl flex items-center justify-between transition cursor-pointer ${
                        isCurrent
                          ? 'bg-slate-50 dark:bg-neutral-800/50 font-bold'
                          : 'hover:bg-slate-50 dark:hover:bg-neutral-800/30'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={track.coverUrl}
                          alt={track.title}
                          className="w-10 h-10 rounded-lg object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <div
                            className={`text-xs truncate ${
                              isCurrent ? 'text-[var(--primary)] font-bold' : 'text-slate-800 dark:text-neutral-200'
                            }`}
                          >
                            {track.title}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-neutral-500 truncate">
                            {track.artist}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {track.dedicatedForClientName && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
                            Para {track.dedicatedForClientName.split(' ')[0]}
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-slate-400">
                          {formatTime(track.durationSeconds)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          </motion.div>
        )}

        {/* TAB 2: HOSPITALIDAD & GUSTOS DEL CLIENTE */}
        {activeTab === 'hospitality' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {activeLoungeClient ? (
              <>
                {/* ── Tarjeta de la clienta + ambiente de cabina ───────── */}
                <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <img
                      src={activeLoungeClient.avatar}
                      alt={activeLoungeClient.name}
                      className="w-14 h-14 rounded-2xl object-cover ring-2 ring-[var(--primary)]/20"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">
                          {activeLoungeClient.name}
                        </h2>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--primary)]/10 text-[var(--primary)]">
                          VIP Lounge
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                        {activeLoungeClient.phone} • {activeLoungeClient.totalVisits} visitas registradas
                      </p>
                    </div>
                  </div>

                  {/* Ambiente de cabina — toca para cambiar, se guarda solo.
                      Si no hay dato lo decimos, no inventamos un valor. */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-neutral-800">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Ambiente de cabina
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {AMBIENTE_CAMPOS.map(campo => {
                        const valor = ambiente[campo.key];
                        const Icono = campo.icon === 'wind' ? Wind : campo.icon === 'flame' ? Flame : Smile;
                        const tono =
                          campo.icon === 'wind' ? 'text-sky-500'
                          : campo.icon === 'flame' ? 'text-amber-500'
                          : 'text-emerald-500';
                        return (
                          <button
                            key={campo.key}
                            onClick={() => rotarAmbiente(campo.key, campo.opciones)}
                            disabled={guardandoAmbiente === campo.key}
                            className="p-2 rounded-xl bg-slate-50 dark:bg-neutral-800/40 hover:bg-slate-100 dark:hover:bg-neutral-800 transition active:scale-98 disabled:opacity-50"
                          >
                            <Icono className={`w-3.5 h-3.5 mx-auto mb-1 ${tono}`} />
                            <div className="text-[10px] text-slate-400 font-medium">{campo.label}</div>
                            <div
                              className={`text-xs font-bold capitalize ${
                                valor
                                  ? 'text-slate-800 dark:text-neutral-200'
                                  : 'text-slate-300 dark:text-neutral-600 italic'
                              }`}
                            >
                              {valor ? String(valor).replace(/_/g, ' ') : 'Sin registrar'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ── Lo que le gusta (DEMANDA) ─────────────────────────── */}
                {/* Esto NO es el catálogo: es lo que la clienta pide, exista
                    o no en el salón. El hueco entre las dos cosas es la
                    señal de compra. */}
                <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 shrink-0 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                        <Heart className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                          Lo que le gusta
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Sus gustos, tengas el producto o no
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setPickerTipo('drink')}
                      className="shrink-0 px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-[11px] font-bold text-slate-600 dark:text-neutral-300 flex items-center gap-1 hover:bg-slate-200 dark:hover:bg-neutral-700 transition"
                    >
                      <Plus className="w-3 h-3" />
                      Agregar
                    </button>
                  </div>

                  {gustosConsumibles.length ? (
                    <div className="flex flex-wrap gap-2">
                      {gustosConsumibles.map(g => {
                        const prod = productoQueSatisface(g.value);
                        const agotado = prod && prod.stock <= 0;
                        return (
                          <div
                            key={g.preferenceId}
                            className={`pl-3 pr-1.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                              !prod
                                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
                                : agotado
                                  ? 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-900/60 text-red-900 dark:text-red-200'
                                  : 'bg-slate-50 dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200'
                            }`}
                          >
                            <span>{g.value}</span>
                            {!prod && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-800/60 font-extrabold">
                                no lo vendes
                              </span>
                            )}
                            {prod && agotado && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-200/70 dark:bg-red-800/60 font-extrabold">
                                agotado
                              </span>
                            )}
                            <button
                              onClick={() => quitarPref(g.preferenceId)}
                              title="Quitar de sus preferencias"
                              className="w-5 h-5 rounded-full flex items-center justify-center opacity-40 hover:opacity-100 hover:bg-black/10 transition"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <button
                      onClick={() => setPickerTipo('drink')}
                      className="w-full py-4 rounded-2xl border border-dashed border-slate-200 dark:border-neutral-700 text-xs text-slate-400 hover:border-[var(--primary)]/50 hover:text-[var(--primary)] transition"
                    >
                      Nada registrado todavía — toca para agregar
                    </button>
                  )}
                </div>

                {/* El punto de venta: mismo componente que en Caja */}
                <PosPanel compact />

                {/* ── Resumen musical (el detalle vive en Reproductor) ─── */}
                <button
                  onClick={() => setActiveTab('player')}
                  className="w-full p-3.5 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex items-center gap-3 text-left hover:border-[var(--primary)]/40 transition"
                >
                  <div className="w-8 h-8 shrink-0 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
                    <Music className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Gusto musical
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-neutral-400 truncate">
                      {prefMusic.length
                        ? prefMusic.join(' · ')
                        : 'Sin géneros registrados — tócalo para configurarlo'}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[var(--primary)] shrink-0">
                    Reproductor →
                  </span>
                </button>
                {/* ── Bitácora: timeline persistente del salón ───────────── */}
                <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                      Bitácora del salón
                    </h3>
                    <div className="flex items-center gap-1 p-0.5 rounded-full bg-slate-100 dark:bg-neutral-800">
                      {(['today', 'all'] as const).map(r => (
                        <button
                          key={r}
                          onClick={() => setBitacoraRango(r)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                            bitacoraRango === r
                              ? 'bg-white dark:bg-neutral-700 text-slate-900 dark:text-white shadow-2xs'
                              : 'text-slate-500 dark:text-neutral-400'
                          }`}
                        >
                          {r === 'today' ? 'Hoy' : 'Historial'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Filtro: solo esta clienta o todo el salón */}
                  <label className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-neutral-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bitacoraSoloClienta}
                      onChange={e => setBitacoraSoloClienta(e.target.checked)}
                      className="accent-[var(--primary)]"
                    />
                    Solo {activeLoungeClient.name.split(' ')[0]}
                  </label>

                  {loungeEvents.length === 0 && !loungeEventsLoading ? (
                    <p className="py-6 text-center text-xs text-slate-400">
                      {bitacoraRango === 'today'
                        ? 'Todavía no se ha servido nada hoy.'
                        : 'No hay nada registrado aún.'}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {agruparPorDia(loungeEvents).map(grupo => (
                        <div key={grupo.dia}>
                          {bitacoraRango === 'all' && (
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300 dark:text-neutral-600 mb-1">
                              {grupo.dia}
                            </div>
                          )}
                          <div className="divide-y divide-slate-100 dark:divide-neutral-800">
                            {grupo.items.map(ev => {
                              const esCancion = ev.kind === 'track_played';
                              return (
                                <div
                                  key={ev.id}
                                  className={`py-2 flex items-center justify-between gap-2 text-xs ${
                                    esCancion ? 'opacity-60' : ''
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {esCancion
                                      ? <Music className="w-3.5 h-3.5 shrink-0 text-[var(--primary)]" />
                                      : ev.kind === 'sale'
                                        ? <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                                        : <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" />}
                                    <span className="font-semibold text-slate-800 dark:text-neutral-200 truncate">
                                      {ev.label}
                                    </span>
                                    {ev.clientName && !bitacoraSoloClienta && (
                                      <span className="text-[10px] text-slate-400 shrink-0">
                                        ({ev.clientName.split(' ')[0]})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {ev.amount ? (
                                      <span className="text-[11px] font-bold text-amber-600">
                                        {Number(ev.amount).toFixed(2)}
                                      </span>
                                    ) : null}
                                    <span className="text-[11px] font-mono text-slate-400">
                                      {new Date(ev.createdAt).toLocaleTimeString('es', {
                                        hour: '2-digit', minute: '2-digit',
                                      })}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {bitacoraRango === 'all' && loungeEventsHasMore && (
                        <button
                          onClick={() => loadLoungeEvents({
                            range: 'all', append: true,
                            clientId: bitacoraSoloClienta ? activeLoungeClient.id : undefined,
                          })}
                          disabled={loungeEventsLoading}
                          className="w-full py-2 rounded-xl text-[11px] font-bold text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/15 transition disabled:opacity-40"
                        >
                          {loungeEventsLoading ? 'Cargando…' : 'Ver más atrás'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-8 text-center bg-white dark:bg-neutral-900 rounded-3xl border border-slate-200 dark:border-neutral-800">
                <Coffee className="w-10 h-10 mx-auto text-slate-300 dark:text-neutral-600 mb-2" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-neutral-300">
                  Ninguna clienta seleccionada
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Elige una clienta arriba para sincronizar sus bebidas, comida preferida y ambiente musical.
                </p>
                <button
                  onClick={() => setShowClientSelector(true)}
                  className="mt-4 px-4 py-2 rounded-full bg-[var(--primary)] text-white text-xs font-bold shadow-xs"
                >
                  Seleccionar Clienta
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 3: YOUTUBE PLAYER */}
        {activeTab === 'explore' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* YouTube player.
                El <iframe> real vive en <GlobalYouTubePlayer /> (App.tsx) para que
                la reproducción sobreviva al cambio de pantalla. Aquí solo publicamos
                este hueco como ancla; el iframe se posiciona encima. */}
            <div className="rounded-3xl overflow-hidden bg-black border border-slate-200/80 dark:border-neutral-800 shadow-sm">
              {ytQueue.length > 0 ? (
                <div
                  ref={setYtLoungeAnchor}
                  className="relative w-full"
                  style={{ paddingTop: '56.25%' }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-red-600/10 flex items-center justify-center">
                    <span className="text-2xl">▶️</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white/80">YouTube Lounge</p>
                    <p className="text-[11px] text-white/40 mt-0.5">
                      Pega un enlace o elige un género abajo para empezar
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Cola automática de la clienta ── */}
            {activeLoungeClient && (
              <div className="p-3.5 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Cola automática · {activeLoungeClient.name.split(' ')[0]}
                    </h3>
                  </div>
                  {queueInfo.total > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/25">
                      {queueInfo.total} temas en fila
                    </span>
                  )}
                </div>

                {queueInfo.loading ? (
                  <p className="text-[11px] text-slate-400 italic">Armando la lista desde sus gustos…</p>
                ) : ytBlocks.length > 0 ? (
                  <>
                    {/* Resumen simple: los controles viven en el Reproductor */}
                    <div className="flex flex-wrap gap-1.5">
                      {ytBlocks.map(b => (
                        <span
                          key={b.clientId}
                          title={b.preferences.length ? b.preferences.join(' · ') : 'Lista guardada'}
                          className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/25"
                        >
                          {b.clientName.split(' ')[0]} <span className="opacity-60">×{b.tracks.length}</span>
                        </span>
                      ))}
                    </div>

                    {/* Cómo repartir la música — lo decide el salón */}
                    {ytBlocks.length > 1 && (
                      <div className="pt-1.5 space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          Cómo repartir la música
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {([
                            ['fair', 'Turnos parejos', 'Una de cada quien, por ronda'],
                            ['chair', 'Prioridad al sillón', `Doble para ${ytBlocks[0]?.clientName.split(' ')[0] ?? 'la primera'}`],
                            ['random', 'Al azar', 'Todo mezclado en una bolsa'],
                          ] as [typeof ytMixMode, string, string][]).map(([mode, label, hint]) => (
                            <button
                              key={mode}
                              onClick={() => setYtMixMode(mode)}
                              title={hint}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                                ytMixMode === mode
                                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                                  : 'bg-white dark:bg-neutral-900 text-slate-500 dark:text-neutral-400 border-slate-200 dark:border-neutral-700 hover:border-[var(--primary)]/50'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-[10px] text-slate-400">
                      Se reproducen una tras otra y la lista se repite sola. No hay que tocar nada.
                    </p>
                  </>
                ) : !queueInfo.configured ? (
                  <p className="text-[11px] text-amber-500">
                    Falta <b>YOUTUBE_API_KEY</b> en el backend para que el sistema busque la música solo.
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    {queueInfo.reason ?? 'Sin música registrada para esta clienta.'}
                  </p>
                )}
              </div>
            )}

            {/* URL Paste Input */}
            <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">Pegar enlace de YouTube</h3>
                  <p className="text-[11px] text-slate-400">Video, playlist o ID directo</p>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  ref={urlInputRef}
                  type="text"
                  placeholder="https://youtube.com/watch?v=... o pegar playlist"
                  value={youtubeUrl}
                  onChange={e => { setYoutubeUrl(e.target.value); setYoutubeError(null); }}
                  onKeyDown={e => e.key === 'Enter' && handleLoadYoutube()}
                  className="flex-1 px-3 py-2.5 rounded-2xl bg-slate-100 dark:bg-neutral-800/80 border border-transparent focus:border-red-400 dark:focus:border-red-500 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition"
                />
                <button
                  onClick={handleLoadYoutube}
                  disabled={loadingUrl || !youtubeUrl.trim()}
                  className="px-4 py-2.5 rounded-2xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 active:scale-95 transition shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingUrl ? 'Cargando…' : 'Cargar'}
                </button>
              </div>

              {youtubeError && (
                <p className="text-[11px] text-red-500 font-medium px-1">{youtubeError}</p>
              )}

              {activeLoungeClient && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--primary)]/5 border border-[var(--primary)]/20">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                  <p className="text-[11px] text-[var(--primary)] font-medium">
                    Sugerido para {activeLoungeClient.name.split(' ')[0]}: {suggestedMusic} · {suggestedDrink}
                    {prefMusic.length > 1 && (
                      <span className="opacity-70"> · +{prefMusic.length - 1} más</span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Genre Quick-Load Tiles */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                Géneros Rápidos para el Salón
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                {GENRE_TILES.map(genre => {
                  const isActive = ytQueue[ytIndex]?.videoId === genre.videoId;
                  return (
                    <button
                      key={genre.label}
                      onClick={() => loadIntoQueue(genre.videoId)}
                      className={`p-3.5 rounded-2xl border text-left transition shadow-2xs cursor-pointer group ${
                        isActive
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'bg-white dark:bg-neutral-900 border-slate-200/80 dark:border-neutral-800 hover:border-red-300 dark:hover:border-red-800'
                      }`}
                    >
                      <div className="text-xl mb-1">{genre.emoji}</div>
                      <div className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                        {genre.label}
                      </div>
                      <div className={`text-[10px] mt-0.5 line-clamp-1 ${isActive ? 'text-white/70' : 'text-slate-400'}`}>
                        {genre.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Open in YouTube CTA */}
            {ytQueue[ytIndex] && (
              <button
                onClick={() => {
                  window.open(
                    `https://www.youtube.com/watch?v=${ytQueue[ytIndex].videoId}`,
                    '_blank',
                    'noopener',
                  );
                }}
                className="w-full py-3 rounded-2xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-semibold text-slate-600 dark:text-neutral-400 hover:text-red-600 hover:border-red-300 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir en YouTube
              </button>
            )}
          </motion.div>
        )}
      </div>
      </PageContent>

      {/* ── Editor de lista ──────────────────────────────────────────
          Renombrar, reordenar y quitar canciones. El reordenamiento usa
          flechas y no arrastre: el salón trabaja en tablet y con las manos
          ocupadas, y un objetivo grande que se toca gana a un drag preciso. */}
      <AnimatePresence>
        {editingList && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.15 }}
            className="absolute inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
            onClick={() => setEditingListId(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={reduceMotion ? { duration: 0 } : { type: 'spring', damping: 28, stiffness: 320 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-2xl"
            >
              {/* Nombre editable */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg shrink-0">{editingList.clientId ? '📌' : '⭐'}</span>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={() => {
                    const n = editName.trim();
                    if (n && n !== editingList.name) updatePlaylist(editingList.id, { name: n });
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-sm font-bold border border-transparent focus:border-[var(--primary)] focus:outline-none text-slate-900 dark:text-white"
                />
                <button
                  onClick={() => setEditingListId(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {editingList.clientId && editingList.client && (
                <p className="text-[11px] text-slate-400 mb-2 px-1">
                  Lista fija de {editingList.client.name} — suena siempre en su turno.
                </p>
              )}

              {/* Canciones */}
              {editingList.tracks.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic py-6 text-center">
                  Esta lista está vacía. Añade canciones desde el reproductor.
                </p>
              ) : (
                <LayoutGroup id={`editor-${editingList.id}`}>
                  <div className="max-h-72 overflow-y-auto hide-scrollbar">
                    <AnimatePresence initial={false}>
                      {editingList.tracks.map((t, i) => (
                        <motion.div
                          key={t.videoId}
                          layout={reduceMotion ? false : 'position'}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 38 }}
                          className="flex items-center gap-2 py-2 px-1 border-b border-slate-100 dark:border-neutral-800/80 last:border-b-0"
                        >
                          <span className="w-4 text-[11px] font-mono text-slate-400 tabular-nums shrink-0">
                            {i + 1}
                          </span>
                          {t.thumbnail ? (
                            <img src={t.thumbnail} alt={t.title} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-red-600/10 flex items-center justify-center shrink-0 text-xs">▶</div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-semibold truncate text-slate-800 dark:text-neutral-200">
                              {t.title}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">{t.channel || 'YouTube'}</div>
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={() => moveTrack(-1, t.videoId)}
                              disabled={i === 0}
                              title="Subir"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-[var(--primary)] hover:bg-slate-100 dark:hover:bg-neutral-800 disabled:opacity-25 disabled:hover:bg-transparent transition cursor-pointer"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => moveTrack(1, t.videoId)}
                              disabled={i === editingList.tracks.length - 1}
                              title="Bajar"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-[var(--primary)] hover:bg-slate-100 dark:hover:bg-neutral-800 disabled:opacity-25 disabled:hover:bg-transparent transition cursor-pointer"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeTrackFromPlaylist(editingList.id, t.videoId)}
                              title="Quitar de la lista"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </LayoutGroup>
              )}

              {/* Pie */}
              <div className="flex items-center justify-between gap-2 pt-3 mt-2 border-t border-slate-100 dark:border-neutral-800">
                <span className="text-[10px] text-slate-400">
                  {editingList.tracks.length} canción{editingList.tracks.length === 1 ? '' : 'es'}
                </span>
                <button
                  onClick={() => {
                    if (confirm(`¿Eliminar la lista «${editingList.name}»?`)) {
                      deletePlaylist(editingList.id);
                      setEditingListId(null);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-rose-500 hover:bg-rose-500/10 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar lista
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Guardar en lista ──────────────────────────────────────────
          Un solo panel para los dos caminos: la canción que suena y las
          marcadas en la cola. `saveTargets` decide cuáles se guardan. */}
      <AnimatePresence>
        {saveTargets && saveTargets.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.15 }}
            className="absolute inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
            onClick={() => setSaveTargets(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={reduceMotion ? { duration: 0 } : { type: 'spring', damping: 28, stiffness: 320 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Guardar {saveTargets.length === 1 ? 'canción' : `${saveTargets.length} canciones`}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    {saveTargets.length === 1
                      ? saveTargets[0].title
                      : saveTargets.slice(0, 2).map((t: any) => t.title.slice(0, 22)).join(' · ') + '…'}
                  </p>
                </div>
                <button
                  onClick={() => setSaveTargets(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Listas existentes */}
              <div className="max-h-52 overflow-y-auto hide-scrollbar space-y-1">
                {playlists.length === 0 && (
                  <p className="text-[11px] text-slate-400 italic px-1 py-2">
                    Aún no tienes listas. Crea la primera abajo.
                  </p>
                )}
                {playlists.map(pl => {
                  const have = saveTargets.filter((t: any) => pl.tracks.some(x => x.videoId === t.videoId)).length;
                  const allIn = have === saveTargets.length;
                  return (
                    <button
                      key={pl.id}
                      disabled={allIn || savingTo === pl.id}
                      onClick={() => commitSave(pl.id, pl.name)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition cursor-pointer ${
                        allIn
                          ? 'text-slate-400 cursor-not-allowed'
                          : 'hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-200'
                      }`}
                    >
                      <span className="truncate flex items-center gap-1.5">
                        <span>{pl.clientId ? '📌' : '⭐'}</span>
                        <span className="truncate font-semibold">{pl.name}</span>
                        <span className="opacity-50">({pl.tracks.length})</span>
                        {pl.clientId && pl.client && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] shrink-0">
                            {pl.client.name.split(' ')[0]}
                          </span>
                        )}
                      </span>
                      {savingTo === pl.id
                        ? <span className="text-[10px] shrink-0">…</span>
                        : allIn
                        ? <Check className="w-3.5 h-3.5 shrink-0" />
                        : <Plus className="w-3.5 h-3.5 shrink-0 opacity-50" />}
                    </button>
                  );
                })}
              </div>

              {/* Crear lista nueva del salón */}
              <div className="flex gap-1.5 pt-3 mt-2 border-t border-slate-100 dark:border-neutral-800">
                <input
                  value={newListName}
                  onChange={e => setNewListName(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key !== 'Enter' || !newListName.trim()) return;
                    const pl = await createPlaylist(newListName.trim(), null);
                    if (pl) { setNewListName(''); await commitSave(pl.id, pl.name); }
                  }}
                  placeholder="⭐ Nueva lista del salón…"
                  className="flex-1 px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-xs border border-slate-200 dark:border-neutral-700 focus:outline-none focus:ring-1 focus:ring-[var(--primary)] text-slate-900 dark:text-white"
                />
                <button
                  disabled={!newListName.trim()}
                  onClick={async () => {
                    const pl = await createPlaylist(newListName.trim(), null);
                    if (pl) { setNewListName(''); await commitSave(pl.id, pl.name); }
                  }}
                  className="px-3 py-2 rounded-xl bg-[var(--primary)] text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
                >
                  Crear
                </button>
              </div>

              {/* Atajo: fijar a la clienta del sillón */}
              {activeLoungeClient && (
                <button
                  onClick={async () => {
                    const nombre = activeLoungeClient.name.split(' ')[0];
                    const existente = playlists.find(p => p.clientId === activeLoungeClient.id);
                    const pl = existente ?? await createPlaylist(`Fijas de ${nombre}`, activeLoungeClient.id);
                    if (pl) await commitSave(pl.id, pl.name);
                  }}
                  className="w-full mt-2 px-3 py-2 rounded-xl text-[11px] font-bold text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/15 transition cursor-pointer"
                >
                  📌 Fijar a {activeLoungeClient.name.split(' ')[0]} — sonará siempre en su turno
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Selector de cortesías del catálogo del salón ───────────────── */}
      <AnimatePresence>
        {pickerTipo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPickerTipo(null)}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-3"
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 p-4 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {pickerTipo === 'drink' ? 'Agregar bebida' : 'Agregar aperitivo'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Del catálogo del salón, para {activeLoungeClient?.name.split(' ')[0]}
                  </p>
                </div>
                <button
                  onClick={() => setPickerTipo(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {opcionesDisponibles(pickerTipo).length ? (
                <div className="max-h-[50vh] overflow-y-auto flex flex-wrap gap-2">
                  {opcionesDisponibles(pickerTipo).map(op => (
                    <button
                      key={op.id}
                      disabled={guardandoPref}
                      onClick={async () => {
                        await agregarPref(op.id);
                        // Se queda abierto: normalmente se agregan varias de una
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs font-semibold text-slate-700 dark:text-neutral-200 hover:border-[var(--primary)] hover:text-[var(--primary)] transition disabled:opacity-40"
                    >
                      {op.value}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-xs text-slate-400">
                  Ya tiene registrado todo el catálogo de esta categoría.
                </p>
              )}

              <button
                onClick={() => setPickerTipo(null)}
                className="w-full mt-4 px-3 py-2.5 rounded-xl bg-[var(--primary)] text-white text-xs font-bold"
              >
                Listo
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
