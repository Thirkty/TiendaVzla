// Utilidades de formateo de moneda (USD y conversión a VES con tasa BCV).

const DEFAULT_BCV_RATE = 40;

// Se lee de forma literal para que Next.js lo inyecte en el bundle del cliente.
const parsedRate = Number(process.env.NEXT_PUBLIC_BCV_RATE);
export const BCV_RATE = Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : DEFAULT_BCV_RATE;

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

/** Convierte USD a bolívares con la tasa BCV y lo formatea. */
export function formatVes(usd: number): string {
  return vesFormatter.format(roundMoney(usd * BCV_RATE));
}

/** Formatea un monto en dólares. */
export function formatUsd(usd: number): string {
  return usdFormatter.format(roundMoney(usd));
}

/** Formatea un monto que ya está en bolívares (p. ej. el total_ves de una orden). */
export function formatBs(ves: number): string {
  return vesFormatter.format(roundMoney(ves));
}
