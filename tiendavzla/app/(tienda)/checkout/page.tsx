// Checkout: datos del cliente -> Pago Móvil -> confirmación (ver CheckoutFlow).
import type { Metadata } from "next";
import CheckoutFlow from "@/components/checkout/CheckoutFlow";

export const metadata: Metadata = {
  title: "Finalizar compra | TiendaVzla",
};

export default function CheckoutPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6">
      <h1 className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl">Finalizar compra</h1>
      <CheckoutFlow />
    </section>
  );
}
