/**
 * Las horas, siempre como las dicen las clientas: "1:30 p. m.", nunca "13:30".
 * La app guarda y manda "HH:mm" por dentro; esto es solo para mostrar.
 */
const MEDIODIA = 12;

/** "13:30" → "1:30 p. m." · "09:00" → "9:00 a. m." */
export function hora12(hhmm?: string | null): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  const h12 = h % MEDIODIA || MEDIODIA;
  return `${h12}:${String(m || 0).padStart(2, '0')} ${h < MEDIODIA ? 'a. m.' : 'p. m.'}`;
}

/** Un instante a "1:30 p. m." */
export function horaDe(fecha: Date | string | number): string {
  const d = new Date(fecha);
  return Number.isNaN(d.getTime()) ? '' : hora12(`${d.getHours()}:${d.getMinutes()}`);
}
