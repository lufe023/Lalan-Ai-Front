import { useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';

/** Por encima de esto no se enseñan centavos (RD$ 2.676, no RD$ 2.676,00) */
const SIN_CENTAVOS_DESDE = 100;
const LOCALE = 'es-DO';

/**
 * Cómo se enseña el dinero en toda la app.
 *
 * La regla: todo va en la moneda BASE del salón (Ajustes → Monedas). Un
 * precio guardado en otra moneda (un servicio en US$) se convierte con la
 * tasa de hoy. Si esa moneda no está registrada no se inventa una tasa: se
 * enseña en su propia moneda, para que se vea que falta.
 */
export function useDinero() {
  const { currencies, baseCurrency } = useApp();
  const base = baseCurrency?.code ?? currencies.find(c => c.isBase)?.code ?? 'DOP';

  const tasas = useMemo(
    () => new Map(currencies.filter(c => c.active).map(c => [c.code.toUpperCase(), c.isBase ? 1 : Number(c.rateToBase)])),
    [currencies],
  );

  /** El monto en la moneda base; null si su moneda no tiene tasa */
  const enBase = useCallback((monto: number, moneda?: string | null): number | null => {
    const c = (moneda ?? '').toUpperCase();
    if (!c || c === base) return monto;
    const t = tasas.get(c);
    return t == null ? null : monto * t;
  }, [base, tasas]);

  const formatear = useCallback((monto: number, moneda: string) => {
    const conCentavos = Math.abs(monto) < SIN_CENTAVOS_DESDE && !Number.isInteger(Math.round(monto * 100) / 100);
    try {
      return new Intl.NumberFormat(LOCALE, {
        style: 'currency', currency: moneda,
        minimumFractionDigits: conCentavos ? 2 : 0, maximumFractionDigits: conCentavos ? 2 : 0,
      }).format(monto || 0);
    } catch {
      return `${moneda} ${(monto || 0).toLocaleString(LOCALE)}`;
    }
  }, []);

  /** "RD$ 2.676": en la moneda base, convirtiendo si hace falta */
  const dinero = useCallback((monto: number | null | undefined, moneda?: string | null) => {
    const v = Number(monto ?? 0);
    const convertido = enBase(v, moneda);
    return convertido == null ? formatear(v, (moneda ?? base).toUpperCase()) : formatear(convertido, base);
  }, [base, enBase, formatear]);

  /** "US$ 45": tal cual, en su propia moneda (para el catálogo) */
  const enSuMoneda = useCallback(
    (monto: number | null | undefined, moneda?: string | null) => formatear(Number(monto ?? 0), (moneda ?? base).toUpperCase()),
    [base, formatear],
  );

  /** ¿Está en otra moneda que la base? */
  const esExtranjera = useCallback((moneda?: string | null) => !!moneda && moneda.toUpperCase() !== base, [base]);

  return { base, dinero, enBase, enSuMoneda, esExtranjera };
}
