import { useEffect, useState } from 'react';
import { alRecibir, alConectar, alDesconectar, mandar, idSocket } from './socket';

/**
 * La música del salón, compartida entre aparatos.
 *
 * ── Los tres papeles ─────────────────────────────────────────────────
 *
 *   ANFITRIÓN  el aparato enchufado a los altavoces. Es el único que
 *              reproduce de verdad. Publica qué suena y obedece órdenes.
 *   MANDO      los teléfonos con permiso. No reproducen nada: mandan.
 *   PANTALLA   la pared. Solo mira.
 *
 * ── Por qué el estado vive en un módulo y no en un contexto ──────────
 *
 * Lo necesitan tres sitios que no se conocen entre sí: el puente que habla
 * con el reproductor de YouTube, el mando del Lounge y el bloque de la
 * pizarra —que corre en una pantalla SIN sesión, donde no hay AppContext
 * montado—. Un contexto de React obligaría a envolver también a la pared.
 */

export interface PistaSala {
  videoId?: string | null;
  titulo?: string | null;
  artista?: string | null;
  portada?: string | null;
}

export interface EstadoSala {
  anfitrion: string | null;
  nombre: string | null;
  sonando: boolean;
  pista: PistaSala | null;
  posicion: number;
  duracion: number;
  volumen: number;
  /** La cola que debe sonar y por dónde va. La empuja quien tiene mando. */
  cola: PistaSala[];
  indice: number;
  /** El altavoz está en pantalla completa del navegador */
  completa: boolean;
  actualizado: string;
}

export type OrdenMusica =
  | 'play' | 'pause' | 'next' | 'prev' | 'seek' | 'volumen' | 'pista'
  /** Cómo se VE en la pantalla del salón, no qué suena */
  | 'video' | 'pantalla';

const VACIO: EstadoSala = {
  anfitrion: null, nombre: null, sonando: false, pista: null,
  posicion: 0, duracion: 0, volumen: 80, cola: [], indice: 0,
  completa: false, actualizado: '',
};

let sala: EstadoSala = VACIO;
let arrancado = false;

/**
 * Se guarda la INTENCIÓN, no el hecho.
 *
 * El servidor identifica al anfitrión por el id del socket, y ese id cambia
 * en cada reconexión: un wifi que parpadea dejaría la sede sin altavoz y con
 * la pared enseñando una canción muerta. Con esto, el aparato que quiso
 * sonar vuelve a reclamar el puesto solo en cuanto se reconecta.
 */
let quiereSerAnfitrion = false;

/**
 * ¿Ya sabemos qué pasa en el salón?
 *
 * Al abrir la app no lo sabemos: hay que preguntárselo al servidor y esperar
 * la respuesta. En ese hueco de medio segundo, pulsar "play" hacía sonar la
 * música EN EL TELÉFONO, y un instante después llegaba la respuesta, el
 * teléfono se callaba y la lista volvía a empezar en el televisor. Desde
 * fuera eso no parece una carrera de arranque: parece una app que funciona
 * a trompicones.
 */
let sincronizado = false;
let pendientes: (() => void)[] = [];

/**
 * Hasta cuándo seguir enseñando el aviso de "sincronizando".
 *
 * La respuesta llega en un parpadeo, y un aviso que aparece y desaparece en
 * ochenta milisegundos no lo ve nadie: el usuario solo percibe que los
 * botones tardaron en responder, que es exactamente la sensación de app
 * rota que queríamos quitar. Se sostiene tres cuartos de segundo para que
 * quien mira entienda qué pasó.
 */
let finDelAviso = 0;

/** Lo dice el servidor al conectar. La pared nunca lo recibe: no manda. */
let puedoMandar = false;

const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach(fn => { try { fn(); } catch { /* noop */ } });

/** Se llama una vez, al montar la app o la pantalla de pared */
export function iniciarMusica() {
  if (arrancado) return;
  arrancado = true;

  alRecibir('musica:cambio', (s: any) => {
    sala = { ...VACIO, ...(s ?? {}) };
    if (!sincronizado) {
      sincronizado = true;
      finDelAviso = Date.now() + 750;
      // Un segundo repintado al terminar el aviso: sin él, el cartel se
      // quedaría puesto hasta que algo más provocara un render.
      setTimeout(avisar, 780);
      const cola = pendientes; pendientes = [];
      for (const fn of cola) { try { fn(); } catch { /* noop */ } }
    }
    avisar();
  });

  // El servidor dice al conectar si este usuario puede mandar. Se pregunta
  // para poder ESCONDER los botones: denegar en silencio se parece
  // demasiado a estar averiado.
  alRecibir('musica:permiso', (p: any) => {
    puedoMandar = !!p?.puede;
    avisar();
  });

  alConectar(() => {
    mandar('musica:sync');
    if (quiereSerAnfitrion) mandar('musica:reclamar');
  });

  /* Sin enlace no sabemos qué suena en el salón, aunque hace un segundo sí
     lo supiéramos. Volver a "no sincronizado" hace dos cosas: enseña el
     aviso otra vez y, sobre todo, vuelve a retener los botones hasta saber
     — que es lo que impide que un play a ciegas suene en el teléfono. */
  alDesconectar(() => {
    sincronizado = false;
    avisar();
  });

  // La pantalla puede haberse conectado antes de que esto se registre
  mandar('musica:sync');
}

export const estadoMusica = () => sala;

export const estaSincronizado = () => sincronizado;

/** ¿Hay que enseñar el aviso? Incluye el rato mínimo para que se vea. */
export const estaSincronizando = () => !sincronizado || Date.now() < finDelAviso;

/**
 * Hacer algo, pero no antes de saber qué pasa en el salón.
 *
 * Si ya lo sabemos, se hace ahora. Si no, se guarda y se ejecuta en cuanto
 * llegue la respuesta —normalmente en un parpadeo—. Solo se guarda la ÚLTIMA
 * intención: quien pulsó play y luego siguiente quiere lo segundo, no las
 * dos cosas seguidas.
 */
export function cuandoSepamos(fn: () => void) {
  if (sincronizado) { fn(); return; }
  pendientes = [fn];
}

export const soyElAnfitrion = () =>
  !!sala.anfitrion && sala.anfitrion === idSocket();

export function reclamarAnfitrion() {
  quiereSerAnfitrion = true;
  mandar('musica:reclamar');
}

export function soltarAnfitrion() {
  quiereSerAnfitrion = false;
  mandar('musica:soltar');
}

/** Desde un teléfono: que el altavoz haga algo */
export function ordenar(accion: OrdenMusica, valor?: any) {
  mandar('musica:mando', { accion, valor: valor ?? null });
}

/**
 * Desde un mando: esta es la cola que debe sonar en el salón.
 *
 * Hace falta porque el altavoz puede ser una ventana pública sin sesión, que
 * no tiene forma de pedirle la cola a nadie. Quien sí tiene sesión se la
 * empuja: el teléfono decide, la pantalla suena.
 */
export function enviarCola(cola: PistaSala[], indice: number) {
  mandar('musica:cola', { cola, indice });
}

/** Desde el anfitrión: contar qué está sonando */
export function publicarEstado(x: Partial<EstadoSala>) {
  mandar('musica:estado', x);
}

export function suscribir(fn: () => void) {
  oyentes.add(fn);
  return () => { oyentes.delete(fn); };
}

/** Lo que usan las pantallas */
export function useMusicaSala() {
  const [, redibujar] = useState(0);
  useEffect(() => suscribir(() => redibujar(n => n + 1)), []);
  return {
    sala,
    puedoMandar,
    sincronizado,
    sincronizando: estaSincronizando(),
    hayAnfitrion: !!sala.anfitrion,
    soyAnfitrion: soyElAnfitrion(),
    reclamar: reclamarAnfitrion,
    soltar: soltarAnfitrion,
    ordenar,
  };
}
