// Datos de la cuenta que recibe los Pago Móvil. Se configuran en .env.local
// (variables NEXT_PUBLIC_PAGO_MOVIL_*); reinicia `npm run dev` después de cambiarlas.

export const PAGO_MOVIL = {
  bank: process.env.NEXT_PUBLIC_PAGO_MOVIL_BANCO ?? "",
  phone: process.env.NEXT_PUBLIC_PAGO_MOVIL_TELEFONO ?? "",
  idNumber: process.env.NEXT_PUBLIC_PAGO_MOVIL_CEDULA ?? "",
} as const;

/** Clave del sessionStorage donde guardamos la orden pendiente (por si recargan la página). */
export const PENDING_ORDER_KEY = "tiendavzla-pending-order";
