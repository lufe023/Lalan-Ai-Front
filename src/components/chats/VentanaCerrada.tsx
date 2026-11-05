import React from 'react';
import { MessageCircle } from 'lucide-react';
import type { Conversation } from '../../types';

const NOMBRE_DEL_CANAL: Record<string, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger' };

/**
 * Pasaron más de 24 h desde su último mensaje (regla de Meta): ni la dueña
 * ni Lalan pueden escribirle libre desde la app. Meta aceptaría el envío y
 * nunca le llegaría. En WhatsApp queda el camino que sí llega: escribirle
 * desde el WhatsApp de la dueña, con un toque.
 */
export const VentanaCerrada: React.FC<{ conversacion: Conversation }> = ({ conversacion }) => {
  const app = NOMBRE_DEL_CANAL[conversacion.channel] ?? 'Meta';
  const telefono = conversacion.channel === 'whatsapp' ? (conversacion.clientPhone ?? '').replace(/\D/g, '') : '';
  return (
    <div className="px-4 pb-2 flex items-center gap-2 text-[0.6875rem] text-amber-700 dark:text-amber-300 bg-white dark:bg-neutral-950">
      <p className="flex-1 min-w-0">
        Pasaron más de 24 horas desde su último mensaje: {app} no deja escribirle, ni a ti ni a Lalan, hasta que vuelva a escribir.
      </p>
      {telefono && (
        <a href={`https://wa.me/${telefono}`} target="_blank" rel="noopener"
          className="shrink-0 font-bold underline flex items-center gap-1">
          <MessageCircle className="w-3.5 h-3.5" /> Escribirle desde mi WhatsApp
        </a>
      )}
    </div>
  );
};
