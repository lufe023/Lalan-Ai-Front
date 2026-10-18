import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Store } from 'lucide-react';
import { ErrorPublico, publicRequest } from '../services/api';
import PaginaVitrina from '../components/vitrina/PaginaVitrina';
import type { DatosVitrina } from '../types/vitrina';

/** El `?de=` del enlace (o el `utm_source`), esté antes o después del # */
function deDondeDice(): string | undefined {
  const deHash = window.location.hash.split('?')[1] ?? '';
  for (const q of [window.location.search, deHash]) {
    const p = new URLSearchParams(q);
    const v = p.get('de') ?? p.get('utm_source');
    if (v) return v.slice(0, 30);
  }
  return undefined;
}

/**
 * Cuenta la visita una vez por sesión del navegador (recargar o volver de
 * otra pestaña no suma). Si no se puede guardar la marca, cuenta igual: mejor
 * una de más que perderlas todas en navegación privada.
 */
function contarVisita(slug: string) {
  const marca = `vitrina-visita:${slug}`;
  try { if (sessionStorage.getItem(marca)) return; sessionStorage.setItem(marca, '1'); } catch { /* sin almacenamiento */ }
  void publicRequest(`/vitrina/publica/${encodeURIComponent(slug)}/visita`, {
    method: 'POST', body: { ref: document.referrer || undefined, de: deDondeDice() },
  }).catch(() => undefined);
}

/**
 * La Vitrina de una sede (#/v/:slug), sin sesión: es lo que abre una clienta
 * desde el enlace de Instagram o el QR del mostrador. Como la pared y el
 * reproductor, se monta antes que la app: aquí no hay token ni contexto.
 */
export default function VitrinaScreen({ slug }: { slug: string }) {
  const [datos, setDatos] = useState<DatosVitrina | null>(null);
  const [error, setError] = useState<{ texto: string; noExiste: boolean } | null>(null);

  const cargar = useCallback(() => {
    setError(null);
    publicRequest<DatosVitrina>(`/vitrina/publica/${encodeURIComponent(slug)}`)
      .then((d) => {
        setDatos(d);
        contarVisita(slug);
        document.title = `${d.salon.nombre} · ${d.sede.nombre}`;
        // Un enlace largo de antes (/app/#/v/…): la barra muestra la dirección corta
        if (d.direccionCorta && window.location.hash.startsWith('#/v/')) {
          window.history.replaceState(null, '', `/${d.direccionCorta}${window.location.search}`);
        }
      })
      .catch((e: unknown) => {
        const noExiste = e instanceof ErrorPublico && e.status === 404;
        setError({ noExiste, texto: noExiste ? 'Esta vitrina no está disponible ahora.' : e instanceof ErrorPublico ? e.message : 'No se pudo abrir la vitrina.' });
      });
  }, [slug]);

  useEffect(() => { setDatos(null); cargar(); }, [cargar]);

  if (datos) return <PaginaVitrina datos={datos} slug={slug} />;

  return (
    <div className="grid min-h-dvh place-items-center bg-[#FAF7F6] px-6 text-center text-[#1F1A1C]">
      {error ? (
        <div className="max-w-xs">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#C46B7C]/12 text-[#C46B7C]"><Store className="size-7" /></span>
          <p className="mt-4 font-semibold">{error.texto}</p>
          <p className="mt-1 text-sm text-[#6B6266]">
            {error.noExiste ? 'Puede que el salón la esté preparando. Escríbeles por WhatsApp o Instagram para reservar.' : 'Revisa tu conexión e inténtalo otra vez.'}
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
