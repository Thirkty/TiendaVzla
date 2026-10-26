// Cliente de los endpoints de administración. Todas las llamadas llevan el header
// X-Admin-Key con la clave que el admin escribe al entrar a /admin.
import { API_URL } from "./client";
import type { AdminOrder, ExchangeRate, OrderStatus, RateStatus } from "./types";

const KEY_STORAGE = "tiendavzla-admin-key";

export class AdminAuthError extends Error {
  constructor() {
    super("Clave de administrador incorrecta");
    this.name = "AdminAuthError";
  }
}

export function getStoredAdminKey(): string | null {
  try {
    return sessionStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}

export function storeAdminKey(key: string | null) {
  try {
    if (key) sessionStorage.setItem(KEY_STORAGE, key);
    else sessionStorage.removeItem(KEY_STORAGE);
  } catch {
    // Sin sessionStorage hay que volver a escribir la clave al recargar.
  }
}

async function adminFetch<T>(
  key: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "X-Admin-Key": key,
      ...(init.body !== undefined && { "Content-Type": "application/json" }),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (res.status === 401) throw new AdminAuthError();
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail;
    throw new Error(typeof detail === "string" ? detail : `Error ${res.status}`);
  }
  return data as T;
}

export type OrdersSummary = Record<OrderStatus, number>;

export const adminApi = {
  summary: (key: string) => adminFetch<OrdersSummary>(key, "/api/admin/orders/summary"),

  orders: (key: string, status: OrderStatus, limit = 100) =>
    adminFetch<AdminOrder[]>(key, `/api/admin/orders?status=${status}&limit=${limit}`),

  updateStatus: (key: string, orderId: string, status: OrderStatus, reason?: string) =>
    adminFetch<AdminOrder>(key, `/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
      method: "PATCH",
      body: { status, ...(reason && { reason }) },
    }),

  rateStatus: (key: string) => adminFetch<RateStatus>(key, "/api/admin/rate/status"),

  setRate: (key: string, rate: number) =>
    adminFetch<ExchangeRate>(key, "/api/admin/rate", { method: "PUT", body: { rate } }),

  refreshRate: (key: string) =>
    adminFetch<ExchangeRate>(key, "/api/admin/rate/refresh", { method: "POST" }),
};
