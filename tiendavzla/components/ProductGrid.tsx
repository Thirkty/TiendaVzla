"use client";
// ProductGrid: resuelve la promesa de productos y los muestra en una grilla responsive
// con entrada escalonada al hacer scroll. Incluye el esqueleto de carga.

import { use } from "react";
import { motion } from "framer-motion";
import type { ProductGridProps } from "@/lib/api/types";
import ProductCard from "./ProductCard";

const GRID_CLASSES = "grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3";

export default function ProductGrid({ productsPromise }: ProductGridProps) {
  const products = use(productsPromise);

  if (products.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line py-16 text-center text-ink/60">
        Pronto tendremos productos nuevos para ti. 📦
      </p>
    );
  }

  return (
    <ul className={GRID_CLASSES}>
      {products.map((product, index) => (
        <motion.li
          key={product.id}
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: (index % 3) * 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          <ProductCard product={product} />
        </motion.li>
      ))}
    </ul>
  );
}

/** Placeholder mientras llegan los productos (mientras responde la API). */
export function ProductGridSkeleton() {
  return (
    <ul className={GRID_CLASSES} aria-busy="true" aria-label="Cargando productos">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="animate-pulse rounded-2xl border border-line bg-white p-3 shadow-sm">
          <div className="aspect-square rounded-2xl bg-line/70" />
          <div className="space-y-3 px-2 pb-2 pt-4">
            <div className="h-5 w-3/4 rounded-full bg-line/70" />
            <div className="h-4 w-full rounded-full bg-line/50" />
            <div className="h-4 w-2/3 rounded-full bg-line/50" />
            <div className="h-7 w-24 rounded-full bg-line/70" />
            <div className="h-12 w-full rounded-xl bg-line/70" />
          </div>
        </li>
      ))}
    </ul>
  );
}
