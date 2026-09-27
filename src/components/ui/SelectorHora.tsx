import React from 'react';

const MEDIODIA = 12;

/**
 * Elegir una hora sin reloj de 24 horas: hora (1–12), minutos y a. m./p. m.
 * El valor entra y sale como "HH:mm", que es lo que guarda la app.
 * (El <input type="time"> del navegador sale en 24 h según la computadora.)
 */
export const SelectorHora: React.FC<{
  value: string;
  onChange: (hhmm: string) => void;
  /** De cuántos en cuántos minutos */
  paso?: number;
  className?: string;
  etiqueta?: string;
}> = ({ value, onChange, paso = 5, className = '', etiqueta = 'Hora' }) => {
  const [h24, m] = (value || '09:00').split(':').map(Number);
  const tarde = h24 >= MEDIODIA;
  const h12 = h24 % MEDIODIA || MEDIODIA;
  const minutos = Array.from({ length: 60 / paso }, (_, i) => i * paso);
  if (!minutos.includes(m)) minutos.push(m);
  minutos.sort((a, b) => a - b);

  const armar = (hora12: number, min: number, pm: boolean) => {
    const h = (hora12 % MEDIODIA) + (pm ? MEDIODIA : 0);
    onChange(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  };
  const caja = 'px-2 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white text-sm font-semibold focus:outline-none dark:[color-scheme:dark]';
  return (
    <div className={`flex items-center gap-1.5 ${className}`} role="group" aria-label={etiqueta}>
      <select aria-label="Hora" value={h12} onChange={e => armar(Number(e.target.value), m, tarde)} className={caja}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="font-bold text-slate-400">:</span>
      <select aria-label="Minutos" value={m} onChange={e => armar(h12, Number(e.target.value), tarde)} className={caja}>
        {minutos.map(x => <option key={x} value={x}>{String(x).padStart(2, '0')}</option>)}
      </select>
      <select aria-label="Mañana o tarde" value={tarde ? 'pm' : 'am'} onChange={e => armar(h12, m, e.target.value === 'pm')} className={caja}>
        <option value="am">a. m.</option>
        <option value="pm">p. m.</option>
      </select>
    </div>
  );
};
