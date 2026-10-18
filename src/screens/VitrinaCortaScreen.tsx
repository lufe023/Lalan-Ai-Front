import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Loader2, MapPin, RefreshCw, Store } from 'lucide-react';
import { ErrorPublico, publicRequest, urlDeFoto } from '../services/api';
import VitrinaScreen from './VitrinaScreen';
import type { DireccionCortaVitrina } from '../types/vitrina';

/** Cambia la dirección sin recargar y avisa a App, que escucha popstate */
export function irADireccion(ruta: string, reemplazar = false) {
  const destino = `${ruta}${window.location.search}`;
  if (reemplazar) window.history.replaceState(null, '', destino);
  else window.history.pushState(null, '', destino);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * La Vitrina por su dirección corta (/<salón> o /<salón>/<sede>), sin sesión.
 * Con una sola sede publicada entra directo; con varias, la clienta elige
 * viendo la dirección de cada una: nunca se adivina la más cercana. Si llegó
 * por un nombre viejo, la barra pasa al nombre de hoy.
 */
export default function VitrinaCortaScreen({ nombre, sede }: { nombre: string; sede: string | null }) {
  const [datos, setDatos] = useState<DireccionCortaVitrina | null>(null);
  const [error, setError] = useState<{ texto: string; noExiste: boolean } | null>(null);

  const cargar = useCallback(() => {
    setError(null);
    publicRequest<DireccionCortaVitrina>(`/vitrina/publica/nombre/${encodeURIComponent(nombre)}`)
      .then((d) => {
        setDatos(d);
        document.title = d.salon;
      })
      .catch((e: unknown) => {
        const noExiste = e instanceof ErrorPublico && e.status === 404;
        setError({ noExiste, texto: noExiste ? 'Esta vitrina no está disponible.' : e instanceof ErrorPublico ? e.message : 'No se pudo abrir la vitrina.' });
      });
  }, [nombre]);

  useEffect(() => { setDatos(null); cargar(); }, [cargar]);

  // Llegó por un nombre viejo: la dirección de hoy en la barra
  useEffect(() => {
    if (datos && datos.nombre !== nombre) irADireccion(`/${datos.nombre}${sede ? `/${sede}` : ''}`, true);
  }, [datos, nombre, sede]);

  if (datos) {
    const elegida = sede ? datos.sedes.find((s) => s.corto === sede) : datos.sedes.length === 1 ? datos.sedes[0] : undefined;
    if (elegida) return <VitrinaScreen slug={elegida.slug} />;
    return <ElegirSede datos={datos} noEncontrada={!!sede} />;
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-[#FAF7F6] px-6 text-center text-[#1F1A1C]">
      {error ? (
        <div className="max-w-xs">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#C46B7C]/12 text-[#C46B7C]"><Store className="size-7" /></span>
          <p className="mt-4 font-semibold">{error.texto}</p>
          <p className="mt-1 text-sm text-[#6B6266]">
            {error.noExiste ? 'Revisa que el nombre esté bien escrito, o escríbele al salón por WhatsApp o Instagram para reservar.' : 'Revisa tu conexión e inténtalo otra vez.'}
          </p>
          {!error.noExiste && (
            <button type="button" onClick={cargar} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#C46B7C] px-5 py-2.5 text-sm font-semibold text-white">
              <RefreshCw className="size-4" /> Reintentar
            </button>
          )}
        </div>
      ) : (
        <Loader2 className="size-7 animate-spin text-[#C46B7C]" aria-label="Cargando" />
      )}
    </div>
  );
}

/** Varias sedes: la clienta elige a cuál va, con la dirección a la vista */
function ElegirSede({ datos, noEncontrada }: { datos: DireccionCortaVitrina; noEncontrada: boolean }) {
  return (
    <div className="min-h-dvh bg-[#FAF7F6] px-4 py-10 text-[#1F1A1C]">
      <div className="mx-auto max-w-md">
        <span className="grid size-14 place-items-center rounded-2xl bg-[#C46B7C]/12 text-[#C46B7C]"><Store className="size-7" /></span>
        <h1 className="mt-4 font-serif text-3xl font-semibold leading-tight">{datos.salon}</h1>
        <p className="mt-1 text-[#6B6266]">
          {noEncontrada ? 'No encontramos esa sede. ¿A cuál quieres ir?' : '¿A qué sede quieres ir?'}
        </p>
        <ul className="mt-6 space-y-3">
          {datos.sedes.map((s) => {
            const foto = urlDeFoto(s.portada);
            return (
              <li key={s.corto}>
                <button
                  type="button"
                  onClick={() => irADireccion(`/${datos.nombre}/${s.corto}`)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-[#EADFE2] bg-white p-3 text-left shadow-sm transition hover:border-[#C46B7C] focus-visible:outline-2 focus-visible:outline-[#C46B7C]"
                >
                  {foto
                    ? <img src={foto} alt="" className="size-16 shrink-0 rounded-xl object-cover" loading="lazy" />
                    : <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-[#C46B7C]/10 text-[#C46B7C]"><Store className="size-6" /></span>}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{s.nombre}</span>
                    {s.direccion && (
                      <span className="mt-0.5 flex items-start gap-1 text-sm text-[#6B6266]">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" /> <span className="line-clamp-2">{s.direccion}</span>
                      </span>
                    )}
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-[#B5A9AD]" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
