// Textos, colores y acciones del admin para cada estado de una orden.
// Las transiciones permitidas son las mismas de backend/services/orders.py.
import type { OrderStatus } from "@/lib/api/types";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PAYMENT_SUBMITTED: "Por verificar",
  PENDING: "Esperando pago",
  PAID: "Pagados",
  PROCESSING: "Preparando",
  SHIPPED: "Enviados",
  DELIVERED: "Entregados",
  CANCELLED: "Cancelados",
};

/** Orden de las pestañas del panel (lo urgente primero). */
export const STATUS_TABS: OrderStatus[] = [
  "PAYMENT_SUBMITTED",
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

export const STATUS_BADGE: Record<OrderStatus, string> = {
  PAYMENT_SUBMITTED: "bg-brand/15 text-brand-dark",
  PENDING: "bg-line text-ink/70",
  PAID: "bg-success/15 text-deep",
  PROCESSING: "bg-deep/10 text-deep",
  SHIPPED: "bg-deep/10 text-deep",
  DELIVERED: "bg-success/20 text-deep",
  CANCELLED: "bg-ink/10 text-ink/50",
};

export interface StatusAction {
  to: OrderStatus;
  label: string;
  kind: "primary" | "secondary" | "danger";
  /** Pide confirmación (y motivo, si cancela) antes de ejecutar. */
  confirm?: string;
}

export const STATUS_ACTIONS: Record<OrderStatus, StatusAction[]> = {
  PAYMENT_SUBMITTED: [
    { to: "PAID", label: "Aprobar pago", kind: "primary" },
    {
      to: "PENDING",
      label: "Rechazar referencia",
      kind: "secondary",
      confirm: "El cliente tendrá que enviar otra referencia. ¿Rechazar?",
    },
    { to: "CANCELLED", label: "Cancelar", kind: "danger", confirm: "Motivo de la cancelación" },
  ],
  PENDING: [
    { to: "CANCELLED", label: "Cancelar", kind: "danger", confirm: "Motivo de la cancelación" },
  ],
  PAID: [
    { to: "PROCESSING", label: "Pasar a preparación", kind: "primary" },
    { to: "CANCELLED", label: "Cancelar", kind: "danger", confirm: "Motivo de la cancelación" },
  ],
  PROCESSING: [
    { to: "SHIPPED", label: "Marcar como enviado", kind: "primary" },
    { to: "CANCELLED", label: "Cancelar", kind: "danger", confirm: "Motivo de la cancelación" },
  ],
  SHIPPED: [{ to: "DELIVERED", label: "Marcar como entregado", kind: "primary" }],
  DELIVERED: [],
  CANCELLED: [],
};
