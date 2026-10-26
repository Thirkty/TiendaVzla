// Panel del vendedor: sus productos y los datos de su tienda.
import type { Metadata } from "next";
import SellerDashboard from "@/components/seller/SellerDashboard";

export const metadata: Metadata = {
  title: "Mi tienda | TiendaVzla",
  robots: { index: false, follow: false },
};

export default function SellerPage() {
  return <SellerDashboard />;
}
