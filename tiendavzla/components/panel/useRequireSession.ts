"use client";
// Carga el usuario conectado; si no hay sesión, manda a /entrar y vuelve aquí después.

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { accountApi } from "@/lib/api/session";
import type { Me } from "@/lib/api/types";

export function useRequireSession() {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const current = await accountApi.me();
      if (current === null) {
        router.replace(`/entrar?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setMe(current);
    } catch {
      setError("No pudimos conectar con el servidor. Intenta de nuevo en un momento.");
    }
  }, [router, pathname]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const logout = useCallback(async () => {
    await accountApi.logout().catch(() => undefined);
    router.replace("/entrar");
  }, [router]);

  return { me, error, reload, logout };
}
