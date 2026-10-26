"use client";
// ProductsAdmin: productos de la tienda (publicados u ocultos) con alta y edición.

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { EyeOff, Pencil, Plus } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import type { AdminProduct } from "@/lib/api/types";
import { formatUsd } from "@/lib/utils/format";
import { FormError, primaryButton } from "@/components/ui/form";
import ProductEditor from "./ProductEditor";

export default function ProductsAdmin({ onApiError }: { onApiError: (err: unknown) => void }) {
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [editing, setEditing] = useState<AdminProduct | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setProducts(await adminApi.products());
    } catch (err) {
      onApiError(err);
      setError("No se pudieron cargar los productos.");
    }
  }, [onApiError]);

  useEffect(() => {
    void load();
  }, [load]);

  const saved = (product: AdminProduct) => {
    setProducts((list) =>
      editing === "new"
        ? [product, ...(list ?? [])]
        : (list ?? []).map((p) => (p.id === product.id ? product : p)),
    );
    setEditing(null);
  };

  return (
    <section>
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink/60">
          {products ? `${products.length} ${products.length === 1 ? "producto" : "productos"}` : "Cargando…"}
        </p>
        <button type="button" onClick={() => setEditing("new")} className={primaryButton}>
          <Plus className="size-4" />
          Nuevo producto
        </button>
      </div>

      <FormError message={error} />

      {products?.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-line py-16 text-center text-ink/60">
          Aún no hay productos. Crea el primero con “Nuevo producto”.
        </div>
      )}

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products?.map((p) => (
          <li key={p.id} className="flex gap-3 rounded-2xl border border-line bg-white p-3 shadow-sm">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-line/50">
              <Image src={p.imageUrl} alt="" fill sizes="80px" className="object-cover" />
              {!p.isActive && (
                <span className="absolute inset-0 flex items-center justify-center bg-ink/50 text-white">
                  <EyeOff className="size-5" />
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</p>
              <p className="text-sm tabular-nums">
                {formatUsd(p.priceUsd)}{" "}
                <span className="text-ink/50">
                  · envío {p.shippingCostUsd > 0 ? formatUsd(p.shippingCostUsd) : "gratis"}
                </span>
              </p>
              <div className="mt-auto flex items-center justify-between pt-1">
                <span className={`text-xs font-medium ${p.stock === 0 ? "text-brand-dark" : "text-ink/50"}`}>
                  {p.isActive ? (p.stock === 0 ? "Agotado" : `${p.stock} disponibles`) : "Oculto"}
                </span>
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-deep hover:bg-line/60"
                >
                  <Pencil className="size-3.5" />
                  Editar
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <ProductEditor
          product={editing === "new" ? null : editing}
          onSaved={saved}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
