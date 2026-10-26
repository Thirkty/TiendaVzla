// Utilidades de formateo de moneda (USD y conversión a VES con tasa BCV).
// La tasa viene de la API (GET /api/rate); en componentes se obtiene con useBcvRate().

const vesFormatter = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "VES",
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** Redondea a 2 decimales evitando errores de coma flotante. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Convierte USD a bolívares con la tasa BCV dada y lo formatea. */
export function formatVes(usd: number, rate: number): string {
  return vesFormatter.format(roundMoney(usd * rate));
}

/** Formatea un monto en dólares. */
export function formatUsd(usd: number): string {
  return usdFormatter.format(roundMoney(usd));
}

/** Formatea un monto que ya está en bolívares (p. ej. el total_ves de una orden). */
export function formatBs(ves: number): string {
  return vesFormatter.format(roundMoney(ves));
}
