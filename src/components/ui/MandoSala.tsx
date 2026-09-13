import React, { useEffect } from 'react';
import { Speaker, RadioTower, LogOut, Loader2 } from 'lucide-react';
import { useMusicaSala } from '../../services/musica';
import { actualizarMandoSistema, apagarMandoSistema } from '../../utils/mandoSistema';

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
    reclamar, soltar,
  } = useMusicaSala();

  /* Lo que suena manda el estado del salón directamente: aquí ya no hay
     transporte ni volumen que necesiten respuesta optimista. Eso vive ahora
     en el reproductor, que es donde está la mano del usuario. */
  const sonando = sala.sonando;

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

  // ── Suena en otro aparato ──────────────────────────────────────────
  /**
   * Una línea, y nada más.
   *
   * Todo lo que se hace con la música —elegir, avanzar, volumen, poner el
   * vídeo en grande— vive en el reproductor de abajo, que es donde está la
   * mano del usuario. Repetir aquí esos botones obligaba a recordar en cuál
   * de las dos tarjetas estaba cada cosa. Aquí solo queda el dato que el
   * reproductor no puede dar: dónde está sonando.
   */
  return (
    <div className={`${marco} flex items-center gap-2`}>
      <RadioTower className="w-4 h-4 text-[var(--primary)] shrink-0" />
      <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--primary)] truncate">
        Sonando en {sala.nombre || 'la pantalla del salón'}
      </span>
      <span className="ml-auto text-[10px] text-slate-400 dark:text-neutral-500 shrink-0">
        Se controla desde el reproductor
      </span>
    </div>
  );
};
