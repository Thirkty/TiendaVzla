// Endpoints de administración. Usan la sesión del admin (cookie); si no hay sesión la
// API responde 401 y si la cuenta no es admin, 403.
import type { StatusChangeExtra } from "@/lib/orderStatus";
import { sessionFetch } from "./session";
import type {
  AdminOrder,
  AdminSeller,
  ExchangeRate,
  OrderStatus,
  RateStatus,
  SellerStatus,
} from "./types";

export type OrdersSummary = Record<OrderStatus, number>;

export const adminApi = {
  summary: () => sessionFetch<OrdersSummary>("/api/admin/orders/summary"),

  orders: (status: OrderStatus, limit = 100) =>
    sessionFetch<AdminOrder[]>(`/api/admin/orders?status=${status}&limit=${limit}`),

  updateStatus: (orderId: string, status: OrderStatus, extra: StatusChangeExtra = {}) =>
    sessionFetch<AdminOrder>(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
      method: "PATCH",
      json: { status, ...extra },
    }),

  rateStatus: () => sessionFetch<RateStatus>("/api/admin/rate/status"),

  setRate: (rate: number) =>
    sessionFetch<ExchangeRate>("/api/admin/rate", { method: "PUT", json: { rate } }),

  refreshRate: () => sessionFetch<ExchangeRate>("/api/admin/rate/refresh", { method: "POST" }),

  sellers: (status?: SellerStatus) =>
    sessionFetch<AdminSeller[]>(`/api/admin/sellers${status ? `?status=${status}` : ""}`),

  updateSellerStatus: (sellerId: string, status: SellerStatus, note?: string) =>
    sessionFetch<AdminSeller>(`/api/admin/sellers/${encodeURIComponent(sellerId)}/status`, {
      method: "PATCH",
      json: { status, ...(note && { note }) },
    }),
};
