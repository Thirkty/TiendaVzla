"use client";
// HeroSection: portada con badge de envío nacional, titular, subtítulo y CTA al catálogo.

import { motion, type Variants } from "framer-motion";
import { ArrowDown, ShieldCheck, Smartphone, Truck } from "lucide-react";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15, delayChildren: 0.2 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const PERKS = [
  { icon: Truck, label: "Entrega en 48h" },
  { icon: Smartphone, label: "Paga con Pago Móvil" },
  { icon: ShieldCheck, label: "Compra segura" },
] as const;

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-linear-to-br from-brand/10 via-cream to-deep/10">
      {/* Manchas decorativas */}
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-brand/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-deep/10 blur-3xl" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative mx-auto flex max-w-6xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28"
      >
        <motion.span
          variants={item}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-white/80 px-4 py-1.5 text-sm font-semibold text-deep shadow-sm"
        >
          🇻🇪 Envío nacional
        </motion.span>

        <motion.h1
          variants={item}
          className="mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl"
        >
          Lo que necesitas, <span className="text-brand">a tu puerta en 48h</span>
        </motion.h1>

        <motion.p variants={item} className="mt-5 max-w-xl text-lg leading-relaxed text-ink/70">
          Productos prácticos para tu casa y tu rutina, con precios claros en dólares y bolívares.
          Pides hoy, lo recibes en un par de días.
        </motion.p>

        <motion.div variants={item} className="mt-8">
          <a
            href="#catalogo"
            className="inline-flex items-center gap-2 rounded-2xl bg-brand px-7 py-3.5 font-semibold text-white shadow-sm transition hover:bg-brand-dark hover:shadow-lg"
          >
            Ver catálogo
            <ArrowDown className="size-4" />
          </a>
        </motion.div>

        <motion.ul variants={item} className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-3">
          {PERKS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2 text-sm font-medium text-ink/60">
              <Icon className="size-4 text-success" />
              {label}
            </li>
          ))}
        </motion.ul>
      </motion.div>
    </section>
  );
}
