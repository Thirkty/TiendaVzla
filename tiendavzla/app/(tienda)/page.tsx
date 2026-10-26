// Home: hero editorial con categorías + catálogo. Pide los productos a la API una vez y
// comparte la promesa: las categorías la resuelven en el servidor y el grid con `use()`.
import { Suspense } from "react";
import CategoryWindows, { CategoryWindowsSkeleton } from "@/components/CategoryWindows";
import HeroSection from "@/components/HeroSection";
import ProductGrid, { ProductGridSkeleton } from "@/components/ProductGrid";
import { getProducts } from "@/lib/api/client";

export default function HomePage() {
  const productsPromise = getProducts();

  return (
    <>
      <HeroSection>
        <Suspense fallback={<CategoryWindowsSkeleton />}>
          <CategoryWindows productsPromise={productsPromise} />
        </Suspense>
      </HeroSection>

      <section id="catalogo" className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">
        <div className="mb-10 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand">Catálogo</p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              Pensado para el día a día
            </h2>
          </div>
          <p className="max-w-sm text-ink/60">
            Productos probados que resuelven problemas reales: luz, agua, orden y descanso.
          </p>
        </div>

        <Suspense fallback={<ProductGridSkeleton />}>
          <ProductGrid productsPromise={productsPromise} />
        </Suspense>
      </section>
    </>
  );
}
