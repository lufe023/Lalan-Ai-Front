import { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { terminarConexionInstagram } from '../../utils/instagramLogin';
import { guardarPendientes, terminarFacebook } from '../../utils/facebookLogin';
import { pedirSeccionAjustes } from '../ajustes/MenuAjustes';

/** Saca de la dirección los parámetros de vuelta (para que recargar no lo repita) */
function limpiarDireccion(claves: string[]) {
  const q = new URLSearchParams(window.location.search);
  claves.forEach((k) => q.delete(k));
  window.history.replaceState(null, '', `${window.location.pathname}${q.toString() ? `?${q}` : ''}${window.location.hash}`);
}

/**
 * Al volver de Instagram o de Facebook en la misma pestaña (el teléfono o la
 * app instalada), la dirección trae ?ig_code=… o ?fb_code=…: aquí se termina.
 *  · Instagram ("solo Instagram"): queda conectado ahí mismo.
 *  · Facebook: vuelven sus páginas y se abre "Lalan en los chats" para que
 *    la dueña elija la de su negocio, igual que en la computadora.
 */
export const RetornoInstagram: React.FC = () => {
  const { recargarBots, showToast, navigateTo } = useApp();
  const hecho = useRef(false);
  useEffect(() => {
    if (hecho.current) return;
    const q = new URLSearchParams(window.location.search);

    const ig = { code: q.get('ig_code'), state: q.get('ig_state'), error: q.get('ig_error') };
    if (ig.code || ig.error) {
      hecho.current = true;
      limpiarDireccion(['ig_code', 'ig_state', 'ig_error']);
      if (!ig.code || !ig.state) {
        showToast('No se conectó Instagram', ig.error === 'cancelado' ? 'Cerraste la ventana antes de aceptar.' : `Instagram: ${ig.error}`, 'warning');
        return;
      }
      terminarConexionInstagram(ig.code, ig.state)
        .then(async (r) => { await recargarBots(); showToast('Instagram conectado', `Lalan ya recibe los mensajes de ${r.instagram}.`, 'success'); })
        .catch((e) => showToast('No se pudo conectar Instagram', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'));
      return;
    }

    const fb = { code: q.get('fb_code'), state: q.get('fb_state'), error: q.get('fb_error') };
    if (fb.code || fb.error) {
      hecho.current = true;
      limpiarDireccion(['fb_code', 'fb_state', 'fb_error']);
      if (!fb.code || !fb.state) {
        showToast('No se conectó Facebook', fb.error === 'cancelado' ? 'Cerraste la ventana antes de aceptar.' : `Facebook: ${fb.error}`, 'warning');
        return;
      }
      terminarFacebook(fb.code, fb.state)
        .then((r) => {
          if (!r.paginas.length) {
            showToast('No hay páginas', 'Tu usuario de Facebook no administra ninguna página, o no la marcaste en la ventana de Meta.', 'warning');
            return;
          }
          // La pantalla de conectar las toma y muestra para elegir
          guardarPendientes(r);
          pedirSeccionAjustes('chats');
          navigateTo('settings');
        })
        .catch((e) => showToast('No se pudo conectar Facebook', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'));
    }
  }, [recargarBots, showToast, navigateTo]);
  return null;
};
