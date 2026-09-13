import React, { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { alRecibir } from '../services/socket';
import { iniciarMusica, publicarEstado, enviarCola, useMusicaSala } from '../services/musica';

/**
 * El puente entre el reproductor de este aparato y la sala.
 *
 * No pinta nada. Se monta una sola vez en toda la app y hace tres cosas.
 *
 * SI ESTE APARATO ES EL ANFITRIÓN:
 *   1. cuenta a la sede qué está sonando;
 *   2. obedece las órdenes que llegan de los mandos.
 *
 * SI EL ANFITRIÓN ES OTRO:
 *   3. CALLA este aparato y le empuja su cola al que sí suena.
 *
 * El punto 3 es el que faltaba y hacía que el teléfono y el portátil sonaran
 * cada uno por su lado: dos altavoces con la misma app, cada uno con su
 * propia cola. Mientras otro aparato sea el altavoz, este se queda mudo — no
 * es un detalle de comodidad, es lo único que evita el eco en el local.
 */
export const PuenteMusica: React.FC = () => {
  const {
    ytQueue, ytIndex, ytPlaying, ytTime, ytDuration, ytVolume,
    ytPlayerRef, ytNext, ytPrev, ytSeek, ytSetVolume, ytPlayIndex,
    currentTrack, isPlayingLounge, togglePlayLounge, nextLoungeTrack,
  } = useApp();
  const { soyAnfitrion, hayAnfitrion, puedoMandar } = useMusicaSala();

  useEffect(() => { iniciarMusica(); }, []);

  const pista = ytQueue[ytIndex];
  const hayYt = !!pista;

  /**
   * Las órdenes se aplican a través de una referencia y no directamente en
   * el `useEffect` de escucha: si el oyente dependiera de `ytNext`, se
   * volvería a registrar con cada render y acabaríamos con varios oyentes
   * atendiendo la misma orden —un "siguiente" saltaría tres canciones.
   */
  const aplicar = useRef<(o: any) => void>(() => {});
  aplicar.current = (orden: any) => {
    const p = ytPlayerRef?.current;
    const accion = orden?.accion;
    const valor = orden?.valor;
    try {
      switch (accion) {
        case 'play':
          if (hayYt) p?.playVideo?.();
          else if (!isPlayingLounge) togglePlayLounge();
          break;
        case 'pause':
          if (hayYt) p?.pauseVideo?.();
          else if (isPlayingLounge) togglePlayLounge();
          break;
        case 'next':
          hayYt ? ytNext() : nextLoungeTrack();
          break;
        case 'prev':
          if (hayYt) ytPrev();
          break;
        case 'seek':
          if (hayYt && Number.isFinite(Number(valor))) ytSeek(Number(valor));
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
        ? { videoId: t.videoId, titulo: t.title, artista: (t as any).channel ?? null, portada: (t as any).thumbnail ?? null }
        : currentTrack
          ? { titulo: currentTrack.title, artista: currentTrack.artist, portada: currentTrack.coverUrl }
          : null,
    });
  };

  /**
   * Callar cuando manda otro.
   *
   * Se pausa, no se vacía la cola: si el televisor se apaga y este aparato
   * vuelve a ser el altavoz, tiene que poder seguir donde estaba sin
   * rearmar nada.
   */
  useEffect(() => {
    if (!hayAnfitrion || soyAnfitrion) {
      // Volvimos a ser el altavoz (o no hay ninguno): se devuelve el sonido
      try { ytPlayerRef?.current?.unMute?.(); } catch { /* noop */ }
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
  }, [hayAnfitrion, soyAnfitrion, pista?.videoId, ytPlaying, isPlayingLounge]);

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
    const firma = ytQueue.map((t: any) => t.videoId).join(',');
    if (!firma || firma === ultimaCola.current) return;
    ultimaCola.current = firma;
    enviarCola(
      ytQueue.map((t: any) => ({
        videoId: t.videoId,
        titulo: t.title ?? null,
        artista: t.channel ?? null,
        portada: t.thumbnail ?? null,
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
