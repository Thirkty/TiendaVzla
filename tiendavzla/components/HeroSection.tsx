// HeroSection: portada editorial (titular sans + cursiva serif, fondo gris cálido) con
// un espacio para el carrusel de categorías. Sin JavaScript: las entradas son
// animaciones CSS que se apagan con "reducir movimiento".
import type { ReactNode } from "react";
import { ArrowDown, ShieldCheck, Smartphone, Truck } from "lucide-react";

const PERKS = [
  { icon: Truck, label: "Envíos a toda Venezuela" },
  { icon: Smartphone, label: "Pagas por Pago Móvil" },
  { icon: ShieldCheck, label: "Compra segura" },
] as const;

export default function HeroSection({ children }: { children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-mist">
      <div className="mx-auto max-w-6xl px-4 pt-14 sm:px-6 sm:pt-20">
        <p className="fade-up text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">
          Tienda venezolana
        </p>
        <h1 className="fade-up mt-4 max-w-4xl text-[2.6rem] font-bold leading-[1.02] tracking-tight [animation-delay:80ms] sm:text-7xl">
          Lo que necesitas,{" "}
          <span className="whitespace-nowrap font-serif text-[1.12em] font-normal italic tracking-normal text-brand">
            a tu puerta
          </span>
        </h1>

        <div className="fade-up mt-6 flex flex-col gap-6 [animation-delay:160ms] sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-md text-lg leading-relaxed text-ink/65">
            Productos útiles para tu casa y tu rutina. Precios claros en dólares y bolívares, y
            pagas fácil por Pago Móvil.
          </p>
          <a
            href="#catalogo"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-6 py-3 font-semibold text-white transition hover:bg-ink/85"
          >
            Ver catálogo
            <ArrowDown className="size-4" />
          </a>
        </div>
      </div>

      {children}

      <div className="mx-auto flex max-w-6xl flex-col gap-4 border-t border-mist-dark px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {PERKS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2 text-sm font-medium text-ink/60">
              <Icon className="size-4 text-deep" />
              {label}
            </li>
          ))}
        </ul>
        <p className="font-serif text-xl text-ink/70">
          Hecho en Venezuela, <span className="italic">para Venezuela</span>
        </p>
      </div>
    </section>
  );
}
