import type { Metadata } from "next";
import SellerSignup from "@/components/account/SellerSignup";

export const metadata: Metadata = {
  title: "Vende en TiendaVzla",
  description: "Abre tu tienda y vende a toda Venezuela. Recibe los pagos directo en tu Pago Móvil.",
};

export default function SellPage() {
  return <SellerSignup />;
}
