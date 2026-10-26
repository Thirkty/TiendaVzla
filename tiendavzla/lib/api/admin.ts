// Endpoints del panel de admin: pedidos, productos, configuración y tasa. Usan la sesión
// del admin (cookie); sin sesión la API responde 401 y si la cuenta no es admin, 403.
import type { StatusChangeExtra } from "@/lib/orderStatus";
import { sessionFetch } from "./session";
import type {
  AdminOrder,
  AdminProduct,
  ExchangeRate,
  OfferInput,
  OrderStatus,
  ProductInput,
  RateStatus,
  SalesSummary,
  StoreSettings,
  Supplier,
  SupplierInput,
  SupplierRequest,
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

  store: () => sessionFetch<StoreSettings>("/api/admin/store"),
  updateStore: (data: StoreSettings) =>
    sessionFetch<StoreSettings>("/api/admin/store", { method: "PUT", json: data }),

  products: () => sessionFetch<AdminProduct[]>("/api/admin/products"),
  createProduct: (data: ProductInput) =>
    sessionFetch<AdminProduct>("/api/admin/products", { json: data }),
  updateProduct: (id: string, data: Partial<ProductInput>) =>
    sessionFetch<AdminProduct>(`/api/admin/products/${encodeURIComponent(id)}`, {
      method: "PATCH",
      json: data,
    }),

  setProductOffers: (productId: string, offers: OfferInput[]) =>
    sessionFetch<AdminProduct>(`/api/admin/products/${encodeURIComponent(productId)}/suppliers`, {
      method: "PUT",
      json: { offers },
    }),

  suppliers: () => sessionFetch<Supplier[]>("/api/admin/suppliers"),
  createSupplier: (data: SupplierInput) =>
    sessionFetch<Supplier>("/api/admin/suppliers", { json: data }),
  updateSupplier: (id: string, data: SupplierInput) =>
    sessionFetch<Supplier>(`/api/admin/suppliers/${encodeURIComponent(id)}`, {
      method: "PUT",
      json: data,
    }),

  /** Mensajes de WhatsApp para pedirle la mercancía de un pedido a cada proveedor. */
  supplierRequest: (orderId: string) =>
    sessionFetch<SupplierRequest>(`/api/admin/orders/${encodeURIComponent(orderId)}/supplier-request`),
  markSupplierRequested: (orderId: string) =>
    sessionFetch<AdminOrder>(`/api/admin/orders/${encodeURIComponent(orderId)}/supplier-request`, {
      method: "POST",
    }),

  salesSummary: (days = 30) =>
    sessionFetch<SalesSummary>(`/api/admin/reports/summary?days=${days}`),

  /** Sube una foto; la API la valida, la achica y devuelve su URL. */
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return sessionFetch<{ url: string }>("/api/admin/uploads", { form });
  },
};
