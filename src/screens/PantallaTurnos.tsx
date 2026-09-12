import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { publicFetch } from '../services/api';
import { conectarComoPantalla, desconectar, alRecibir, estaConectado } from '../services/socket';
import {
  activarSonido, sonidoListo, campanaDeLlamada, tinDeCambio, decir, fraseDeTurno, callar,
} from '../utils/campana';

/**
 * Red de seguridad, no el mecanismo principal.
 *
 * Lo que manda ahora es el socket: el servidor avisa y la pantalla vuelve a
 * pedir. Este intervalo existe porque un socket se cae sin avisar —el wifi
 * del local, un proxy, el navegador viejo de una smart TV— y una pared
 * congelada sin que nadie lo note es peor que una que tarda medio minuto.
 */
const REFRESCO_MS = 30000;

interface TurnoPublico {
  id: string;
  code: string;
  nombre: string;
  zona: string | null;
  color: string | null;
  destino: string | null;
  desde: string;
}

interface Pantalla {
  salon: string;
  sede?: string;
  /** Cómo tiene que anunciar ESTA pared; lo decide la sede desde Ajustes */
  anuncio?: { modo: 'tono' | 'voz' | 'ambos' | 'mudo'; voz: string | null };
  actualizado: string;
  zonas: { id: string; name: string; prefix: string; color: string | null }[];
  llamando: TurnoPublico[];
  atendiendo: TurnoPublico[];
  esperando: TurnoPublico[];
}

const laHora = () =>
  new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

/**
 * La pantalla de pared.
 *
 * Se mira de pie y de lejos, así que casi todo aquí es tamaño: el código del
 * turno manda sobre todo lo demás, el nombre va debajo y el destino —a dónde
 * tiene que ir— al lado. Nada que haya que leer de cerca.
 *
 * No tiene sesión ni menú a propósito. Es una URL con un token y nada más;
 * quien la abra no puede navegar a ninguna otra parte del sistema.
 */
export const PantallaTurnos: React.FC<{ token: string }> = ({ token }) => {
  const [datos, setDatos] = useState<Pantalla | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hora, setHora] = useState(laHora);
  const [enVivo, setEnVivo] = useState(false);
  const [conSonido, setConSonido] = useState(false);
  const fallosRef = useRef(0);
  const llamandoRef = useRef<string[] | null>(null);
  // Para distinguir un cambio real de la primera carga: sin esto sonaría
  // una campanada cada vez que alguien abre la pantalla.
  const atendiendoRef = useRef<string[] | null>(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await publicFetch<Pantalla>(`/public/display/${token}`));
      setError(null);
      fallosRef.current = 0;
    } catch (e: any) {
      // Un corte de red de un segundo no puede vaciar el televisor: se avisa
      // recién al tercer fallo seguido, y se sigue mostrando lo último.
      fallosRef.current += 1;
      if (fallosRef.current >= 3) setError(e?.message ?? 'Sin conexión');
    }
  }, [token]);

  useEffect(() => {
    void cargar();
    conectarComoPantalla(token);
    const dejarDeEscuchar = alRecibir('sala:cambio', () => { void cargar(); });


    const id = window.setInterval(() => { void cargar(); }, REFRESCO_MS);
    const reloj = window.setInterval(() => {
      setHora(laHora());
      setEnVivo(estaConectado());
      setConSonido(sonidoListo());
    }, 1000);
    return () => {
      dejarDeEscuchar();
      // Si se cierra la pantalla a mitad de un anuncio, que no siga hablando
      callar();
      desconectar();
      window.clearInterval(id);
      window.clearInterval(reloj);
    };
  }, [cargar, token]);

  const llamando = datos?.llamando ?? [];
  const atendiendo = datos?.atendiendo ?? [];

  /**
   * Se llamó a alguien: tono, voz, las dos o nada, según lo que diga la sede.
   *
   * Se dispara por IDENTIDADES nuevas en la lista, no por el evento del
   * socket. Lo tenía atado al evento y lo cambié: así el anuncio sale de los
   * datos que la pantalla ACABA de recibir —con nombre y destino— en vez de
   * depender de lo que viajara en el aviso, y si el socket se perdiera una
   * llamada, el refresco de respaldo la anuncia igual. Repetir es imposible:
   * un id ya visto no vuelve a ser nuevo.
   */
  useEffect(() => {
    // La llave lleva el MOMENTO de la llamada, no solo el id.
    //
    // Sin `desde`, volver a llamar a alguien que ya estaba en la lista no
    // sonaría: su id ya se había visto. Y volver a llamar es justo lo que se
    // hace cuando la clienta no oyó la primera vez — el caso en que más
    // falta hace que suene.
    const llave = (t: TurnoPublico) => `${t.id}@${t.desde}`;
    const ahora = llamando.map(llave);
    const antes = llamandoRef.current;
    llamandoRef.current = ahora;
    if (antes === null) return;                  // primera carga

    const nuevos = llamando.filter(t => !antes.includes(llave(t)));
    if (!nuevos.length) return;

    const modo = datos?.anuncio?.modo ?? 'tono';
    if (modo === 'mudo') return;

    if (modo === 'tono' || modo === 'ambos') campanaDeLlamada();
    if (modo === 'voz' || modo === 'ambos') {
      // Con las dos, la voz espera a que termine la campanada: el tono llama
      // la atención y la voz llega cuando ya están mirando.
      const retrasoMs = modo === 'ambos' ? 950 : 0;
      for (const t of nuevos.slice(0, 2)) {
        decir(fraseDeTurno(t.code, t.nombre, t.destino), {
          voz: datos?.anuncio?.voz, retrasoMs,
        });
      }
    }
  }, [llamando, datos?.anuncio?.modo, datos?.anuncio?.voz]);

  /**
   * Alguien NUEVO se sentó: un tin corto, sin llamar a nadie.
   *
   * Se comparan identidades, no cantidades: si una persona termina y otra se
   * sienta entre dos refrescos, el total no cambia pero sí hay alguien nuevo.
   * Contar habría dejado ese caso mudo.
   */
  useEffect(() => {
    const ahora = atendiendo.map(t => t.id).sort();
    const antes = atendiendoRef.current;
    atendiendoRef.current = ahora;
    if (antes === null) return;                  // primera carga, no es un cambio
    const nuevos = ahora.filter(id => !antes.includes(id));
    if (nuevos.length) tinDeCambio();
  }, [atendiendo]);
  const esperando = datos?.esperando ?? [];
  const hayAlguien = llamando.length + atendiendo.length + esperando.length > 0;

  const tono = (t: TurnoPublico) => t.color || '#c4697d';

  return (
    <div className="fixed inset-0 bg-neutral-950 text-white overflow-hidden flex flex-col">
      {/* ── Cabecera ─────────────────────────────────────────────── */}
      <header className="shrink-0 px-8 py-5 flex items-center justify-between border-b border-white/10">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">
            {datos?.salon ?? 'Lalan AI'}
          </h1>
          <p className="text-sm text-white/40">Turnos en sala</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-3xl font-bold tabular-nums">{hora}</div>
          {error ? (
            <div className="text-xs text-rose-400 font-semibold">{error}</div>
          ) : (
            /* Diminuto a propósito: a quien espera no le importa, pero
               permite saber de un vistazo si la pared está en vivo o
               sobreviviendo a base de refrescos lentos. */
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${
                enVivo ? 'bg-emerald-400' : 'bg-white/20'
              }`} />
              <span className="text-[10px] text-white/25">
                {enVivo ? 'en vivo' : 'sin enlace'}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 min-h-0 flex">
        {/* ── Llamando: lo más grande de la pantalla ──────────────── */}
        <section className="flex-1 min-w-0 p-8 flex flex-col justify-center gap-6">
          <LayoutGroup id="pantalla-llamando">
            <AnimatePresence mode="popLayout">
              {llamando.length ? (
                llamando.slice(0, 3).map(t => (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                    className="rounded-3xl p-8 flex items-center gap-8"
                    style={{ backgroundColor: tono(t) }}
                  >
                    {/* Parpadea despacio: llama la atención sin marear a nadie
                        que lleve media hora sentado mirándolo */}
                    <motion.div
                      animate={{ opacity: [1, 0.55, 1] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                      className="text-[9rem] leading-none font-black tabular-nums tracking-tighter"
                    >
                      {t.code}
                    </motion.div>
                    <div className="min-w-0">
                      <div className="text-6xl font-bold truncate">{t.nombre}</div>
                      {t.destino && (
                        <div className="text-3xl text-white/80 mt-2 truncate">→ {t.destino}</div>
                      )}
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div
                  key="nadie"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-center"
                >
                  <div className="text-5xl font-bold text-white/25">
                    {hayAlguien ? 'Servicio en curso' : 'Bienvenida'}
                  </div>
                  <div className="text-xl text-white/20 mt-3">
                    {hayAlguien
                      ? 'Te llamaremos por tu número'
                      : 'Acércate a recepción para tomar tu turno'}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </LayoutGroup>
        </section>

        {/* ── Columna lateral ─────────────────────────────────────── */}
        <aside className="w-[30rem] shrink-0 border-l border-white/10 flex flex-col">
          <div className="flex-1 min-h-0 p-6 overflow-hidden">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white/35 mb-4">
              En atención
            </h2>
            <LayoutGroup id="pantalla-atendiendo">
              <div className="space-y-2.5">
                <AnimatePresence initial={false}>
                  {atendiendo.slice(0, 6).map(t => (
                    <motion.div
                      key={t.id}
                      layout="position"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center gap-4 rounded-2xl bg-white/5 px-4 py-3"
                    >
                      <span
                        className="shrink-0 px-3 py-1.5 rounded-xl text-2xl font-black tabular-nums"
                        style={{ backgroundColor: tono(t) }}
                      >
                        {t.code}
                      </span>
                      <span className="text-2xl font-semibold truncate flex-1">{t.nombre}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {!atendiendo.length && (
                  <p className="text-white/20 text-lg">Ningún sillón ocupado.</p>
                )}
              </div>
            </LayoutGroup>
          </div>

          {/* La cola de espera desaparece entera cuando está vacía: un martes
              tranquilo la pantalla se ve como si no existiera. */}
          {!!esperando.length && (
            <div className="shrink-0 border-t border-white/10 p-6">
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white/35 mb-3">
                En espera · {esperando.length}
              </h2>
              <div className="flex flex-wrap gap-2">
                {esperando.slice(0, 14).map(t => (
                  <span
                    key={t.id}
                    className="px-3 py-1.5 rounded-xl text-xl font-bold tabular-nums border"
                    style={{ borderColor: tono(t), color: tono(t) }}
                  >
                    {t.code}
                  </span>
                ))}
                {esperando.length > 14 && (
                  <span className="px-3 py-1.5 text-xl font-bold text-white/30">
                    +{esperando.length - 14}
                  </span>
                )}
              </div>
            </div>
          )}
        </aside>
      </main>

      {/* ── Activar sonido ───────────────────────────────────────
          NO bloquea la pantalla: si nadie lo pulsa, la pared sigue
          sirviendo, muda. Bloquearla haría que un televisor recién
          encendido se quedara en un botón hasta que alguien subiera a
          tocarlo. */}
      {!conSonido && (
        <button
          type="button"
          onClick={async () => { setConSonido(await activarSonido()); }}
          className="absolute bottom-8 left-8 px-6 py-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm text-left transition cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔔</span>
            <div>
              <div className="text-lg font-bold">Activar sonido</div>
              <div className="text-sm text-white/40">
                Tócalo una vez al montar la pantalla
              </div>
            </div>
          </div>
        </button>
      )}

      {!datos && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-950">
          <span className="text-white/30 text-xl">Conectando…</span>
        </div>
      )}
    </div>
  );
};
