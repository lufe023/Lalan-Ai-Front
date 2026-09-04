import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Shuffle,
  Repeat,
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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LoungeTrack } from '../types';
import { MUSIC_VIBES, POPULAR_BEVERAGES, POPULAR_SNACKS } from '../data/mockData';

export const LoungePlayerScreen: React.FC = () => {
  const {
    loungeTracks,
    currentTrackIndex,
    currentTrack,
    isPlayingLounge,
    activeLoungeClient,
    servedHospitalityHistory,
    playTrack,
    togglePlayLounge,
    nextLoungeTrack,
    prevLoungeTrack,
    addTrackToLounge,
    removeLoungeTrack,
    setActiveLoungeClient,
    serveHospitalityItem,
    clients,
    showToast,
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

  // Client dropdown modal/popover
  const [showClientSelector, setShowClientSelector] = useState<boolean>(false);

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
    <div className="flex-1 w-full h-full flex flex-col bg-[#F9FAFB] dark:bg-neutral-950 overflow-y-auto pb-24 text-slate-900 dark:text-neutral-100 select-none">
      {/* iOS Minimalist Nav Header */}
      <div className="sticky top-0 z-20 px-4 pt-3 pb-2.5 bg-[#F9FAFB]/90 dark:bg-neutral-950/90 backdrop-blur-md border-b border-slate-200/50 dark:border-neutral-900">
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
            {activeLoungeClient ? (
              <>
                <img
                  src={activeLoungeClient.avatar}
                  alt={activeLoungeClient.name}
                  className="w-5 h-5 rounded-full object-cover"
                />
                <span className="text-xs font-semibold max-w-[90px] truncate text-slate-800 dark:text-neutral-200">
                  {activeLoungeClient.name.split(' ')[0]}
                </span>
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-semibold text-slate-600 dark:text-neutral-400">
                  Elegir clienta
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
                Selecciona la clienta actualmente en el sillón:
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {clients.map(c => {
                  const isSelected = activeLoungeClient?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setActiveLoungeClient(c);
                        setShowClientSelector(false);
                        showToast(`Clienta Activa: ${c.name}`, 'Preferencias de bebida y música sincronizadas.', 'info');
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
                          <div className="text-xs font-bold">{c.name}</div>
                          <div className="text-[10px] opacity-80">{c.hospitality?.musicVibe || 'Gusto general'}</div>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
            Bebidas & Gustos
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
            YouTube / Spotify
          </button>
        </div>
      </div>

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
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={activeLoungeClient.avatar}
                      alt={activeLoungeClient.name}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-[var(--primary)]/30"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--primary)] text-white text-[8px] flex items-center justify-center">
                      ★
                    </span>
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-slate-400 dark:text-neutral-500">
                      Sonando para la cita de
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {activeLoungeClient.name}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-neutral-800 text-[10px] font-semibold text-slate-600 dark:text-neutral-300">
                    <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                    {activeLoungeClient.hospitality?.musicVibe || 'Lofi Chill'}
                  </span>
                </div>
              </div>
            )}

            {/* Apple Music Style Player Card */}
            <div className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
              {/* Subtle ambient gradient halo */}
              <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-[var(--primary)]/10 to-transparent pointer-events-none" />

              {/* Album Art with Floating Glow */}
              <div className="relative my-2">
                <motion.div
                  animate={{
                    scale: isPlayingLounge ? [1, 1.015, 1] : 1,
                  }}
                  transition={{
                    repeat: isPlayingLounge ? Infinity : 0,
                    duration: 3.5,
                    ease: 'easeInOut',
                  }}
                  className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden shadow-xl border border-slate-100 dark:border-neutral-800 relative group"
                >
                  <img
                    src={currentTrack.coverUrl}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                  {/* Visualizer overlay */}
                  {isPlayingLounge && (
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
              </div>

              {/* Title & Artist */}
              <div className="mt-4 w-full px-2">
                <div className="flex items-center justify-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                    {currentTrack.title}
                  </h2>
                </div>
                <p className="text-sm font-medium text-slate-500 dark:text-neutral-400 mt-0.5 truncate">
                  {currentTrack.artist} {currentTrack.album && `• ${currentTrack.album}`}
                </p>

                {/* Source badge */}
                <div className="mt-2 flex items-center justify-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300">
                    {currentTrack.source === 'youtube' ? 'YouTube Music' : currentTrack.source === 'spotify' ? 'Spotify Sync' : 'Lalan Radio'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-[var(--primary)] bg-[var(--primary)]/10">
                    {currentTrack.vibe}
                  </span>
                </div>
              </div>

              {/* Scrubber Progress Slider */}
              <div className="w-full mt-5 px-1">
                <div className="relative flex items-center">
                  <input
                    type="range"
                    min={0}
                    max={currentTrack.durationSeconds}
                    value={progressSec}
                    onChange={e => setProgressSec(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 dark:text-neutral-500 mt-1.5 px-0.5">
                  <span>{formatTime(progressSec)}</span>
                  <span>-{formatTime(Math.max(0, currentTrack.durationSeconds - progressSec))}</span>
                </div>
              </div>

              {/* iOS Playback Controls */}
              <div className="w-full flex items-center justify-between max-w-xs mt-3 px-2">
                <button
                  onClick={() => setIsShuffle(!isShuffle)}
                  className={`p-2 rounded-full transition cursor-pointer ${
                    isShuffle ? 'text-[var(--primary)]' : 'text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300'
                  }`}
                  title="Aleatorio"
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                <button
                  onClick={prevLoungeTrack}
                  className="p-2.5 rounded-full text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition ios-touch cursor-pointer"
                  title="Anterior"
                >
                  <SkipBack className="w-6 h-6 fill-current" />
                </button>

                <button
                  onClick={togglePlayLounge}
                  className="w-14 h-14 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition ios-touch cursor-pointer"
                  title={isPlayingLounge ? 'Pausar' : 'Reproducir'}
                >
                  {isPlayingLounge ? (
                    <Pause className="w-7 h-7 fill-current" />
                  ) : (
                    <Play className="w-7 h-7 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  onClick={nextLoungeTrack}
                  className="p-2.5 rounded-full text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition ios-touch cursor-pointer"
                  title="Siguiente"
                >
                  <SkipForward className="w-6 h-6 fill-current" />
                </button>

                <button
                  onClick={() => setIsRepeat(!isRepeat)}
                  className={`p-2 rounded-full transition cursor-pointer ${
                    isRepeat ? 'text-[var(--primary)]' : 'text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300'
                  }`}
                  title="Repetir"
                >
                  <Repeat className="w-4 h-4" />
                </button>
              </div>

              {/* Volume Slider */}
              <div className="w-full max-w-xs flex items-center gap-2.5 mt-4 px-3">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={isMuted ? 0 : volume}
                  onChange={e => {
                    setVolume(Number(e.target.value));
                    if (isMuted) setIsMuted(false);
                  }}
                  className="w-full h-1 bg-slate-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
                />
              </div>
            </div>

            {/* Upcoming Queue List (Minimal iOS Table) */}
            <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-2">
              <div className="flex items-center justify-between pb-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                  A continuación en el salón ({loungeTracks.length})
                </h3>
                <span className="text-[11px] font-semibold text-[var(--primary)]">
                  Sonido ambiental activo
                </span>
              </div>

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
                {/* Client Hospitality Card Header */}
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

                  {/* Ambient Mood & Cabina Preferences */}
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-neutral-800 text-center">
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-neutral-800/40">
                      <Wind className="w-3.5 h-3.5 mx-auto text-sky-500 mb-1" />
                      <div className="text-[10px] text-slate-400 font-medium">Temperatura</div>
                      <div className="text-xs font-bold capitalize text-slate-800 dark:text-neutral-200">
                        {activeLoungeClient.hospitality?.temperaturePreference || 'Neutra'}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-neutral-800/40">
                      <Flame className="w-3.5 h-3.5 mx-auto text-amber-500 mb-1" />
                      <div className="text-[10px] text-slate-400 font-medium">Aromaterapia</div>
                      <div className="text-xs font-bold text-slate-800 dark:text-neutral-200 truncate">
                        {activeLoungeClient.hospitality?.roomAroma || 'Lavanda'}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-neutral-800/40">
                      <Smile className="w-3.5 h-3.5 mx-auto text-emerald-500 mb-1" />
                      <div className="text-[10px] text-slate-400 font-medium">Interacción</div>
                      <div className="text-xs font-bold text-slate-800 dark:text-neutral-200 capitalize">
                        {activeLoungeClient.hospitality?.conversationLevel?.replace('_', ' ') || 'Amigable'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Favorite Beverages Section */}
                <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                        <Coffee className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                          Bebidas Favoritas de la Clienta
                        </h3>
                        <p className="text-[11px] text-slate-400">Toca para registrar cortesía servida en la cita</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {activeLoungeClient.hospitality?.favoriteDrinks && activeLoungeClient.hospitality.favoriteDrinks.length > 0 ? (
                      activeLoungeClient.hospitality.favoriteDrinks.map(drink => (
                        <button
                          key={drink}
                          onClick={() => serveHospitalityItem(drink)}
                          className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2 hover:scale-[1.02] active:scale-98 transition cursor-pointer"
                        >
                          <span>☕</span>
                          <span>{drink}</span>
                          <span className="text-[10px] bg-amber-200/60 dark:bg-amber-800/60 px-1.5 py-0.5 rounded-full font-extrabold">
                            Servir
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">No hay bebidas registradas aún.</p>
                    )}
                  </div>
                </div>

                {/* Favorite Snacks Section */}
                <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                        Snacks & Bocadillos Preferidos
                      </h3>
                      <p className="text-[11px] text-slate-400">Cortesías para hacer su experiencia placentera</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {activeLoungeClient.hospitality?.favoriteSnacks && activeLoungeClient.hospitality.favoriteSnacks.length > 0 ? (
                      activeLoungeClient.hospitality.favoriteSnacks.map(snack => (
                        <button
                          key={snack}
                          onClick={() => serveHospitalityItem(snack)}
                          className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-xs font-bold text-rose-900 dark:text-rose-200 flex items-center gap-2 hover:scale-[1.02] active:scale-98 transition cursor-pointer"
                        >
                          <span>🍓</span>
                          <span>{snack}</span>
                          <span className="text-[10px] bg-rose-200/60 dark:bg-rose-800/60 px-1.5 py-0.5 rounded-full font-extrabold">
                            Ofrecer
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">No hay snacks registrados.</p>
                    )}
                  </div>
                </div>

                {/* Musical Taste & Artists Card */}
                <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
                      <Music className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                        Gusto Musical & Artistas
                      </h3>
                      <p className="text-[11px] text-slate-400">Estilo: {activeLoungeClient.hospitality?.musicVibe || 'Lofi Chill'}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {activeLoungeClient.hospitality?.favoriteArtistsOrSongs?.map(artist => (
                      <span
                        key={artist}
                        className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-neutral-800 text-xs font-medium text-slate-700 dark:text-neutral-300 flex items-center gap-1.5"
                      >
                        <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                        {artist}
                      </span>
                    ))}
                  </div>

                  {activeLoungeClient.hospitality?.notes && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/50 text-xs text-slate-600 dark:text-neutral-300 italic">
                      "{activeLoungeClient.hospitality.notes}"
                    </div>
                  )}
                </div>

                {/* Real-time Hospitality Log of this Appointment */}
                <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                      Bitácora de Atenciones Servidas Hoy
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      {servedHospitalityHistory.length} entregas
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-neutral-800">
                    {servedHospitalityHistory.map(entry => (
                      <div key={entry.id} className="py-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="font-semibold text-slate-800 dark:text-neutral-200">{entry.item}</span>
                          <span className="text-[10px] text-slate-400">({entry.clientName})</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">{entry.time}</span>
                      </div>
                    ))}
                  </div>
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

        {/* TAB 3: EXPLORAR YOUTUBE & SPOTIFY */}
        {activeTab === 'explore' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Search and API Connection Box */}
            <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Conexión YouTube & Spotify API
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Busca canciones afines al gusto del cliente y agrégalas a su cola
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                    API Ready
                  </span>
                </div>
              </div>

              {/* Search Bar Input */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar artista, canción o pegar enlace de YouTube / Spotify..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-neutral-800/80 border border-transparent focus:border-[var(--primary)] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition"
                />
              </div>

              {/* Source Filter Chips */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSearchSource('all')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                    searchSource === 'all'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setSearchSource('spotify')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                    searchSource === 'spotify'
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400'
                  }`}
                >
                  <span>Spotify</span>
                </button>
                <button
                  onClick={() => setSearchSource('youtube')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                    searchSource === 'youtube'
                      ? 'bg-red-600 text-white font-bold'
                      : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400'
                  }`}
                >
                  <span>YouTube</span>
                </button>
              </div>
            </div>

            {/* Curated Vibe Quick Filters */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                Playlists Recomendadas para el Salón
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {MUSIC_VIBES.map(vibe => (
                  <button
                    key={vibe.id}
                    onClick={() => {
                      setSearchQuery(vibe.label.split(' ')[0]);
                    }}
                    className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 text-left transition shadow-2xs cursor-pointer group"
                  >
                    <div className="text-xl mb-1">{vibe.icon}</div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[var(--primary)] transition">
                      {vibe.label}
                    </div>
                    <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                      {vibe.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Search Results List */}
            <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Canciones Encontradas ({filteredSearchResults.length})
              </h4>

              <div className="divide-y divide-slate-100 dark:divide-neutral-800">
                {filteredSearchResults.map(item => (
                  <div
                    key={item.title}
                    className="py-3 flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={item.coverUrl}
                        alt={item.title}
                        className="w-11 h-11 rounded-xl object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-neutral-400 truncate">
                          {item.artist}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-sm ${
                              item.source === 'spotify'
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : 'bg-red-500/10 text-red-600'
                            }`}
                          >
                            {item.source.toUpperCase()}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatTime(item.durationSeconds)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          addTrackToLounge({
                            title: item.title,
                            artist: item.artist,
                            album: item.album,
                            durationSeconds: item.durationSeconds,
                            coverUrl: item.coverUrl,
                            vibe: item.vibe,
                            source: item.source,
                            dedicatedForClientName: activeLoungeClient?.name,
                          });
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-neutral-800 hover:bg-[var(--primary)] hover:text-white text-xs font-bold text-slate-700 dark:text-neutral-300 transition flex items-center gap-1 cursor-pointer"
                        title="Añadir a la cola"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Añadir</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
