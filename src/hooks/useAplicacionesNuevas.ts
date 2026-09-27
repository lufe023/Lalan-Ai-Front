import { useEffect, useState } from 'react';
import { api } from '../services/api';

/** Cada cuánto se mira si alguien aplicó al piloto (el menú muestra el número) */
const CADA_MS = 2 * 60 * 1000;

/** Aplicaciones al piloto sin contactar. Solo pregunta si quien mira es super admin. */
export function useAplicacionesNuevas(activo: boolean): number {
  const [nuevas, setNuevas] = useState(0);
  useEffect(() => {
    if (!activo) { setNuevas(0); return; }
    let vivo = true;
    const mirar = () => api.get<{ nuevas: number }>('/plataforma/landing/aplicaciones/nuevas')
      .then((r) => { if (vivo) setNuevas(r.nuevas); })
      .catch(() => {});
    void mirar();
    const t = window.setInterval(mirar, CADA_MS);
    return () => { vivo = false; window.clearInterval(t); };
  }, [activo]);
  return nuevas;
}
