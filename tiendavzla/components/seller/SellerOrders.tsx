"use client";
// SellerOrders: pedidos de la tienda por estado. "Por verificar" es el trabajo diario:
// revisar en tu banco que llegó el Pago Móvil y aprobar; después preparar y despachar
// con agencia y guía. Se refresca solo cada 30 segundos.

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { sellerApi } from "@/lib/api/seller";
import type { OrderStatus, SellerOrder } from "@/lib/api/types";
import { STATUS_LABEL, STATUS_TABS, type StatusChangeExtra } from "@/lib/orderStatus";
import OrderCard from "@/components/orders/OrderCard";

const REFRESH_MS = 30_000;

export default function SellerOrders() {
  const [tab, setTab] = useState<OrderStatus>("PAYMENT_SUBMITTED");
  const [summary, setSummary] = useState<Record<OrderStatus, number> | null>(null);
  const [orders, setOrders] = useState<SellerOrder[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, list] = await Promise.all([sellerApi.ordersSummary(), sellerApi.orders(tab)]);
      setSummary(s);
      setOrders(list);
      setError(null);
    } catch {
      setError("No se pudieron cargar tus pedidos.");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    setOrders(null);
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const changeStatus = async (order: SellerOrder, to: OrderStatus, extra?: StatusChangeExtra) => {
    await sellerApi.updateOrderStatus(order.id, to, extra);
    setOrders((list) => list?.filter((o) => o.id !== order.id) ?? null);
    void load();
  };

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <nav aria-label="Estados de los pedidos" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {STATUS_TABS.map((status) => {
            const count = summary?.[status] ?? 0;
            const active = status === tab;
            const urgent = (status === "PAYMENT_SUBMITTED" || status === "PAID") && count > 0;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setTab(status)}
                aria-current={active ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active ? "bg-deep text-white" : "border border-line bg-white text-ink/70 hover:bg-line/50"
                }`}
              >
                {STATUS_LABEL[status]}
                <span
                  className={`rounded-full px-1.5 text-xs tabular-nums ${
                    urgent ? "bg-brand text-white" : active ? "bg-white/20" : "bg-line"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Actualizar pedidos"
          className="shrink-0 rounded-xl border border-line bg-white p-2 transition hover:bg-line/50 disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {tab === "PAYMENT_SUBMITTED" && (orders?.length ?? 0) > 0 && (
        <p className="mt-3 rounded-xl bg-deep/5 px-4 py-3 text-sm text-deep">
          Revisa en tu banco que el Pago Móvil llegó con esa referencia y ese monto antes de aprobar.
        </p>
      )}

      {error && <p className="mt-4 text-sm text-brand-dark">{error}</p>}

      <div className="mt-4 space-y-4">
        {orders === null ? (
          Array.from({ length: 2 }, (_, i) => <div key={i} className="h-48 animate-pulse rounded-2xl bg-line/50" />)
        ) : orders.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line py-16 text-center text-ink/50">
            No hay pedidos en “{STATUS_LABEL[tab]}”.
          </p>
        ) : (
          orders.map((order) => <OrderCard key={order.id} order={order} onChangeStatus={changeStatus} />)
        )}
      </div>
    </section>
  );
}
