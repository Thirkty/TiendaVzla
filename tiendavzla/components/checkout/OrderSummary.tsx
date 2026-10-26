// OrderSummary: resumen de productos del carrito con subtotal en USD y su equivalente en Bs.

import Image from "next/image";
import type { CartItem } from "@/lib/api/types";
import { formatUsd } from "@/lib/utils/format";
import { VesAmount } from "../RateProvider";

interface OrderSummaryProps {
  items: CartItem[];
  totalUsd: number;
}

export default function OrderSummary({ items, totalUsd }: OrderSummaryProps) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold">Tu pedido</h2>

      <ul className="mt-4 space-y-3">
        {items.map(({ product, quantity }) => (
          <li key={product.id} className="flex items-center gap-3">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-line/50">
              <Image src={product.imageUrl} alt="" fill sizes="56px" className="object-cover" />
              <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-deep px-1 text-[11px] font-bold text-white">
                {quantity}
              </span>
            </div>
            <p className="line-clamp-2 flex-1 text-sm font-medium leading-snug">{product.name}</p>
            <p className="text-sm font-semibold tabular-nums">
              {formatUsd(product.priceUsd * quantity)}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-5 border-t border-line pt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-ink/60">Total</span>
          <span className="text-2xl font-bold tabular-nums">{formatUsd(totalUsd)}</span>
        </div>
        <VesAmount usd={totalUsd} className="text-right text-sm text-ink/50" />
        <p className="mt-3 text-xs text-ink/50">
          El monto final en bolívares se fija con la tasa BCV del momento en que confirmas el pedido.
        </p>
      </div>
    </section>
  );
}
