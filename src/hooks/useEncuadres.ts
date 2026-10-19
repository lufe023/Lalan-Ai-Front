import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { esNormal, type Encuadre } from '../components/catalogo/FotoEncuadrada';

/**
 * Cómo acomodó la dueña cada foto del catálogo (por id de foto). Solo vienen
 * las que no están centradas y llenando. Si no cargan, las fotos se ven como
 * siempre: nunca deja la lista vacía.
 */
export function useEncuadres() {
  const [encuadres, setEncuadres] = useState<Record<string, Encuadre>>({});
  useEffect(() => {
    let vivo = true;
    api.get<Record<string, Encuadre>>('/catalogo/fotos/encuadres')
      .then((e) => { if (vivo) setEncuadres(e ?? {}); })
      .catch(() => { /* se ven como siempre */ });
    return () => { vivo = false; };
  }, []);

  const guardar = useCallback(async (fotoId: string, e: Encuadre) => {
    const r = await api.put<{ id: string; encuadre: Encuadre | null }>(`/catalogo/fotos/${encodeURIComponent(fotoId)}/encuadre`, e);
    setEncuadres((todos) => {
      const { [fotoId]: _antes, ...resto } = todos;
      return r.encuadre && !esNormal(r.encuadre) ? { ...resto, [fotoId]: r.encuadre } : resto;
    });
  }, []);

  return { encuadres, guardar };
}
