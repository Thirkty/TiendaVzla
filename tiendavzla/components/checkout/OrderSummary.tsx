// OrderSummary: resumen del carrito con el envío y el total en USD y Bs. Se agrupa por
// tienda (hoy hay una sola; con varias, cada grupo sería un pedido y un pago aparte).

import Image from "next/image";
import type { CartItem } from "@/lib/api/types";
import { cartTotals, groupBySeller } from "@/lib/store/groups";
import { formatUsd } from "@/lib/utils/format";
import { VesAmount } from "../RateProvider";

export default function OrderSummary({ items }: { items: CartItem[] }) {
  const groups = groupBySeller(items);
  const totals = cartTotals(groups);

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold">Tu pedido</h2>

      <div className="mt-4 space-y-5">
        {groups.map((group) => (
          <div key={group.seller.id}>
            {groups.length > 1 && (
              <p className="text-xs font-semibold uppercase tracking-wider text-ink/50">
                {group.seller.storeName}
              </p>
            )}
            <ul className="mt-2 space-y-3">
              {group.items.map(({ product, quantity }) => (
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
            <p className="mt-2 flex justify-between text-sm text-ink/60">
              <span>Envío</span>
              <span className="tabular-nums">
                {group.shippingUsd > 0 ? formatUsd(group.shippingUsd) : "Gratis"}
              </span>
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-ink/60">Total</span>
          <span className="text-2xl font-bold tabular-nums">{formatUsd(totals.totalUsd)}</span>
        </div>
        <VesAmount usd={totals.totalUsd} className="text-right text-sm text-ink/50" />
        <p className="mt-3 text-xs text-ink/50">
          {groups.length > 1
            ? `Le compras a ${groups.length} tiendas: harás un Pago Móvil a cada una. `
            : ""}
          El monto en bolívares se fija con la tasa BCV al confirmar el pedido.
        </p>
      </div>
    </section>
  );
}
