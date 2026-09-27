import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { VentanaChat } from './VentanaChat';

/** Desde este ancho los chats se abren en ventanitas (en el teléfono, a pantalla completa) */
const ANCHO_ESCRITORIO = 1024;
/** Lo que ocupan el menú lateral y cada ventana, para saber cuántas caben */
const ANCHO_MENU = 280;
const ANCHO_VENTANA = 372;
const MAXIMO_VENTANAS = 4;

interface Ventana { id: string; minimizada: boolean }

function cuantasCaben(ancho: number) {
  return Math.min(MAXIMO_VENTANAS, Math.max(1, Math.floor((ancho - ANCHO_MENU) / ANCHO_VENTANA)));
}

/**
 * Los chats abiertos en la computadora: ventanitas abajo a la derecha, como
 * en cualquier chat de la web. Se quedan abiertas aunque cambies de pantalla.
 * Abrir un chat desde la lista, un aviso o un enlace pone su ventana primera;
 * si no caben más, se cierra la más vieja.
 */
export const ChatsFlotantes: React.FC = () => {
  const { activeConversationId, setActiveConversationId, conversations } = useApp();
  const [ancho, setAncho] = useState(() => window.innerWidth);
  const [ventanas, setVentanas] = useState<Ventana[]>([]);

  useEffect(() => {
    const alCambiar = () => setAncho(window.innerWidth);
    window.addEventListener('resize', alCambiar);
    return () => window.removeEventListener('resize', alCambiar);
  }, []);

  // Las ventanas se apoyan encima del pie de página, no lo tapan
  const [pie, setPie] = useState(0);
  useEffect(() => {
    const el = document.getElementById('pie-app');
    if (!el) return;
    const medir = () => setPie(el.offsetHeight);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [ancho]);

  const esEscritorio = ancho >= ANCHO_ESCRITORIO;
  const caben = cuantasCaben(ancho);

  // Abrir un chat en la computadora = abrir (o traer al frente) su ventana
  useEffect(() => {
    if (!esEscritorio || !activeConversationId) return;
    const id = activeConversationId;
    setVentanas(v => [{ id, minimizada: false }, ...v.filter(x => x.id !== id)].slice(0, caben));
    setActiveConversationId(null);
  }, [activeConversationId, esEscritorio, caben, setActiveConversationId]);

  // Si se achica la pantalla, se quedan las más recientes
  useEffect(() => { setVentanas(v => (v.length > caben ? v.slice(0, caben) : v)); }, [caben]);

  const existentes = ventanas.filter(v => conversations.some(c => c.id === v.id));
  if (!esEscritorio || !existentes.length) return null;

  return (
    <div className="fixed right-4 z-[150] flex flex-row-reverse items-end gap-3 pointer-events-none" style={{ bottom: pie }} aria-label="Chats abiertos">
      {existentes.map(v => (
        <div key={v.id} className="pointer-events-auto">
          <VentanaChat
            conversacionId={v.id}
            flotante
            minimizada={v.minimizada}
            onMinimizar={() => setVentanas(vs => vs.map(x => x.id === v.id ? { ...x, minimizada: !x.minimizada } : x))}
            onCerrar={() => setVentanas(vs => vs.filter(x => x.id !== v.id))}
          />
        </div>
      ))}
    </div>
  );
};
