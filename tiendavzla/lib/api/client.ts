// Fuente de datos real: consulta la API de FastAPI (backend/).
// Misma interfaz que mock.ts, así los componentes no cambian.
import type { CartItem, CustomerField, CustomerInput, Order, Product } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiGet<T>(path: string): Promise<T> {
  // no-store: el stock cambia con cada compra, no queremos datos cacheados.
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} respondió ${res.status}`);
  return res.json() as Promise<T>;
}

export async function getProducts(): Promise<Product[]> {
  try {
    return await apiGet<Product[]>("/api/products");
  } catch (error) {
    // Si la API está caída mostramos el catálogo vacío en vez de romper la página.
    console.error("No se pudieron cargar los productos:", error);
    return [];
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const res = await fetch(`${API_URL}/api/products/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /api/products/${slug} respondió ${res.status}`);
  return res.json() as Promise<Product>;
}

/* ---------- Checkout y pago ---------- */

/** Error de la API con un mensaje listo para mostrar y, si aplica, errores por campo. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: Partial<Record<CustomerField, string>> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ValidationIssue {
  loc: (string | number)[];
  msg: string;
}

interface StockIssue {
  name: string;
  requested: number;
  available: number;
}

/** Traduce el `detail` de FastAPI (string, objeto o lista de 422) a un ApiError. */
function toApiError(status: number, detail: unknown): ApiError {
  if (typeof detail === "string") return new ApiError(detail, status);

  if (Array.isArray(detail)) {
    const fieldErrors: Partial<Record<CustomerField, string>> = {};
    for (const issue of detail as ValidationIssue[]) {
      const field = issue.loc.at(-1);
      if (issue.loc.includes("customer") && typeof field === "string") {
        fieldErrors[field as CustomerField] = issue.msg.replace(/^Value error, /, "");
      }
    }
    return new ApiError("Revisa los datos marcados en el formulario.", status, fieldErrors);
  }

  if (detail && typeof detail === "object" && "message" in detail) {
    const { message, items } = detail as { message: string; items?: StockIssue[] };
    if (items?.length) {
      const lines = items.map((i) => `${i.name}: quedan ${i.available}`);
      return new ApiError(`${message}. ${lines.join(" · ")}`, status);
    }
    return new ApiError(message, status);
  }

  return new ApiError("Algo salió mal. Intenta de nuevo.", status);
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("No pudimos conectar con la tienda. Revisa tu conexión.", 0);
  }
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw toApiError(res.status, (data as { detail?: unknown } | null)?.detail);
  }
  return data as T;
}

/** Crea la orden en PENDING. El backend recalcula precios y reserva el stock. */
export function createOrder(customer: CustomerInput, items: CartItem[]): Promise<Order> {
  return apiPost<Order>("/api/checkout", {
    customer,
    items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
  });
}

/** Registra la referencia del Pago Móvil (PENDING -> PAID). */
export function confirmPayment(orderId: string, reference: string): Promise<Order> {
  return apiPost<Order>(`/api/orders/${encodeURIComponent(orderId)}/pay`, { reference });
}
