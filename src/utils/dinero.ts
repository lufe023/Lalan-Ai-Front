/**
 * Un monto como se lee en el salón: con coma de miles y dos decimales
 * («1,600.00»). Antes salía «1600.00» y los montos grandes costaba leerlos.
 */
export const miles = (n: number | string | null | undefined, decimales = 2): string =>
  Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
