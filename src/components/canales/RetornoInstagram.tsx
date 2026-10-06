import { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { terminarConexionInstagram } from '../../utils/instagramLogin';

/**
 * Al volver de "Conectar solo Instagram" en la misma pestaña (el teléfono o
 * la app instalada), la dirección trae ?ig_code=… : aquí se termina la
 * conexión y se limpia la dirección.
 */
export const RetornoInstagram: React.FC = () => {
  const { recargarBots, showToast } = useApp();
  const hecho = useRef(false);
  useEffect(() => {
    if (hecho.current) return;
    const q = new URLSearchParams(window.location.search);
    const code = q.get('ig_code'), state = q.get('ig_state'), error = q.get('ig_error');
    if (!code && !error) return;
    hecho.current = true;
    ['ig_code', 'ig_state', 'ig_error'].forEach((k) => q.delete(k));
    window.history.replaceState(null, '', `${window.location.pathname}${q.toString() ? `?${q}` : ''}${window.location.hash}`);
    if (!code || !state) {
      showToast('No se conectó Instagram', error === 'cancelado' ? 'Cerraste la ventana antes de aceptar.' : `Instagram: ${error}`, 'warning');
      return;
    }
    terminarConexionInstagram(code, state)
      .then(async (r) => { await recargarBots(); showToast('Instagram conectado', `Lalan ya recibe los mensajes de ${r.instagram}.`, 'success'); })
      .catch((e) => showToast('No se pudo conectar Instagram', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'));
  }, [recargarBots, showToast]);
  return null;
};
