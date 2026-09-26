import { useEffect, useState } from 'react';
import { alRecibir, alConectar, alDesconectar, mandar, mandarConRespuesta, idSocket } from './socket';

/**
 * La música del salón, compartida entre aparatos.
 *
 * ── Los papeles ─────────────────────────────────────────────────────
 *
 *   ALTAVOZ    un aparato que suena. Puede haber VARIOS encendidos a la vez
 *              (dos televisores, el mostrador, una tablet): cada uno
 *              reproduce por su cuenta la misma canción.
 *   LÍDER      uno de los altavoces encendidos marca el ritmo: publica qué
 *              suena y en qué segundo va, y obedece las órdenes que mueven
 *              la cola. Los demás lo SIGUEN, y se corrigen si se separan.
 *   MANDO      los teléfonos con permiso: mandan, y encienden o apagan
 *              altavoces desde la lista.
 *   PANTALLA   la pared. Si su sede lo pide, es un altavoz más.
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
  /** Si la pidió una clienta desde el QR: su id y el nombre con que la dedicó */
  peticionId?: string | null;
  pidio?: string | null;
}

export type TipoAltavoz = 'pantalla' | 'reproductor' | 'app';

/** Un aparato que puede sonar, tal como lo cuenta el servidor */
export interface AltavozInfo {
  /** Identidad estable del aparato (no cambia al reconectar) */
  id: string;
  nombre: string;
  tipo: TipoAltavoz;
  activo: boolean;
  lider: boolean;
  /** Ajuste fino A MANO, en ms. Positivo = suena tarde: se le adelanta */
  retardoMs: number;
  /** Lo que el propio aparato midió que va por detrás (se calibra solo) */
  autoMs: number;
  /** Solo imagen: enseña el vídeo pero no suena */
  silencioso: boolean;
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
  /** Cuándo (reloj del servidor, ms) se midió `posicion` */
  posicionEn: number;
  altavoces: AltavozInfo[];
  servidor: number;
}

export type OrdenMusica =
  | 'play' | 'pause' | 'next' | 'prev' | 'seek' | 'volumen' | 'pista'
  /** Cómo se VE en la pantalla del salón, no qué suena */
  | 'video' | 'pantalla';

const VACIO: EstadoSala = {
  anfitrion: null, nombre: null, sonando: false, pista: null,
  posicion: 0, duracion: 0, volumen: 80, cola: [], indice: 0,
  completa: false, actualizado: '', posicionEn: 0, altavoces: [], servidor: 0,
};

let sala: EstadoSala = VACIO;
let arrancado = false;

/**
 * Cómo se ofrece ESTE aparato como altavoz. Se guarda la INTENCIÓN, no el
 * hecho: el servidor identifica cada conexión por un id que cambia en cada
 * reconexión, y un wifi que parpadea no puede dejar al aparato fuera de la
 * lista. Al reconectar se vuelve a ofrecer solo.
 */
let oferta: { tipo: TipoAltavoz; nombre: string; suave: boolean } | null = null;

/**
 * Identidad estable de ESTE aparato como altavoz (no del socket). Con ella un
 * televisor que vuelve tras un corte de wifi sigue siendo el mismo —conserva
 * su interruptor y su ajuste—, y un teléfono distinto nunca lo suplanta.
 */
export function dispositivoPropio(): string {
  const K = 'lalan_altavoz_dispositivo';
  try {
    let v = localStorage.getItem(K);
    if (!v) {
      v = (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/[^\w-]/g, '').slice(0, 64);
      localStorage.setItem(K, v);
    }
    return v;
  } catch {
    // Sin almacenamiento (modo privado): un id por carga de página
    return idEfimero;
  }
}
const idEfimero = `s${Math.random().toString(36).slice(2, 14)}`;

/** "iPhone", "Android", "Windows"…: para que la lista diga QUÉ aparato es */
export function nombreDelAparato(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return /TV|AFT|BRAVIA|SmartTV/i.test(ua) ? 'Android TV' : 'Android';
  if (/SmartTV|Tizen|Web0S|WebOS|BRAVIA|HbbTV/i.test(ua)) return 'Smart TV';
  if (/CrOS/.test(ua)) return 'Chromebook';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Aparato';
}

const enviarOferta = () => {
  if (!oferta) return;
  mandar('musica:altavoz', { dispositivo: dispositivoPropio(), ...oferta });
};

/**
 * Ofrecer este aparato como altavoz.
 *
 * NO lo enciende, salvo `suave` y con la sede en silencio: una pantalla que se
 * abre sola nunca le quita el sitio a la que ya suena. Aparece en la lista de
 * altavoces y quien manda decide si suena.
 */
export function registrarAltavoz(tipo: TipoAltavoz, opciones: { suave?: boolean; nombre?: string } = {}) {
  const nombre = opciones.nombre
    ?? `${tipo === 'pantalla' ? 'Pantalla' : tipo === 'reproductor' ? 'Reproductor' : 'App'} · ${nombreDelAparato()}`;
  const nueva = { tipo, nombre, suave: !!opciones.suave };
  if (oferta && oferta.tipo === nueva.tipo && oferta.nombre === nueva.nombre && oferta.suave === nueva.suave) {
    enviarOferta();   // idempotente: reenviar es barato y arregla un mensaje perdido
    return;
  }
  oferta = nueva;
  enviarOferta();
}

// ── Reloj ─────────────────────────────────────────────────────────────
//
// Los aparatos no tienen la misma hora. Para que "hazlo a las 12:00:00.400"
// signifique lo mismo en todos se mide cuánto se adelanta o atrasa el reloj
// de este aparato respecto al del servidor: cinco pings, y se queda el más
// rápido (el de menos viaje es el menos contaminado por la red).

let desfaseReloj = 0;
let midiendoReloj = false;

export const ahoraServidor = () => Date.now() + desfaseReloj;

async function medirReloj() {
  if (midiendoReloj) return;
  midiendoReloj = true;
  try {
    let mejor: { rtt: number; desfase: number } | null = null;
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now();
      const r = await mandarConRespuesta<{ t: number }>('reloj:ping', {});
      const t1 = Date.now();
      if (!r || !Number.isFinite(r.t)) continue;
      const rtt = t1 - t0;
      if (!mejor || rtt < mejor.rtt) mejor = { rtt, desfase: r.t - (t0 + t1) / 2 };
    }
    if (mejor) desfaseReloj = mejor.desfase;
  } finally { midiendoReloj = false; }
}

/**
 * Ejecutar algo a la hora del servidor `en` (ms). Sin hora, o ya pasada, o
 * absurdamente lejana, se hace ahora: mejor un poco tarde que nunca.
 */
export function programar(en: any, fn: () => void): void {
  const t = Number(en);
  if (!Number.isFinite(t) || t <= 0) { fn(); return; }
  const espera = t - ahoraServidor();
  if (espera <= 0 || espera > 5000) { fn(); return; }
  window.setTimeout(fn, espera);
}

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
    enviarOferta();
    void medirReloj();
  });
  // El reloj de un aparato deriva: se vuelve a medir de vez en cuando
  window.setInterval(() => { void medirReloj(); }, 60_000);

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

/** Este aparato deja de sonar (apaga su propio interruptor) */
export function dejarDeSonar() {
  mandar('musica:soltar');
}

/** Un mando enciende o apaga un altavoz de la lista */
export function activarAltavoz(dispositivo: string, activo: boolean, siLibre = false) {
  mandar('musica:activar', { dispositivo, activo, siLibre });
}

/** Un mando deja sonando solo a este altavoz */
export function soloEsteAltavoz(dispositivo: string) {
  mandar('musica:activar', { dispositivo, solo: true });
}

/** Ajuste fino A MANO de un altavoz que va un poco adelantado o atrasado */
export function ajustarAltavoz(dispositivo: string, retardoMs: number) {
  mandar('musica:ajuste', { dispositivo, retardoMs });
}

/** Solo imagen: este altavoz enseña el vídeo pero no suena */
export function silenciarAltavoz(dispositivo: string, silencioso: boolean) {
  mandar('musica:silencio', { dispositivo, silencioso });
}

/** Este aparato cuenta lo que ha medido que va por detrás (calibración sola) */
export function calibrarme(autoMs: number) {
  mandar('musica:calibrar', { autoMs });
}

/** ¿Este aparato está ENCENDIDO en la lista? (líder o seguidor) */
export const soyAltavoz = () => {
  const yo = dispositivoPropio();
  return sala.altavoces.some(a => a.id === yo && a.activo);
};

const yoEnLaLista = () => sala.altavoces.find(a => a.id === dispositivoPropio());

/**
 * Lo que este aparato tiene que adelantarse, en ms: lo que midió solo más lo
 * que le puso a mano quien manda. Es lo que se suma a su posición.
 */
export const miAjusteMs = () => {
  const yo = yoEnLaLista();
  return (yo?.autoMs ?? 0) + (yo?.retardoMs ?? 0);
};

/** Lo que este aparato ha medido solo que va por detrás, en ms */
export const miAutoMs = () => yoEnLaLista()?.autoMs ?? 0;

/** Este aparato está puesto como "solo imagen" */
export const miSilencio = () => !!yoEnLaLista()?.silencioso;

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
    /** Soy el LÍDER: el que marca el ritmo y publica qué suena */
    soyAnfitrion: soyElAnfitrion(),
    /** Estoy encendido en la lista (líder o seguidor): este aparato suena */
    soyAltavoz: soyAltavoz(),
    /** Este aparato está en "solo imagen": sigue la canción pero no suena */
    silencioso: miSilencio(),
    yo: dispositivoPropio(),
    altavoces: sala.altavoces,
    soltar: dejarDeSonar,
    ordenar,
  };
}
