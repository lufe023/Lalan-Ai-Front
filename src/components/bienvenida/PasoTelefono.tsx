import React from 'react';
import { ActivarNotificaciones } from '../ui/ActivarNotificaciones';
import { TarjetaInstalar } from '../ui/InstalarApp';
import { BotonPrincipal, Encabezado } from './comun';

/**
 * «Tu teléfono»: el primer paso de la Bienvenida. Instalar Lalan y activar
 * los avisos son de ESTE aparato (no del salón), por eso no cuentan en el
 * porcentaje y se recuerdan en el aparato: si la dueña instala la app en el
 * iPhone y entra desde el ícono, aquí vuelve a salir para activar los avisos
 * (en iPhone solo se pueden activar con la app instalada).
 */
const CLAVE_VISTO = 'lalan_paso_telefono_visto';
export function pasoTelefonoVisto(): boolean {
  try { return localStorage.getItem(CLAVE_VISTO) === '1'; } catch { return false; }
}
export function marcarPasoTelefonoVisto() {
  try { localStorage.setItem(CLAVE_VISTO, '1'); } catch { /* sin almacenamiento: vuelve a salir, no pasa nada */ }
}

export const PasoTelefono: React.FC<{ onSiguiente: () => void }> = ({ onSiguiente }) => (
  <div className="space-y-5">
    <Encabezado
      titulo="Lalan en tu teléfono"
      texto="Así te avisa de lo importante aunque tengas la app cerrada: una clienta que te necesita, una cita nueva o lo que falta, como conectar tu WhatsApp."
    />
    <TarjetaInstalar />
    <ActivarNotificaciones />
    <BotonPrincipal onClick={() => { marcarPasoTelefonoVisto(); onSiguiente(); }} className="w-full">Siguiente</BotonPrincipal>
  </div>
);
