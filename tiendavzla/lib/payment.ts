// Los datos de Pago Móvil vienen de cada vendedor en la respuesta del checkout
// (order.seller); ya no hay una cuenta única de la plataforma.

/** Clave del sessionStorage donde guardamos las órdenes pendientes (por si recargan). */
export const PENDING_ORDER_KEY = "tiendavzla-pending-orders";
