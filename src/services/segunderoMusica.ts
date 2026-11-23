import { useSyncExternalStore } from 'react';

/**
 * El segundero de la canción que suena (YouTube).
 *
 * Vive aparte del contexto de la app a propósito: cambia dos veces por
 * segundo mientras suena música, y si estuviera en el contexto toda la app
 * (la lista de chats, el chat abierto, la agenda…) se volvería a pintar dos
 * veces por segundo. Con eso escribir en un chat se sentía lento: las letras
 * esperaban su turno detrás de esos repintados. Aquí solo se repinta quien
 * de verdad enseña el segundero (la barra del reproductor).
 */
let segundos = 0;
const oyentes = new Set<() => void>();

export function ponerSegundoMusica(valor: number) {
  if (valor === segundos) return;
  segundos = valor;
  oyentes.forEach(o => o());
}

/** Para leerlo sin repintar (por ejemplo, al publicar el estado por el socket) */
export function leerSegundoMusica() {
  return segundos;
}

function suscribir(o: () => void) {
  oyentes.add(o);
  return () => { oyentes.delete(o); };
}

/** El segundero, para quien lo enseña. `redondear` evita repintar por medio segundo */
export function useSegundoMusica(redondear = true) {
  return useSyncExternalStore(
    suscribir,
    () => (redondear ? Math.round(segundos) : segundos),
    () => 0,
  );
}
