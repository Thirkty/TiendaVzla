"use client";
// ProductCard: tarjeta de producto con imagen, badge, descripción, precio USD/VES y botón "Agregar".

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus } from "lucide-react";
import type { ProductCardProps } from "@/lib/api/types";
import { useCartStore } from "@/lib/store/cart";
import { formatUsd } from "@/lib/utils/format";
import { VesAmount } from "./RateProvider";

export default function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);
  const inCart = useCartStore(
    (s) => s.items.find((i) => i.product.id === product.id)?.quantity ?? 0,
  );

  const [added, setAdded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const maxReached = inCart >= product.stock;
  const lowStock = product.stock <= 5;

  const handleAdd = () => {
    if (!addItem(product)) return;
    setAdded(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setAdded(false), 1400);
  };

  return (
    <motion.article
      initial="rest"
      animate="rest"
      whileHover="hover"
      variants={{
        rest: { y: 0 },
        hover: { y: -4, transition: { type: "spring", stiffness: 300, damping: 20 } },
      }}
      className="flex h-full flex-col rounded-2xl border border-line bg-white p-3 shadow-sm transition-shadow duration-300 hover:shadow-lg"
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-line/50">
        <motion.div
          variants={{ rest: { scale: 1 }, hover: { scale: 1.05 } }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        </motion.div>

        {product.badge && (
          <span className="absolute left-3 top-3 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white shadow-sm">
            {product.badge}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-2 pb-2 pt-4">
        <h3 className="text-lg font-bold leading-snug">{product.name}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink/60">
          {product.description}
        </p>

        <div className="mt-auto pt-4">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-2xl font-bold tracking-tight">{formatUsd(product.priceUsd)}</p>
              <VesAmount usd={product.priceUsd} className="text-sm text-ink/50" />
            </div>
            {lowStock && (
              <span className="text-xs font-semibold text-brand">Quedan {product.stock}</span>
            )}
          </div>

          <motion.button
            type="button"
            onClick={maxReached && !added ? openCart : handleAdd}
            animate={added ? { scale: [1, 1.07, 0.97, 1] } : { scale: 1 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            whileTap={{ scale: 0.97 }}
            className={`mt-4 flex w-full items-center justify-center rounded-xl py-3 font-semibold transition-colors ${
              added
                ? "bg-success text-white"
                : maxReached
                  ? "bg-line text-ink/60 hover:bg-line/70"
                  : "bg-brand text-white hover:bg-brand-dark"
            }`}
          >
            <AnimatePresence mode="wait" initial={false}>
              {added ? (
                <motion.span
                  key="added"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-2"
                >
                  <Check className="size-5" strokeWidth={3} />
                  Agregado
                </motion.span>
              ) : (
                <motion.span
                  key={maxReached ? "max" : "add"}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-2"
                >
                  {maxReached ? (
                    "Máximo en el carrito · Ver"
                  ) : (
                    <>
                      <Plus className="size-5" strokeWidth={2.5} />
                      Agregar
                    </>
                  )}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}
