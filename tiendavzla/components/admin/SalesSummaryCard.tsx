"use client";
// SalesSummaryCard: ventas y ganancia de los pedidos pagados en los últimos días.

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import type { SalesSummary } from "@/lib/api/types";
import { formatUsd } from "@/lib/utils/format";

const RANGES = [7, 30, 90] as const;

export default function SalesSummaryCard() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [summary, setSummary] = useState<SalesSummary | null>(null);

  useEffect(() => {
    setSummary(null);
    adminApi.salesSummary(days).then(setSummary).catch(() => undefined);
  }, [days]);

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-ink/60">
          <TrendingUp className="size-4" />
          Ventas pagadas
        </p>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setDays(r)}
              aria-pressed={days === r}
              className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                days === r ? "bg-ink text-white" : "text-ink/50 hover:bg-line/60"
              }`}
            >
              {r} días
            </button>
          ))}
        </div>
      </div>

      {summary === null ? (
        <div className="mt-3 h-16 animate-pulse rounded-xl bg-line/50" />
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-1">
            <div>
              <p className="text-3xl font-extrabold tabular-nums">{formatUsd(summary.revenueUsd)}</p>
              <p className="text-xs text-ink/50">
                {summary.orders} {summary.orders === 1 ? "pedido" : "pedidos"} · + {formatUsd(summary.shippingUsd)} de envío
              </p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums text-deep">{formatUsd(summary.profitUsd)}</p>
              <p className="text-xs text-ink/50">
                ganancia{summary.marginPct !== null && ` · margen ${summary.marginPct}%`}
              </p>
            </div>
          </div>
          {summary.itemsWithoutCost > 0 && (
            <p className="mt-2 text-xs text-brand-dark">
              {summary.itemsWithoutCost} {summary.itemsWithoutCost === 1 ? "unidad vendida" : "unidades vendidas"} sin
              costo cargado: no cuentan en la ganancia.
            </p>
          )}
        </>
      )}
    </section>
  );
}
