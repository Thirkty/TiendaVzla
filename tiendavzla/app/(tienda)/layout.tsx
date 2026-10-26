// Layout de la tienda: navbar, footer, carrito y botón de WhatsApp (el admin no los usa).
import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import WhatsAppButton from "@/components/WhatsAppButton";

export default function StoreLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
      <CartDrawer />
      <WhatsAppButton />
    </>
  );
}
