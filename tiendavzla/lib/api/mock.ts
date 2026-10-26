// Fuente de datos única (mock). Cuando exista el backend real,
// solo se reemplaza la implementación de estas funciones.
import type { Product } from "./types";

const delay = (ms = 500) => new Promise<void>((r) => setTimeout(r, ms));

const image = (seed: string) => `https://picsum.photos/seed/${seed}/600/600`;

const PRODUCTS: Product[] = [
  {
    id: "p-001",
    slug: "ventilador-recargable-led",
    name: "Ventilador Recargable 12\" con Luz LED",
    description:
      "Hasta 8 horas de autonomía con una sola carga. Tu aliado para dormir fresco cuando se va la luz, con 3 velocidades y lámpara LED integrada.",
    priceUsd: 34.99,
    stock: 15,
    imageUrl: image("ventilador-recargable"),
    badge: "Más vendido",
  },
  {
    id: "p-002",
    slug: "lampara-solar-sensor",
    name: "Lámpara Solar con Sensor de Movimiento",
    description:
      "Se carga sola con el sol y se enciende al detectar movimiento. Ideal para el patio, la entrada o el estacionamiento. Resistente a la lluvia.",
    priceUsd: 19.99,
    stock: 25,
    imageUrl: image("lampara-solar"),
    badge: "Ahorra luz",
  },
  {
    id: "p-003",
    slug: "organizador-nevera-6-piezas",
    name: "Set Organizador de Nevera (6 piezas)",
    description:
      "Contenedores transparentes apilables para que la comida dure más y encuentres todo de un vistazo. Libres de BPA y fáciles de lavar.",
    priceUsd: 16.5,
    stock: 30,
    imageUrl: image("organizador-nevera"),
  },
  {
    id: "p-004",
    slug: "masajeador-cervical-electrico",
    name: "Masajeador Cervical Eléctrico",
    description:
      "Alivia la tensión de cuello y espalda después de un día largo. Función de calor, 6 modos de intensidad y batería recargable por USB.",
    priceUsd: 27.9,
    stock: 10,
    imageUrl: image("masajeador-cervical"),
    badge: "Nuevo",
  },
  {
    id: "p-005",
    slug: "power-bank-solar-20000",
    name: "Power Bank Solar 20.000 mAh",
    description:
      "Carga tu teléfono hasta 5 veces. Panel solar de respaldo, linterna incorporada y dos puertos USB para que nunca te quedes incomunicado.",
    priceUsd: 29.99,
    stock: 4,
    imageUrl: image("power-bank-solar"),
    badge: "Últimas unidades",
  },
  {
    id: "p-006",
    slug: "filtro-agua-grifo",
    name: "Filtro de Agua para Grifo",
    description:
      "Reduce cloro, sedimentos y mal sabor directo desde la llave. Instalación en minutos, sin herramientas y con cartucho de larga duración.",
    priceUsd: 14.99,
    stock: 20,
    imageUrl: image("filtro-agua"),
  },
];

export async function getProducts(): Promise<Product[]> {
  await delay();
  return PRODUCTS;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  await delay();
  return PRODUCTS.find((p) => p.slug === slug) ?? null;
}
