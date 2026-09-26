import React, { useEffect, useState } from 'react';
import {
  Speaker, Tv, Smartphone, Laptop, Loader2, RadioTower, SlidersHorizontal,
  Volume2, VolumeX, Crosshair, ChevronDown,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  useMusicaSala, activarAltavoz, soloEsteAltavoz, ajustarAltavoz, silenciarAltavoz,
  estadoMusica, ordenar, AltavozInfo,
} from '../../services/musica';
import { posicionObjetivo } from '../../utils/seguirLider';
import { actualizarMandoSistema, apagarMandoSistema } from '../../utils/mandoSistema';

/**
 * Dónde suena la música del salón.
 *
 * Cada aparato que puede sonar —la pantalla de turnos, el reproductor de un
 * televisor, esta misma app en un teléfono o un portátil— aparece en una
 * lista y se elige en cuál suena.
 *
 * ── Por qué de momento suena en UNO solo ─────────────────────────────
 *
 * El sistema sabe hacer sonar varios a la vez y arrancarlos juntos, pero no
 * sabe MANTENERLOS juntos: al cabo de un minuto se separan y no hay forma de
 * volver a juntarlos sin que se note. YouTube solo acepta velocidades fijas
 * (0,5, 1, 1,25…), así que no se puede corregir la deriva estirando un pelo
 * la reproducción; lo único que queda es saltar, y un salto se oye. Hasta
 * resolver eso, encender un aparato apaga los demás: es mejor una sola
 * música bien que dos peleándose.
 *
 * Todo lo de varios altavoces sigue montado detrás de `VARIOS_ALTAVOCES`.
 * Cuando la deriva esté resuelta se enciende y vuelven los interruptores
 * independientes, el "solo imagen" y el ajuste fino.
 */
const VARIOS_ALTAVOCES: boolean = false;

/** Se recuerda plegada o desplegada; en el móvil ocupa cabecera, que es cara */
const CLAVE_ABIERTO = 'lalan_altavoces_abierto';

const icono = (a: AltavozInfo) =>
  a.tipo === 'app'
    ? (/iPhone|Android|iPad/.test(a.nombre) ? Smartphone : Laptop)
    : Tv;

export const MandoSala: React.FC = () => {
  const {
    sala, puedoMandar, sincronizando, hayAnfitrion, soyAnfitrion, yo, altavoces,
  } = useMusicaSala();
  const { ytPlayerRef } = useApp();
  const [ajustando, setAjustando] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(() => {
    try { return localStorage.getItem(CLAVE_ABIERTO) === '1'; } catch { return false; }
  });

  const alternarPanel = () => setAbierto(v => {
    try { localStorage.setItem(CLAVE_ABIERTO, v ? '0' : '1'); } catch { /* noop */ }
    return !v;
  });

  const sonando = sala.sonando;
  const activos = altavoces.filter(a => a.activo);
  const encendidos = activos.length;
  const conSonido = activos.filter(a => !a.silencioso).length;

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
    'rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/70 backdrop-blur';

  /* ── Todavía no sabemos qué pasa en el salón ──────────────────────
     Medio segundo, pero es el medio segundo en el que alguien pulsa play.
     Decirlo es mejor que enseñar una lista vacía y desdecirse. */
  if (sincronizando) {
    return (
      <div className={`${marco} px-3 py-2.5 flex items-center gap-2.5`}>
        <Loader2 className="w-4 h-4 text-[var(--primary)] animate-spin shrink-0" />
        <span className="text-xs font-semibold text-slate-600 dark:text-neutral-300">
          Buscando los altavoces del salón…
        </span>
      </div>
    );
  }

  /** Elegir dónde suena. Con un solo altavoz, encender uno apaga los demás. */
  const alternar = (a: AltavozInfo) => {
    const encender = !a.activo;
    /* Encender ESTE aparato es un toque del usuario: se aprovecha para
       desbloquear el audio del navegador, que si no lo bloquea al arrancar
       solo. Solo si ya suena algo; si el salón está en pausa no se
       arranca nada. */
    if (encender && a.id === yo && estadoMusica().sonando) {
      try { ytPlayerRef?.current?.playVideo?.(); } catch { /* noop */ }
    }
    if (!encender) { activarAltavoz(a.id, false); return; }
    if (VARIOS_ALTAVOCES) activarAltavoz(a.id, true);
    else soloEsteAltavoz(a.id);
  };

  /**
   * Volver a alinear: se manda a todos al segundo en el que va la canción,
   * con la hora común de siempre. Sirve para oír el efecto de un ajuste sin
   * esperar a la próxima canción.
   */
  const realinear = () => ordenar('seek', Math.round(posicionObjetivo(sala) * 100) / 100);

  // ── La línea de siempre: dónde suena, en una frase ──────────────────
  const resumen = () => {
    if (!altavoces.length) return 'Ningún aparato listo para sonar';
    if (!encendidos) return 'La música no suena en ningún aparato';
    if (encendidos === 1) {
      const a = activos[0];
      return `Suena en ${a.nombre}${a.id === yo ? ' (este aparato)' : ''}`;
    }
    return `Suena en ${encendidos} aparatos`;
  };

  const fila = (a: AltavozInfo) => {
    const Icono = icono(a);
    const esYo = a.id === yo;
    const desplegado = ajustando === a.id;
    const puedeAjustar = VARIOS_ALTAVOCES && a.activo && !a.lider && !a.silencioso && encendidos > 1;
    const total = a.retardoMs + a.autoMs;

    return (
      <li key={a.id} className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            a.activo
              ? 'bg-[var(--primary)]/15 text-[var(--primary)]'
              : 'bg-slate-100 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500'
          }`}>
            <Icono className="w-4 h-4" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">{a.nombre}</span>
              {esYo && (
                <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400">
                  Este aparato
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-neutral-400 flex items-center gap-1.5 flex-wrap">
              {a.activo ? (
                a.silencioso ? (
                  <span className="inline-flex items-center gap-1 font-medium">
                    <VolumeX className="w-3 h-3" /> Solo imagen
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="relative flex w-1.5 h-1.5">
                      {sonando && <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping" />}
                      <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </span>
                    {sonando ? 'Sonando' : 'Encendido'}
                  </span>
                )
              ) : (
                <span>Apagado</span>
              )}
              {VARIOS_ALTAVOCES && a.lider && encendidos > 1 && (
                <span className="inline-flex items-center gap-1" title="Los demás se ajustan a este">
                  <RadioTower className="w-3 h-3" /> Marca el ritmo
                </span>
              )}
              {VARIOS_ALTAVOCES && total !== 0 && a.activo && !a.lider && (
                <span>· {total > 0 ? '+' : ''}{total} ms</span>
              )}
            </div>
          </div>

          {/* Solo imagen: quitarle el sonido a esta pantalla sin apagarla */}
          {VARIOS_ALTAVOCES && a.activo && (
            <button
              type="button"
              onClick={() => silenciarAltavoz(a.id, !a.silencioso)}
              aria-pressed={a.silencioso}
              title={a.silencioso ? 'Devolverle el sonido' : 'Dejarlo en solo imagen'}
              className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer ${
                a.silencioso
                  ? 'bg-slate-100 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500'
                  : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
              }`}
            >
              {a.silencioso ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}

          {/* El interruptor: lo único que hace falta para decidir dónde suena */}
          <button
            type="button" role="switch" aria-checked={a.activo}
            aria-label={`${a.activo ? 'Apagar' : 'Que la música suene en'} ${a.nombre}`}
            onClick={() => alternar(a)}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors cursor-pointer ${
              a.activo ? 'bg-[var(--primary)]' : 'bg-slate-300 dark:bg-neutral-700'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              a.activo ? 'translate-x-5' : ''
            }`} />
          </button>
        </div>

        {puedeAjustar && (
          <div className="mt-2 pl-[2.6rem]">
            <button
              type="button" onClick={() => setAjustando(desplegado ? null : a.id)}
              className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400 hover:text-[var(--primary)] transition cursor-pointer inline-flex items-center gap-1"
              aria-expanded={desplegado}
            >
              <SlidersHorizontal className="w-3 h-3" /> Ajuste fino
            </button>
          </div>
        )}

        {desplegado && puedeAjustar && (
          <div className="mt-2 ml-[2.6rem] rounded-xl bg-slate-50 dark:bg-neutral-800/60 px-3 py-2.5">
            <p className="text-[11px] text-slate-500 dark:text-neutral-400 leading-snug mb-2">
              Este aparato ya se corrige solo
              {a.autoMs !== 0 && <> (lleva medidos <b>{a.autoMs > 0 ? '+' : ''}{a.autoMs} ms</b>)</>}.
              Usa esto solo si aun así lo oyes desfasado: si va <b>detrás</b>, sube; si va <b>delante</b>, baja.
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[-100, -20].map(d => (
                <button key={d} type="button" onClick={() => ajustarAltavoz(a.id, a.retardoMs + d)}
                  className="px-2 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 cursor-pointer active:scale-95 transition">
                  {d}
                </button>
              ))}
              <span className="min-w-[4.5rem] text-center text-xs font-bold tabular-nums text-slate-900 dark:text-white">
                {a.retardoMs > 0 ? '+' : ''}{a.retardoMs} ms
              </span>
              {[20, 100].map(d => (
                <button key={d} type="button" onClick={() => ajustarAltavoz(a.id, a.retardoMs + d)}
                  className="px-2 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 cursor-pointer active:scale-95 transition">
                  +{d}
                </button>
              ))}
              {a.retardoMs !== 0 && (
                <button type="button" onClick={() => ajustarAltavoz(a.id, 0)}
                  className="ml-auto text-[11px] font-semibold text-slate-500 dark:text-neutral-400 hover:text-[var(--primary)] cursor-pointer">
                  Quitar
                </button>
              )}
            </div>
            <button
              type="button" onClick={realinear}
              className="mt-2 w-full py-1.5 rounded-lg text-[11px] font-bold bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 transition cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <Crosshair className="w-3 h-3" /> Volver a alinear y escuchar
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <section className={marco} aria-label="Altavoces del salón">
      {/* Plegada es UNA línea. Esta tarjeta vive en la cabecera fija, que en
          un móvil es casi toda la pantalla: desplegada por defecto no dejaba
          sitio para el reproductor. */}
      <button
        type="button"
        onClick={alternarPanel}
        aria-expanded={abierto}
        className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left cursor-pointer"
      >
        <Speaker className={`w-4 h-4 shrink-0 ${
          encendidos ? 'text-[var(--primary)]' : 'text-slate-400 dark:text-neutral-500'
        }`} />
        <span className="min-w-0 flex-1 text-[13px] font-semibold text-slate-900 dark:text-white truncate">
          {resumen()}
        </span>
        {!abierto && altavoces.length > 1 && (
          <span className="shrink-0 text-[11px] text-slate-400 dark:text-neutral-500">Cambiar</span>
        )}
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 dark:text-neutral-500 transition-transform ${
          abierto ? 'rotate-180' : ''
        }`} />
      </button>

      {abierto && (
        altavoces.length === 0 ? (
          <p className="px-3 pb-3 text-[11px] text-slate-500 dark:text-neutral-400 leading-snug">
            Abre la pantalla de turnos o el reproductor del salón en el
            televisor (el enlace está en Ajustes) y aparecerá aquí para poder
            mandarle la música.
          </p>
        ) : (
          <>
            {/* Aunque esté desplegada no puede comerse la pantalla */}
            <ul className="border-t border-slate-100 dark:border-neutral-800 divide-y divide-slate-100 dark:divide-neutral-800 max-h-[40vh] overflow-y-auto">
              {altavoces.map(fila)}
            </ul>
            <div className="px-3 py-2 border-t border-slate-100 dark:border-neutral-800 flex items-center gap-3 flex-wrap">
              <p className="text-[11px] text-slate-400 dark:text-neutral-500 leading-snug flex-1 min-w-[12rem]">
                {VARIOS_ALTAVOCES
                  ? (conSonido > 1
                      ? 'Varios altavoces en la misma sala se oyen con eco. Para varias pantallas, deja el sonido en una y pon las demás en solo imagen.'
                      : 'Los encendidos arrancan a la vez y se corrigen solos.')
                  : 'La música suena en un aparato a la vez: al encender uno se apaga el anterior.'}
              </p>
              {VARIOS_ALTAVOCES && encendidos > 1 && sonando && (
                <button
                  type="button" onClick={realinear}
                  className="shrink-0 text-[11px] font-semibold text-slate-500 dark:text-neutral-400 hover:text-[var(--primary)] transition cursor-pointer inline-flex items-center gap-1"
                >
                  <Crosshair className="w-3 h-3" /> Volver a alinear
                </button>
              )}
            </div>
          </>
        )
      )}
    </section>
  );
};
