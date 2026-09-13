import React, { useEffect, useState } from 'react';
import { Volume2, Music4, WifiOff, Maximize2, Minimize2 } from 'lucide-react';
import { publicFetch } from '../services/api';
import { conectarComoPantalla, desconectar, estaConectado } from '../services/socket';
import { iniciarMusica } from '../services/musica';
import { useAltavoz } from '../hooks/useAltavoz';
import { recordarPantalla } from '../utils/pantallaRecordada';

/**
 * El reproductor del salón: una ventana pública, sin sesión.
 *
 * El altavoz del salón es un aparato que se queda encendido todo el día donde
 * lo ve cualquiera. Dejar ahí una sesión abierta significa dejar abierta la
 * agenda, la caja y las fichas de las clientas en un televisor que nadie
 * supervisa. Esta ventana entra con el mismo token público de la pared: puede
 * sonar y contar qué suena, y no puede leer un solo dato ni mandarle nada a
 * nadie.
 */
export const ReproductorSala: React.FC<{ token: string }> = ({ token }) => {
  const [enVivo, setEnVivo] = useState(false);
  const [bajarAlLlamar, setBajarAlLlamar] = useState(true);
  const {
    anclaRef, encender, intentarSolo, listo, bloqueado,
    cola, pista, sala, videoGrande, alternarVideo,
  } = useAltavoz({ bajarAlLlamar });
  /* Igual que en la pared: el vídeo grande es estado del altavoz, para que
     responda lo mismo a un toque aquí que a una orden desde el teléfono. */
  const completa = videoGrande;
  const alternar = alternarVideo;

  useEffect(() => {
    conectarComoPantalla(token);
    // Para que la aplicación instalada vuelva sola aquí al abrirse
    recordarPantalla('reproductor', token);
    iniciarMusica();
    // Lo único que se pide por HTTP: cómo está configurada esta sede. La
    // música entera viaja por el socket.
    publicFetch<any>(`/public/display/${token}`)
      .then((d: any) => setBajarAlLlamar(d?.anuncio?.bajar !== false))
      .catch(() => { /* con el valor por defecto se vive */ });

    // Intentar sonar sin que nadie toque nada. Si el navegador lo permite,
    // el botón de activar no llega a aparecer.
    void intentarSolo();

    const reloj = window.setInterval(() => setEnVivo(estaConectado()), 1000);
    return () => { window.clearInterval(reloj); desconectar(); };
  }, [token]);

  const pct = sala.duracion > 0 ? Math.min(100, (sala.posicion / sala.duracion) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-neutral-950 text-white overflow-hidden flex flex-col">
      {/* En pantalla completa el vídeo se lo come todo. Y se puede tocar en
          cualquier parte para salir: en un televisor no hay teclado, y quien
          espera no se va a levantar de la silla a buscar la tecla Escape. */}
      <div
        className={completa ? 'absolute inset-0 z-40 bg-black cursor-pointer' : 'flex-1 relative bg-black'}
        onClick={completa ? alternar : undefined}
        title={completa ? 'Toca para salir de pantalla completa' : undefined}
      >
        <div ref={anclaRef} className="absolute inset-0 pointer-events-none" />
        {completa && (
          <button
            onClick={alternar}
            className="absolute top-6 right-6 w-14 h-14 rounded-2xl bg-black/40 backdrop-blur text-white/50 hover:text-white hover:bg-black/70 flex items-center justify-center transition cursor-pointer"
            title="Salir de pantalla completa"
          >
            <Minimize2 className="w-6 h-6" />
          </button>
        )}
      </div>

      {!completa && (
        <div className="shrink-0 px-6 py-5 bg-neutral-950 flex items-center gap-5">
          {pista?.portada ? (
            <img src={pista.portada} alt="" className="w-20 h-20 rounded-2xl object-cover shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
              <Music4 className="w-8 h-8 text-white/20" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {/* Las barritas solo bailan si de verdad suena: una ficha que
                  baila con la música en pausa miente. */}
              <span className="flex items-end gap-[2px] h-3.5">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className={`w-[3px] rounded-full bg-emerald-400 ${sala.sonando ? 'animate-pulse' : ''}`}
                    style={{
                      height: `${[60, 100, 75][i]}%`,
                      animationDelay: `${i * 150}ms`,
                      opacity: sala.sonando ? 1 : 0.3,
                    }}
                  />
                ))}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400/80">
                {enVivo ? (sala.sonando ? 'Sonando' : 'En pausa') : 'Sin enlace'}
              </span>
            </div>

            <div className="text-2xl font-bold truncate mt-1 leading-tight">
              {pista?.titulo ?? 'Sin cola'}
            </div>
            <div className="text-white/40 truncate">{pista?.artista ?? '—'}</div>

            <div className="mt-2.5 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-emerald-400/80 transition-[width] duration-1000 ease-linear"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <span className="text-white/30 text-sm tabular-nums">
              {cola.length ? `${sala.indice + 1} / ${cola.length}` : ''}
            </span>
            {/* Lo único pulsable, y a propósito: cambia cómo se ve, no qué
                suena. Quien pase por delante no toca la música del salón. */}
            <button
              onClick={alternar}
              className="w-11 h-11 rounded-xl text-white/30 hover:text-white hover:bg-white/10 flex items-center justify-center transition cursor-pointer"
              title="Pantalla completa"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {(!listo || bloqueado) && (
        <div className="absolute inset-0 z-50 bg-neutral-950 flex flex-col items-center justify-center gap-6 px-8 text-center">
          <Music4 className="w-16 h-16 text-white/20" />
          <div>
            <h1 className="text-3xl font-bold">Reproductor del salón</h1>
            <p className="text-white/40 mt-2 max-w-md">
              Este aparato va a ser el que suene. Pulsa una vez para activar el
              audio — ningún navegador deja sonar nada sin un toque.
            </p>
          </div>
          <button
            onClick={encender}
            className="px-8 py-4 rounded-2xl bg-emerald-500 text-white text-lg font-bold hover:bg-emerald-400 transition cursor-pointer flex items-center gap-3"
          >
            <Volume2 className="w-6 h-6" />
            Activar y poner música aquí
          </button>
          {!enVivo && (
            <div className="flex items-center gap-2 text-amber-400/70 text-sm">
              <WifiOff className="w-4 h-4" /> Sin enlace con el salón
            </div>
          )}
        </div>
      )}
    </div>
  );
};
