import React, { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { alRecibir } from '../services/socket';
import {
  iniciarMusica, publicarEstado, enviarCola, useMusicaSala, registrarAltavoz, activarAltavoz,
  dispositivoPropio, programar, miAjusteMs, miAutoMs, calibrarme, estadoMusica, soyElAnfitrion,
} from '../services/musica';
import {
  corregirSeguidor, posicionObjetivo, arrancarSincronizado, Calibrador, MemoriaSeguidor,
} from '../utils/seguirLider';

/**
 * El puente entre el reproductor de este aparato y la sala.
 *
 * No pinta nada. Se monta una sola vez en toda la app y hace tres cosas.
 *
 * SI ESTE APARATO ES EL ANFITRIÓN:
 *   1. cuenta a la sede qué está sonando;
 *   2. obedece las órdenes que llegan de los mandos.
 *
 * SI ESTE APARATO ES UN SEGUIDOR (encendido en la lista, pero otro marca el
 * ritmo): suena la misma canción y se corrige contra el líder.
 *
 * SI ESTÁ APAGADO EN LA LISTA Y SUENAN OTROS:
 *   3. CALLA este aparato y le empuja su cola al que sí suena.
 *
 * El punto 3 evita que el teléfono y el portátil suenen cada uno por su lado
 * con su propia cola. Puede haber varios altavoces a la vez, pero solo los
 * que quien manda encendió.
 */
export const PuenteMusica: React.FC = () => {
  const {
    ytQueue, ytIndex, ytPlaying, ytTime, ytDuration, ytVolume,
    ytPlayerRef, ytNext, ytPrev, ytSeek, ytSetVolume, ytPlayIndex,
    currentTrack, isPlayingLounge, togglePlayLounge, nextLoungeTrack,
  } = useApp();
  const {
    soyAnfitrion, hayAnfitrion, puedoMandar, soyAltavoz, sincronizado, altavoces, silencioso,
  } = useMusicaSala();

  useEffect(() => { iniciarMusica(); }, []);

  /* Este aparato se ofrece como altavoz (apagado): aparece en la lista de
     altavoces y quien manda decide si suena aquí. */
  useEffect(() => { if (puedoMandar) registrarAltavoz('app'); }, [puedoMandar]);

  const pista = ytQueue[ytIndex];
  const hayYt = !!pista;

  /**
   * Las órdenes se aplican a través de una referencia y no directamente en
   * el `useEffect` de escucha: si el oyente dependiera de `ytNext`, se
   * volvería a registrar con cada render y acabaríamos con varios oyentes
   * atendiendo la misma orden —un "siguiente" saltaría tres canciones.
   */
  const silencioHastaRef = useRef(0);
  const memoriaSeguidorRef = useRef<MemoriaSeguidor>({ ultimoSalto: 0 });
  const calibradorRef = useRef(new Calibrador());
  const aplicar = useRef<(o: any) => void>(() => {});
  aplicar.current = (orden: any) => {
    const p = ytPlayerRef?.current;
    const accion = orden?.accion;
    const valor = orden?.valor;
    /* Play, pausa y salto llevan una hora del servidor: todos los altavoces
       esperan a esa hora y ejecutan juntos. Después se deja un rato sin
       corregir, para no deshacer lo que se acaba de pedir con un estado viejo. */
    const conHora = (fn: () => void) => programar(orden?.en, () => {
      silencioHastaRef.current = Date.now() + 1800;
      calibradorRef.current.reiniciar();
      try { fn(); } catch { /* el player aún no está listo */ }
    });

    /** Arrancar a la vez que los demás. Ver `useAltavoz`: es el mismo trato. */
    const arrancar = (base: number | null) => {
      const pl = ytPlayerRef?.current;
      const en = Number(orden?.en);
      calibradorRef.current.reiniciar();
      if (!Number.isFinite(en) || en <= 0) {
        if (base !== null) { try { pl?.seekTo?.(base, true); } catch { /* noop */ } }
        try { pl?.playVideo?.(); } catch { /* noop */ }
        return;
      }
      const ajuste = soyElAnfitrion() ? 0 : miAjusteMs();
      silencioHastaRef.current = Date.now() + Math.max(0, en - Date.now()) + 2000;
      arrancarSincronizado(pl, base ?? posicionObjetivo(estadoMusica(), 0, en), ajuste, en, programar);
    };

    try {
      switch (accion) {
        case 'play':
          if (hayYt) arrancar(null);
          else if (!isPlayingLounge) togglePlayLounge();
          break;
        case 'pause':
          if (hayYt) conHora(() => ytPlayerRef?.current?.pauseVideo?.());
          else if (isPlayingLounge) togglePlayLounge();
          break;
        case 'next':
          hayYt ? ytNext() : nextLoungeTrack();
          break;
        case 'prev':
          if (hayYt) ytPrev();
          break;
        case 'seek':
          if (hayYt && Number.isFinite(Number(valor))) arrancar(Number(valor));
          break;
        case 'volumen':
          if (Number.isFinite(Number(valor))) {
            ytSetVolume(Math.max(0, Math.min(100, Number(valor))));
          }
          break;
        case 'pista':
          if (hayYt && Number.isFinite(Number(valor))) ytPlayIndex(Number(valor));
          break;
      }
    } catch { /* el player aún no está listo; la siguiente orden llegará */ }
  };

  // Un solo oyente para toda la vida de la app
  useEffect(() => alRecibir('musica:orden', (o: any) => aplicar.current(o)), []);

  /**
   * Publicar lo que suena. Dos disparos distintos a propósito:
   * el cambio de canción o de play/pausa va inmediato —es lo que la gente
   * mira—, y el segundero va cada dos segundos, que es suficiente para una
   * barra de progreso y no satura el socket con sesenta mensajes por minuto.
   */
  /* El estado se lee de una referencia y no de las dependencias del efecto:
     `ytTime` cambia cada segundo, así que un efecto que dependiera de él
     rearmaría el intervalo sesenta veces por minuto y el throttle no
     serviría de nada. */
  const contar = useRef<() => void>(() => {});
  contar.current = () => {
    const t = hayYt ? pista : null;
    publicarEstado({
      sonando: hayYt ? ytPlaying : isPlayingLounge,
      posicion: hayYt ? ytTime : 0,
      duracion: hayYt ? ytDuration : 0,
      volumen: ytVolume,
      pista: t
        ? {
            videoId: t.videoId, titulo: t.title, artista: (t as any).channel ?? null, portada: (t as any).thumbnail ?? null,
            peticionId: (t as any).peticionId ?? null, pidio: (t as any).pidio ?? null,
          }
        : currentTrack
          ? { titulo: currentTrack.title, artista: currentTrack.artist, portada: currentTrack.coverUrl }
          : null,
    });
  };

  /**
   * Callar cuando el salón suena en OTROS aparatos.
   *
   * Si este aparato está encendido en la lista de altavoces (líder o
   * seguidor) suena; si hay altavoces pero este no está entre ellos, se
   * calla. Se pausa, no se vacía la cola: si el televisor se apaga y este
   * aparato vuelve a sonar, tiene que poder seguir donde estaba.
   */
  useEffect(() => {
    if (!hayAnfitrion || soyAltavoz) {
      // Suena aquí (o no hay ninguno): se devuelve el sonido, salvo que este
      // aparato esté puesto como "solo imagen"
      try {
        if (silencioso) ytPlayerRef?.current?.mute?.();
        else ytPlayerRef?.current?.unMute?.();
      } catch { /* noop */ }
      return;
    }
    try {
      /* Mudo ADEMÁS de pausado. La pantalla sigue a la canción del salón, y
         cambiar de canción hace que el player local la cargue y arranque
         solo por un instante: sin el mudo, ese instante se oye. */
      ytPlayerRef?.current?.mute?.();
      ytPlayerRef?.current?.pauseVideo?.();
    } catch { /* noop */ }
    if (isPlayingLounge) togglePlayLounge();
  }, [hayAnfitrion, soyAltavoz, silencioso, pista?.videoId, ytPlaying, isPlayingLounge]);

  /**
   * Si pulsan play aquí y no suena nada en el salón, este aparato pasa a ser
   * el altavoz. Así lo que se oye siempre está en la lista, lo ven las demás
   * pantallas y se puede sumar otro aparato después. Solo con el salón en
   * silencio: nunca le quita el sitio a uno que ya suena.
   */
  useEffect(() => {
    if (!puedoMandar || !sincronizado || hayAnfitrion) return;
    if (!(ytPlaying || isPlayingLounge)) return;
    activarAltavoz(dispositivoPropio(), true, true);
  }, [puedoMandar, sincronizado, hayAnfitrion, ytPlaying, isPlayingLounge, altavoces.length]);

  /**
   * Seguidor: este aparato suena, pero el ritmo lo marca otro. Una vez por
   * segundo se compara lo que hace el player con lo que dice el líder.
   */
  useEffect(() => {
    if (!puedoMandar || !soyAltavoz || soyAnfitrion) return;
    const id = window.setInterval(() => {
      if (Date.now() < silencioHastaRef.current) return;
      const s = estadoMusica();
      const p = ytPlayerRef?.current;
      if (!p || !s.pista?.videoId) return;
      // Solo con la canción del líder ya puesta; ponerla es cosa del contexto
      let cargado: string | undefined;
      try { cargado = p.getVideoData?.()?.video_id; } catch { /* noop */ }
      if (cargado !== s.pista.videoId) return;
      const hecho = corregirSeguidor(p, s, miAjusteMs(), memoriaSeguidorRef.current);
      // Lo que queda tras la corrección gruesa es el desfase fino: se mide y se guarda
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
      try {
        if (Math.abs((p.getVolume?.() ?? s.volumen) - s.volumen) > 2) ytSetVolume(s.volumen);
      } catch { /* noop */ }
    }, 1000);
    return () => window.clearInterval(id);
  }, [puedoMandar, soyAltavoz, soyAnfitrion]);

  /**
   * Empujarle la cola al que suena.
   *
   * La ventana pública del salón no puede pedir la cola —no tiene sesión con
   * la que identificarse—, así que se la manda quien sí la tiene. Solo se
   * reenvía cuando la LISTA cambia de verdad, no en cada render: lo contrario
   * sería un mensaje por segundo con la misma lista dentro.
   */
  const ultimaCola = useRef('');
  useEffect(() => {
    if (!puedoMandar || soyAnfitrion) return;
    // La marca de "pedida" entra en la firma: que una canción pase a ser (o
    // dejar de ser) petición también es un cambio de la lista.
    const firma = ytQueue.map((t: any) => t.videoId + (t.peticionId ? '*' : '')).join(',');
    if (!firma || firma === ultimaCola.current) return;
    ultimaCola.current = firma;
    enviarCola(
      ytQueue.map((t: any) => ({
        videoId: t.videoId,
        titulo: t.title ?? null,
        artista: t.channel ?? null,
        portada: t.thumbnail ?? null,
        peticionId: t.peticionId ?? null,
        pidio: t.pidio ?? null,
      })),
      ytIndex,
    );
  }, [puedoMandar, soyAnfitrion, ytQueue, ytIndex]);

  // El segundero: cada dos segundos basta para una barra de progreso
  useEffect(() => {
    if (!soyAnfitrion) return;
    const id = window.setInterval(() => contar.current(), 2000);
    return () => window.clearInterval(id);
  }, [soyAnfitrion]);

  // Lo que la gente mira —canción, play/pausa— va inmediato, sin esperar
  useEffect(() => {
    if (soyAnfitrion) contar.current();
  }, [soyAnfitrion, hayYt, pista?.videoId, ytPlaying, isPlayingLounge, currentTrack?.title, ytVolume]);

  return null;
};
