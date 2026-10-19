import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { esNormal, type Encuadre } from '../components/catalogo/FotoEncuadrada';

/**
 * Cómo acomodó la dueña cada foto del catálogo (por id de foto). Solo vienen
 * las que no están centradas y llenando. Si no cargan, las fotos se ven como
 * siempre: nunca deja la lista vacía. También dice cuáles son videos
 * (`cargarVideos` después de subir uno).
 */
export function useEncuadres() {
  const [encuadres, setEncuadres] = useState<Record<string, Encuadre>>({});
  /** Cuáles fotos son videos (id → segundos) */
  const [videos, setVideos] = useState<Record<string, number>>({});
  const cargarVideos = useCallback(async () => {
    try { setVideos((await api.get<Record<string, number>>('/catalogo/fotos/videos')) ?? {}); } catch { /* se ven como fotos */ }
  }, []);
  useEffect(() => {
    let vivo = true;
    api.get<Record<string, Encuadre>>('/catalogo/fotos/encuadres')
      .then((e) => { if (vivo) setEncuadres(e ?? {}); })
      .catch(() => { /* se ven como siempre */ });
    api.get<Record<string, number>>('/catalogo/fotos/videos')
      .then((v) => { if (vivo) setVideos(v ?? {}); })
      .catch(() => { /* se ven como fotos (su primer cuadro) */ });
    return () => { vivo = false; };
  }, []);

  const guardar = useCallback(async (fotoId: string, e: Encuadre) => {
    const r = await api.put<{ id: string; encuadre: Encuadre | null }>(`/catalogo/fotos/${encodeURIComponent(fotoId)}/encuadre`, e);
    setEncuadres((todos) => {
      const { [fotoId]: _antes, ...resto } = todos;
      return r.encuadre && !esNormal(r.encuadre) ? { ...resto, [fotoId]: r.encuadre } : resto;
    });
  }, []);

  return { encuadres, guardar, videos, cargarVideos };
}
