import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { alConectar, alRecibir } from '../services/socket';
import { PeriodoMetricas, ResumenMetricas } from '../types/metricas';

/** Varias señales seguidas (cobrar = venta + pago + cita) → una sola recarga */
const ESPERA_ANTES_DE_RECARGAR_MS = 1200;
/** Red de seguridad por si el socket se cae sin avisar */
const RECARGA_DE_SEGURIDAD_MS = 60_000;
/**
 * Lo que mueve las métricas: la caja (cobros), la agenda (citas nuevas,
 * atendidas, canceladas, también las que agenda la asistente) y los chats
 * (lo que respondió la asistente).
 */
const SENALES = ['ventas:cambio', 'sala:cambio', 'chat:cambio', 'agenda:sin-especialista'];

/**
 * Las métricas en vivo. Antes se pedían una vez al abrir la app: una cita
 * cobrada no aparecía en Ingresos hasta pulsar F5.
 */
export function useMetricas(periodo: PeriodoMetricas) {
  const [datos, setDatos] = useState<ResumenMetricas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pedido = useRef(0);

  const cargar = useCallback(async () => {
    const este = ++pedido.current;
    try {
      const d = await api.get<ResumenMetricas>(`/metrics?period=${periodo}`);
      // Si cambiaron de período mientras tanto, esta respuesta ya no sirve
      if (este === pedido.current) { setDatos(d); setError(null); }
    } catch (e: any) {
      if (este === pedido.current) setError(e?.message ?? 'No se pudieron cargar las métricas');
    } finally {
      if (este === pedido.current) setCargando(false);
    }
  }, [periodo]);

  useEffect(() => {
    setCargando(true);
    void cargar();
    let espera: number | undefined;
    const pronto = () => {
      window.clearTimeout(espera);
      espera = window.setTimeout(() => void cargar(), ESPERA_ANTES_DE_RECARGAR_MS);
    };
    const quitar = SENALES.map(s => alRecibir(s, pronto));
    const quitarConexion = alConectar(pronto);
    const intervalo = window.setInterval(() => void cargar(), RECARGA_DE_SEGURIDAD_MS);
    const alVolver = () => { if (document.visibilityState === 'visible') pronto(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      quitar.forEach(q => q());
      quitarConexion();
      window.clearTimeout(espera);
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [cargar]);

  return { datos, cargando, error, recargar: cargar };
}
