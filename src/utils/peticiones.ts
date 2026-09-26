import type { YtTrack } from '../context/AppContext';

/**
 * Una canción que pidió una clienta desde el QR, tal como la manda el servidor.
 *
 * `pending` espera su turno; `played` ya empezó a sonar. Las quitadas no
 * llegan nunca aquí.
 */
export interface PeticionCancion {
  id: string;
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string | null;
  durationSeconds: number | null;
  guestName: string | null;
  status: 'pending' | 'played' | 'removed';
  createdAt: string;
  playedAt: string | null;
}

const aPista = (p: PeticionCancion): YtTrack => ({
  videoId: p.videoId,
  title: p.title,
  channel: p.channel,
  thumbnail: p.thumbnail,
  durationSeconds: p.durationSeconds,
  peticionId: p.id,
  pidio: p.guestName ?? 'una clienta',
});

/**
 * Mete las peticiones en la cola.
 *
 * LA REGLA (la misma que aplica el servidor en `MusicaSala.insertarPeticion`,
 * y por eso las dos versiones coinciden): las peticiones van DETRÁS de la
 * canción que suena y en orden de llegada, como una fila. No interrumpen lo
 * que ya suena ni se cuelan delante unas de otras.
 *
 * `ancla` es la última canción NORMAL de la cola que sonó. Se necesita porque
 * cuando la que suena es una petición no hay forma de saber dónde íbamos en
 * la cola de fondo; con el ancla, al terminar las peticiones se sigue por
 * donde tocaba.
 *
 * `actualPeticionId` es la petición que suena ahora, si suena una. Una
 * petición pasa a "sonó" en cuanto EMPIEZA, y si desapareciera de la cola en
 * ese instante el reproductor perdería su sitio y saltaría a la primera
 * canción. Por eso se conserva mientras sea la actual.
 *
 * Es una función pura y no toca la cola de fondo: mezclar de nuevo las
 * clientas ('random') cada vez que llegue una petición reordenaría todo.
 */
export function componerCola(
  base: YtTrack[],
  peticiones: PeticionCancion[],
  ancla: string | null,
  actualPeticionId: string | null,
): YtTrack[] {
  const activas = peticiones
    .filter(p => p.status === 'pending' || (actualPeticionId !== null && p.id === actualPeticionId))
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));

  if (!activas.length) return base;
  const pistas = activas.map(aPista);

  // Sin cola de fondo, las peticiones SON la cola
  if (!base.length) return pistas;

  // Ancla desconocida: se sigue tras la primera, nunca antes de todo
  const i = Math.max(0, ancla ? base.findIndex(t => t.videoId === ancla) : 0);
  return [...base.slice(0, i + 1), ...pistas, ...base.slice(i + 1)];
}

/** Posiciones de las peticiones dentro de una cola (para el modo aleatorio) */
export const indicesDePeticiones = (cola: YtTrack[]): number[] =>
  cola.reduce<number[]>((acc, t, i) => (t.peticionId ? (acc.push(i), acc) : acc), []);
