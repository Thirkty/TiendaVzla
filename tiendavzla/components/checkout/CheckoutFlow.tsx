"use client";
// CheckoutFlow: orquesta los tres pasos del checkout.
//   1. Datos  -> crea una orden PENDING por vendedor y vacía el carrito.
//   2. Pago   -> un Pago Móvil por vendedor, cada uno con su referencia
//                (PAYMENT_SUBMITTED). Vencen si no se pagan a tiempo.
//   3. Listo  -> cada vendedor verifica su pago y despacha.
// Las órdenes pendientes se guardan en sessionStorage para no perderlas al recargar.

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

function readPendingOrders(): Order[] | null {
  try {
    const raw = sessionStorage.getItem(PENDING_ORDER_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    // Formato anterior (una sola orden sin vendedor): se descarta.
    return Array.isArray(parsed) ? (parsed as Order[]) : null;
  } catch {
    return null;
  }
}

function savePendingOrders(orders: Order[] | null) {
  try {
    if (orders) sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(orders));
    else sessionStorage.removeItem(PENDING_ORDER_KEY);
  } catch {
    // Sin sessionStorage el flujo sigue funcionando; solo no sobrevive a una recarga.
  }
}

const allSubmitted = (orders: Order[]) => orders.every((o) => o.status !== "PENDING");

export default function CheckoutFlow() {
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const router = useRouter();

  const [step, setStep] = useState<Step>("loading");
  const [orders, setOrders] = useState<Order[]>([]);

  // Esperamos a que el carrito se cargue de localStorage antes de decidir qué mostrar.
  useEffect(() => {
    const start = () => {
      const pending = readPendingOrders();
      if (pending && pending.length > 0 && !allSubmitted(pending)) {
        setOrders(pending);
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

  const handleCreated = (created: Order[]) => {
    savePendingOrders(created);
    setOrders(created);
    setStep("pay");
    clearCart(); // el stock ya quedó reservado en el backend
  };

  const handleUpdated = (updated: Order) => {
    const next = orders.map((o) => (o.id === updated.id ? updated : o));
    setOrders(next);
    if (allSubmitted(next)) {
      savePendingOrders(null);
      setStep("done");
    } else {
      savePendingOrders(next);
    }
  };

  const handleExpired = () => {
    savePendingOrders(null);
    setOrders([]);
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
                <OrderSummary items={items} />
              </div>
            </div>
          )}

          {step === "pay" && (
            <div className="mx-auto max-w-3xl">
              <PagoMovilStep orders={orders} onUpdated={handleUpdated} onExpired={handleExpired} />
            </div>
          )}

          {step === "done" && <OrdersConfirmed orders={orders} />}
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

/** 04141234567 -> https://wa.me/584141234567 */
const whatsappLink = (phone: string) => `https://wa.me/58${phone.replace(/^0/, "")}`;

function OrdersConfirmed({ orders }: { orders: Order[] }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center text-center">
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 16 }}
      >
        <CircleCheck className="size-20 text-success" strokeWidth={1.5} />
      </motion.div>
      <h2 className="mt-4 text-3xl font-bold tracking-tight">
        {orders.length > 1 ? "¡Recibimos tus referencias!" : "¡Recibimos tu referencia!"}
      </h2>
      <p className="mt-2 text-ink/60">
        {orders.length > 1 ? "Cada vendedor verifica su pago" : "El vendedor verifica el pago"} en el
        banco y te escribe por WhatsApp para coordinar el envío.
      </p>

      <ul className="mt-6 w-full space-y-3 text-left">
        {orders.map((order) => (
          <li key={order.id} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold">{order.seller.storeName}</p>
                <p className="text-sm text-ink/60">
                  Pedido #{order.id.slice(0, 8).toUpperCase()} · {formatBs(order.totalVes)} · Ref.{" "}
                  {order.paymentReference}
                </p>
              </div>
              <a
                href={whatsappLink(order.seller.whatsapp)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-whatsapp px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <MessageCircle className="size-4" />
                Escribir
              </a>
            </div>
            <p className="mt-2 text-sm text-ink/70">
              {order.items.map((i) => `${i.quantity}× ${i.product.name}`).join(" · ")}
            </p>
          </li>
        ))}
      </ul>

      <Link
        href="/"
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-white py-3.5 font-semibold transition hover:bg-line/50"
      >
        <ArrowLeft className="size-4" />
        Seguir comprando
      </Link>
    </div>
  );
}
