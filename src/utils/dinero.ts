/**
 * Un monto como se lee en el salón: con coma de miles y dos decimales
 * («1,600.00»). Antes salía «1600.00» y los montos grandes costaba leerlos.
 */
export const miles = (n: number | string | null | undefined, decimales = 2): string =>
  Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

/**
 * Lee un número escrito a mano, como lo escribe la dueña: «1500», «1,500»,
 * «1,500.50», «RD$ 250», «12,5» o «1.500,50». La coma de miles se quita; si
 * solo hay una coma y no le siguen tres cifras, es la de los decimales.
 * Vacío o sin cifras = null.
 */
export function leerNumero(texto: string | number | null | undefined): number | null {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null;
  let t = String(texto ?? '').replace(/[^\d.,]/g, '');
  if (!/\d/.test(t)) return null;
  const coma = t.lastIndexOf(','), punto = t.lastIndexOf('.');
  if (coma >= 0 && punto >= 0) {
    // Las dos: la última es la de los decimales
    t = coma > punto ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (coma >= 0) {
    const comas = t.split(',').length - 1;
    t = comas === 1 && t.length - coma - 1 !== 3 ? t.replace(',', '.') : t.replace(/,/g, '');
  } else if (t.split('.').length > 2) {
    t = t.replace(/\./g, ''); // «1.500.000»
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Un número para leerlo en un campo: con coma de miles y decimales solo si los tiene («1,500», «12.50») */
export const numeroEnCampo = (n: number | null | undefined, conMiles = true, decimales = 4): string =>
  n == null || !Number.isFinite(n) ? ''
    : conMiles ? n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : Math.min(2, decimales), maximumFractionDigits: decimales })
    : String(Number(n.toFixed(decimales)));
