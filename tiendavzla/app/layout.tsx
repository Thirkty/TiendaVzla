// Layout raíz: fuente, metadatos y piezas globales (navbar, footer, carrito y WhatsApp).
import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import WhatsAppButton from "@/components/WhatsAppButton";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TiendaVzla | Lo que necesitas, a tu puerta en 48h",
  description:
    "Productos útiles para el día a día en Venezuela. Envío nacional en 48h y pago con Pago Móvil, transferencia o efectivo.",
};

export const viewport: Viewport = {
  themeColor: "#FAFAF7",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es" className={jakarta.variable}>
      <body className="min-h-dvh bg-cream font-sans text-base leading-relaxed text-ink antialiased">
        <Navbar />
        <main>{children}</main>
        <Footer />
        <CartDrawer />
        <WhatsAppButton />
      </body>
    </html>
  );
}
