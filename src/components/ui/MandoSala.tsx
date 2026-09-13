import React, { useEffect, useRef, useState } from 'react';
import {
  Speaker, Play, Pause, SkipForward, SkipBack, Volume2, RadioTower, LogOut,
  Loader2, Tv, Maximize2, Minimize2,
} from 'lucide-react';
import { useMusicaSala } from '../../services/musica';
import {
  encenderMandoSistema, actualizarMandoSistema, apagarMandoSistema,
} from '../../utils/mandoSistema';

/**
 * El mando de la música del salón.
 *
 * Tres estados, y cada uno enseña una sola cosa:
 *
 *   · Nadie suena  → un botón para que suene AQUÍ.
 *   · Sueno yo     → aviso de que este aparato es el altavoz, y cómo dejarlo.
 *   · Suena otro   → los controles, que van por el socket al que sí suena.
 *
 * Lo que NO hace: mezclar. Cuando el altavoz es otro aparato, los botones de
 * esta pantalla dejan de tocar el audio local — pulsar "siguiente" en el
 * teléfono tiene que cambiar la canción del salón, no la del teléfono.
 */
export const MandoSala: React.FC = () => {
  const {
    sala, puedoMandar, sincronizando, hayAnfitrion, soyAnfitrion,
    reclamar, soltar, ordenar,
  } = useMusicaSala();

  /**
   * ── Respuesta inmediata ──────────────────────────────────────────
   *
   * Un mando que espera a que el televisor conteste se siente roto, aunque
   * tarde dos décimas: arrastras el volumen y la barra no se mueve. Así que
   * lo que tocas se pinta AQUÍ al instante y la orden viaja por detrás.
   *
   * Lo que pinta el mando mientras tanto es esa intención, no el estado del
   * salón — pero solo un rato. En cuanto el televisor confirma (o pasan dos
   * segundos sin confirmar) se suelta y vuelve a mandar la verdad: si la
   * orden se perdió, la barra tiene que volver a donde está de verdad el
   * volumen, no quedarse mintiendo donde la dejó el dedo.
   */
  const [volumenLocal, setVolumenLocal] = useState<number | null>(null);
  const [sonandoLocal, setSonandoLocal] = useState<boolean | null>(null);
  const relojVolumen = useRef(0);
  const relojSonando = useRef(0);
  const ultimoEnvio = useRef(0);
  const envioPendiente = useRef(0);

  // El televisor confirmó: se suelta la intención y manda lo real otra vez
  useEffect(() => {
    if (volumenLocal !== null && Math.abs(sala.volumen - volumenLocal) <= 2) {
      setVolumenLocal(null);
    }
  }, [sala.volumen]);

  useEffect(() => {
    if (sonandoLocal !== null && sala.sonando === sonandoLocal) setSonandoLocal(null);
  }, [sala.sonando]);

  useEffect(() => () => {
    window.clearTimeout(relojVolumen.current);
    window.clearTimeout(relojSonando.current);
    window.clearTimeout(envioPendiente.current);
  }, []);

  /**
   * Arrastrar el volumen dispara decenas de cambios por segundo. Se pinta
   * cada uno —eso es lo que hace que la barra se sienta local— pero al
   * socket solo sale uno cada ciento veinte milisegundos, más SIEMPRE el
   * último: sin ese último, soltar el dedo dejaría el salón en el volumen
   * de hace un instante, no en el que elegiste.
   */
  const mandarVolumen = (v: number) => {
    setVolumenLocal(v);
    window.clearTimeout(relojVolumen.current);
    relojVolumen.current = window.setTimeout(() => setVolumenLocal(null), 2000);

    const ahora = Date.now();
    window.clearTimeout(envioPendiente.current);
    if (ahora - ultimoEnvio.current >= 120) {
      ultimoEnvio.current = ahora;
      ordenar('volumen', v);
    } else {
      envioPendiente.current = window.setTimeout(() => {
        ultimoEnvio.current = Date.now();
        ordenar('volumen', v);
      }, 120);
    }
  };

  const alternarSonido = () => {
    const queremos = !(sonandoLocal ?? sala.sonando);
    setSonandoLocal(queremos);
    window.clearTimeout(relojSonando.current);
    relojSonando.current = window.setTimeout(() => setSonandoLocal(null), 2000);
    ordenar(queremos ? 'play' : 'pause');
  };

  const sonando = sonandoLocal ?? sala.sonando;
  const volumen = volumenLocal ?? sala.volumen;

  /**
   * Los controles en la pantalla de bloqueo del teléfono.
   *
   * Se encienden con el primer toque en cualquier botón del mando —hace
   * falta un gesto para que el sistema deje reproducir el audio que los
   * sostiene— y se apagan en cuanto este teléfono deja de ser un mando:
   * unos botones de "siguiente canción" en el bloqueo de alguien que ya no
   * controla nada son una promesa falsa.
   */
  const esMando = hayAnfitrion && !soyAnfitrion;

  useEffect(() => {
    if (!esMando) apagarMandoSistema();
    return () => { if (!esMando) apagarMandoSistema(); };
  }, [esMando]);

  useEffect(() => {
    if (!esMando) return;
    actualizarMandoSistema({
      titulo: sala.pista?.titulo,
      artista: sala.pista?.artista,
      portada: sala.pista?.portada,
      sonando,
    });
  }, [esMando, sala.pista?.videoId, sala.pista?.titulo, sonando]);

  /** Todo botón del mando enciende de paso los controles del sistema */
  const conGesto = (fn: () => void) => () => { encenderMandoSistema(); fn(); };

  if (!puedoMandar) return null;

  const marco =
    'rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/70 backdrop-blur px-4 py-3';

  /* ── Todavía no sabemos qué pasa en el salón ──────────────────────
     Medio segundo, pero es el medio segundo en el que alguien pulsa play.
     Decirlo es mejor que enseñar "nadie pone música" y desdecirse: lo
     primero es esperar, lo segundo es equivocarse en voz alta. */
  if (sincronizando) {
    return (
      <div className={`${marco} flex items-center gap-3`}>
        <Loader2 className="w-5 h-5 text-[var(--primary)] animate-spin shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            Sincronizando con el salón…
          </div>
          <div className="text-[11px] text-slate-500 dark:text-neutral-400">
            Comprobando qué aparato está poniendo la música
          </div>
        </div>
      </div>
    );
  }

  // ── Nadie es el altavoz todavía ────────────────────────────────────
  if (!hayAnfitrion) {
    return (
      <div className={`${marco} flex items-center gap-3`}>
        <Speaker className="w-5 h-5 text-slate-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            La música suena en este aparato
          </div>
          <div className="text-[11px] text-slate-500 dark:text-neutral-400">
            Para que suene en el televisor, abre allí el reproductor del salón
            — el enlace está en Ajustes, junto al de la pantalla de turnos.
          </div>
        </div>
        <button
          onClick={reclamar}
          className="shrink-0 px-3 py-2 rounded-xl bg-[var(--primary)] text-white text-xs font-bold hover:opacity-90 transition cursor-pointer"
        >
          Que suene aquí
        </button>
      </div>
    );
  }

  // ── Este aparato ES el altavoz ─────────────────────────────────────
  if (soyAnfitrion) {
    return (
      <div className={`${marco} flex items-center gap-3`}>
        <span className="relative flex w-2.5 h-2.5 shrink-0">
          <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
          <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-emerald-500" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            La música sale de este aparato
          </div>
          <div className="text-[11px] text-slate-500 dark:text-neutral-400">
            Los demás teléfonos pueden controlarla desde aquí
          </div>
        </div>
        <button
          onClick={soltar}
          className="shrink-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-neutral-800 transition cursor-pointer flex items-center gap-1.5"
          title="Dejar de ser el altavoz"
        >
          <LogOut className="w-3.5 h-3.5" /> Dejar
        </button>
      </div>
    );
  }

  // ── Suena en otro aparato: esto es un mando a distancia ────────────
  const p = sala.pista;
  const pct = sala.duracion > 0 ? Math.min(100, (sala.posicion / sala.duracion) * 100) : 0;
  const boton =
    'w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer shrink-0';

  return (
    <div className={marco}>
      <div className="flex items-center gap-2 mb-2.5">
        <RadioTower className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--primary)]">
          Sonando en {sala.nombre || 'otro aparato'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {p?.portada ? (
          <img src={p.portada} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
            <Speaker className="w-5 h-5 text-slate-400" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {p?.titulo || 'Sin canción'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-neutral-400 truncate">
            {p?.artista || '—'}
          </div>
          {sala.duracion > 0 && (
            <div className="mt-1.5 h-1 rounded-full bg-slate-200 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-[var(--primary)] transition-[width] duration-1000 ease-linear"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 mt-3">
        <button
          onClick={conGesto(() => ordenar('prev'))}
          className={`${boton} text-slate-500 hover:bg-slate-100 dark:hover:bg-neutral-800`}
          title="Anterior"
        >
          <SkipBack className="w-5 h-5 fill-current" />
        </button>
        <button
          onClick={conGesto(alternarSonido)}
          className={`${boton} w-12 h-12 bg-[var(--primary)] text-white hover:opacity-90`}
          title={sonando ? 'Pausar' : 'Reproducir'}
        >
          {sonando
            ? <Pause className="w-5 h-5 fill-current" />
            : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>
        <button
          onClick={conGesto(() => ordenar('next'))}
          className={`${boton} text-slate-500 hover:bg-slate-100 dark:hover:bg-neutral-800`}
          title="Siguiente"
        >
          <SkipForward className="w-5 h-5 fill-current" />
        </button>
      </div>

      {/* ── Cómo se ve allá ─────────────────────────────────────────
          En un televisor colgado no hay ratón ni teclado, y la clienta no se
          va a levantar de la silla: si esto no se puede mandar desde aquí,
          no se puede hacer. */}
      <div className="flex items-center gap-1.5 mt-3">
        <Tv className="w-4 h-4 text-slate-400 shrink-0" />
        <button
          onClick={() => ordenar('video', true)}
          className="flex-1 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 text-[10px] font-bold text-slate-600 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700 transition cursor-pointer flex items-center justify-center gap-1"
          title="Poner el vídeo en grande en la pantalla del salón"
        >
          <Maximize2 className="w-3 h-3" /> Vídeo
        </button>
        <button
          onClick={() => ordenar('video', false)}
          className="flex-1 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 text-[10px] font-bold text-slate-600 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700 transition cursor-pointer flex items-center justify-center gap-1"
          title="Quitar el vídeo y volver a los turnos"
        >
          <Minimize2 className="w-3 h-3" /> Turnos
        </button>
        {/* Se pintan según lo que el televisor DICE que pasó, no según lo
            que se pidió: la pantalla completa se solicita y el navegador
            puede negarla. Si tras pulsar ⛶ el botón no se enciende, el
            televisor la rechazó — y eso es información, no un botón roto. */}
        <button
          onClick={() => ordenar('pantalla', true)}
          className={`px-2.5 py-1.5 rounded-lg text-[12px] font-bold transition cursor-pointer ${
            sala.completa
              ? 'bg-[var(--primary)] text-white'
              : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700'
          }`}
          title="Pantalla completa del navegador en el televisor"
        >
          ⛶
        </button>
        <button
          onClick={() => ordenar('pantalla', false)}
          className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 text-[12px] font-bold text-slate-600 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700 transition cursor-pointer"
          title="Salir de la pantalla completa del navegador en el televisor"
        >
          ⤢
        </button>
      </div>
      {/* Hay que decirlo, porque si no parece un botón roto: la pantalla
          completa DEL NAVEGADOR (la que esconde la barra de direcciones) la
          conceden casi todos los navegadores solo a un toque reciente en ese
          mismo aparato. Pedida desde aquí, algunos televisores la aceptan y
          otros la ignoran sin decir nada. "Vídeo" sí funciona siempre: es
          una capa nuestra, no una función del navegador. */}
      <p className="text-[9px] text-slate-400 mt-1.5 leading-relaxed">
        ⛶ esconde la barra del navegador y se enciende si el televisor aceptó.
        Muchos la rechazan —solo la conceden a un toque hecho allí mismo—: para
        dejarla fija, instala la pantalla como aplicación en ese aparato
        (menú del navegador → «Instalar»), y abrirá sin barra siempre.
      </p>

      <div className="flex items-center gap-2.5 mt-3">
        <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="range" min={0} max={100} value={volumen}
          onChange={e => mandarVolumen(Number(e.target.value))}
          className="flex-1 accent-[var(--primary)] cursor-pointer"
        />
        <span className="text-[10px] text-slate-400 w-7 text-right tabular-nums">
          {Math.round(volumen)}
        </span>
      </div>
    </div>
  );
};
