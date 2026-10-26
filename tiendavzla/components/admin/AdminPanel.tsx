"use client";
// AdminPanel: requiere sesión de admin. Dos secciones:
//   - Pedidos: tasa BCV y pedidos por estado ("Por verificar" es el trabajo diario).
//   - Vendedores: revisar registros, aprobar y suspender tiendas.
// Los pedidos se refrescan solos cada 30 segundos.

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { adminApi, type OrdersSummary } from "@/lib/api/admin";
import { SessionApiError } from "@/lib/api/session";
import type { AdminOrder, OrderStatus } from "@/lib/api/types";
import { STATUS_LABEL, STATUS_TABS } from "@/lib/orderStatus";
import PanelHeader from "@/components/panel/PanelHeader";
import { useRequireSession } from "@/components/panel/useRequireSession";
import OrderCard from "./OrderCard";
import RateCard from "./RateCard";
import SellersAdmin from "./SellersAdmin";

const REFRESH_MS = 30_000;

type Section = "orders" | "sellers";

export default function AdminPanel() {
  const { me, error, reload, logout } = useRequireSession();
  const [section, setSection] = useState<Section>("orders");

  // Si la sesión vence mientras el panel está abierto, se vuelve a pedir el login.
  const onApiError = useCallback(
    (err: unknown) => {
      if (err instanceof SessionApiError && err.status === 401) void reload();
    },
    [reload],
  );

  if (error) return <p className="p-8 text-center text-brand-dark">{error}</p>;
  if (!me) return <div className="mx-auto mt-16 h-64 max-w-4xl animate-pulse rounded-2xl bg-line/50" />;
  if (!me.isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <ShieldAlert className="mx-auto size-10 text-brand" />
        <p className="mt-3 text-lg font-bold">Esta sección es solo para administradores.</p>
        <button type="button" onClick={logout} className="mt-4 text-sm font-semibold text-brand hover:underline">
          Entrar con otra cuenta
        </button>
      </div>
    );
  }

  return (
    <>
      <PanelHeader me={me} current="admin" onLogout={logout} />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <nav className="flex gap-2" aria-label="Secciones del panel">
          {(
            [
              ["orders", "Pedidos"],
              ["sellers", "Vendedores"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              aria-current={section === key ? "page" : undefined}
              className={`rounded-xl px-4 py-2 text-lg font-bold transition ${
                section === key ? "bg-ink text-white" : "text-ink/50 hover:bg-line/60"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="mt-6">
          {section === "orders" ? <OrdersSection onApiError={onApiError} /> : <SellersAdmin onApiError={onApiError} />}
        </div>
      </div>
    </>
  );
}

function OrdersSection({ onApiError }: { onApiError: (err: unknown) => void }) {
  const [tab, setTab] = useState<OrderStatus>("PAYMENT_SUBMITTED");
  const [summary, setSummary] = useState<OrdersSummary | null>(null);
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, list] = await Promise.all([adminApi.summary(), adminApi.orders(tab)]);
      setSummary(s);
      setOrders(list);
      setError(null);
    } catch (err) {
      onApiError(err);
      setError("No se pudieron cargar los pedidos. ¿Está corriendo la API?");
    } finally {
      setLoading(false);
    }
  }, [tab, onApiError]);

  useEffect(() => {
    setOrders(null);
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const changeStatus = async (order: AdminOrder, to: OrderStatus, reason?: string) => {
    try {
      await adminApi.updateStatus(order.id, to, reason);
    } catch (err) {
      onApiError(err);
      throw err;
    }
    // La orden cambió de estado, así que sale de esta pestaña.
    setOrders((list) => list?.filter((o) => o.id !== order.id) ?? null);
    void load();
  };

  return (
    <>
      <RateCard />

      <div className="mt-8 flex items-center justify-between gap-3">
        <nav aria-label="Estados de los pedidos" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {STATUS_TABS.map((status) => {
            const count = summary?.[status] ?? 0;
            const active = status === tab;
            const urgent = status === "PAYMENT_SUBMITTED" && count > 0;
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

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-brand/10 px-4 py-3 text-sm text-brand-dark">
          {error}
        </p>
      )}

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
    </>
  );
}
