"use client";
// CheckoutFlow: orquesta los tres pasos del checkout.
//   1. Datos  -> crea la orden (PENDING) y vacía el carrito.
//   2. Pago   -> Pago Móvil + referencia (PAYMENT_SUBMITTED). Vence si no pagan a tiempo.
//   3. Listo  -> "estamos verificando tu pago" (el admin lo aprueba desde /admin).
// La orden pendiente se guarda en sessionStorage para no perderla si recargan la página.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CircleCheck, MessageCircle } from "lucide-react";
import type { Order } from "@/lib/api/types";
import { PENDING_ORDER_KEY } from "@/lib/payment";
import { useCartStore } from "@/lib/store/cart";
import { formatBs } from "@/lib/utils/format";
import CheckoutForm from "./CheckoutForm";
import OrderSummary from "./OrderSummary";
import PagoMovilStep from "./PagoMovilStep";

type Step = "loading" | "form" | "pay" | "done";

const STEPS: ReadonlyArray<{ key: Exclude<Step, "loading">; label: string }> = [
  { key: "form", label: "Datos" },
  { key: "pay", label: "Pago" },
  { key: "done", label: "Listo" },
];

function readPendingOrder(): Order | null {
  try {
    const raw = sessionStorage.getItem(PENDING_ORDER_KEY);
    return raw ? (JSON.parse(raw) as Order) : null;
  } catch {
    return null;
  }
}

function savePendingOrder(order: Order | null) {
  try {
    if (order) sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(order));
    else sessionStorage.removeItem(PENDING_ORDER_KEY);
  } catch {
    // Sin sessionStorage el flujo sigue funcionando; solo no sobrevive a una recarga.
  }
}

export default function CheckoutFlow() {
  const items = useCartStore((s) => s.items);
  const totalUsd = useCartStore((s) => s.totalUsd());
  const clearCart = useCartStore((s) => s.clearCart);
  const router = useRouter();

  const [step, setStep] = useState<Step>("loading");
  const [order, setOrder] = useState<Order | null>(null);

  // Esperamos a que el carrito se cargue de localStorage antes de decidir qué mostrar.
  useEffect(() => {
    const start = () => {
      const pending = readPendingOrder();
      if (pending?.status === "PENDING") {
        setOrder(pending);
        setStep("pay");
      } else {
        setStep("form");
      }
    };
    if (useCartStore.persist.hasHydrated()) start();
    return useCartStore.persist.onFinishHydration(start);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const handleCreated = (created: Order) => {
    savePendingOrder(created);
    setOrder(created);
    setStep("pay");
    clearCart(); // el stock ya quedó reservado en el backend
  };

  const handlePaid = (paid: Order) => {
    savePendingOrder(null);
    setOrder(paid);
    setStep("done");
  };

  const handleExpired = () => {
    savePendingOrder(null);
    setOrder(null);
    router.push("/#catalogo");
  };

  if (step === "loading") {
    return <div className="h-96 animate-pulse rounded-2xl bg-line/50" aria-busy="true" />;
  }

  if (step === "form" && items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="text-6xl" role="img" aria-label="Carrito vacío">
          🛒
        </span>
        <p className="text-lg font-bold">Tu carrito está vacío</p>
        <Link
          href="/#catalogo"
          className="rounded-2xl bg-brand px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-dark"
        >
          Ver catálogo
        </Link>
      </div>
    );
  }

  return (
    <>
      <Stepper current={step} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.25 }}
          className="mt-8"
        >
          {step === "form" && (
            <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
              <CheckoutForm items={items} onCreated={handleCreated} />
              <div className="lg:sticky lg:top-24">
                <OrderSummary items={items} totalUsd={totalUsd} />
              </div>
            </div>
          )}

          {step === "pay" && order && (
            <div className="mx-auto max-w-lg">
              <PagoMovilStep order={order} onPaid={handlePaid} onExpired={handleExpired} />
            </div>
          )}

          {step === "done" && order && <OrderConfirmed order={order} />}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

function Stepper({ current }: { current: Exclude<Step, "loading"> }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex items-center gap-2 text-sm font-semibold">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          <span
            className={`flex size-7 items-center justify-center rounded-full text-xs ${
              i <= currentIndex ? "bg-brand text-white" : "bg-line text-ink/50"
            }`}
          >
            {i + 1}
          </span>
          <span className={i <= currentIndex ? "text-ink" : "text-ink/40"}>{s.label}</span>
          {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-line sm:w-10" />}
        </li>
      ))}
    </ol>
  );
}

function OrderConfirmed({ order }: { order: Order }) {
  const shortId = order.id.slice(0, 8).toUpperCase();
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center text-center">
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 16 }}
      >
        <CircleCheck className="size-20 text-success" strokeWidth={1.5} />
      </motion.div>
      <h2 className="mt-4 text-3xl font-bold tracking-tight">¡Recibimos tu referencia!</h2>
      <p className="mt-2 text-ink/60">
        Pedido <span className="font-semibold text-ink">#{shortId}</span> por{" "}
        <span className="font-semibold text-ink">{formatBs(order.totalVes)}</span> · Referencia{" "}
        <span className="font-semibold text-ink">{order.paymentReference}</span>
      </p>
      <p className="mt-4 rounded-2xl border border-line bg-white px-5 py-4 text-sm text-ink/70">
        Estamos verificando el pago en el banco. Apenas se confirme te escribimos por WhatsApp
        para coordinar el envío, que llega en unas 48 horas.
      </p>

      <ul className="mt-6 w-full space-y-2 text-left text-sm">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-3">
            <span className="text-ink/70">
              {item.quantity} × {item.product.name}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-white py-3.5 font-semibold transition hover:bg-line/50"
        >
          <ArrowLeft className="size-4" />
          Seguir comprando
        </Link>
        <Link
          href="/#contacto"
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-whatsapp py-3.5 font-semibold text-white transition hover:opacity-90"
        >
          <MessageCircle className="size-4" />
          ¿Dudas? Escríbenos
        </Link>
      </div>
    </div>
  );
}
