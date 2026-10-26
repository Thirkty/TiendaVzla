"use client";
// Navbar: barra sticky con logo, enlaces, carrito con badge animado y "Mi cuenta" (login).
// También rehidrata el carrito guardado en localStorage al montar.

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShoppingBag, User } from "lucide-react";
import { selectTotalItems, useCartStore } from "@/lib/store/cart";

const NAV_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: "Catálogo", href: "/#catalogo" },
  { label: "Envíos", href: "/#envios" },
  { label: "Contacto", href: "/#contacto" },
];

export default function Navbar() {
  const totalItems = useCartStore(selectTotalItems);
  const openCart = useCartStore((s) => s.openCart);

  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="sticky top-0 z-40 border-b border-line/80 bg-cream/80 backdrop-blur-md"
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="/" className="text-xl font-extrabold tracking-tight text-brand">
          TiendaVzla
        </a>

        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm font-medium text-ink/70 transition-colors hover:text-brand"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCart}
            aria-label={`Abrir carrito (${totalItems} productos)`}
            className="relative rounded-full p-2.5 text-ink transition-colors hover:bg-line/70"
          >
            <ShoppingBag className="size-5" strokeWidth={2} />
            {totalItems > 0 && (
              <motion.span
                key={totalItems}
                initial={{ scale: 0.4 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 520, damping: 14 }}
                className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold leading-none text-white"
              >
                {totalItems}
              </motion.span>
            )}
          </button>

          <Link
            href="/entrar"
            className="inline-flex items-center gap-2 rounded-full bg-deep px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-deep/90 sm:px-4"
          >
            <User className="size-4" />
            <span className="hidden sm:inline">Mi cuenta</span>
          </Link>
        </div>
      </nav>
    </motion.header>
  );
}
