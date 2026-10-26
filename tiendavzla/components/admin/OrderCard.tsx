"use client";
// OrderCard: un pedido en el panel de admin, con datos del cliente, monto, referencia
// del Pago Móvil y los botones para moverlo al siguiente estado.

import { useState, type FormEvent } from "react";
import { Loader2, MapPin, MessageCircle } from "lucide-react";
import type { AdminOrder, OrderStatus } from "@/lib/api/types";
import { STATUS_ACTIONS, STATUS_BADGE, STATUS_LABEL, type StatusAction } from "@/lib/orderStatus";
import { formatBs, formatUsd } from "@/lib/utils/format";

interface OrderCardProps {
  order: AdminOrder;
  onChangeStatus: (order: AdminOrder, to: OrderStatus, reason?: string) => Promise<void>;
}

const dateFormatter = new Intl.DateTimeFormat("es-VE", {
  dateStyle: "short",
  timeStyle: "short",
});

const BUTTON_CLASSES: Record<StatusAction["kind"], string> = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  secondary: "border border-line bg-white hover:bg-line/50",
  danger: "text-ink/60 hover:bg-brand/10 hover:text-brand-dark",
};

/** 04141234567 -> https://wa.me/584141234567 */
function whatsappLink(phone: string): string {
  return `https://wa.me/58${phone.replace(/^0/, "")}`;
}

export default function OrderCard({ order, onChangeStatus }: OrderCardProps) {
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { customer } = order;

  const change = async (to: OrderStatus, why?: string) => {
    setBusy(to);
    setError(null);
    try {
      await onChangeStatus(order, to, why);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar");
      setBusy(null);
    }
  };

  const handleAction = (action: StatusAction) => {
    if (action.to === "CANCELLED") {
      setCancelling(true);
      return;
    }
    if (action.confirm && !window.confirm(action.confirm)) return;
    void change(action.to);
  };

  const submitCancel = (e: FormEvent) => {
    e.preventDefault();
    void change("CANCELLED", reason.trim() || undefined);
  };

  return (
    <article className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-bold">#{order.id.slice(0, 8).toUpperCase()}</h3>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[order.status]}`}
          >
            {STATUS_LABEL[order.status]}
          </span>
        </div>
        <time className="text-sm text-ink/50" dateTime={order.createdAt}>
          {dateFormatter.format(new Date(order.createdAt))}
        </time>
      </header>

      <div className="mt-4 grid gap-5 md:grid-cols-[1fr_1fr_auto]">
        {/* Cliente */}
        <div className="space-y-1 text-sm">
          <p className="font-semibold">{customer.name}</p>
          <p className="text-ink/60">{customer.cedula}</p>
          <a
            href={whatsappLink(customer.phone)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-deep hover:underline"
          >
            <MessageCircle className="size-4" />
            {customer.phone}
          </a>
          <p className="flex gap-1.5 text-ink/70">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            <span>
              {customer.addressStreet}, {customer.addressCity}, {customer.addressState}
              {customer.addressReference && (
                <span className="block text-ink/50">Ref: {customer.addressReference}</span>
              )}
            </span>
          </p>
        </div>

        {/* Productos */}
        <ul className="space-y-1 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span className="text-ink/70">
                <span className="font-semibold text-ink">{item.quantity}×</span> {item.product.name}
              </span>
              <span className="tabular-nums text-ink/60">
                {formatUsd(item.priceAtPurchase * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        {/* Pago */}
        <div className="rounded-xl bg-cream p-3 text-sm md:min-w-56 md:text-right">
          <p className="text-xl font-extrabold tabular-nums">{formatBs(order.totalVes)}</p>
          <p className="text-ink/50">
            {formatUsd(order.totalUsd)} · tasa {order.bcvRate.toLocaleString("es-VE")}
          </p>
          {order.paymentReference && (
            <p className="mt-2">
              <span className="text-ink/60">Referencia </span>
              <span className="font-mono text-base font-bold tracking-wider">
                {order.paymentReference}
              </span>
            </p>
          )}
          {order.status === "PENDING" && order.expiresAt && (
            <p className="mt-2 text-xs text-ink/50">
              Vence {dateFormatter.format(new Date(order.expiresAt))}
            </p>
          )}
          {order.status === "CANCELLED" && order.cancelReason && (
            <p className="mt-2 text-xs text-ink/60">Motivo: {order.cancelReason}</p>
          )}
        </div>
      </div>

      {STATUS_ACTIONS[order.status].length > 0 && (
        <footer className="mt-4 border-t border-line pt-4">
          {cancelling ? (
            <form onSubmit={submitCancel} className="flex flex-wrap items-center gap-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                autoFocus
                placeholder="Motivo (ej: el pago no llegó)"
                aria-label="Motivo de la cancelación"
                className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
              />
              <button
                type="submit"
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy === "CANCELLED" && <Loader2 className="size-4 animate-spin" />}
                Confirmar cancelación
              </button>
              <button
                type="button"
                onClick={() => setCancelling(false)}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-ink/60 hover:bg-line/50"
              >
                Volver
              </button>
              <p className="w-full text-xs text-ink/50">El stock de estos productos se devuelve.</p>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              {STATUS_ACTIONS[order.status].map((action) => (
                <button
                  key={action.to}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => handleAction(action)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${BUTTON_CLASSES[action.kind]}`}
                >
                  {busy === action.to && <Loader2 className="size-4 animate-spin" />}
                  {action.label}
                </button>
              ))}
            </div>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-brand-dark">
              {error}
            </p>
          )}
        </footer>
      )}
    </article>
  );
}
