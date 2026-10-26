// CategoryWindows: categorías del catálogo como "ventanas" de avión (marco con bisel y
// una cortinilla que sube al pasar el mouse), en un carrusel horizontal con scroll-snap.
// Componente de servidor: arma las categorías con los productos que ya pide la portada,
// así no hay pedidos extra ni JavaScript en el navegador.
import Image from "next/image";
import type { Product } from "@/lib/api/types";

const MAX_WINDOWS = 8;

interface Category {
  name: string;
  count: number;
  imageUrl: string;
}

function toCategories(products: Product[]): Category[] {
  const byName = new Map<string, Category>();
  for (const p of products) {
    const name = p.category?.trim() || "Más productos";
    const current = byName.get(name);
    if (current) current.count += 1;
    else byName.set(name, { name, count: 1, imageUrl: p.imageUrl });
  }
  return [...byName.values()].sort((a, b) => b.count - a.count).slice(0, MAX_WINDOWS);
}

export default async function CategoryWindows({
  productsPromise,
}: {
  productsPromise: Promise<Product[]>;
}) {
  const categories = toCategories(await productsPromise);
  if (categories.length === 0) return null;

  return (
    <nav aria-label="Categorías" className="fade-up mt-12 [animation-delay:240ms]">
      <ul className="no-scrollbar mx-auto flex max-w-6xl snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-10 sm:gap-6 sm:px-6">
        {categories.map((category, i) => (
          <li key={category.name} className="shrink-0 snap-start">
            <a href="#catalogo" className="group block w-36 text-center sm:w-48">
              <Window imageUrl={category.imageUrl} priority={i < 3} />
              <p className="mt-3 font-serif text-xl italic leading-none">{category.name}</p>
              <p className="mt-1 text-xs font-medium text-ink/50">
                {category.count} {category.count === 1 ? "producto" : "productos"}
              </p>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Window({ imageUrl, priority }: { imageUrl: string; priority: boolean }) {
  return (
    // Bisel: degradado gris que simula el marco de plástico de la ventana.
    <div className="rounded-[4.5rem] bg-linear-to-b from-white to-mist-dark p-2.5 shadow-[0_10px_30px_-12px_rgba(26,26,26,0.35)] transition-transform duration-300 group-hover:-translate-y-1 sm:p-3">
      <div className="relative aspect-[3/4] overflow-hidden rounded-[4rem] bg-mist-dark shadow-[inset_0_0_0_3px_rgba(255,255,255,0.6)]">
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 144px, 192px"
          priority={priority}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Cortinilla: baja un poco y sube al pasar el mouse */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[22%] bg-linear-to-b from-white/95 to-white/70 shadow-[0_2px_6px_rgba(0,0,0,0.12)] transition-transform duration-500 group-hover:-translate-y-full motion-reduce:transition-none"
        />
        {/* Reflejo del vidrio */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[4rem] bg-linear-to-tr from-transparent via-white/0 to-white/25"
        />
      </div>
    </div>
  );
}

export function CategoryWindowsSkeleton() {
  return (
    <div className="mx-auto mt-12 flex max-w-6xl gap-4 overflow-hidden px-4 pb-10 sm:gap-6 sm:px-6">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="w-36 shrink-0 sm:w-48">
          <div className="aspect-[3/4] animate-pulse rounded-[4.5rem] bg-mist-dark" />
          <div className="mx-auto mt-3 h-4 w-20 rounded-full bg-mist-dark" />
        </div>
      ))}
    </div>
  );
}
