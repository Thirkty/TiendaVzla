// Layout raíz: fuente, metadatos y tasa BCV. La tienda pone su navbar/footer en app/(tienda)/layout.tsx.
import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { RateProvider } from "@/components/RateProvider";
import { getRate } from "@/lib/api/client";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

// Serif editorial para titulares (en especial su cursiva), al estilo de revista.
const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument",
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

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const rate = await getRate();

  return (
    <html lang="es" className={`${jakarta.variable} ${instrumentSerif.variable}`}>
      <body className="min-h-dvh bg-cream font-sans text-base leading-relaxed text-ink antialiased">
        <RateProvider rate={rate?.rate ?? null}>{children}</RateProvider>
      </body>
    </html>
  );
}
