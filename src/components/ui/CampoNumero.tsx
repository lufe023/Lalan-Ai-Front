import React, { useState } from 'react';
import { leerNumero, numeroEnCampo } from '../../utils/dinero';

/**
 * Un campo para escribir un precio, un costo o una cantidad sin pelearse con él.
 *
 * Antes eran `<input type="number">` y costaba escribir: no se dejaba vaciar
 * (al borrar volvía el «0» y quedaba «01500»), «1,500» con coma se borraba
 * solo, la rueda del ratón cambiaba el precio al bajar por la hoja, y un costo
 * con más decimales de los que pedía `step` (los que salen de Compras) frenaba
 * el botón Guardar sin decir nada.
 *
 * Ahora es texto con el teclado de números del teléfono: mientras se escribe
 * se deja tal cual, se entiende «1,500», «1500.50» o «RD$ 250», y al salir se
 * ve con su coma de miles («1,500»). Al entrar, un 0 se vacía para escribir
 * encima. Nunca frena el formulario: lo que no se entiende cuenta como vacío.
 */
export const CampoNumero: React.FC<{
  valor: number | string | null | undefined;
  /** El número que quedó (null = vacío) */
  onCambio: (n: number | null) => void;
  /** Con coma de miles al salir del campo (precios y costos). Cantidades: false */
  conMiles?: boolean;
  /** Cuántos decimales se guardan como mucho */
  decimales?: number;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  id?: string;
  'aria-label'?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}> = ({ valor, onCambio, conMiles = true, decimales = 4, className, placeholder, autoFocus, id, onKeyDown, ...resto }) => {
  // Mientras tiene el foco manda lo que se va escribiendo; fuera, el número guardado
  const [escribiendo, setEscribiendo] = useState<string | null>(null);
  const n = leerNumero(valor as string | number | null | undefined);
  const visible = escribiendo ?? numeroEnCampo(n, conMiles, decimales);

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      enterKeyHint="done"
      autoFocus={autoFocus}
      placeholder={placeholder}
      aria-label={resto['aria-label']}
      value={visible}
      onFocus={(e) => {
        const texto = n ? numeroEnCampo(n, false, decimales) : '';
        setEscribiendo(texto);
        // Todo marcado: lo que se escriba reemplaza (en el teléfono no hace falta borrar)
        const campo = e.currentTarget;
        requestAnimationFrame(() => { try { campo.select(); } catch { /* sin selección */ } });
      }}
      onChange={(e) => {
        const texto = e.target.value.replace(/[^\d.,\s$A-Za-z]/g, '');
        setEscribiendo(texto);
        const leido = leerNumero(texto);
        onCambio(leido == null ? null : Number(leido.toFixed(decimales)));
      }}
      onBlur={() => setEscribiendo(null)}
      onKeyDown={onKeyDown}
      className={`tabular-nums ${className ?? ''}`}
    />
  );
};
