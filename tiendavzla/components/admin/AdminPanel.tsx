"use client";
// AdminPanel: entrada con la clave de admin, tasa BCV y pedidos por estado.
// La pestaña "Por verificar" es el trabajo diario: revisar la referencia en el banco
// y aprobar o rechazar. La lista se refresca sola cada 30 segundos.

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2, LogOut, RefreshCw } from "lucide-react";
import {
  AdminAuthError,
  adminApi,
  getStoredAdminKey,
  storeAdminKey,
  type OrdersSummary,
} from "@/lib/api/admin";
import type { AdminOrder, OrderStatus } from "@/lib/api/types";
import { STATUS_LABEL, STATUS_TABS } from "@/lib/orderStatus";
import OrderCard from "./OrderCard";
import RateCard from "./RateCard";

const REFRESH_MS = 30_000;

export default function AdminPanel() {
  // undefined = todavía leyendo sessionStorage; null = sin sesión.
  const [adminKey, setAdminKey] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setAdminKey(getStoredAdminKey());
  }, []);

  const logout = useCallback(() => {
    storeAdminKey(null);
    setAdminKey(null);
  }, []);

  if (adminKey === undefined) return null;
  if (adminKey === null) {
    return (
      <AdminLogin
        onLogin={(key) => {
          storeAdminKey(key);
          setAdminKey(key);
        }}
      />
    );
  }
  return <Dashboard adminKey={adminKey} onLogout={logout} />;
}

function AdminLogin({ onLogin }: { onLogin: (key: string) => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setError(null);
    try {
      await adminApi.summary(key.trim()); // valida la clave contra la API
      onLogin(key.trim());
    } catch (err) {
      setError(
        err instanceof AdminAuthError ? err.message : "No se pudo conectar con la API",
      );
      setChecking(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-24 max-w-sm rounded-2xl border border-line bg-white p-6 shadow-sm"
    >
      <h1 className="text-xl font-bold">Panel de TiendaVzla</h1>
      <label htmlFor="admin-key" className="mt-4 block text-sm font-semibold text-ink/80">
        Clave de administrador
      </label>
      <input
        id="admin-key"
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        autoComplete="current-password"
        className="mt-1.5 w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
      />
      <p className="mt-1.5 text-xs text-ink/50">Es el ADMIN_API_KEY del archivo backend/.env.</p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-brand-dark">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={checking || !key.trim()}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-deep py-3 font-semibold text-white transition hover:bg-deep/90 disabled:opacity-50"
      >
        {checking && <Loader2 className="size-4 animate-spin" />}
        Entrar
      </button>
    </form>
  );
}

function Dashboard({ adminKey, onLogout }: { adminKey: string; onLogout: () => void }) {
  const [tab, setTab] = useState<OrderStatus>("PAYMENT_SUBMITTED");
  const [summary, setSummary] = useState<OrdersSummary | null>(null);
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, list] = await Promise.all([
        adminApi.summary(adminKey),
        adminApi.orders(adminKey, tab),
      ]);
      setSummary(s);
      setOrders(list);
      setError(null);
    } catch (err) {
      if (err instanceof AdminAuthError) onLogout();
      else setError("No se pudieron cargar los pedidos. ¿Está corriendo la API?");
    } finally {
      setLoading(false);
    }
  }, [adminKey, tab, onLogout]);

  useEffect(() => {
    setOrders(null);
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const changeStatus = async (order: AdminOrder, to: OrderStatus, reason?: string) => {
    try {
      await adminApi.updateStatus(adminKey, order.id, to, reason);
    } catch (err) {
      if (err instanceof AdminAuthError) onLogout();
      throw err;
    }
    // La orden cambió de estado, así que sale de esta pestaña.
    setOrders((list) => list?.filter((o) => o.id !== order.id) ?? null);
    void load();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-brand">TiendaVzla</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Panel de pedidos</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold transition hover:bg-line/50 disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-ink/60 transition hover:bg-line/50"
          >
            <LogOut className="size-4" />
            Salir
          </button>
        </div>
      </header>

      <div className="mt-6">
        <RateCard adminKey={adminKey} />
      </div>

      <nav
        aria-label="Estados de los pedidos"
        className="-mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
      >
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

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-brand/10 px-4 py-3 text-sm text-brand-dark">
          {error}
        </p>
      )}

      <div className="mt-4 space-y-4">
        {orders === null ? (
          Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-line/50" />
          ))
        ) : orders.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line py-16 text-center text-ink/50">
            No hay pedidos en “{STATUS_LABEL[tab]}”.
          </p>
        ) : (
          orders.map((order) => (
            <OrderCard key={order.id} order={order} onChangeStatus={changeStatus} />
          ))
        )}
      </div>
    </div>
  );
}
