"use client";
// OrderCard: un pedido en el panel de admin. Datos de envío, monto,
// referencia del Pago Móvil, despacho (agencia y guía) y botones para el siguiente estado.

import { useState, type FormEvent } from "react";
import { Check, Loader2, MapPin, MessageCircle, PackageSearch, Truck } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import type { AdminOrder, OrderStatus, SupplierRequest } from "@/lib/api/types";
import {
  CARRIERS,
  STATUS_ACTIONS,
  STATUS_BADGE,
  STATUS_LABEL,
  type StatusAction,
  type StatusChangeExtra,
} from "@/lib/orderStatus";
import { formatBs, formatUsd } from "@/lib/utils/format";

interface OrderCardProps {
  order: AdminOrder;
  onChangeStatus: (order: AdminOrder, to: OrderStatus, extra?: StatusChangeExtra) => Promise<void>;
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

const INPUT =
  "min-w-0 rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/15";

/** 04141234567 -> https://wa.me/584141234567 */
function whatsappLink(phone: string): string {
  return `https://wa.me/58${phone.replace(/^0/, "")}`;
}

type Panel = "actions" | "cancel" | "ship";

export default function OrderCard({ order, onChangeStatus }: OrderCardProps) {
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [panel, setPanel] = useState<Panel>("actions");
  const [reason, setReason] = useState("");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { shipping } = order;

  const change = async (to: OrderStatus, extra?: StatusChangeExtra) => {
    setBusy(to);
    setError(null);
    try {
      await onChangeStatus(order, to, extra);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar");
      setBusy(null);
    }
  };

  const handleAction = (action: StatusAction) => {
    if (action.to === "CANCELLED") return setPanel("cancel");
    if (action.to === "SHIPPED") return setPanel("ship");
    if (action.confirm && !window.confirm(action.confirm)) return;
    void change(action.to);
  };

  const submitCancel = (e: FormEvent) => {
    e.preventDefault();
    void change("CANCELLED", { reason: reason.trim() || undefined });
  };

  const submitShip = (e: FormEvent) => {
    e.preventDefault();
    if (!carrier) return setError("Elige la agencia");
    if (!tracking.trim()) return setError("Escribe el número de guía");
    void change("SHIPPED", { carrier, trackingNumber: tracking.trim() });
  };

  return (
    <article className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold">#{order.id.slice(0, 8).toUpperCase()}</h3>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[order.status]}`}>
            {STATUS_LABEL[order.status]}
          </span>
        </div>
        <time className="text-sm text-ink/50" dateTime={order.createdAt}>
          {dateFormatter.format(new Date(order.createdAt))}
        </time>
      </header>

      <div className="mt-4 grid gap-5 md:grid-cols-[1fr_1fr_auto]">
        {/* Contacto y envío de este pedido */}
        <div className="space-y-1 text-sm">
          <p className="font-semibold">{shipping.name}</p>
          <p className="text-ink/60">{shipping.cedula}</p>
          <a
            href={whatsappLink(shipping.phone)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-deep hover:underline"
          >
            <MessageCircle className="size-4" />
            {shipping.phone}
          </a>
          <p className="flex gap-1.5 text-ink/70">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            <span>
              {shipping.addressStreet}, {shipping.addressCity}, {shipping.addressState}
              {shipping.addressReference && (
                <span className="block text-ink/50">Ref: {shipping.addressReference}</span>
              )}
            </span>
          </p>
        </div>

        {/* Productos */}
        <div className="text-sm">
          <ul className="space-y-1">
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
            <li className="flex justify-between gap-3 text-ink/50">
              <span>Envío</span>
              <span className="tabular-nums">
                {order.shippingUsd > 0 ? formatUsd(order.shippingUsd) : "Gratis"}
              </span>
            </li>
          </ul>
          {order.carrier && (
            <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-deep/5 px-2.5 py-1.5 text-deep">
              <Truck className="size-4 shrink-0" />
              {order.carrier} · guía <span className="font-mono font-semibold">{order.trackingNumber}</span>
            </p>
          )}
        </div>

        {/* Pago */}
        <div className="rounded-xl bg-cream p-3 text-sm md:min-w-56 md:text-right">
          <p className="text-xl font-extrabold tabular-nums">{formatBs(order.totalVes)}</p>
          <p className="text-ink/50">
            {formatUsd(order.totalUsd)} · tasa {order.bcvRate.toLocaleString("es-VE")}
          </p>
          {order.paymentReference && (
            <p className="mt-2">
              <span className="text-ink/60">Referencia </span>
              <span className="font-mono text-base font-bold tracking-wider">{order.paymentReference}</span>
            </p>
          )}
          {order.status === "PENDING" && order.expiresAt && (
            <p className="mt-2 text-xs text-ink/50">Vence {dateFormatter.format(new Date(order.expiresAt))}</p>
          )}
          {order.status === "CANCELLED" && order.cancelReason && (
            <p className="mt-2 text-xs text-ink/60">Motivo: {order.cancelReason}</p>
          )}
          {order.status !== "CANCELLED" && (
            <p className="mt-2 border-t border-line pt-2 text-xs">
              {order.profitUsd !== null && order.costUsd !== null ? (
                <span className={order.profitUsd >= 0 ? "text-deep" : "text-brand-dark"}>
                  Costo {formatUsd(order.costUsd)} · <span className="font-bold">ganas {formatUsd(order.profitUsd)}</span>
                </span>
              ) : (
                <span className="text-ink/50">Sin costo cargado en algún producto</span>
              )}
            </p>
          )}
        </div>
      </div>

      {SUPPLIER_STATUSES.has(order.status) && <SupplierRequestPanel order={order} />}

      {STATUS_ACTIONS[order.status].length > 0 && (
        <footer className="mt-4 border-t border-line pt-4">
          {panel === "cancel" && (
            <form onSubmit={submitCancel} className="flex flex-wrap items-center gap-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                autoFocus
                placeholder="Motivo (ej: el pago no llegó)"
                aria-label="Motivo de la cancelación"
                className={`${INPUT} flex-1`}
              />
              <button
                type="submit"
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy === "CANCELLED" && <Loader2 className="size-4 animate-spin" />}
                Confirmar cancelación
              </button>
              <BackButton onClick={() => setPanel("actions")} />
              <p className="w-full text-xs text-ink/50">El stock de estos productos se devuelve.</p>
            </form>
          )}

          {panel === "ship" && (
            <form onSubmit={submitShip} className="flex flex-wrap items-center gap-2">
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                aria-label="Agencia de envío"
                className={INPUT}
              >
                <option value="" disabled>
                  Agencia…
                </option>
                {CARRIERS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                maxLength={60}
                placeholder="Número de guía"
                aria-label="Número de guía"
                className={`${INPUT} flex-1`}
              />
              <button
                type="submit"
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {busy === "SHIPPED" && <Loader2 className="size-4 animate-spin" />}
                Marcar como enviado
              </button>
              <BackButton onClick={() => setPanel("actions")} />
              <p className="w-full text-xs text-ink/50">
                El cliente verá la agencia y la guía. Si entregas tú mismo, elige “Delivery propio” y
                escribe una referencia.
              </p>
            </form>
          )}

          {panel === "actions" && (
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

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl px-3 py-2 text-sm font-semibold text-ink/60 hover:bg-line/50"
    >
      Volver
    </button>
  );
}

/** Estados en los que tiene sentido pedirle la mercancía al proveedor. */
const SUPPLIER_STATUSES = new Set<OrderStatus>(["PAID", "PROCESSING"]);

/** Pedir la mercancía al proveedor: abre WhatsApp con el mensaje armado y marca el pedido. */
function SupplierRequestPanel({ order }: { order: AdminOrder }) {
  const [request, setRequest] = useState<SupplierRequest | null>(null);
  const [requestedAt, setRequestedAt] = useState(order.supplierRequestedAt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setLoading(true);
    setError(null);
    try {
      setRequest(await adminApi.supplierRequest(order.id));
    } catch {
      setError("No se pudo armar el mensaje.");
    } finally {
      setLoading(false);
    }
  };

  const markRequested = async () => {
    try {
      setRequestedAt((await adminApi.markSupplierRequested(order.id)).supplierRequestedAt);
    } catch {
      setError("No se pudo marcar como pedido.");
    }
  };

  return (
    <div className="mt-4 rounded-xl bg-deep/5 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold text-deep">
          <PackageSearch className="size-4" />
          {requestedAt
            ? `Pedido al proveedor el ${dateFormatter.format(new Date(requestedAt))}`
            : "Falta pedirle la mercancía al proveedor"}
        </p>
        {!request && (
          <button
            type="button"
            onClick={() => void open()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-deep/20 bg-white px-3 py-1.5 font-semibold text-deep transition hover:bg-deep/10 disabled:opacity-50"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {requestedAt ? "Ver mensaje" : "Pedir al proveedor"}
          </button>
        )}
      </div>

      {request && (
        <div className="mt-3 space-y-3">
          {request.missingSupplier.length > 0 && (
            <p className="text-brand-dark">
              Sin proveedor asignado: {request.missingSupplier.join(", ")}. Asígnalo en Productos.
            </p>
          )}
          {request.messages.map((m) => (
            <div key={m.supplier.id} className="rounded-lg bg-white p-3">
              <p className="font-semibold">{m.supplier.name}</p>
              <pre className="mt-1 whitespace-pre-wrap font-sans text-xs text-ink/70">{m.message}</pre>
              <a
                href={m.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  if (!requestedAt) void markRequested();
                }}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-whatsapp px-3 py-1.5 font-semibold text-white transition hover:opacity-90"
              >
                <MessageCircle className="size-4" />
                Enviar por WhatsApp
              </a>
            </div>
          ))}
          {!requestedAt && request.messages.length > 0 && (
            <button
              type="button"
              onClick={() => void markRequested()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-deep hover:underline"
            >
              <Check className="size-3.5" />
              Ya lo pedí por otro medio
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-brand-dark">{error}</p>}
    </div>
  );
}
