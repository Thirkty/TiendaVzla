// Cliente para los endpoints que usan la sesión (cookie httpOnly que pone la API):
// cuentas, panel del vendedor y panel de admin. Todas las llamadas van con
// credentials: "include" para que el navegador envíe la cookie.
import { API_URL } from "./client";
import type { Me } from "./types";

/** Error de la API con mensaje para mostrar y, si aplica, errores por campo (422). */
export class SessionApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "SessionApiError";
  }
}

interface ValidationIssue {
  loc: (string | number)[];
  msg: string;
}

function toError(status: number, detail: unknown): SessionApiError {
  if (typeof detail === "string") return new SessionApiError(detail, status);
  if (Array.isArray(detail)) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of detail as ValidationIssue[]) {
      const field = issue.loc.at(-1);
      if (typeof field === "string") {
        fieldErrors[field] = issue.msg.replace(/^(Value error|String should[^,]*), ?/, "");
      }
    }
    return new SessionApiError("Revisa los datos marcados.", status, fieldErrors);
  }
  return new SessionApiError(`Algo salió mal (${status}). Intenta de nuevo.`, status);
}

export async function sessionFetch<T>(
  path: string,
  init: { method?: string; json?: unknown; form?: FormData } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? (init.json !== undefined || init.form ? "POST" : "GET"),
      credentials: "include",
      headers: init.json !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.json !== undefined ? JSON.stringify(init.json) : init.form,
      cache: "no-store",
    });
  } catch {
    throw new SessionApiError("No pudimos conectar con el servidor.", 0);
  }
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toError(res.status, (data as { detail?: unknown } | null)?.detail);
  return data as T;
}

/* ---------- Cuentas ---------- */

export interface SellerRegistration {
  email: string;
  password: string;
  storeName: string;
  whatsapp: string;
  pagoMovilBank: string;
  pagoMovilPhone: string;
  pagoMovilId: string;
}

export const accountApi = {
  /** Usuario conectado, o null si no hay sesión. */
  me: async (): Promise<Me | null> => {
    try {
      return await sessionFetch<Me>("/api/auth/me");
    } catch (err) {
      if (err instanceof SessionApiError && err.status === 401) return null;
      throw err;
    }
  },
  login: (email: string, password: string) =>
    sessionFetch<Me>("/api/auth/login", { json: { email, password } }),
  logout: () => sessionFetch<void>("/api/auth/logout", { method: "POST" }),
  registerSeller: (data: SellerRegistration) =>
    sessionFetch<Me>("/api/auth/register-seller", { json: data }),
};

/** A dónde mandar al usuario después de entrar. */
export function homeFor(me: Me): string {
  if (me.isAdmin) return "/admin";
  if (me.seller) return "/vendedor";
  return "/";
}
