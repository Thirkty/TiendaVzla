// Agrupa el carrito por vendedor: cada grupo será una orden y un Pago Móvil aparte.
// El envío de un vendedor es el MAYOR costo de envío de sus productos (un solo paquete),
// igual que lo calcula el backend en el checkout.
import type { CartItem, SellerSummary } from "@/lib/api/types";
import { roundMoney } from "@/lib/utils/format";

export interface SellerGroup {
  seller: SellerSummary;
  items: CartItem[];
  subtotalUsd: number;
  shippingUsd: number;
  totalUsd: number;
}

const UNKNOWN_SELLER: SellerSummary = { id: "?", storeName: "Vendedor", slug: "" };

export function groupBySeller(items: CartItem[]): SellerGroup[] {
  const groups = new Map<string, SellerGroup>();
  for (const item of items) {
    const seller = item.product.seller ?? UNKNOWN_SELLER;
    const group =
      groups.get(seller.id) ??
      ({ seller, items: [], subtotalUsd: 0, shippingUsd: 0, totalUsd: 0 } satisfies SellerGroup);
    group.items.push(item);
    group.subtotalUsd += item.product.priceUsd * item.quantity;
    group.shippingUsd = Math.max(group.shippingUsd, item.product.shippingCostUsd ?? 0);
    groups.set(seller.id, group);
  }
  return [...groups.values()].map((g) => ({
    ...g,
    subtotalUsd: roundMoney(g.subtotalUsd),
    shippingUsd: roundMoney(g.shippingUsd),
    totalUsd: roundMoney(g.subtotalUsd + g.shippingUsd),
  }));
}

export function cartTotals(groups: SellerGroup[]) {
  const subtotalUsd = roundMoney(groups.reduce((s, g) => s + g.subtotalUsd, 0));
  const shippingUsd = roundMoney(groups.reduce((s, g) => s + g.shippingUsd, 0));
  return { subtotalUsd, shippingUsd, totalUsd: roundMoney(subtotalUsd + shippingUsd) };
}
