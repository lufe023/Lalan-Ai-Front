import React, { useEffect, useState } from 'react';
import { Download, EyeOff, FileText, ImageOff, Megaphone, Link2, CircleDot, MicOff } from 'lucide-react';
import { blobProtegido, descargarArchivo } from '../../services/api';
import type { ChatMessage } from '../../types';

/**
 * Lo que va dentro de una burbuja del chat: la foto o el video, lo que la IA
 * vio en ella, el texto, y si la clienta lo borró.
 *
 * Las fotos se piden con la sesión (no son públicas) y se guardan en
 * memoria mientras el chat está abierto.
 */

/** Tipos que se enseñan como imagen o como video (catálogo TipoContenido) */
const TIPOS_IMAGEN = ['imagen', 'sticker'];
const TIPOS_VIDEO = ['video'];
const TIPOS_AUDIO = ['nota_voz', 'audio'];
/** Extensión para descargar el audio con un nombre que el teléfono entienda */
const EXTENSION_AUDIO: Record<string, string> = { 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'video/mp4': 'mp4' };
/** Textos de relleno que pone el sistema cuando no hay texto de la clienta */
const ES_RELLENO = /^\[.*\]$|^\(Envió |^\((Nota de voz|Audio)\) /;

const cache = new Map<string, string>();

function useArchivo(mensajeId: string, activo: boolean) {
  const [url, setUrl] = useState<string | null>(cache.get(mensajeId) ?? null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!activo || url) return;
    let vivo = true;
    blobProtegido(`/conversations/mensajes/${mensajeId}/archivo`)
      .then((u) => { cache.set(mensajeId, u); if (vivo) setUrl(u); })
      .catch(() => { if (vivo) setError(true); });
    return () => { vivo = false; };
  }, [mensajeId, activo, url]);
  return { url, error };
}

export const ContenidoMensaje: React.FC<{
  msg: ChatMessage;
  /** Burbuja de color (equipo o asistente): los textos secundarios van claros */
  sobreColor: boolean;
  esSuperAdmin: boolean;
}> = ({ msg, sobreColor, esSuperAdmin }) => {
  const tipo = msg.tipo ?? 'texto';
  const a = msg.adjunto;
  const esImagen = TIPOS_IMAGEN.includes(tipo);
  const esVideo = TIPOS_VIDEO.includes(tipo);
  const esAudio = TIPOS_AUDIO.includes(tipo);
  const { url, error } = useArchivo(msg.id, !!a?.tieneArchivo && (esImagen || esVideo || esAudio) && (!msg.eliminado || esSuperAdmin));
  const suave = sobreColor ? 'text-white/75' : 'text-slate-500 dark:text-neutral-400';

  if (msg.eliminado && !esSuperAdmin) {
    return (
      <p className={`flex items-center gap-1.5 italic ${suave}`}>
        <EyeOff className="w-3.5 h-3.5 shrink-0" /> La clienta eliminó este mensaje
      </p>
    );
  }

  const texto = msg.text && !(a && ES_RELLENO.test(msg.text)) ? msg.text : '';

  return (
    <div className="space-y-1.5">
      {msg.eliminado && (
        <p className={`flex items-center gap-1 text-[0.6875rem] font-bold ${sobreColor ? 'text-amber-200' : 'text-amber-600'}`}>
          <EyeOff className="w-3 h-3" /> Eliminado por la clienta · solo lo ves tú como super admin
        </p>
      )}

      {(esImagen || esVideo) && (
        a?.tieneArchivo ? (
          url ? (
            esVideo
              ? <video src={url} controls playsInline className="rounded-xl max-h-72 w-full bg-black" />
              : (
                <a href={url} target="_blank" rel="noreferrer" className="block">
                  <img src={url} alt={a.descripcion ?? 'Foto de la clienta'} className={`rounded-xl max-h-72 w-auto object-cover ${tipo === 'sticker' ? 'max-h-28' : ''}`} />
                </a>
              )
          ) : (
            <div className={`h-40 w-56 max-w-full rounded-xl flex items-center justify-center text-[0.75rem] ${sobreColor ? 'bg-white/10' : 'bg-slate-100 dark:bg-neutral-700/60'} ${suave}`}>
              {error ? 'No se pudo cargar' : 'Cargando…'}
            </div>
          )
        ) : (
          <p className={`flex items-center gap-1.5 ${suave}`}>
            <ImageOff className="w-3.5 h-3.5 shrink-0" /> {esVideo ? 'Video' : 'Foto'} que no se pudo guardar
          </p>
        )
      )}

      {esAudio && (
        a?.tieneArchivo ? (
          <div className="space-y-1">
            {url
              ? <audio src={url} controls preload="metadata" className="w-60 max-w-full h-10" />
              : <p className={suave}>{error ? 'No se pudo cargar el audio' : 'Cargando audio…'}</p>}
            {url && (
              <button
                type="button"
                onClick={() => void descargarArchivo(`/conversations/mensajes/${msg.id}/archivo`, `nota-de-voz.${EXTENSION_AUDIO[(a.mime ?? '').split(';')[0]] ?? 'ogg'}`)}
                className={`flex items-center gap-1 text-[0.6875rem] font-bold ${suave}`}
              >
                <Download className="w-3 h-3" /> Descargar
              </button>
            )}
          </div>
        ) : (
          <p className={`flex items-center gap-1.5 ${suave}`}><MicOff className="w-3.5 h-3.5 shrink-0" /> Nota de voz que no se pudo guardar</p>
        )
      )}

      {a?.transcripcion && (
        <p className={`text-[0.75rem] leading-snug ${suave}`}>
          <span className="font-bold">Dice: </span>«{a.transcripcion}»
        </p>
      )}

      {tipo === 'documento' && a && (
        <button
          type="button"
          disabled={!a.tieneArchivo}
          onClick={() => void descargarArchivo(`/conversations/mensajes/${msg.id}/archivo`, a.nombre || 'documento')}
          className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-left ${sobreColor ? 'bg-white/10' : 'bg-slate-100 dark:bg-neutral-700/60'} disabled:opacity-60`}
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span className="truncate font-semibold">{a.nombre || 'Documento'}</span>
        </button>
      )}

      {a?.descripcion && (
        <p className={`text-[0.75rem] leading-snug ${suave}`}>
          <span className="font-bold">Lalan ve: </span>{a.descripcion}
        </p>
      )}

      {texto && <p className="whitespace-pre-wrap">{texto}</p>}
    </div>
  );
};

/** El emoji con que reaccionó, pegado al borde de la burbuja */
export const ReaccionDeMensaje: React.FC<{ emoji?: string | null; aLaDerecha: boolean }> = ({ emoji, aLaDerecha }) =>
  emoji ? (
    <span className={`-mt-2 ${aLaDerecha ? 'mr-2' : 'ml-2'} px-1.5 py-0.5 rounded-full text-[0.8125rem] leading-none bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 shadow-xs`}>
      {emoji}
    </span>
  ) : null;

const ORIGENES: Record<string, { texto: string; Icono: React.FC<{ className?: string }> }> = {
  anuncio: { texto: 'Llegó por un anuncio', Icono: Megaphone },
  historia: { texto: 'Respondió a tu historia', Icono: CircleDot },
  enlace: { texto: 'Llegó por un enlace', Icono: Link2 },
};

/** Arriba del chat: de dónde vino la clienta la primera vez que escribió */
export const OrigenDelChat: React.FC<{ mensajes: ChatMessage[] }> = ({ mensajes }) => {
  const o = mensajes.find((m) => m.origen)?.origen;
  if (!o) return null;
  const { texto, Icono } = ORIGENES[o.tipo] ?? ORIGENES.enlace;
  return (
    <div className="flex justify-center">
      <div className="px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200/70 dark:border-sky-900 text-[0.75rem] text-sky-800 dark:text-sky-200 flex items-center gap-1.5 max-w-[90%]">
        <Icono className="w-3.5 h-3.5 shrink-0" />
        <span className="font-semibold">{texto}</span>
        {o.titulo && <span className="truncate opacity-80">· {o.titulo}</span>}
        {o.url && <a href={o.url} target="_blank" rel="noreferrer" className="underline shrink-0">ver</a>}
      </div>
    </div>
  );
};
