"use client";
// CartDrawer: panel lateral del carrito con overlay, items editables, subtotal USD/VES,
// botón "Ir a pagar" (lleva a /checkout) y estado vacío.

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { selectTotalItems, useCartStore } from "@/lib/store/cart";
import { cartTotals, groupBySeller } from "@/lib/store/groups";
import { formatUsd } from "@/lib/utils/format";
import { VesAmount } from "./RateProvider";

export default function CartDrawer() {
  const isOpen = useCartStore((s) => s.isOpen);
  const items = useCartStore((s) => s.items);
  const totalItems = useCartStore(selectTotalItems);
  const groups = groupBySeller(items);
  const totals = cartTotals(groups);
  const closeCart = useCartStore((s) => s.closeCart);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const router = useRouter();

  // Cerrar con Escape y bloquear el scroll del fondo mientras está abierto.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, closeCart]);

  const goToCatalog = () => {
    closeCart();
    const catalog = document.getElementById("catalogo");
    if (catalog) catalog.scrollIntoView({ behavior: "smooth" });
    else router.push("/#catalogo");
  };

  const goToCheckout = () => {
    closeCart();
    router.push("/checkout");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="cart-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={closeCart}
            aria-hidden
            className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-[2px]"
          />

          <motion.aside
            key="cart-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Carrito de compras"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-cream shadow-2xl"
          >
            {/* Encabezado */}
            <header className="flex items-center justify-between border-b border-line px-6 py-5">
              <div>
                <h2 className="text-xl font-bold">Tu carrito</h2>
                <p className="text-sm text-ink/50">
                  {totalItems} {totalItems === 1 ? "producto" : "productos"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCart}
                aria-label="Cerrar carrito"
                className="rounded-full p-2 text-ink/60 transition-colors hover:bg-line hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </header>

            {items.length === 0 ? (
              /* Estado vacío */
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
                <span
                  className="text-6xl"
                  role="img"
                  aria-label="Carrito vacío"
                >
                  🛒
                </span>
                <div>
                  <p className="text-lg font-bold">Tu carrito está vacío</p>
                  <p className="mt-1 text-ink/60">
                    Échale un ojo al catálogo, seguro hay algo que te resuelve
                    el día.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={goToCatalog}
                  className="mt-2 rounded-2xl bg-brand px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-dark hover:shadow-lg"
                >
                  Ver catálogo
                </button>
              </div>
            ) : (
              <>
                {/* Items agrupados por vendedor: cada grupo es un pedido y un pago aparte */}
                <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                  {groups.map((group) => (
                    <section key={group.seller.id}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/50">
                        {group.seller.storeName}
                      </p>
                      <ul className="space-y-3">
                        <AnimatePresence initial={false}>
                          {group.items.map(({ product, quantity }) => (
                            <motion.li
                              key={product.id}
                              layout
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: 48 }}
                              transition={{ duration: 0.25 }}
                              className="flex gap-4 rounded-2xl border border-line bg-white p-3 shadow-sm"
                            >
                              <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-line/50">
                                <Image
                                  src={product.imageUrl}
                                  alt={product.name}
                                  fill
                                  sizes="80px"
                                  className="object-cover"
                                />
                              </div>

                              <div className="flex min-w-0 flex-1 flex-col">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="line-clamp-2 text-sm font-semibold leading-snug">
                                    {product.name}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => removeItem(product.id)}
                                    aria-label={`Eliminar ${product.name}`}
                                    className="shrink-0 rounded-lg p-1 text-ink/40 transition-colors hover:bg-brand/10 hover:text-brand"
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                </div>

                                <div className="mt-auto flex items-center justify-between pt-2">
                                  <div className="flex items-center rounded-full border border-line">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateQuantity(product.id, quantity - 1)
                                      }
                                      disabled={quantity <= 1}
                                      aria-label="Restar uno"
                                      className="rounded-full p-1.5 transition-colors hover:bg-line disabled:cursor-not-allowed disabled:opacity-30"
                                    >
                                      <Minus className="size-3.5" />
                                    </button>
                                    <span className="w-8 text-center text-sm font-semibold tabular-nums">
                                      {quantity}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateQuantity(product.id, quantity + 1)
                                      }
                                      disabled={quantity >= product.stock}
                                      aria-label="Sumar uno"
                                      className="rounded-full p-1.5 transition-colors hover:bg-line disabled:cursor-not-allowed disabled:opacity-30"
                                    >
                                      <Plus className="size-3.5" />
                                    </button>
                                  </div>
                                  <p className="font-bold tabular-nums">
                                    {formatUsd(product.priceUsd * quantity)}
                                  </p>
                                </div>
                                {quantity >= product.stock && (
                                  <p className="mt-1 text-xs text-brand">
                                    Máximo disponible
                                  </p>
                                )}
                              </div>
                            </motion.li>
                          ))}
                        </AnimatePresence>
                      </ul>
                      <p className="mt-2 flex justify-between px-1 text-sm text-ink/60">
                        <span>Envío</span>
                        <span className="tabular-nums">
                          {group.shippingUsd > 0
                            ? formatUsd(group.shippingUsd)
                            : "Gratis"}
                        </span>
                      </p>
                    </section>
                  ))}
                </div>

                {/* Resumen */}
                <footer className="border-t border-line bg-white px-6 py-5">
                  {totals.shippingUsd > 0 && (
                    <p className="flex justify-between text-sm text-ink/60">
                      <span>
                        Productos {formatUsd(totals.subtotalUsd)} + envío
                      </span>
                      <span className="tabular-nums">
                        {formatUsd(totals.shippingUsd)}
                      </span>
                    </p>
                  )}
                  <div className="flex items-baseline justify-between">
                    <span className="text-ink/60">Total</span>
                    <span className="text-2xl font-bold tabular-nums">
                      {formatUsd(totals.totalUsd)}
                    </span>
                  </div>
                  <VesAmount
                    usd={totals.totalUsd}
                    className="text-right text-sm text-ink/50"
                  />

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={goToCheckout}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 font-semibold text-white shadow-sm transition hover:bg-brand-dark hover:shadow-lg"
                  >
                    <ShoppingBag className="size-5" />
                    Ir a pagar
                  </motion.button>
                  <p className="mt-3 text-center text-xs text-ink/50">
                    {groups.length > 1
                      ? `${groups.length} vendedores · un Pago Móvil a cada uno`
                      : "Pagas por Pago Móvil directo al vendedor"}
                  </p>
                </footer>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
